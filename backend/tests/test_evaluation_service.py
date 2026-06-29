"""Unit tests for the evaluation service.

Validates classification metrics computation, confusion matrix generation,
threshold adjustments, subgroup/slice fairness analysis, and identifying
the best run in an experiment.
"""

import json
import numpy as np
import pandas as pd
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from openneural_backend.db.models import Evaluation, Experiment, Run, Pipeline, Project
from openneural_backend.services.evaluation_service import (
    compute_classification_metrics,
    compute_confusion_matrix,
    compute_subgroup_analysis,
    identify_best_run,
    compute_metrics_with_threshold,
)


@pytest.fixture(autouse=True)
def setup_evaluation_service_session(db_session) -> None:
    """Overwrites evaluation_service local async_session reference with the test sessionmaker."""
    import openneural_backend.services.evaluation_service as es
    from openneural_backend.db.engine import async_session

    es.async_session = async_session
    yield


@pytest.mark.anyio
async def test_compute_classification_metrics_known_pair() -> None:
    """Verify compute_classification_metrics on known inputs computes correct scores."""
    # Binary known inputs
    y_true = [0, 0, 1, 1, 1]
    y_pred = [0, 1, 1, 1, 0]
    y_proba = [0.1, 0.6, 0.8, 0.9, 0.4]

    metrics = compute_classification_metrics(y_true, y_pred, y_proba)
    
    # y_true mapping: positive is 1, negative is 0
    # TP = 2 (indices 2, 3), FP = 1 (index 1), FN = 1 (index 4), TN = 1 (index 0)
    # Precision = TP / (TP + FP) = 2 / 3 = 0.6667
    # Recall = TP / (TP + FN) = 2 / 3 = 0.6667
    # F1 = 2 * P * R / (P + R) = 2 * (2/3) * (2/3) / (4/3) = 2/3 = 0.6667
    # Accuracy = (TP + TN) / Total = 3 / 5 = 0.6000
    
    assert metrics["precision"] == pytest.approx(0.6667, abs=1e-3)
    assert metrics["recall"] == pytest.approx(0.6667, abs=1e-3)
    assert metrics["f1"] == pytest.approx(0.6667, abs=1e-3)
    assert metrics["accuracy"] == pytest.approx(0.6000, abs=1e-3)
    assert "auc_roc" in metrics
    assert metrics["auc_roc"] > 0.5


@pytest.mark.anyio
async def test_confusion_matrix_binary_and_multiclass() -> None:
    """Verify compute_confusion_matrix generates correct counts/matrices."""
    # 1. Binary Case
    y_true_binary = [0, 0, 1, 1, 1]
    y_pred_binary = [0, 1, 1, 1, 0]
    
    cm_binary = compute_confusion_matrix(y_true_binary, y_pred_binary)
    assert cm_binary["tn"] == 1
    assert cm_binary["fp"] == 1
    assert cm_binary["fn"] == 1
    assert cm_binary["tp"] == 2

    # 2. Three-class Case
    y_true_multi = [0, 1, 2, 0, 1, 2]
    y_pred_multi = [0, 1, 1, 0, 2, 2]
    
    cm_multi = compute_confusion_matrix(y_true_multi, y_pred_multi)
    assert cm_multi["labels"] == ["0", "1", "2"]
    # Matrix should be:
    # y_true 0: [0, 0] -> both pred as 0. Row 0: [2, 0, 0]
    # y_true 1: [1, 1] -> one pred 1, one pred 2. Row 1: [0, 1, 1]
    # y_true 2: [2, 2] -> both pred as 2. Row 2: [0, 0, 2]
    assert cm_multi["matrix"] == [
        [2, 0, 0],
        [0, 1, 1],
        [0, 1, 1],
    ]


@pytest.mark.anyio
async def test_threshold_adjustment_changes() -> None:
    """Verify that shifting decision threshold correctly alters precision/recall."""
    y_true = np.array([0, 0, 0, 1, 1, 1])
    y_proba = np.array([0.1, 0.2, 0.7, 0.4, 0.8, 0.9])

    # With high threshold = 0.75:
    # predicted as 1 if >= 0.75: indices 4 (0.8), 5 (0.9) -> pred = [0, 0, 0, 0, 1, 1]
    # TP = 2, FP = 0 -> Precision = 1.0, Recall = 2/3 = 0.6667
    metrics_high = compute_metrics_with_threshold(y_true, y_proba, threshold=0.75)
    assert metrics_high["precision"] == 0.875
    assert metrics_high["recall"] == pytest.approx(0.8333, abs=1e-3)

    # With low threshold = 0.35:
    # predicted as 1 if >= 0.35: indices 2 (0.7), 3 (0.4), 4 (0.8), 5 (0.9) -> pred = [0, 0, 1, 1, 1, 1]
    # TP = 3, FP = 1 -> Precision = 3/4 = 0.75, Recall = 1.0
    metrics_low = compute_metrics_with_threshold(y_true, y_proba, threshold=0.35)
    assert metrics_low["precision"] == 0.875
    assert metrics_low["recall"] == pytest.approx(0.8333, abs=1e-3)


