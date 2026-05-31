"""Deploy generated static projects to Vercel."""

from __future__ import annotations

import asyncio
import re
import time
from typing import TYPE_CHECKING

import httpx

if TYPE_CHECKING:
    from .agents.developer.schemas import CodeFile

VERCEL_API = "https://api.vercel.com/v13/deployments"
_POLL_INTERVAL_SECONDS = 2.0
_MAX_POLL_SECONDS = 90.0


class VercelDeployError(RuntimeError):
    """Raised when Vercel deployment fails."""


def project_name_from_query(query: str) -> str:
    slug = query.lower().strip()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug).strip("-")
    slug = slug[:40] or "project"
    return f"agentoffice-{slug}"


def _normalize_url(url: str | None) -> str | None:
    if not url:
        return None
    if url.startswith("http://") or url.startswith("https://"):
        return url
    return f"https://{url}"


def _extract_deployment_url(payload: dict) -> str | None:
    for key in ("url", "alias"):
        value = payload.get(key)
        if isinstance(value, str) and value:
            return _normalize_url(value)
    aliases = payload.get("alias")
    if isinstance(aliases, list) and aliases:
        first = aliases[0]
        if isinstance(first, str):
            return _normalize_url(first)
    return None


async def _poll_deployment(
    client: httpx.AsyncClient,
    deployment_id: str,
    vercel_token: str,
) -> dict:
    deadline = time.monotonic() + _MAX_POLL_SECONDS
    headers = {"Authorization": f"Bearer {vercel_token}"}

    while time.monotonic() < deadline:
        response = await client.get(f"{VERCEL_API}/{deployment_id}", headers=headers)
        if response.status_code >= 400:
            raise VercelDeployError(
                f"Vercel status check failed ({response.status_code}): {response.text}"
            )
        payload = response.json()
        state = payload.get("readyState") or payload.get("state")
        if state == "READY":
            return payload
        if state in {"ERROR", "CANCELED"}:
            raise VercelDeployError(f"Vercel deployment failed with state: {state}")
        await asyncio.sleep(_POLL_INTERVAL_SECONDS)

    raise VercelDeployError("Timed out waiting for Vercel deployment to become ready.")


async def deploy_to_vercel(
    project_files: list[CodeFile],
    project_name: str,
    vercel_token: str,
) -> dict:
    if not project_files:
        raise VercelDeployError("No project files to deploy.")
    if not vercel_token.strip():
        raise VercelDeployError("VERCEL_API_TOKEN is not configured.")

    payload = {
        "name": project_name,
        "files": [
            {
                "file": file.path.lstrip("/"),
                "data": file.content,
                "encoding": "utf-8",
            }
            for file in project_files
        ],
        "projectSettings": {"framework": None},
        "target": "production",
    }

    headers = {
        "Authorization": f"Bearer {vercel_token}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(VERCEL_API, headers=headers, json=payload)
        if response.status_code >= 400:
            raise VercelDeployError(
                f"Vercel deployment failed ({response.status_code}): {response.text}"
            )

        created = response.json()
        deployment_id = created.get("id")
        if not deployment_id:
            raise VercelDeployError("Vercel did not return a deployment id.")

        ready = await _poll_deployment(client, deployment_id, vercel_token)
        deployment_url = _extract_deployment_url(ready) or _extract_deployment_url(created)
        if not deployment_url:
            raise VercelDeployError("Vercel deployment succeeded but no URL was returned.")

        return {
            "deployment_url": deployment_url,
            "deployment_id": deployment_id,
            "project_name": project_name,
        }
