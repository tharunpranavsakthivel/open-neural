"""Unit tests for training time estimator."""

from openneural_backend.orchestrator.estimator import estimate_training_time


def test_estimate_training_time_validation_guards() -> None:
    """Verify that negative or zero inputs are clamped correctly."""
    # Test zero/negative row_count, feature_count, and candidate_count
    time_clamped = estimate_training_time(
        row_count=0,
        feature_count=-10,
        candidate_count=0,
        automl_config={"max_trials": 5, "cv_folds": 2},
    )
    assert time_clamped > 0

    # Test medium datasets factor > 10 (size_multiplier factor ** 1.2)
    time_medium = estimate_training_time(
        row_count=2000,
        feature_count=100,
        candidate_count=1,
        automl_config={"max_trials": 1, "cv_folds": 2},
    )
    assert time_medium > 0

    # Test very large datasets factor > 100 (size_multiplier factor ** 1.5)
    time_large = estimate_training_time(
        row_count=100000,
        feature_count=1000,
        candidate_count=1,
        automl_config={"max_trials": 1, "cv_folds": 2},
    )
    assert time_large > 0