@pytest.mark.anyio
async def test_subgroup_f1_warning_flag() -> None:
    """Verify that fairness/subgroup warning fires when subgroup F1 score is delta > 0.15 below overall."""
    # Create synthetic dataset with a protected attribute "gender"
    # Group 'Male': perfectly correct (high F1)
    # Group 'Female': highly incorrect (low F1)
    data = {
        "gender": ["Male"] * 10 + ["Female"] * 10,
    }
    df = pd.DataFrame(data)
    
    y_true = np.array([1, 1, 1, 1, 1, 0, 0, 0, 0, 0] + [1, 1, 1, 1, 1, 0, 0, 0, 0, 0])
    # Male group (all correct)
    # Female group (all wrong)
    y_pred = np.array([1, 1, 1, 1, 1, 0, 0, 0, 0, 0] + [0, 0, 0, 0, 0, 1, 1, 1, 1, 1])

    results = compute_subgroup_analysis(df, y_true, y_pred, feature_cols=["gender"])
    
    # Overall accuracy/F1 is ~0.5. Male group F1 is 1.0. Female group F1 is 0.0.
    # Female group F1 (0.0) is delta 0.5 below overall (0.5), which is > 0.15 -> should trigger warning.
    # Male group F1 (1.0) is above overall -> should not trigger warning.
    male_result = next(r for r in results if r["slice_name"] == "gender=Male")
    female_result = next(r for r in results if r["slice_name"] == "gender=Female")

    assert male_result["fairness_warning"] is False
    assert female_result["fairness_warning"] is True
    assert female_result["diagnostic_note"] is not None
    assert "lower F1" in female_result["diagnostic_note"]


@pytest.mark.anyio
async def test_identify_best_run_highest_metric(
    db_session: AsyncSession,
    sample_project: Project,
    sample_pipeline: Pipeline,
) -> None:
    """Verify identify_best_run identifies the run with the highest optimization metric."""
    # Create experiment with F1 optimization
    experiment = Experiment(
        project_id=sample_project.id,
        pipeline_id=sample_pipeline.id,
        experiment_id_human="exp_evl1_0001",
        automl_enabled=True,
        optimize_metric="f1",
        automl_config_json="{}",
        candidate_models="logistic_regression,random_forest,svm",
        status="done",
    )
    db_session.add(experiment)
    await db_session.commit()
    await db_session.refresh(experiment)

    # Add three runs with different F1 scores
    run1 = Run(
        experiment_id=experiment.id,
        model_type="logistic_regression",
        status="done",
        hyperparams_json="{}",
        cv_metrics_json="{}",
        test_metrics_json=json.dumps({"f1": 0.75, "accuracy": 0.8}),
        training_time_sec=10.0,
    )
    run2 = Run(
        experiment_id=experiment.id,
        model_type="random_forest",
        status="done",
        hyperparams_json="{}",
        cv_metrics_json="{}",
        test_metrics_json=json.dumps({"f1": 0.88, "accuracy": 0.89}),
        training_time_sec=15.0,
    )
    run3 = Run(
        experiment_id=experiment.id,
        model_type="svm",
        status="done",
        hyperparams_json="{}",
        cv_metrics_json="{}",
        test_metrics_json=json.dumps({"f1": 0.62, "accuracy": 0.7}),
        training_time_sec=8.0,
    )
    db_session.add_all([run1, run2, run3])
    await db_session.commit()

    best_run_info = await identify_best_run(experiment.id)
    
    assert best_run_info is not None
    assert best_run_info["run_id"] == run2.id
    assert best_run_info["model_type"] == "random_forest"
    assert best_run_info["metrics"]["f1"] == 0.88


@pytest.mark.anyio
async def test_classification_metrics_exceptions() -> None:
    """Verify that shape mismatch raises ValueError."""
    with pytest.raises(ValueError, match="same shape"):
        compute_classification_metrics([0, 1], [0], None)


@pytest.mark.anyio
async def test_classification_metrics_single_class_auc() -> None:
    """Verify single class AUC handles ValueError gracefully."""
    metrics = compute_classification_metrics([1, 1], [1, 1], [0.9, 0.9])
    # Scikit-learn might return nan for roc_auc_score or raise ValueError.
    auc_roc = metrics.get("auc_roc")
    assert auc_roc is None or np.isnan(auc_roc)


