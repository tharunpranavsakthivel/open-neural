"""Evaluation router for OpenNeural backend.

Provides endpoints for experiment evaluation: metrics, confusion matrix, threshold
adjustment, and subgroup analysis. Implements the evaluation dashboard API
as specified in TDD §2.5.
"""

import json
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from openneural_backend.db.engine import async_session
from openneural_backend.db.models import Evaluation, Experiment, SubgroupAnalysis
from openneural_backend.services.evaluation_service import (
    compute_metrics_with_threshold,
    identify_best_run,
    load_predictions,
)

router = APIRouter(
    prefix="/experiments/{experiment_id}/evaluation",
    tags=["evaluation"],
)


@router.get(
    "",
    summary="Get evaluation results for an experiment",
    description="Loads metrics, confusion matrix, and subgroup analyses for the best run of an experiment.",
    responses={
        200: {"description": "Successfully retrieved evaluation results."},
        400: {"description": "No completed runs found for this experiment."},
        404: {"description": "Experiment not found."},
        500: {"description": "Internal server error."}
    }
)
async def get_evaluation(experiment_id: str) -> dict[str, Any]:
    """Get evaluation results for an experiment.

    Calls identify_best_run to find the best performing run, then loads
    confusion matrix, subgroup analyses, and metrics from the evaluations
    and subgroup_analyses tables. Returns the full evaluation response
    object as specified in TDD §2.5.

    Args:
        experiment_id: The UUID of the experiment to evaluate.

    Returns:
        dict: Full evaluation response containing:
            - best_run_id: UUID of the best run.
            - best_model_type: Type of model for the best run.
            - metrics: Dict of metrics (f1, auc_roc, precision, recall, etc.).
            - confusion_matrix: TN/FP/FN/TP for binary, or N×N matrix for multiclass.
            - threshold: Decision threshold used for classification.
            - subgroup_analyses: List of subgroup performance analyses.

    Raises:
        HTTPException 404: If the experiment is not found.
        HTTPException 400: If no completed runs exist for the experiment.
    """
    async with async_session() as session:
        # Verify experiment exists
        exp_stmt = select(Experiment).where(Experiment.id == experiment_id)
        exp_result = await session.execute(exp_stmt)
        experiment = exp_result.scalar_one_or_none()

        if experiment is None:
            raise HTTPException(
                status_code=404,
                detail=f"Experiment not found: {experiment_id}",
            )

        # Call identify_best_run to find the best performing run
        best_run_info = await identify_best_run(experiment_id)

        if best_run_info is None:
            raise HTTPException(
                status_code=400,
                detail="No completed runs found for this experiment",
            )

        # Load evaluation record for the best run
        eval_stmt = (
            select(Evaluation)
            .where(Evaluation.run_id == best_run_info["run_id"])
            .where(Evaluation.split == "test")
        )
        eval_result = await session.execute(eval_stmt)
        evaluation = eval_result.scalar_one_or_none()

        # Parse metrics from evaluation or use best_run_info metrics
        if evaluation:
            try:
                metrics = json.loads(evaluation.metrics_json)
            except (json.JSONDecodeError, TypeError):
                metrics = best_run_info["metrics"]

            # Parse confusion matrix
            confusion_matrix = best_run_info.get("confusion_matrix")
            if confusion_matrix is None and evaluation.confusion_matrix_json:
                try:
                    confusion_matrix = json.loads(evaluation.confusion_matrix_json)
                except (json.JSONDecodeError, TypeError):
                    confusion_matrix = None

            threshold = evaluation.threshold
        else:
            metrics = best_run_info["metrics"]
            confusion_matrix = best_run_info.get("confusion_matrix")
            threshold = 0.5

        # Load subgroup analyses for this evaluation
        subgroup_analyses = []
        if evaluation:
            subgroup_stmt = select(SubgroupAnalysis).where(
                SubgroupAnalysis.evaluation_id == evaluation.id
            )
            subgroup_result = await session.execute(subgroup_stmt)
            subgroups = subgroup_result.scalars().all()

            for subgroup in subgroups:
                try:
                    subgroup_metrics = json.loads(subgroup.metrics_json)
                except (json.JSONDecodeError, TypeError):
                    subgroup_metrics = {}

                subgroup_analyses.append(
                    {
                        "slice_name": subgroup.slice_name,
                        "n": subgroup.n,
                        "metrics": subgroup_metrics,
                    }
                )

        # Build the response according to TDD §2.5
        response = {
            "best_run_id": best_run_info["run_id"],
            "best_model_type": best_run_info["model_type"],
            "metrics": metrics,
            "threshold": threshold,
        }

        # Add confusion matrix if available
        if confusion_matrix is not None:
            response["confusion_matrix"] = confusion_matrix

        # Add subgroup analyses if available
        if subgroup_analyses:
            response["subgroup_analyses"] = subgroup_analyses

        return response


