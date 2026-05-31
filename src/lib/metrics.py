"""Performance metrics tracking for agents and orchestration."""

from __future__ import annotations

import time
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any

from pydantic import BaseModel


class MetricsSummary(BaseModel):
    """Summary of performance metrics."""
    
    total_executions: int
    successful_executions: int
    failed_executions: int
    success_rate: float
    average_execution_time_ms: float
    total_execution_time_ms: int
    agent_metrics: dict[str, dict[str, Any]]
    recent_executions: list[dict[str, Any]]


class PerformanceMetrics:
    """In-memory performance metrics tracker."""
    
    def __init__(self):
        self._executions: list[dict[str, Any]] = []
        self._agent_stats: dict[str, dict[str, int]] = defaultdict(
            lambda: {"executions": 0, "successes": 0, "failures": 0, "total_time_ms": 0}
        )
        self._start_time = time.time()
    
    def record_execution(
        self,
        query: str,
        goal: str,
        success: bool,
        execution_time_ms: int,
        agent_results: dict[str, bool],
    ) -> None:
        """Record a research execution."""
        execution = {
            "timestamp": datetime.utcnow().isoformat(),
            "query": query,
            "goal": goal,
            "success": success,
            "execution_time_ms": execution_time_ms,
            "agents_used": list(agent_results.keys()),
        }
        
        self._executions.append(execution)
        
        for agent_name, agent_success in agent_results.items():
            stats = self._agent_stats[agent_name]
            stats["executions"] += 1
            stats["total_time_ms"] += execution_time_ms // len(agent_results)
            
            if agent_success:
                stats["successes"] += 1
            else:
                stats["failures"] += 1
        
        if len(self._executions) > 1000:
            self._executions = self._executions[-1000:]
    
    def get_summary(self, last_n_hours: int | None = None) -> MetricsSummary:
        """Get metrics summary, optionally filtered by time window."""
        executions = self._executions
        
        if last_n_hours:
            cutoff = datetime.utcnow() - timedelta(hours=last_n_hours)
            executions = [
                e for e in executions
                if datetime.fromisoformat(e["timestamp"]) > cutoff
            ]
        
        total = len(executions)
        successful = sum(1 for e in executions if e["success"])
        failed = total - successful
        
        success_rate = (successful / total * 100) if total > 0 else 0.0
        
        avg_time = (
            sum(e["execution_time_ms"] for e in executions) / total
            if total > 0 else 0.0
        )
        
        total_time = sum(e["execution_time_ms"] for e in executions)
        
        agent_metrics = {}
        for agent_name, stats in self._agent_stats.items():
            executions = stats["executions"]
            successes = stats["successes"]
            
            agent_metrics[agent_name] = {
                "total_executions": executions,
                "successes": successes,
                "failures": stats["failures"],
                "success_rate": (successes / executions * 100) if executions > 0 else 0.0,
                "average_time_ms": (
                    stats["total_time_ms"] / executions if executions > 0 else 0.0
                ),
            }
        
        recent = sorted(executions, key=lambda e: e["timestamp"], reverse=True)[:10]
        
        return MetricsSummary(
            total_executions=total,
            successful_executions=successful,
            failed_executions=failed,
            success_rate=round(success_rate, 2),
            average_execution_time_ms=round(avg_time, 2),
            total_execution_time_ms=total_time,
            agent_metrics=agent_metrics,
            recent_executions=recent,
        )
    
    def get_uptime_seconds(self) -> int:
        """Get server uptime in seconds."""
        return int(time.time() - self._start_time)


_global_metrics = PerformanceMetrics()


def get_metrics() -> PerformanceMetrics:
    """Get the global metrics instance."""
    return _global_metrics