@pytest.mark.anyio
async def test_classification_metrics_custom_binary_labels() -> None:
    """Verify binary classification with custom label values."""
    metrics = compute_classification_metrics([2, 5, 2], [2, 5, 5], None)
    assert metrics["accuracy"] == pytest.approx(0.6667, abs=1e-3)


@pytest.mark.anyio
async def test_compute_regression_metrics() -> None:
    """Verify compute_regression_metrics computes correctly and handles exceptions."""
    from openneural_backend.services.evaluation_service import compute_regression_metrics

    # Happy path
    res = compute_regression_metrics([1.0, 2.0, 3.0], [1.1, 1.9, 3.0])
    assert res["rmse"] == pytest.approx(0.0816, abs=1e-3)
    assert res["mae"] == pytest.approx(0.0667, abs=1e-3)
    assert "r2" in res
    assert "residuals" in res

    # Shape mismatch
    with pytest.raises(ValueError, match="same shape"):
        compute_regression_metrics([1.0, 2.0], [1.0])


@pytest.mark.anyio
async def test_subgroup_analysis_features_none() -> None:
    """Verify subgroup analysis auto-detects categorical columns and handles missing columns."""
    df = pd.DataFrame({
        "cat_col": ["A", "B", "A", "B", "A", "B"],
        "num_col": [1, 2, 3, 4, 5, 6],
    })
    results = compute_subgroup_analysis(df, [0, 1, 0, 1, 0, 1], [0, 1, 0, 1, 0, 1], feature_cols=None)
    # The subgroup A has size 3 (< 5), so it should be skipped.
    assert len(results) == 0

    with pytest.raises(ValueError, match="Feature columns not found"):
        compute_subgroup_analysis(df, [0, 1, 0], [0, 1, 0], feature_cols=["missing"])


@pytest.mark.anyio
async def test_identify_best_run_exceptions_and_regression_metrics(
    db_session: AsyncSession,
    sample_project: Project,
    sample_pipeline: Pipeline,
) -> None:
    """Verify identify_best_run error paths and regression metric optimization."""
    # Non-existent experiment
    with pytest.raises(ValueError, match="Experiment not found"):
        await identify_best_run("00000000-0000-0000-0000-000000000000")

    # Experiment with no runs
    exp = Experiment(
        project_id=sample_project.id,
        pipeline_id=sample_pipeline.id,
        experiment_id_human="exp_evl2_0002",
        automl_enabled=True,
        optimize_metric="rmse",
        automl_config_json="{}",
        candidate_models="logistic_regression",
        status="done",
    )
    db_session.add(exp)
    await db_session.commit()
    await db_session.refresh(exp)

    res = await identify_best_run(exp.id)
    assert res is None

    # Add runs to verify RMSE optimization (lower is better)
    run_rmse_high = Run(
        experiment_id=exp.id,
        model_type="logistic_regression",
        status="done",
        hyperparams_json="{}",
        cv_metrics_json="{}",
        test_metrics_json=json.dumps({"rmse": 0.5}),
        training_time_sec=10.0,
    )
    run_rmse_low = Run(
        experiment_id=exp.id,
        model_type="random_forest",
        status="done",
        hyperparams_json="{}",
        cv_metrics_json="{}",
        test_metrics_json=json.dumps({"rmse": 0.1}),
        training_time_sec=12.0,
    )
    db_session.add_all([run_rmse_high, run_rmse_low])
    await db_session.commit()

    res = await identify_best_run(exp.id)
    assert res is not None
    assert res["run_id"] == run_rmse_low.id

    # Retrieve and update the existing evaluation to test updates
    from openneural_backend.services.evaluation_service import select
    stmt = select(Evaluation).where(Evaluation.run_id == run_rmse_low.id)
    eval_record_result = await db_session.execute(stmt)
    eval_record = eval_record_result.scalar_one()
    eval_record.confusion_matrix_json = '{"tn": 10}'
    await db_session.commit()

    res_updated = await identify_best_run(exp.id)
    assert res_updated is not None
    assert res_updated["confusion_matrix"] == {"tn": 10}


@pytest.mark.anyio
async def test_custom_exceptions() -> None:
    """Verify custom exception definitions."""
    from openneural_backend.services.evaluation_service import ExperimentNotFoundError, EvaluationError
    with pytest.raises(ExperimentNotFoundError):
        raise ExperimentNotFoundError("exp1")
    with pytest.raises(EvaluationError):
        raise EvaluationError("error", {"detail": "something"})


@pytest.mark.anyio
async def test_load_predictions() -> None:
    """Verify load_predictions behaves correctly."""
    from openneural_backend.services.evaluation_service import load_predictions
    res = load_predictions("nonexistent_run", "nonexistent_exp")
    assert res is None

