"""Evaluation service for OpenNeural backend.

Provides model evaluation, metrics computation, confusion matrix generation,
subgroup analysis, and best run identification. All methods support both
classification and regression tasks as specified in the OpenNeural TDD.

Exposes:
    compute_classification_metrics(y_true, y_pred, y_proba, threshold): Compute
        classification metrics including F1, AUC-ROC, Precision, and Recall.
    compute_regression_metrics(y_true, y_pred): Compute regression metrics
        including RMSE, MAE, and R².
    compute_confusion_matrix(y_true, y_pred): Compute confusion matrix for
        classification tasks, returning TN/FP/FN/TP for binary or full N×N matrix.
    compute_subgroup_analysis(df, y_true, y_pred, feature_cols): Analyze
        performance across subgroups defined by feature columns.
    identify_best_run(experiment_id): Identify the best run from an experiment
        based on the optimization metric.
"""

import json
from typing import Any

import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix as sklearn_confusion_matrix,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    r2_score,
    recall_score,
    roc_auc_score,
)
from sqlalchemy import select

from openneural_backend.db.engine import async_session
from openneural_backend.db.models import Evaluation, Experiment, Run, SubgroupAnalysis


def compute_classification_metrics(
    y_true: np.ndarray | list,
    y_pred: np.ndarray | list,
    y_proba: np.ndarray | list | None = None,
    threshold: float = 0.5,
) -> dict[str, float]:
    """Compute classification metrics for model evaluation.

    Calculates F1 (weighted), AUC-ROC, Precision (weighted), and Recall (weighted).
    For binary classification, applies the specified decision threshold to y_proba
    before computing threshold-dependent metrics.

    Args:
        y_true: Ground truth (correct) target values. Shape: (n_samples,).
        y_pred: Estimated targets as returned by a classifier. Shape: (n_samples,).
        y_proba: Predicted class probabilities for AUC-ROC calculation.
            For binary: shape (n_samples,) or (n_samples, 2) where column 1
            is the positive class probability.
            For multiclass: shape (n_samples, n_classes). Optional.
        threshold: Decision threshold for binary classification (default 0.5).
            Only used when computing metrics for binary problems. Range: 0.0-1.0.

    Returns:
        dict: Classification metrics containing:
            - f1: F1 score (weighted average).
            - auc_roc: Area Under the ROC Curve (None if y_proba not provided).
            - precision: Precision score (weighted average).
            - recall: Recall score (weighted average).
            - accuracy: Overall accuracy score.

    Raises:
        ValueError: If y_true and y_pred have incompatible shapes or lengths.
    """
    y_true_arr = np.asarray(y_true)
    y_pred_arr = np.asarray(y_pred)

    if y_true_arr.shape != y_pred_arr.shape:
        raise ValueError(
            f"y_true and y_pred must have the same shape. "
            f"Got {y_true_arr.shape} and {y_pred_arr.shape}"
        )

    # Determine if binary or multiclass
    unique_classes = np.unique(y_true_arr)
    n_classes = len(unique_classes)
    is_binary = n_classes == 2

    # For binary classification with threshold adjustment
    if is_binary and y_proba is not None:
        y_proba_arr = np.asarray(y_proba)

        # Handle different probability array shapes
        if y_proba_arr.ndim == 2 and y_proba_arr.shape[1] == 2:
            # Extract positive class probability (column 1)
            positive_proba = y_proba_arr[:, 1]
        elif y_proba_arr.ndim == 1:
            positive_proba = y_proba_arr
        else:
            positive_proba = y_proba_arr

        # Apply threshold to get new predictions
        y_pred_arr = (positive_proba >= threshold).astype(int)

        # Calculate AUC-ROC using probabilities
        try:
            auc_roc = float(roc_auc_score(y_true_arr, positive_proba))
        except ValueError:
            # May fail if only one class present in y_true
            auc_roc = None
    elif y_proba is not None:
        # Multiclass AUC-ROC
        try:
            if n_classes == 2:
                y_proba_arr = np.asarray(y_proba)
                if y_proba_arr.ndim == 2:
                    auc_roc = float(roc_auc_score(y_true_arr, y_proba_arr[:, 1]))
                else:
                    auc_roc = float(roc_auc_score(y_true_arr, y_proba_arr))
            else:
                # One-vs-rest AUC for multiclass
                auc_roc = float(
                    roc_auc_score(
                        y_true_arr, np.asarray(y_proba), multi_class="ovr", average="weighted"
                    )
                )
        except ValueError:
            auc_roc = None
    else:
        auc_roc = None

    # Compute metrics using weighted averaging
    # weighted accounts for class imbalance
    average = "weighted" if n_classes > 2 else "binary" if is_binary else "weighted"

    # For binary classification, need to ensure positive class is labeled as 1
    if is_binary and average == "binary":
        # Map classes to 0 and 1 if they aren't already
        if set(unique_classes) != {0, 1}:
            # Find positive class (assumed to be the larger value or second unique)
            positive_class = sorted(unique_classes)[1]
            y_true_binary = (y_true_arr == positive_class).astype(int)
            y_pred_binary = (y_pred_arr == positive_class).astype(int)
        else:
            y_true_binary = y_true_arr.astype(int)
            y_pred_binary = y_pred_arr.astype(int)

        f1 = float(f1_score(y_true_binary, y_pred_binary, average="binary"))
        precision = float(precision_score(y_true_binary, y_pred_binary, average="binary", zero_division=0))
        recall = float(recall_score(y_true_binary, y_pred_binary, average="binary", zero_division=0))
    else:
        f1 = float(f1_score(y_true_arr, y_pred_arr, average="weighted", zero_division=0))
        precision = float(precision_score(y_true_arr, y_pred_arr, average="weighted", zero_division=0))
        recall = float(recall_score(y_true_arr, y_pred_arr, average="weighted", zero_division=0))

    accuracy = float(accuracy_score(y_true_arr, y_pred_arr))

    result = {
        "f1": round(f1, 4),
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "accuracy": round(accuracy, 4),
    }

    if auc_roc is not None:
        result["auc_roc"] = round(auc_roc, 4)

    return result


