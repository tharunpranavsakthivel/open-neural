"""Leaderboard router for OpenNeural backend.

Provides endpoints for experiment comparison leaderboard.
Implements the experiment comparison leaderboard API as specified in TDD §2.6.
"""

import json
import time
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select

from openneural_backend.db.engine import async_session
from openneural_backend.db.models import Evaluation, Experiment, Project, Run

router = APIRouter(prefix="/projects/{project_id}/leaderboard", tags=["leaderboard"])


# Valid sort columns and their database mapping
SORT_COLUMNS = {
    "f1": "f1",
    "auc_roc": "auc_roc",
    "precision": "precision",
    "recall": "recall",
    "training_time": "training_time_sec",
}


class LeaderboardEntry(BaseModel):
    """Single experiment entry in the leaderboard.

    Attributes:
        experiment_id: UUID of the experiment.
        experiment_id_human: Human-readable experiment ID (e.g., "exp_cxp8_1015").
        best_model_type: Type of the best model for this experiment.
        metrics: Dict of metrics (f1, auc_roc, precision, recall, training_time).
        training_time_seconds: Training duration in seconds.
        is_best: Flag indicating if this is the globally best experiment.
        created_at: ISO8601 timestamp when experiment was created.
    """

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "experiment_id": "550e8400-e29b-41d4-a716-446655440000",
                    "experiment_id_human": "exp_cxp8_1015",
                    "best_model_type": "xgboost",
                    "metrics": {
                        "f1": 0.847,
                        "auc_roc": 0.921,
                        "precision": 0.831,
                        "recall": 0.864,
                    },
                    "training_time_seconds": 222.0,
                    "is_best": True,
                    "created_at": "2024-10-15T14:30:00",
                }
            ]
        }
    }

    experiment_id: str
    experiment_id_human: str
    best_model_type: str
    metrics: dict
    training_time_seconds: float
    is_best: bool
    created_at: str


@router.get("")
async def get_leaderboard(
    project_id: str,
    sort_by: Literal["f1", "auc_roc", "precision", "recall", "training_time"] = Query(
        default="f1",
        description="Column to sort by",
    ),
    order: Literal["asc", "desc"] = Query(
        default="desc",
        description="Sort order (asc or desc)",
    ),
) -> list[LeaderboardEntry]:
    """Get the experiment leaderboard for a project.

    Joins experiments → runs → evaluations to extract per-experiment best run metrics.
    Returns a sorted list with an `is_best` flag on the top experiment by the sort metric.

    Per SRS NFR-PERF-05: Sorts the experiment leaderboard within 500ms of a column
    header click, regardless of experiment count (up to 1,000 experiments).

    Args:
        project_id: The project ID.
        sort_by: Column to sort by (f1, auc_roc, precision, recall, training_time).
            Default: f1.
        order: Sort order (asc or desc). Default: desc.

    Returns:
        list[LeaderboardEntry]: Sorted list of experiment results. The first entry
            (after sorting) has is_best=True, all others have is_best=False.

    Raises:
        HTTPException 404: If the project is not found.
        HTTPException 400: If sort_by or order parameters are invalid.
    """
    start_time = time.time()

    async with async_session() as session:
        # Verify project exists
        project_stmt = select(Project).where(Project.id == project_id)
        project_result = await session.execute(project_stmt)
        project = project_result.scalar_one_or_none()

        if project is None:
            raise HTTPException(
                status_code=404,
                detail=f"Project not found: {project_id}",
            )

        # Query all done experiments for this project with their runs
        # Using efficient joins to minimize database round-trips
        experiments_stmt = (
            select(Experiment)
            .where(Experiment.project_id == project_id)
            .where(Experiment.status.in_(["done", "cancelled", "interrupted"]))
        )
        experiments_result = await session.execute(experiments_stmt)
        experiments = experiments_result.scalars().all()

        # Build leaderboard entries by extracting best run per experiment
        entries = []
        for experiment in experiments:
            # Get all done runs for this experiment
            runs_stmt = (
                select(Run)
                .where(Run.experiment_id == experiment.id)
                .where(Run.status == "done")
                .where(Run.test_metrics_json.isnot(None))
            )
            runs_result = await session.execute(runs_stmt)
            runs = runs_result.scalars().all()

            if not runs:
                # Skip experiments with no completed runs
                continue

            # Find the best run based on the experiment's optimize_metric
            best_run = None
            best_metrics = None
            best_score = float("-inf")

            for run in runs:
                try:
                    metrics = json.loads(run.test_metrics_json)
                    optimize_metric = experiment.optimize_metric
                    score = metrics.get(optimize_metric, float("-inf"))

                    # Handle metrics where lower is better (RMSE, MAE)
                    if optimize_metric in ("rmse", "mae"):
                        score = -score

                    if score > best_score:
                        best_score = score
                        best_run = run
                        best_metrics = metrics
                except (json.JSONDecodeError, TypeError):
                    continue

            if best_run is None or best_metrics is None:
                continue

            # Extract metrics for the leaderboard
            # Classification metrics: f1, auc_roc, precision, recall
            # Regression metrics: rmse, mae, r2
            entry_metrics = {
                "f1": best_metrics.get("f1"),
                "auc_roc": best_metrics.get("auc_roc"),
                "precision": best_metrics.get("precision"),
                "recall": best_metrics.get("recall"),
                "rmse": best_metrics.get("rmse"),
                "mae": best_metrics.get("mae"),
                "r2": best_metrics.get("r2"),
                "accuracy": best_metrics.get("accuracy"),
            }

            # Remove None values for cleaner response
            entry_metrics = {k: v for k, v in entry_metrics.items() if v is not None}

            entries.append({
                "experiment_id": experiment.id,
                "experiment_id_human": experiment.experiment_id_human,
                "best_model_type": best_run.model_type,
                "metrics": entry_metrics,
                "training_time_seconds": best_run.training_time_sec or 0.0,
                "is_best": False,  # Will be set after sorting
                "created_at": experiment.created_at.isoformat(),
            })

        # Sort entries by the requested column
        reverse = order == "desc"

        if sort_by == "training_time":
            # Sort by training_time_seconds
            entries.sort(key=lambda x: x["training_time_seconds"], reverse=reverse)
        else:
            # Sort by metric value (handle None by treating as -inf for desc, inf for asc)
            def get_sort_value(entry: dict) -> float:
                value = entry["metrics"].get(sort_by)
                if value is None:
                    return float("-inf") if reverse else float("inf")
                return value

            entries.sort(key=get_sort_value, reverse=reverse)

        # Mark the first entry as the best
        if entries:
            entries[0]["is_best"] = True

        # Log performance for debugging (per NFR-PERF-05 requirement)
        elapsed_ms = (time.time() - start_time) * 1000
        if elapsed_ms > 500:
            # Log warning if sorting exceeds 500ms
            import logging

            logger = logging.getLogger(__name__)
            logger.warning(
                f"Leaderboard sort took {elapsed_ms:.1f}ms for {len(entries)} experiments, "
                f"exceeding 500ms target"
            )

        return entries
