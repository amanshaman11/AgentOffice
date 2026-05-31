"""Planner agent: turns a user request into a validated execution plan."""

from __future__ import annotations

from pydantic import BaseModel

from .gemini_client import GeminiError, generate_json
from .schemas import Plan, PlanStep

DEFAULT_AGENT_SEQUENCE = ("searcher", "analyzer", "summarizer", "sender")
RESEARCH_ROLES = frozenset(DEFAULT_AGENT_SEQUENCE)

DEVELOPER_AGENT_SEQUENCE = ("planner", "executor", "qa", "deployer", "marketing")
DEVELOPER_ROLES = frozenset(DEVELOPER_AGENT_SEQUENCE)

_OFFICE_ROLES = {"research": RESEARCH_ROLES, "developer": DEVELOPER_ROLES}
_OPTIONAL_TERMINAL_ROLES = {
    "research": frozenset({"sender"}),
    "developer": frozenset({"deployer", "marketing"}),
}


def default_plan(goal: str) -> Plan:
    """Return the deterministic Research Office plan used as a fallback."""

    return Plan(
        goal=goal,
        steps=[
            PlanStep(step=1, agent="searcher", depends_on=[], required=True),
            PlanStep(step=2, agent="analyzer", depends_on=[1], required=True),
            PlanStep(step=3, agent="summarizer", depends_on=[2], required=True),
            PlanStep(step=4, agent="sender", depends_on=[3], required=False),
        ],
        fallback_rules=["if analyzer fails, retry searcher max 2 times"],
    )


def default_developer_plan(goal: str) -> Plan:
    """Return the deterministic Developer Office plan used as a fallback."""

    return Plan(
        goal=goal,
        steps=[
            PlanStep(step=1, agent="planner", depends_on=[], required=True),
            PlanStep(step=2, agent="executor", depends_on=[1], required=True),
            PlanStep(step=3, agent="qa", depends_on=[2], required=True),
            PlanStep(step=4, agent="deployer", depends_on=[3], required=True),
            PlanStep(step=5, agent="marketing", depends_on=[4], required=False),
        ],
        fallback_rules=["if qa fails, retry executor max 5 times"],
    )


def _roster_fallback_rules(roles: set[str], office_type: str) -> list[str]:
    if office_type == "developer" and {"qa", "executor"} <= roles:
        return ["if qa fails, retry executor max 5 times"]
    if office_type == "research" and {"analyzer", "searcher"} <= roles:
        return ["if analyzer fails, retry searcher max 2 times"]
    return []


def plan_from_roster(goal: str, agents: list[str], office_type: str = "research") -> Plan:
    """Build a linear execution plan from an ordered agent roster.

    Each roster entry becomes one step, depending only on the previous step.
    The last step is optional when it is the office's terminal role.

    Raises ``ValueError`` for empty rosters or agents not valid for ``office_type``.
    """

    if not agents:
        raise ValueError("Roster is empty — add at least one agent to the office.")
    valid_roles = _OFFICE_ROLES.get(office_type, RESEARCH_ROLES)
    unknown = [a for a in agents if a not in valid_roles]
    if unknown:
        raise ValueError(
            f"Unknown {office_type} agents: {', '.join(unknown)}. "
            f"Valid agents are: {', '.join(sorted(valid_roles))}."
        )

    optional_roles = _OPTIONAL_TERMINAL_ROLES.get(office_type, frozenset())
    steps = [
        PlanStep(
            step=i,
            agent=role,
            depends_on=[i - 1] if i > 1 else [],
            required=not (role in optional_roles and i == len(agents)),
        )
        for i, role in enumerate(agents, start=1)
    ]

    fallback_rules = _roster_fallback_rules(set(agents), office_type)
    return Plan(goal=goal, steps=steps, fallback_rules=fallback_rules)


class WorkflowSuggestion(BaseModel):
    """Gemini's recommendation for which research agents to run."""

    suggested_agents: list[str]
    rationale: str


_WORKFLOW_INSTRUCTIONS = {
    "research": (
        "You are the planning lead of a multi-agent research office. "
        "Given a user request, recommend an ordered list of research agents to run. "
        f"Available agents: {', '.join(DEFAULT_AGENT_SEQUENCE)}. "
        "The searcher gathers sources, the analyzer validates source quality, "
        "the summarizer writes a concise summary, and the sender formats citations. "
        "Return only agents from the available list in recommended execution order. "
        "Include a brief rationale (1-2 sentences) explaining your choice."
    ),
    "developer": (
        "You are the planning lead of a multi-agent software development office. "
        "Given a product idea, recommend an ordered list of developer agents to run. "
        f"Available agents: {', '.join(DEVELOPER_AGENT_SEQUENCE)}. "
        "The planner turns the idea into a build plan, the executor generates code, "
        "the qa reviews the code and requests fixes, the deployer produces a "
        "deployment checklist, and marketing generates launch content. Return only "
        "agents from the available list in recommended execution order. Include a "
        "brief rationale (1-2 sentences)."
    ),
}


def suggest_workflow(query: str, office_type: str = "research") -> WorkflowSuggestion:
    """Use Gemini to recommend an ordered workflow for ``query``.

    Returns a suggestion only — never executes any agents.
    """

    system_instruction = _WORKFLOW_INSTRUCTIONS.get(
        office_type, _WORKFLOW_INSTRUCTIONS["research"]
    )
    noun = "development" if office_type == "developer" else "research"
    prompt = f"User request:\n{query}\n\nSuggest the optimal {noun} workflow."
    return generate_json(prompt, WorkflowSuggestion, system_instruction=system_instruction)


class Planner:
    """Generates an execution :class:`Plan` from a research query."""

    system_instruction = (
        "You are the planning lead of a multi-agent research office. Given a user "
        "request, produce an execution plan as steps assigned to these agents only: "
        f"{', '.join(DEFAULT_AGENT_SEQUENCE)}. The searcher gathers sources, the "
        "analyzer validates source quality, the summarizer writes the summary, and "
        "the sender formats citations and delivers results. Set realistic depends_on "
        "links, mark the sender optional, and include concrete fallback_rules such as "
        "retrying the searcher when the analyzer reports weak sources."
    )

    def __init__(self, *, model: str | None = None) -> None:
        self.model = model

    def create_plan(self, query: str) -> Plan:
        """Return a plan for ``query``, falling back to the default on failure."""

        prompt = f"User request:\n{query}\n\nProduce the execution plan."
        try:
            plan = generate_json(
                prompt,
                Plan,
                system_instruction=self.system_instruction,
                **({"model": self.model} if self.model else {}),
            )
        except GeminiError:
            return default_plan(query)
        return self._sanitize(plan, query)

    @staticmethod
    def _sanitize(plan: Plan, query: str) -> Plan:
        """Drop steps with unknown agents and ensure the plan stays executable."""

        valid_steps = [s for s in plan.steps if s.agent in DEFAULT_AGENT_SEQUENCE]
        if not valid_steps:
            return default_plan(query)
        known = {s.step for s in valid_steps}
        for step in valid_steps:
            step.depends_on = [d for d in step.depends_on if d in known and d != step.step]
        plan.steps = sorted(valid_steps, key=lambda s: s.step)
        if not plan.goal.strip():
            plan.goal = query
        return plan
