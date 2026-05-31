"""Deterministic, zero-dependency static code validator for generated projects.

Catches syntax errors, broken cross-file references, missing entry-points,
and placeholder content without requiring any external tools (no Node, no tsc,
no linter). Results feed directly into the QA agent to trigger Executor retries.
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field

from .agents.developer.schemas import CodeFile

_PLACEHOLDER_PATTERNS = [
    re.compile(r"^\s*(?:#|//|/\*)?\s*TODO\b", re.MULTILINE | re.IGNORECASE),
    re.compile(r"placeholder", re.IGNORECASE),
    re.compile(r"not yet implemented", re.IGNORECASE),
    re.compile(r"your code here", re.IGNORECASE),
]

_JS_IMPORT_RE = re.compile(
    r"""(?:import\s+[^'"]*from\s+|require\s*\(\s*)['"](\.{1,2}/[^'"]+)['"]""",
    re.MULTILINE,
)
_HTML_SCRIPT_RE = re.compile(r"""<script\b[^>]*\bsrc\s*=\s*['"]([^'"]+)['"]""", re.IGNORECASE)
_HTML_LINK_RE = re.compile(r"""<link\b[^>]*\bhref\s*=\s*['"]([^'"]+)['"]""", re.IGNORECASE)
_CSS_IMPORT_RE = re.compile(r"""@import\s+['"]([^'"]+)['"]""")

_LOGIC_EXTENSIONS = {".py", ".js", ".ts", ".jsx", ".tsx", ".mjs", ".cjs"}


@dataclass
class CodeIssue:
    severity: str
    file: str
    line: int | None
    message: str
    fix: str

    def as_feedback_line(self) -> str:
        loc = f":{self.line}" if self.line else ""
        return f"[{self.severity}] {self.file}{loc}: {self.message} -> {self.fix}"


def validate_files(files: list[CodeFile]) -> list[CodeIssue]:
    file_set = {_normalise(f.path) for f in files}
    issues: list[CodeIssue] = []

    for f in files:
        ext = os.path.splitext(f.path)[1].lower()
        content = f.content or ""

        issues += _check_empty_or_placeholder(f, ext)

        if ext == ".py":
            issues += _check_python_syntax(f)
        elif ext == ".json":
            issues += _check_json(f)
        elif ext in {".js", ".ts", ".jsx", ".tsx", ".mjs", ".cjs"}:
            issues += _check_js_brackets(f)

        issues += _check_cross_refs(f, file_set, ext, content)

    issues += _check_entry_point(file_set, files)
    return issues


def _normalise(path: str) -> str:
    return path.lstrip("/").replace("\\", "/")


def _ext(path: str) -> str:
    return os.path.splitext(path)[1].lower()


def _check_empty_or_placeholder(f: CodeFile, ext: str) -> list[CodeIssue]:
    if ext not in _LOGIC_EXTENSIONS:
        return []
    stripped = f.content.strip()
    if not stripped:
        return [CodeIssue("blocker", f.path, None, "File is empty.", "Add the required implementation.")]
    for pat in _PLACEHOLDER_PATTERNS:
        if pat.search(stripped):
            first_match = pat.search(stripped)
            line_no = stripped[: first_match.start()].count("\n") + 1 if first_match else None
            return [CodeIssue("blocker", f.path, line_no, "File contains placeholder content.", "Replace all TODO/placeholder text with real implementation.")]
    return []


def _check_python_syntax(f: CodeFile) -> list[CodeIssue]:
    try:
        compile(f.content, f.path, "exec")
    except SyntaxError as e:
        return [CodeIssue("blocker", f.path, e.lineno, f"Python syntax error: {e.msg}", "Fix the syntax error reported above.")]
    return []


def _check_json(f: CodeFile) -> list[CodeIssue]:
    if not f.content.strip():
        return []
    try:
        json.loads(f.content)
    except json.JSONDecodeError as e:
        return [CodeIssue("blocker", f.path, e.lineno, f"Invalid JSON: {e.msg}", "Ensure the file is valid JSON.")]
    return []


