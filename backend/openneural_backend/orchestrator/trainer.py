"""Trainer module for OpenNeural backend.

Provides the run_experiment async function for executing ML training experiments.
Handles loading data, building pipelines, running Optuna hyperparameter search,
computing metrics, and persisting results.

Exposes:
    run_experiment(experiment_id): Run a complete experiment training cycle.
"""

import asyncio
import json
import logging
from concurrent.futures import ProcessPoolExecutor
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import joblib
import optuna
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
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
from openneural_backend.db.models import DatasetSnapshot, Experiment, Pipeline, Run
from openneural_backend.models.optuna_adapter import build_optuna_objective
from openneural_backend.models.registry import get_model
from openneural_backend.pipeline.builder import build_sklearn_pipeline
from openneural_backend.pipeline.blocks.split import TrainValTestSplitBlock

logger = logging.getLogger(__name__)


# Metric mapping for test set evaluation
METRIC_FUNCTIONS = {
    "classification": {
        "f1": lambda y_true, y_pred: f1_score(y_true, y_pred, average="weighted"),
        "auc_roc": lambda y_true, y_pred_proba: roc_auc_score(y_true, y_pred_proba, multi_class="ovr"),
        "precision": lambda y_true, y_pred: precision_score(y_true, y_pred, average="weighted"),
        "recall": lambda y_true, y_pred: recall_score(y_true, y_pred, average="weighted"),
        "accuracy": accuracy_score,
    },
    "regression": {
        "rmse": lambda y_true, y_pred: mean_squared_error(y_true, y_pred, squared=False),
        "mae": mean_absolute_error,
        "r2": r2_score,
    },
}


def _compute_test_metrics(
    y_true: pd.Series,
    y_pred: pd.Series,
    y_pred_proba: Optional[pd.DataFrame],
    task_type: str,
    optimize_metric: str,
) -> Dict[str, float]:
    """Compute test set metrics for a trained model.

    Args:
        y_true: True target values.
        y_pred: Predicted target values.
        y_pred_proba: Predicted probabilities (for classification).
        task_type: "classification" or "regression".
        optimize_metric: The primary metric being optimized.

    Returns:
        dict: Dictionary of computed metrics.
    """
    metrics = {}

    if task_type == "classification":
        # Classification metrics
        metrics["f1"] = float(f1_score(y_true, y_pred, average="weighted"))
        metrics["precision"] = float(precision_score(y_true, y_pred, average="weighted"))
        metrics["recall"] = float(recall_score(y_true, y_pred, average="weighted"))
        metrics["accuracy"] = float(accuracy_score(y_true, y_pred))

        # ROC AUC (requires probability scores)
        if y_pred_proba is not None:
            try:
                if len(y_pred_proba.shape) > 1 and y_pred_proba.shape[1] > 1:
                    # Multi-class
                    metrics["auc_roc"] = float(roc_auc_score(y_true, y_pred_proba, multi_class="ovr"))
                else:
                    # Binary
                    metrics["auc_roc"] = float(roc_auc_score(y_true, y_pred_proba))
            except Exception:
                metrics["auc_roc"] = 0.0
    else:
        # Regression metrics
        metrics["rmse"] = float(mean_squared_error(y_true, y_pred, squared=False))
        metrics["mae"] = float(mean_absolute_error(y_true, y_pred))
        metrics["r2"] = float(r2_score(y_true, y_pred))

    return metrics