def compute_regression_metrics(
    y_true: np.ndarray | list,
    y_pred: np.ndarray | list,
) -> dict[str, float]:
    """Compute regression metrics for model evaluation.

    Calculates RMSE, MAE, and R² score. Also computes residuals for residual plots.

    Args:
        y_true: Ground truth (correct) target values. Shape: (n_samples,).
        y_pred: Estimated targets as returned by a regressor. Shape: (n_samples,).

    Returns:
        dict: Regression metrics containing:
            - rmse: Root Mean Squared Error.
            - mae: Mean Absolute Error.
            - r2: R² score (coefficient of determination).
            - residuals: Array of residuals (y_pred - y_true) for plotting.

    Raises:
        ValueError: If y_true and y_pred have incompatible shapes or lengths.
    """
    y_true_arr = np.asarray(y_true, dtype=float)
    y_pred_arr = np.asarray(y_pred, dtype=float)

    if y_true_arr.shape != y_pred_arr.shape:
        raise ValueError(
            f"y_true and y_pred must have the same shape. "
            f"Got {y_true_arr.shape} and {y_pred_arr.shape}"
        )

    # Compute metrics
    # Use squared=False for RMSE as per scikit-learn best practice
    rmse = float(mean_squared_error(y_true_arr, y_pred_arr, squared=False))
    mae = float(mean_absolute_error(y_true_arr, y_pred_arr))
    r2 = float(r2_score(y_true_arr, y_pred_arr))

    # Compute residuals for residual plots
    residuals = (y_pred_arr - y_true_arr).tolist()

    return {
        "rmse": round(rmse, 4),
        "mae": round(mae, 4),
        "r2": round(r2, 4),
        "residuals": residuals,
    }


