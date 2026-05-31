"""Project profiles — define what kinds of projects Executor is allowed to produce.

The active profile is selected via the DEV_PROJECT_PROFILE env var (default: static_web).
Each profile exposes:
  - ALLOWED_EXTENSIONS: set of lower-case file extensions the project may contain.
  - REQUIRED_ENTRY: filename that must be present at the project root.
  - ALLOWED_CDN_PREFIXES: external URLs that are fine in <script src> / <link href>.
  - SYSTEM_INSTRUCTION_SUFFIX: profile-specific rules appended to Planner/Executor prompts.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field


@dataclass(frozen=True)
class ProjectProfile:
    name: str
    allowed_extensions: frozenset[str]
    required_entry: str
    allowed_cdn_prefixes: tuple[str, ...]
    system_instruction_suffix: str


STATIC_WEB = ProjectProfile(
    name="static_web",
    allowed_extensions=frozenset({".html", ".css", ".js", ".json", ".svg", ".png", ".jpg", ".jpeg", ".ico", ".txt", ".md"}),
    required_entry="index.html",
    allowed_cdn_prefixes=(
        "https://cdn.",
        "https://unpkg.com/",
        "https://esm.sh/",
        "https://cdnjs.cloudflare.com/",
        "https://fonts.googleapis.com/",
        "https://fonts.gstatic.com/",
    ),
    system_instruction_suffix=(
        "\n\nPROJECT PROFILE — STRICT RULES (static_web):\n"
        "1. Produce a SINGLE-PAGE, zero-build-step static web application.\n"
        "2. The output MUST include an `index.html` as the entry point.\n"
        "3. Allowed file types: .html, .css, .js, .json, .svg, .ico, .md only.\n"
        "4. Do NOT use TypeScript, JSX, bundlers (Webpack, Vite, Parcel, etc.), "
        "   npm install steps, or any build tool. Vanilla HTML + CSS + JS only.\n"
        "5. External dependencies must be loaded from a CDN <script> or <link> tag "
        "   inside index.html (e.g. unpkg.com, cdn.jsdelivr.net, esm.sh). "
        "   Do NOT use import/require for packages — there is no node_modules.\n"
        "6. SELF-CHECK before returning: verify every `src=`, `href=`, and "
        "   `import './...'` reference points to a file you are actually including "
        "   in the output. Remove any reference that does not have a matching file.\n"
        "7. Do NOT leave any TODO, placeholder, or '// implement me' comment. "
        "   Every file must contain complete, working code.\n"
        "8. Inline all small CSS in <style> or in styles.css; keep JS in app.js "
        "   (and optionally additional .js files you include via <script src>).\n"
        "9. The application must work by simply opening index.html in a browser "
        "   with no server or build step required."
    ),
)

_PROFILES: dict[str, ProjectProfile] = {
    "static_web": STATIC_WEB,
}


def get_active_profile() -> ProjectProfile:
    name = os.getenv("DEV_PROJECT_PROFILE", "static_web")
    return _PROFILES.get(name, STATIC_WEB)