def _run_optuna_study(
    model_key: str,
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_test: pd.DataFrame,
    y_test: pd.Series,
    cv_folds: int,
    max_trials: int,
    metric: str,
    task_type: str,
) -> Dict[str, Any]:
    """Run a single Optuna study for a candidate model.

    This function runs in a separate process via ProcessPoolExecutor.

    Args:
        model_key: Model identifier from MODEL_REGISTRY.
        X_train: Training features.
        y_train: Training targets.
        X_test: Test features.
        y_test: Test targets.
        cv_folds: Number of CV folds.
        max_trials: Maximum Optuna trials.
        metric: Optimization metric.
        task_type: "classification" or "regression".

    Returns:
        dict: Study results containing best_params, cv_metrics, test_metrics, etc.
    """
    # Build Optuna objective
    objective = build_optuna_objective(
        model_key=model_key,
        X_train=X_train,
        y_train=y_train,
        cv_folds=cv_folds,
        metric=metric,
    )

    # Create and run study
    study = optuna.create_study(direction="maximize")
    study.optimize(objective, n_trials=max_trials, show_progress_bar=False)

    # Get best hyperparameters
    best_params = study.best_params

    # Train final model with best params
    model_spec = get_model(model_key)
    final_params = {**best_params, **model_spec.default_params}
    final_model = model_spec.model_class(**final_params)
    final_model.fit(X_train, y_train)

    # Predict on test set
    y_pred = final_model.predict(X_test)

    # Get probabilities for classification
    y_pred_proba = None
    if task_type == "classification" and hasattr(final_model, "predict_proba"):
        try:
            y_pred_proba = final_model.predict_proba(X_test)
        except Exception:
            pass

    # Compute test metrics
    test_metrics = _compute_test_metrics(
        y_test, y_pred,
        pd.DataFrame(y_pred_proba) if y_pred_proba is not None else None,
        task_type, metric,
    )

    # Cross-validation metrics from best trial
    cv_metrics = {
        "mean_cv_score": float(study.best_value),
        "n_trials": len(study.trials),
    }

    return {
        "model_key": model_key,
        "best_params": best_params,
        "cv_metrics": cv_metrics,
        "test_metrics": test_metrics,
        "training_time_sec": 0.0,  # Will be computed by caller
    }


