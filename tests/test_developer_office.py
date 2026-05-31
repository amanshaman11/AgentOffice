"""Unit tests for the Developer Office backend."""

from __future__ import annotations

import io
import json
import unittest
import zipfile
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

from src.lib.agents.developer.editor import EditorAgent
from src.lib.agents.developer.executor import ExecutorAgent
from src.lib.agents.developer.planner_agent import DeveloperPlannerAgent
from src.lib.agents.developer.qa import QAAgent
from src.lib.agents.developer.schemas import (
    CodeFile,
    DevPlanOutput,
    ExecutorOutput,
    Milestone,
    QAIssue,
    QAReport,
)
from src.lib.agents.orchestrator import Orchestrator, build_agents
from src.lib.agents.planner import (
    DEVELOPER_AGENT_SEQUENCE,
    default_developer_plan,
    plan_from_roster,
)
from src.lib.agents.schemas import AgentResult, Plan, PlanStep
from src.lib.project_packager import build_project_zip, extract_executor_files
from src.lib.server import app


def _dev_plan_json() -> str:
    return DevPlanOutput(
        goal="Build a todo app",
        tech_stack=["Next.js", "SQLite"],
        milestones=[Milestone(title="MVP", description="CRUD todos")],
        file_structure=["app/page.tsx"],
        tasks=["Create UI", "Add API"],
        acceptance_criteria=["User can add and delete todos"],
    ).model_dump_json()


def _executor_json() -> str:
    return ExecutorOutput(
        files=[
            CodeFile(
                path="index.html",
                content='<html><body><script src="./app.js"></script></body></html>',
                language="html",
            ),
            CodeFile(
                path="app.js",
                content='document.addEventListener("DOMContentLoaded", () => { console.log("ok"); });',
                language="js",
            ),
        ],
        dependencies=[],
        setup_instructions="Open index.html in a browser.",
    ).model_dump_json()


class PlanFromRosterTests(unittest.TestCase):
    def test_accepts_developer_roles(self) -> None:
        plan = plan_from_roster("Build a todo app", list(DEVELOPER_AGENT_SEQUENCE), "developer")
        self.assertEqual([s.agent for s in plan.steps], list(DEVELOPER_AGENT_SEQUENCE))
        self.assertIn("if qa fails, retry executor max 5 times", plan.fallback_rules)

    def test_rejects_unknown_developer_agent(self) -> None:
        with self.assertRaises(ValueError):
            plan_from_roster("Build a todo app", ["planner", "searcher"], "developer")

    def test_default_developer_plan(self) -> None:
        plan = default_developer_plan("Build a todo app")
        self.assertEqual(plan.goal, "Build a todo app")
        self.assertEqual(len(plan.steps), 3)
        self.assertEqual(plan.steps[-1].agent, "qa")
        self.assertTrue(plan.steps[-1].required)


class ProjectPackagerTests(unittest.TestCase):
    def test_build_project_zip_round_trip(self) -> None:
        files = [
            CodeFile(path="src/main.py", content="print('hi')", language="python"),
            CodeFile(path="README.md", content="# Demo", language="markdown"),
        ]
        archive = build_project_zip(files)
        with zipfile.ZipFile(io.BytesIO(archive)) as zf:
            self.assertEqual(set(zf.namelist()), {"src/main.py", "README.md"})
            self.assertEqual(zf.read("src/main.py").decode(), "print('hi')")

    def test_extract_executor_files(self) -> None:
        payload = _executor_json()
        extracted = extract_executor_files(payload)
        self.assertEqual(len(extracted), 2)
        paths = {f.path for f in extracted}
        self.assertIn("index.html", paths)
        self.assertIn("app.js", paths)

    def test_extract_executor_files_invalid_json(self) -> None:
        self.assertEqual(extract_executor_files("not json"), [])


