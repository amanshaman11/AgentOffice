"""Database models and operations for research history and metrics."""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any

DB_PATH = Path(__file__).parent.parent.parent / "data" / "agentoffice.db"


class DatabaseError(RuntimeError):
    pass


def _get_connection() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_database() -> None:
    conn = _get_connection()
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS research_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                query TEXT NOT NULL,
                goal TEXT NOT NULL,
                success INTEGER NOT NULL,
                final_output TEXT,
                plan_json TEXT NOT NULL,
                outputs_json TEXT NOT NULL,
                log_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                execution_time_ms INTEGER,
                office_type TEXT NOT NULL DEFAULT 'research',
                artifact_url TEXT
            )
        """)

        existing = {row[1] for row in conn.execute("PRAGMA table_info(research_history)")}
        if "office_type" not in existing:
            conn.execute(
                "ALTER TABLE research_history ADD COLUMN office_type TEXT NOT NULL DEFAULT 'research'"
            )
        if "artifact_url" not in existing:
            conn.execute("ALTER TABLE research_history ADD COLUMN artifact_url TEXT")
        
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_research_created 
            ON research_history(created_at DESC)
        """)
        
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_research_query 
            ON research_history(query)
        """)
        
        conn.execute("""
            CREATE TABLE IF NOT EXISTS agent_metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                research_id INTEGER,
                agent_name TEXT NOT NULL,
                success INTEGER NOT NULL,
                execution_time_ms INTEGER NOT NULL,
                attempt_number INTEGER NOT NULL,
                error_message TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (research_id) REFERENCES research_history(id)
            )
        """)
        
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_metrics_agent 
            ON agent_metrics(agent_name, created_at DESC)
        """)
        
        conn.commit()
    finally:
        conn.close()


def save_research(
    query: str,
    goal: str,
    success: bool,
    final_output: str,
    plan: dict[str, Any],
    outputs: dict[str, Any],
    log: list[str],
    execution_time_ms: int,
    office_type: str = "research",
    artifact_url: str | None = None,
) -> int:
    conn = _get_connection()
    try:
        cursor = conn.execute(
            """
            INSERT INTO research_history 
            (query, goal, success, final_output, plan_json, outputs_json, log_json, created_at, execution_time_ms, office_type, artifact_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                query,
                goal,
                int(success),
                final_output,
                json.dumps(plan),
                json.dumps(outputs),
                json.dumps(log),
                datetime.utcnow().isoformat(),
                execution_time_ms,
                office_type,
                artifact_url,
            ),
        )
        conn.commit()
        return cursor.lastrowid
    finally:
        conn.close()


def save_agent_metric(
    research_id: int,
    agent_name: str,
    success: bool,
    execution_time_ms: int,
    attempt_number: int,
    error_message: str | None = None,
) -> None:
    conn = _get_connection()
    try:
        conn.execute(
            """
            INSERT INTO agent_metrics 
            (research_id, agent_name, success, execution_time_ms, attempt_number, error_message, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                research_id,
                agent_name,
                int(success),
                execution_time_ms,
                attempt_number,
                error_message,
                datetime.utcnow().isoformat(),
            ),
        )
        conn.commit()
    finally:
        conn.close()


def get_research_history(limit: int = 50) -> list[dict[str, Any]]:
    conn = _get_connection()
    try:
        cursor = conn.execute(
            """
            SELECT id, query, goal, success, final_output, created_at, execution_time_ms, office_type, artifact_url
            FROM research_history 
            ORDER BY created_at DESC 
            LIMIT ?
            """,
            (limit,),
        )
        return [dict(row) for row in cursor.fetchall()]
    finally:
        conn.close()


def update_research_artifact_url(research_id: int, artifact_url: str) -> None:
    conn = _get_connection()
    try:
        conn.execute(
            "UPDATE research_history SET artifact_url = ? WHERE id = ?",
            (artifact_url, research_id),
        )
        conn.commit()
    finally:
        conn.close()


def get_research_by_id(research_id: int) -> dict[str, Any] | None:
    conn = _get_connection()
    try:
        cursor = conn.execute(
            """
            SELECT id, query, goal, success, final_output, plan_json, outputs_json, log_json, created_at, execution_time_ms, office_type, artifact_url
            FROM research_history 
            WHERE id = ?
            """,
            (research_id,),
        )
        row = cursor.fetchone()
        if not row:
            return None
        
        result = dict(row)
        result["plan"] = json.loads(result.pop("plan_json"))
        result["outputs"] = json.loads(result.pop("outputs_json"))
        result["log"] = json.loads(result.pop("log_json"))
        return result
    finally:
        conn.close()


def search_similar_research(query: str, limit: int = 5) -> list[dict[str, Any]]:
    conn = _get_connection()
    try:
        cursor = conn.execute(
            """
            SELECT id, query, goal, final_output, created_at, execution_time_ms, office_type, artifact_url
            FROM research_history 
            WHERE success = 1 
            AND (query LIKE ? OR goal LIKE ?)
            ORDER BY created_at DESC 
            LIMIT ?
            """,
            (f"%{query}%", f"%{query}%", limit),
        )
        return [dict(row) for row in cursor.fetchall()]
    finally:
        conn.close()


def get_agent_metrics_summary() -> dict[str, Any]:
    conn = _get_connection()
    try:
        cursor = conn.execute("""
            SELECT 
                agent_name,
                COUNT(*) as total_runs,
                SUM(success) as successful_runs,
                AVG(execution_time_ms) as avg_time_ms,
                MIN(execution_time_ms) as min_time_ms,
                MAX(execution_time_ms) as max_time_ms
            FROM agent_metrics
            GROUP BY agent_name
        """)
        
        metrics = {}
        for row in cursor.fetchall():
            row_dict = dict(row)
            agent = row_dict.pop("agent_name")
            row_dict["success_rate"] = (
                row_dict["successful_runs"] / row_dict["total_runs"]
                if row_dict["total_runs"] > 0
                else 0.0
            )
            metrics[agent] = row_dict
        
        total_cursor = conn.execute("""
            SELECT COUNT(*) as total_research,
            SUM(success) as successful_research,
            AVG(execution_time_ms) as avg_time_ms
            FROM research_history
        """)
        total = dict(total_cursor.fetchone())
        
        return {
            "agents": metrics,
            "overall": total,
        }
    finally:
        conn.close()


init_database()