def compute_confusion_matrix(
    y_true: np.ndarray | list,
    y_pred: np.ndarray | list,
) -> dict[str, Any]:
    """Compute confusion matrix for classification tasks.

    For binary classification, returns TN, FP, FN, TP counts.
    For multiclass classification, returns the full N×N matrix with class labels.

    Args:
        y_true: Ground truth (correct) target values. Shape: (n_samples,).
        y_pred: Estimated targets as returned by a classifier. Shape: (n_samples,).

    Returns:
        dict: Confusion matrix data. For binary:
            - tn: True negatives count.
            - fp: False positives count.
            - fn: False negatives count.
            - tp: True positives count.
            For multiclass:
            - matrix: 2D list representing the N×N confusion matrix.
            - labels: List of class labels in order.

    Raises:
        ValueError: If y_true and y_pred have incompatible shapes or lengths.
    """
    y_true_arr = np.asarray(y_true)
    y_pred_arr = np.asarray(y_pred)

    if y_true_arr.shape != y_pred_arr.shape:
        raise ValueError(
            f"y_true and y_pred must have the same shape. "
            f"Got {y_true_arr.shape} and {y_pred_arr.shape}"
        )

    # Compute confusion matrix
    cm = sklearn_confusion_matrix(y_true_arr, y_pred_arr)

    # Get unique class labels sorted
    labels = sorted(np.unique(np.concatenate([y_true_arr, y_pred_arr])))
    n_classes = len(labels)

    if n_classes == 2:
        # For binary classification, return TN, FP, FN, TP
        # ravel() flattens the 2x2 matrix in row-major order:
        # [[tn, fp],
        #  [fn, tp]]
        tn, fp, fn, tp = cm.ravel()
        return {
            "tn": int(tn),
            "fp": int(fp),
            "fn": int(fn),
            "tp": int(tp),
        }
    else:
        # For multiclass, return the full N×N matrix
        return {
            "matrix": cm.tolist(),
            "labels": [str(label) for label in labels],
        }


def compute_subgroup_analysis(
    df: pd.DataFrame,
    y_true: np.ndarray | list,
    y_pred: np.ndarray | list,
    feature_cols: list[str] | None = None,
    max_subgroups: int = 10,
) -> list[dict[str, Any]]:
    """Compute subgroup/slice analysis for fairness and bias detection.

    Analyzes model performance across different subgroups defined by feature values.
    For categorical features, creates slices based on unique values. Flags subgroups
    where F1 score is significantly lower than overall F1 (threshold: 0.15).

    Args:
        df: DataFrame containing feature columns used for defining subgroups.
        y_true: Ground truth target values. Shape: (n_samples,).
        y_pred: Predicted target values. Shape: (n_samples,).
        feature_cols: List of column names to use for subgroup analysis.
            If None, auto-detects top categorical columns from df.
        max_subgroups: Maximum number of subgroups to analyze (default 10).

    Returns:
        list[dict]: Subgroup analysis results, each containing:
            - slice_name: Human-readable name of the subgroup.
            - slice_config: JSON-serializable config defining the slice.
            - n: Sample count in this subgroup.
            - metrics: Dict with f1, recall, precision for the subgroup.
            - fairness_warning: Boolean flag if group_f1 < overall_f1 - 0.15.
            - diagnostic_note: Optional diagnostic message for flagged subgroups.

    Raises:
        ValueError: If feature_cols contains columns not present in df.
    """
    y_true_arr = np.asarray(y_true)
    y_pred_arr = np.asarray(y_pred)

    # Auto-detect categorical columns if not specified
    if feature_cols is None:
        # Select columns with object or categorical dtype
        categorical_cols = []
        for col in df.columns:
            if df[col].dtype == "object" or pd.api.types.is_categorical_dtype(df[col]):
                # Only include if reasonable cardinality (< 50 unique values)
                if df[col].nunique() < 50:
                    categorical_cols.append(col)
        feature_cols = categorical_cols[:max_subgroups]
    else:
        # Validate columns exist
        missing_cols = [col for col in feature_cols if col not in df.columns]
        if missing_cols:
            raise ValueError(f"Feature columns not found in DataFrame: {missing_cols}")

    if len(feature_cols) == 0:
        return []

    # Compute overall metrics for fairness comparison
    try:
        overall_f1 = f1_score(y_true_arr, y_pred_arr, average="weighted", zero_division=0)
    except Exception:
        overall_f1 = 0.0

    results = []
    subgroup_count = 0

    for col in feature_cols:
        if subgroup_count >= max_subgroups:
            break

        # Get unique values in this column
        unique_values = df[col].dropna().unique()

        for value in unique_values[:max_subgroups - subgroup_count]:
            if subgroup_count >= max_subgroups:
                break

            # Create boolean mask for this subgroup
            mask = df[col] == value
            mask_arr = mask.values if hasattr(mask, "values") else np.asarray(mask)
            n_samples = int(mask_arr.sum())

            if n_samples < 5:  # Skip very small subgroups
                continue

            # Get subset of data for this subgroup
            y_true_subgroup = y_true_arr[mask_arr]
            y_pred_subgroup = y_pred_arr[mask_arr]

            # Compute metrics for this subgroup
            try:
                subgroup_f1 = f1_score(
                    y_true_subgroup, y_pred_subgroup, average="weighted", zero_division=0
                )
                subgroup_recall = recall_score(
                    y_true_subgroup, y_pred_subgroup, average="weighted", zero_division=0
                )
                subgroup_precision = precision_score(
                    y_true_subgroup, y_pred_subgroup, average="weighted", zero_division=0
                )
            except Exception:
                # Skip if metrics can't be computed (e.g., single class)
                continue

            # Check fairness warning threshold (SRS FR-EVAL-07)
            fairness_warning = subgroup_f1 < (overall_f1 - 0.15)
            diagnostic_note = None
            if fairness_warning:
                diagnostic_note = (
                    f"This subgroup has lower F1 ({subgroup_f1:.3f}) than the model "
                    f"average ({overall_f1:.3f}). Consider collecting more data or "
                    f"reviewing labeling for this segment."
                )

            results.append({
                "slice_name": f"{col}={value}",
                "slice_config": json.dumps({"column": col, "value": str(value)}),
                "n": n_samples,
                "metrics": {
                    "f1": round(subgroup_f1, 4),
                    "recall": round(subgroup_recall, 4),
                    "precision": round(subgroup_precision, 4),
                },
                "fairness_warning": fairness_warning,
                "diagnostic_note": diagnostic_note,
            })

            subgroup_count += 1

    return results