async def run_experiment(experiment_id: str) -> Dict[str, Any]:
    """Run a complete experiment training cycle.

    Loads the snapshot Parquet file, builds the scikit-learn pipeline from config,
    executes train/val/test split, submits one Optuna study per candidate model
    to a ProcessPoolExecutor, updates run records as each study completes,
    computes test-set metrics for the best trial, persists all results,
    and marks the experiment as 'done'.

    Args:
        experiment_id: The UUID of the experiment to run.

    Returns:
        dict: Experiment results containing:
            - experiment_id: The experiment ID.
            - status: Final status ("done" or "failed").
            - runs: List of run results for each candidate model.
            - best_run: The best performing run.

    Raises:
        Exception: If experiment loading or execution fails.
    """
    logger.info(f"Starting experiment: {experiment_id}")

    # Load experiment configuration
    async with async_session() as session:
        # Get experiment
        exp_result = await session.execute(
            select(Experiment).where(Experiment.id == experiment_id)
        )
        experiment = exp_result.scalar_one_or_none()

        if experiment is None:
            raise ValueError(f"Experiment '{experiment_id}' not found")

        # Get pipeline
        pipeline_result = await session.execute(
            select(Pipeline).where(Pipeline.id == experiment.pipeline_id)
        )
        pipeline = pipeline_result.scalar_one_or_none()

        if pipeline is None:
            raise ValueError(f"Pipeline '{experiment.pipeline_id}' not found")

        # Get snapshot
        snapshot_result = await session.execute(
            select(DatasetSnapshot).where(DatasetSnapshot.id == pipeline.snapshot_id)
        )
        snapshot = snapshot_result.scalar_one_or_none()

        if snapshot is None:
            raise ValueError(f"Snapshot '{pipeline.snapshot_id}' not found")

        # Parse configurations
        pipeline_config = json.loads(pipeline.config_json)
        automl_config = json.loads(experiment.automl_config_json)
        candidate_models = experiment.candidate_models.split(",")

        # Get task type from project
        from openneural_backend.db.models import Project
        project_result = await session.execute(
            select(Project).where(Project.id == experiment.project_id)
        )
        project = project_result.scalar_one_or_none()
        task_type = project.task_type if project else "classification"

    # Load snapshot data (outside async session)
    stored_path = Path(snapshot.stored_path)
    df = pd.read_parquet(stored_path)

    # Identify target column from schema
    schema = json.loads(snapshot.schema_json)
    target_column = None
    for col in schema:
        if col.get("inferred_type") in ["boolean"]:
            target_column = col["name"]
            break

    if target_column is None:
        # Fallback: use last column as target
        target_column = df.columns[-1]

    logger.info(f"Loaded dataset: {len(df)} rows, {len(df.columns)} columns")
    logger.info(f"Target column: {target_column}")

    # Separate features and target
    X = df.drop(columns=[target_column])
    y = df[target_column]

    # Build sklearn pipeline and split config
    sklearn_pipeline, split_config = build_sklearn_pipeline(pipeline_config)

    # Apply preprocessing pipeline (fit on full data, then split)
    if sklearn_pipeline.steps:
        X_processed = sklearn_pipeline.fit_transform(X)
        X_processed = pd.DataFrame(X_processed, index=X.index)
    else:
        X_processed = X.copy()

    # Execute train/val/test split
    if split_config:
        split_block = TrainValTestSplitBlock(
            train=split_config.get("train", 0.70),
            val=split_config.get("val", 0.15),
            test=split_config.get("test", 0.15),
            stratify_column=split_config.get("stratify_column"),
        )

        # For stratification, we need the target column in X
        X_with_target = X_processed.copy()
        X_with_target[target_column] = y

        # Split the data
        X_train_full, X_val, X_test, y_train, y_val, y_test = split_block.fit_transform(
            X_with_target, y
        )

        # Remove target column from features
        X_train = X_train_full.drop(columns=[target_column]) if target_column in X_train_full.columns else X_train_full
        X_val = X_val.drop(columns=[target_column]) if target_column in X_val.columns else X_val
        X_test = X_test.drop(columns=[target_column]) if target_column in X_test.columns else X_test
    else:
        # Default 70/15/15 split
        from sklearn.model_selection import train_test_split
        X_temp, X_test, y_temp, y_test = train_test_split(
            X_processed, y, test_size=0.15, random_state=42, stratify=y if task_type == "classification" else None
        )
        X_train, X_val, y_train, y_val = train_test_split(
            X_temp, y_temp, test_size=0.176, random_state=42, stratify=y_temp if task_type == "classification" else None
        )

    logger.info(f"Data split: train={len(X_train)}, val={len(X_val)}, test={len(X_test)}")

    # Prepare run records
    run_records: Dict[str, str] = {}
    async with async_session() as session:
        for model_key in candidate_models:
            run = Run(
                experiment_id=experiment_id,
                model_type=model_key,
                hyperparams_json=json.dumps({}),
                status="queued",
            )
            session.add(run)
            await session.flush()
            run_records[model_key] = run.id
        await session.commit()

    # Run Optuna studies for each candidate model
    cv_folds = automl_config.get("cv_folds", 5)
    max_trials = automl_config.get("max_trials", 25)
    optimize_metric = experiment.optimize_metric

    results = []
    best_run_id = None
    best_test_score = float("-inf")

    # Submit studies to ProcessPoolExecutor
    loop = asyncio.get_event_loop()
    with ProcessPoolExecutor(max_workers=min(len(candidate_models), 4)) as executor:
        futures = []
        for model_key in candidate_models:
            future = loop.run_in_executor(
                executor,
                _run_optuna_study,
                model_key,
                X_train,
                y_train,
                X_test,
                y_test,
                cv_folds,
                max_trials,
                optimize_metric,
                task_type,
            )
            futures.append((model_key, future))

        # Process results as they complete
        for model_key, future in futures:
            try:
                start_time = datetime.utcnow()
                study_result = await future
                end_time = datetime.utcnow()
                training_time = (end_time - start_time).total_seconds()
                study_result["training_time_sec"] = training_time

                # Update run record
                run_id = run_records[model_key]
                async with async_session() as session:
                    result = await session.execute(
                        select(Run).where(Run.id == run_id)
                    )
                    run = result.scalar_one()
                    run.status = "done"
                    run.hyperparams_json = json.dumps(study_result["best_params"])
                    run.cv_metrics_json = json.dumps(study_result["cv_metrics"])
                    run.test_metrics_json = json.dumps(study_result["test_metrics"])
                    run.training_time_sec = training_time
                    await session.commit()

                results.append(study_result)

                # Track best run
                test_score = study_result["test_metrics"].get(optimize_metric, 0)
                if test_score > best_test_score:
                    best_test_score = test_score
                    best_run_id = run_id

                logger.info(f"Completed study for {model_key}: test_{optimize_metric}={test_score:.4f}")

            except Exception as e:
                logger.error(f"Study failed for {model_key}: {e}")
                run_id = run_records[model_key]
                async with async_session() as session:
                    result = await session.execute(
                        select(Run).where(Run.id == run_id)
                    )
                    run = result.scalar_one()
                    run.status = "failed"
                    await session.commit()

    # Mark experiment as done
    async with async_session() as session:
        result = await session.execute(
            select(Experiment).where(Experiment.id == experiment_id)
        )
        experiment = result.scalar_one()
        experiment.status = "done"
        experiment.completed_at = datetime.utcnow()
        await session.commit()

    logger.info(f"Experiment {experiment_id} completed. Best run: {best_run_id}")

    return {
        "experiment_id": experiment_id,
        "status": "done",
        "runs": results,
        "best_run_id": best_run_id,
    }