@router.post(
    "/threshold",
    summary="Update decision threshold",
    description="Updates the decision threshold and recalculates metrics (precision, recall, f1) using pre-stored predictions, ensuring low-latency response (< 200ms).",
    responses={
        200: {"description": "Successfully updated decision threshold and recalculated metrics."},
        400: {"description": "Invalid threshold range/step or prediction data not available."},
        404: {"description": "Experiment not found."},
        500: {"description": "Internal server error."}
    }
)
async def update_threshold(experiment_id: str, payload: dict) -> dict[str, Any]:
    """Update decision threshold and recalculate metrics.

    Accepts a new threshold value, validates it, and returns updated metrics
    computed with the new threshold using pre-stored test-set predictions.
    This ensures response latency ≤ 200ms by loading from Parquet rather
    than re-running model inference.

    Args:
        experiment_id: The UUID of the experiment.
        payload: Dict containing "threshold" key with float value (0.10-0.90, step 0.05).

    Returns:
        dict: Updated metrics (precision, recall, f1) with the new threshold.

    Raises:
        HTTPException 404: If the experiment is not found.
        HTTPException 400: If threshold is out of valid range, step is invalid,
            or no completed runs exist.
    """
    # Extract threshold from request body
    threshold = payload.get("threshold")
    if threshold is None:
        raise HTTPException(
            status_code=400,
            detail="Request body must contain 'threshold' field",
        )

    # Validate threshold range (per Task 105: 0.10-0.90, step 0.05)
    if not (0.10 <= threshold <= 0.90):
        raise HTTPException(
            status_code=400,
            detail="Threshold must be between 0.10 and 0.90",
        )

    # Check step (must be multiple of 0.05)
    step_valid = abs(round(threshold / 0.05) * 0.05 - threshold) < 1e-9
    if not step_valid:
        raise HTTPException(
            status_code=400,
            detail="Threshold must be in increments of 0.05",
        )

    async with async_session() as session:
        # Verify experiment exists
        exp_stmt = select(Experiment).where(Experiment.id == experiment_id)
        exp_result = await session.execute(exp_stmt)
        experiment = exp_result.scalar_one_or_none()

        if experiment is None:
            raise HTTPException(
                status_code=404,
                detail=f"Experiment not found: {experiment_id}",
            )

        # Get the best run
        best_run_info = await identify_best_run(experiment_id)

        if best_run_info is None:
            raise HTTPException(
                status_code=400,
                detail="No completed runs found for this experiment",
            )

        # Load predictions from Parquet file for fast threshold adjustment
        # This ensures latency ≤ 200ms (per Task 105 requirement)
        run_id = best_run_info["run_id"]
        predictions = load_predictions(run_id, experiment_id)

        if predictions is None:
            raise HTTPException(
                status_code=400,
                detail="Predictions data not available for threshold adjustment",
            )

        y_true, y_pred, y_proba = predictions

        # For classification, we need probabilities to adjust threshold
        if y_proba is None:
            raise HTTPException(
                status_code=400,
                detail="Probability predictions not available for this model",
            )

        # Compute metrics with the new threshold
        # This is fast (< 200ms) since we're just applying a threshold to precomputed probabilities
        metrics = compute_metrics_with_threshold(y_true, y_proba, threshold)

        return {
            "threshold": threshold,
            "precision": metrics["precision"],
            "recall": metrics["recall"],
            "f1": metrics["f1"],
        }