def _check_js_brackets(f: CodeFile) -> list[CodeIssue]:
    content = f.content
    opens = content.count("{") - content.count("}")
    opens_p = content.count("(") - content.count(")")
    opens_b = content.count("[") - content.count("]")
    issues = []
    if opens != 0:
        issues.append(CodeIssue("major", f.path, None, f"Unbalanced curly braces (delta={opens:+d}).", "Check for missing or extra {{ or }}."))
    if opens_p != 0:
        issues.append(CodeIssue("major", f.path, None, f"Unbalanced parentheses (delta={opens_p:+d}).", "Check for missing or extra ( or )."))
    if opens_b != 0:
        issues.append(CodeIssue("major", f.path, None, f"Unbalanced square brackets (delta={opens_b:+d}).", "Check for missing or extra [ or ]."))
    return issues


def _resolve_relative(base_path: str, ref: str) -> str:
    if not ref.startswith("."):
        return ref
    base_dir = os.path.dirname(base_path)
    resolved = os.path.normpath(os.path.join(base_dir, ref)).replace("\\", "/")
    return resolved.lstrip("/")


_CANDIDATE_EXTENSIONS = ["", ".js", ".ts", ".jsx", ".tsx", ".mjs", ".cjs", ".css", ".json", ".html", "/index.js", "/index.ts"]


def _exists_in_set(resolved: str, file_set: set[str]) -> bool:
    if _normalise(resolved) in file_set:
        return True
    for ext in _CANDIDATE_EXTENSIONS:
        if _normalise(resolved + ext) in file_set:
            return True
    return False


def _check_cross_refs(f: CodeFile, file_set: set[str], ext: str, content: str) -> list[CodeIssue]:
    issues = []
    refs: list[str] = []

    if ext in {".js", ".ts", ".jsx", ".tsx", ".mjs", ".cjs"}:
        refs = [m.group(1) for m in _JS_IMPORT_RE.finditer(content) if m.group(1).startswith(".")]
    elif ext == ".css":
        refs = [m.group(1) for m in _CSS_IMPORT_RE.finditer(content) if m.group(1).startswith(".")]
    elif ext == ".html":
        refs = [m.group(1) for m in _HTML_SCRIPT_RE.finditer(content) if not m.group(1).startswith("http")]
        refs += [m.group(1) for m in _HTML_LINK_RE.finditer(content) if not m.group(1).startswith("http")]

    for ref in refs:
        if ref.startswith("."):
            resolved = _resolve_relative(f.path, ref)
            if not _exists_in_set(resolved, file_set):
                issues.append(CodeIssue(
                    "blocker",
                    f.path,
                    None,
                    f"Import/reference '{ref}' not found in generated files (resolved: '{resolved}').",
                    f"Either add the missing file '{resolved}' to the project or fix the import path.",
                ))
    return issues


def _check_entry_point(file_set: set[str], files: list[CodeFile]) -> list[CodeIssue]:
    issues = []
    has_html = any(_ext(p) == ".html" for p in file_set)
    if not has_html:
        issues.append(CodeIssue("blocker", "index.html", None, "No HTML entry-point found in the project.", "Create an index.html file that loads the application."))
        return issues

    if "index.html" not in file_set and not any(p.endswith("/index.html") for p in file_set):
        issues.append(CodeIssue("major", "index.html", None, "HTML file exists but none is named index.html.", "Rename the primary HTML entry-point to index.html."))

    pkg = next((f for f in files if _normalise(f.path) == "package.json"), None)
    if pkg and pkg.content.strip():
        try:
            data = json.loads(pkg.content)
            for key in ("main", "scripts"):
                val = data.get(key)
                if val:
                    targets = [val] if isinstance(val, str) else list(val.values())
                    for target in targets:
                        if isinstance(target, str) and target.startswith(".") and not _exists_in_set(_resolve_relative("package.json", target), file_set):
                            issues.append(CodeIssue("major", "package.json", None, f"package.json '{key}' references '{target}' which is not in the project.", f"Add '{target}' or fix the reference."))
        except json.JSONDecodeError:
            pass
    return issues


def issues_to_feedback(issues: list[CodeIssue]) -> str:
    return "\n".join(i.as_feedback_line() for i in issues)