class DeveloperAgentTests(unittest.TestCase):
    def test_planner_success(self) -> None:
        plan = DevPlanOutput(
            goal="Todo app",
            milestones=[Milestone(title="MVP", description="Core CRUD")],
            acceptance_criteria=["Todos persist"],
        )
        with patch("src.lib.agents.developer.planner_agent.generate_json", return_value=plan):
            result = DeveloperPlannerAgent().run("Build a todo app")
        self.assertTrue(result.success)
        self.assertIn("Todo app", result.output)

    def test_planner_failure_when_underspecified(self) -> None:
        plan = DevPlanOutput(goal="Todo app", milestones=[], acceptance_criteria=[])
        with patch("src.lib.agents.developer.planner_agent.generate_json", return_value=plan):
            result = DeveloperPlannerAgent().run("Build a todo app")
        self.assertFalse(result.success)

    def test_executor_success(self) -> None:
        output = ExecutorOutput(
            files=[CodeFile(path="index.js", content="console.log('ok')", language="javascript")],
            dependencies=[],
            setup_instructions="node index.js",
        )
        context = {"planner": AgentResult(agent="planner", success=True, output=_dev_plan_json())}
        with patch("src.lib.agents.developer.executor.generate_json", return_value=output):
            result = ExecutorAgent().run("Build a todo app", context=context)
        self.assertTrue(result.success)

    def test_executor_reads_qa_feedback(self) -> None:
        output = ExecutorOutput(
            files=[CodeFile(path="index.js", content="fixed", language="javascript")],
            dependencies=[],
            setup_instructions="run",
        )
        context = {
            "planner": AgentResult(agent="planner", success=True, output=_dev_plan_json()),
            "qa": AgentResult(agent="qa", success=False, feedback="Missing error handling"),
        }
        with patch("src.lib.agents.developer.executor.generate_json", return_value=output) as mock_gen:
            ExecutorAgent(model="gpt-5.4-mini").run("Build a todo app", context=context)
        self.assertIn("Missing error handling", mock_gen.call_args[0][0])

    def test_qa_pass(self) -> None:
        report = QAReport(passed=True, issues=[], summary="Looks good")
        context = {
            "planner": AgentResult(agent="planner", success=True, output=_dev_plan_json()),
            "executor": AgentResult(agent="executor", success=True, output=_executor_json()),
        }
        with patch("src.lib.agents.developer.qa.generate_json", return_value=report):
            result = QAAgent().run("Build a todo app", context=context)
        self.assertTrue(result.success)

    def test_qa_fail_with_feedback(self) -> None:
        report = QAReport(
            passed=False,
            issues=[
                QAIssue(
                    severity="blocker",
                    file="app/page.tsx",
                    description="Missing delete handler",
                    fix="Add deleteTodo function",
                )
            ],
            summary="Not ready",
        )
        context = {
            "planner": AgentResult(agent="planner", success=True, output=_dev_plan_json()),
            "executor": AgentResult(agent="executor", success=True, output=_executor_json()),
        }
        with patch("src.lib.agents.developer.qa.generate_json", return_value=report):
            result = QAAgent().run("Build a todo app", context=context)
        self.assertFalse(result.success)
        self.assertIn("delete handler", result.feedback)

    def test_qa_passes_when_only_minor_issues(self) -> None:
        report = QAReport(
            passed=False,
            issues=[
                QAIssue(
                    severity="minor",
                    file="app/page.tsx",
                    description="Could add comments",
                    fix="Add docstrings",
                )
            ],
            summary="Good prototype",
        )
        context = {
            "planner": AgentResult(agent="planner", success=True, output=_dev_plan_json()),
            "executor": AgentResult(agent="executor", success=True, output=_executor_json()),
        }
        with patch("src.lib.agents.developer.qa.generate_json", return_value=report):
            result = QAAgent().run("Build a todo app", context=context)
        self.assertTrue(result.success)


class QARetryLoopTests(unittest.TestCase):
    def test_qa_failure_reroutes_to_executor(self) -> None:
        plan = default_developer_plan("Build a todo app")
        executor_calls = {"count": 0}

        class StubExecutor:
            name = "executor"

            def run(self, query: str, context: dict | None = None) -> AgentResult:
                executor_calls["count"] += 1
                if executor_calls["count"] == 1:
                    return AgentResult(agent=self.name, success=True, output=_executor_json())
                return AgentResult(
                    agent=self.name,
                    success=True,
                    output=ExecutorOutput(
                        files=[CodeFile(path="fixed.tsx", content="fixed", language="tsx")],
                        dependencies=[],
                        setup_instructions="run",
                    ).model_dump_json(),
                )

        class StubQA:
            name = "qa"

            def run(self, query: str, context: dict | None = None) -> AgentResult:
                executor = (context or {}).get("executor")
                if executor and "fixed.tsx" in executor.output:
                    return AgentResult(
                        agent=self.name,
                        success=True,
                        output=QAReport(passed=True, summary="ok").model_dump_json(),
                    )
                return AgentResult(
                    agent=self.name,
                    success=False,
                    feedback="Needs fixes",
                )

        agents = {
            "planner": MagicMock(
                name="planner",
                run=MagicMock(
                    return_value=AgentResult(agent="planner", success=True, output=_dev_plan_json())
                ),
            ),
            "executor": StubExecutor(),
            "qa": StubQA(),
        }

        orchestrator = Orchestrator(office_type="developer", agents=agents, planner=MagicMock())
        result = orchestrator.run("Build a todo app", plan=plan)

        self.assertTrue(result.success)
        self.assertEqual(executor_calls["count"], 2)
        self.assertTrue(any("Re-routing to 'executor'" in line for line in result.log))


class DeveloperApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)

    def test_plan_endpoint_accepts_developer_office(self) -> None:
        plan = default_developer_plan("Build a habit tracker")
        with patch("src.lib.server.make_planner") as mock_make:
            mock_make.return_value.create_plan.return_value = plan
            response = self.client.post(
                "/api/plan",
                json={"query": "Build a habit tracker", "office_type": "developer"},
            )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["steps"][0]["agent"], "planner")

    def test_run_endpoint_accepts_developer_office(self) -> None:
        plan = default_developer_plan("Build a habit tracker")
        orchestration = MagicMock()
        orchestration.goal = plan.goal
        orchestration.plan = plan
        orchestration.success = True
        orchestration.outputs = {
            "2": AgentResult(agent="executor", success=True, output=_executor_json()),
        }
        orchestration.final_output = _executor_json()
        orchestration.log = ["Planned 4 steps for goal: Build a habit tracker"]

        with patch("src.lib.server.Orchestrator") as mock_orch, patch(
            "src.lib.server._persist_result", new=AsyncMock(return_value=1)
        ), patch(
            "src.lib.server.get_research_by_id",
            return_value={"artifact_url": None, "office_type": "developer"},
        ):
            mock_orch.return_value.run.return_value = orchestration
            response = self.client.post(
                "/api/run",
                json={
                    "query": "Build a habit tracker",
                    "office_type": "developer",
                    "use_cache": False,
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["success"])

    def test_rejects_unknown_office_type(self) -> None:
        response = self.client.post(
            "/api/run",
            json={"query": "test", "office_type": "marketing"},
        )
        self.assertEqual(response.status_code, 400)


class RegistryTests(unittest.TestCase):
    def test_build_developer_agents(self) -> None:
        agents = build_agents("developer")
        self.assertEqual(
            set(agents.keys()),
            {"planner", "executor", "qa"},
        )
        self.assertEqual(agents["executor"].model, "gpt-5.4-mini")


class CodeValidatorTests(unittest.TestCase):
    from src.lib.code_validator import CodeFile as _VCodeFile
    from src.lib.code_validator import validate_files as _validate

    def _file(self, path: str, content: str) -> CodeFile:
        return CodeFile(path=path, content=content, language="")

    def _validate(self, files: list[CodeFile]):
        from src.lib.code_validator import validate_files
        return validate_files(files)

    def test_valid_static_project_passes(self) -> None:
        files = [
            self._file("index.html", '<html><body><script src="./app.js"></script></body></html>'),
            self._file("app.js", 'document.addEventListener("DOMContentLoaded", () => { console.log("ok"); });'),
            self._file("styles.css", "body { margin: 0; }"),
        ]
        issues = self._validate(files)
        blockers = [i for i in issues if i.severity in {"blocker", "major"}]
        self.assertEqual(blockers, [], msg=f"Unexpected blockers: {blockers}")

    def test_python_syntax_error_caught(self) -> None:
        files = [
            self._file("index.html", "<html></html>"),
            self._file("app.py", "def broken(\n    print('oops')\n"),
        ]
        issues = self._validate(files)
        self.assertTrue(
            any(i.severity == "blocker" and "syntax" in i.message.lower() for i in issues),
            f"Expected syntax blocker, got: {issues}",
        )

    def test_missing_relative_import_caught(self) -> None:
        files = [
            self._file("index.html", '<html><script src="./app.js"></script></html>'),
            self._file("app.js", "import { helper } from './missing_module.js';"),
        ]
        issues = self._validate(files)
        self.assertTrue(
            any(i.severity == "blocker" and "missing_module" in i.message for i in issues),
            f"Expected broken import blocker, got: {issues}",
        )

    def test_missing_script_src_in_html_caught(self) -> None:
        files = [
            self._file("index.html", '<html><script src="./does_not_exist.js"></script></html>'),
        ]
        issues = self._validate(files)
        self.assertTrue(
            any(i.severity == "blocker" and "does_not_exist" in i.message for i in issues),
        )

    def test_missing_entry_point_is_blocker(self) -> None:
        files = [
            self._file("app.js", "console.log('hi');"),
        ]
        issues = self._validate(files)
        self.assertTrue(
            any(i.severity == "blocker" and "entry" in i.message.lower() for i in issues),
            f"Expected entry-point blocker, got: {issues}",
        )

    def test_placeholder_content_caught(self) -> None:
        files = [
            self._file("index.html", "<html></html>"),
            self._file("app.js", "// TODO: implement all the things"),
        ]
        issues = self._validate(files)
        self.assertTrue(
            any(i.severity == "blocker" and "placeholder" in i.message.lower() for i in issues),
        )

    def test_invalid_json_caught(self) -> None:
        files = [
            self._file("index.html", "<html></html>"),
            self._file("package.json", "{invalid json"),
        ]
        issues = self._validate(files)
        self.assertTrue(any(i.severity == "blocker" and i.file == "package.json" for i in issues))

    def test_unbalanced_braces_caught(self) -> None:
        files = [
            self._file("index.html", "<html><script src='./app.js'></script></html>"),
            self._file("app.js", "function broken() { if (true) { console.log('oops');"),
        ]
        issues = self._validate(files)
        self.assertTrue(
            any(i.severity in {"major", "blocker"} and "brace" in i.message.lower() for i in issues),
        )


class QAStaticValidationTests(unittest.TestCase):
    def _executor_output_with_files(self, files: list[CodeFile]) -> str:
        return ExecutorOutput(files=files, dependencies=[], setup_instructions="").model_dump_json()

    def test_qa_fails_on_static_blocker_regardless_of_llm(self) -> None:
        broken_output = self._executor_output_with_files([
            CodeFile(path="app.js", content="console.log('no index.html');", language="js"),
        ])
        context = {
            "planner": AgentResult(agent="planner", success=True, output=_dev_plan_json()),
            "executor": AgentResult(agent="executor", success=True, output=broken_output),
        }
        result = QAAgent().run("Build a todo app", context=context)
        self.assertFalse(result.success, "QA should fail when entry-point is missing")
        self.assertIn("entry", result.feedback.lower())

    def test_qa_does_not_call_llm_when_static_blocker_found(self) -> None:
        broken_output = self._executor_output_with_files([
            CodeFile(path="app.js", content="console.log('no html');", language="js"),
        ])
        context = {
            "planner": AgentResult(agent="planner", success=True, output=_dev_plan_json()),
            "executor": AgentResult(agent="executor", success=True, output=broken_output),
        }
        with patch("src.lib.agents.developer.qa.generate_json") as mock_llm:
            QAAgent().run("Build a todo app", context=context)
        mock_llm.assert_not_called()

    def test_qa_passes_valid_static_project(self) -> None:
        good_output = self._executor_output_with_files([
            CodeFile(path="index.html", content='<html><body><script src="./app.js"></script></body></html>', language="html"),
            CodeFile(path="app.js", content='document.addEventListener("DOMContentLoaded", () => { console.log("ok"); });', language="js"),
        ])
        report = QAReport(passed=True, issues=[], summary="Looks good")
        context = {
            "planner": AgentResult(agent="planner", success=True, output=_dev_plan_json()),
            "executor": AgentResult(agent="executor", success=True, output=good_output),
        }
        with patch("src.lib.agents.developer.qa.generate_json", return_value=report):
            result = QAAgent().run("Build a todo app", context=context)
        self.assertTrue(result.success)


class EditorValidationTests(unittest.TestCase):
    def _good_files(self) -> list[dict]:
        return [
            {"path": "index.html", "content": '<html><script src="./app.js"></script></html>', "language": "html"},
            {"path": "app.js", "content": 'console.log("hi");', "language": "js"},
        ]

    def _broken_output(self) -> ExecutorOutput:
        return ExecutorOutput(
            files=[CodeFile(path="app.js", content="console.log('no html');", language="js")],
            dependencies=[],
            setup_instructions="",
        )

    def _good_output(self) -> ExecutorOutput:
        return ExecutorOutput(
            files=[
                CodeFile(path="index.html", content='<html><script src="./app.js"></script></html>', language="html"),
                CodeFile(path="app.js", content='console.log("ok");', language="js"),
            ],
            dependencies=[],
            setup_instructions="",
        )

    def test_editor_rejects_result_with_blocker(self) -> None:
        with patch("src.lib.agents.developer.editor.generate_json", return_value=self._broken_output()):
            result = EditorAgent().run_edit("add feature", self._good_files(), allow_retry=False)
        self.assertFalse(result.success)
        self.assertIn("entry", result.feedback.lower())

    def test_editor_retries_once_and_succeeds(self) -> None:
        call_count = {"n": 0}
        broken = self._broken_output()
        good = self._good_output()

        def side_effect(*args, **kwargs):
            call_count["n"] += 1
            return broken if call_count["n"] == 1 else good

        with patch("src.lib.agents.developer.editor.generate_json", side_effect=side_effect):
            result = EditorAgent().run_edit("add feature", self._good_files())
        self.assertTrue(result.success)
        self.assertEqual(call_count["n"], 2)

    def test_editor_fails_if_both_attempts_broken(self) -> None:
        with patch("src.lib.agents.developer.editor.generate_json", return_value=self._broken_output()):
            result = EditorAgent().run_edit("add feature", self._good_files())
        self.assertFalse(result.success)


if __name__ == "__main__":
    unittest.main()