async def identify_best_run(experiment_id: str) -> dict[str, Any] | None:
    """Identify the best run from an experiment based on optimization metric.

    Queries all completed ("done") runs for the experiment, ranks them by the
    experiment's configured optimization metric from test_metrics_json, and
    returns the best run. Also stores the evaluation result in the evaluations
    table with split="test".

    Args:
        experiment_id: The UUID of the experiment to evaluate.

    Returns:
        dict | None: Best run information containing:
            - run_id: UUID of the best run.
            - model_type: Type of model for the best run.
            - metrics: Dict of metrics for the best run.
            - training_time_sec: Training duration in seconds.
            Or None if no completed runs found.

    Raises:
        ValueError: If the experiment does not exist.
    """
    async with async_session() as session:
        # Get the experiment to find the optimization metric
        exp_stmt = select(Experiment).where(Experiment.id == experiment_id)
        exp_result = await session.execute(exp_stmt)
        experiment = exp_result.scalar_one_or_none()

        if experiment is None:
            raise ValueError(f"Experiment not found: {experiment_id}")

        optimize_metric = experiment.optimize_metric

        # Get all "done" runs for this experiment
        runs_stmt = (
            select(Run)
            .where(Run.experiment_id == experiment_id)
            .where(Run.status == "done")
            .where(Run.test_metrics_json.isnot(None))
        )
        runs_result = await session.execute(runs_stmt)
        runs = runs_result.scalars().all()

        if not runs:
            return None

        # Parse metrics and find the best run
        runs_with_scores = []
        for run in runs:
            try:
                metrics = json.loads(run.test_metrics_json)
                score = metrics.get(optimize_metric, float("-inf"))

                # Handle metrics where lower is better (RMSE, MAE)
                if optimize_metric in ("rmse", "mae"):
                    # Negate for comparison (lower is better)
                    runs_with_scores.append((run, metrics, -score))
                else:
                    runs_with_scores.append((run, metrics, score))
            except (json.JSONDecodeError, TypeError):
                continue

        if not runs_with_scores:
            return None

        # Sort by score (descending) and get the best
        runs_with_scores.sort(key=lambda x: x[2], reverse=True)
        best_run, best_metrics, _ = runs_with_scores[0]

        # Get confusion matrix if available
        confusion_matrix = None
        threshold = 0.5

        # Check if there's already an evaluation for this run
        eval_stmt = (
            select(Evaluation)
            .where(Evaluation.run_id == best_run.id)
            .where(Evaluation.split == "test")
        )
        eval_result = await session.execute(eval_stmt)
        existing_eval = eval_result.scalar_one_or_none()

        if existing_eval:
            # Update existing evaluation with best run info
            existing_eval.metrics_json = json.dumps(best_metrics)
            if existing_eval.confusion_matrix_json:
                try:
                    confusion_matrix = json.loads(existing_eval.confusion_matrix_json)
                except json.JSONDecodeError:
                    pass
            threshold = existing_eval.threshold
            await session.commit()
        else:
            # Create new evaluation record for the best run
            # Note: Confusion matrix will be computed separately when predictions
            # are loaded from the Parquet file (see Task 106)
            new_eval = Evaluation(
                run_id=best_run.id,
                split="test",
                metrics_json=json.dumps(best_metrics),
                confusion_matrix_json=None,
                threshold=threshold,
            )
            session.add(new_eval)
            await session.commit()

        return {
            "run_id": best_run.id,
            "model_type": best_run.model_type,
            "metrics": best_metrics,
            "training_time_sec": best_run.training_time_sec,
            "confusion_matrix": confusion_matrix,
            "threshold": threshold,
        }


class ExperimentNotFoundError(Exception):
    """Raised when an experiment is not found."""

    def __init__(self, experiment_id: str) -> None:
        """Initialize with the missing experiment ID.

        Args:
            experiment_id: The ID of the experiment that was not found.
        """
        self.experiment_id = experiment_id
        super().__init__(f"Experiment not found: {experiment_id}")


class EvaluationError(Exception):
    """Raised when evaluation computation fails."""

    def __init__(self, message: str, details: dict | None = None) -> None:
        """Initialize with error message and optional details.

        Args:
            message: Human-readable error message.
            details: Additional context about the error.
        """
        self.message = message
        self.details = details or {}
        super().__init__(message)


def load_predictions(run_id: str, experiment_id: str) -> tuple[np.ndarray, np.ndarray, np.ndarray | None] | None:
    """Load test-set predictions from precomputed Parquet file.

    Loads y_true, y_pred, and y_proba from the predictions.parquet file
    stored during training. This enables fast threshold adjustment without
    re-running model inference.

    Args:
        run_id: The UUID of the run to load predictions for.
        experiment_id: The UUID of the experiment (for directory structure).

    Returns:
        tuple | None: (y_true, y_pred, y_proba) arrays if file exists and is valid,
            None if file doesn't exist or can't be loaded.
            y_proba may be None for non-probabilistic models.
    """
    from openneural_backend.config import Settings

    # Build the predictions file path
    # Per Task 106: {data_dir}/experiments/{experiment_id}/runs/{run_id}/predictions.parquet
    predictions_path = (
        Settings.get().data_dir
        / "experiments"
        / experiment_id
        / "runs"
        / run_id
        / "predictions.parquet"
    )

    if not predictions_path.exists():
        return None

    try:
        df = pd.read_parquet(predictions_path)

        # Extract columns
        y_true = df["y_true"].values
        y_pred = df["y_pred"].values

        # y_proba may not exist for non-probabilistic models
        if "y_proba" in df.columns:
            y_proba = df["y_proba"].values
            return y_true, y_pred, y_proba
        else:
            return y_true, y_pred, None

    except Exception:
        return None


def compute_metrics_with_threshold(
    y_true: np.ndarray,
    y_proba: np.ndarray,
    threshold: float,
) -> dict[str, float]:
    """Compute classification metrics with a specific threshold.

    Applies the threshold to probabilities and computes precision, recall, and F1.
    Optimized for low latency (< 200ms) by avoiding unnecessary computations.

    Args:
        y_true: Ground truth labels.
        y_proba: Predicted probabilities for the positive class.
        threshold: Decision threshold to apply.

    Returns:
        dict: Metrics containing precision, recall, and f1.
    """
    # Apply threshold to get binary predictions
    y_pred_thresh = (y_proba >= threshold).astype(int)

    # Compute metrics using weighted average for compatibility
    precision = float(precision_score(y_true, y_pred_thresh, average="weighted", zero_division=0))
    recall = float(recall_score(y_true, y_pred_thresh, average="weighted", zero_division=0))
    f1 = float(f1_score(y_true, y_pred_thresh, average="weighted", zero_division=0))

    return {
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
    }
