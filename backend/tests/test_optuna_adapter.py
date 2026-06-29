"""Unit tests for the Optuna search adapter.

Validates that build_optuna_objective returns a valid callable,
verifies that the objective function runs successfully on synthetic datasets
for both classification and regression models, tests parameter suggestion logic,
and checks metric mapping accuracy.
"""

import sys
from unittest.mock import MagicMock
import pytest
import numpy as np
import optuna

# Mock xgboost module if not present to ensure all models are registered and safe to use
if "xgboost" not in sys.modules:
    mock_xgb = MagicMock()
    mock_xgb.XGBClassifier = MagicMock
    mock_xgb.XGBRegressor = MagicMock
    sys.modules["xgboost"] = mock_xgb

from openneural_backend.models.optuna_adapter import (
    build_optuna_objective,
    build_objective_with_timeout,
    _map_metric,
    _suggest_parameter,
)


def test_map_metric_correctness() -> None:
    """Verify that _map_metric correctly maps OpenNeural metrics to sklearn scoring names."""
    # Test classification metrics mapping
    assert _map_metric("f1", "classification") == "f1_weighted"
    assert _map_metric("auc_roc", "classification") == "roc_auc"
    assert _map_metric("precision", "classification") == "precision_weighted"
    assert _map_metric("recall", "classification") == "recall_weighted"

    # Test regression metrics mapping
    assert _map_metric("rmse", "regression") == "neg_root_mean_squared_error"
    assert _map_metric("mae", "regression") == "neg_mean_absolute_error"
    assert _map_metric("r2", "regression") == "r2"

    # Test unknown metric passes through as-is
    assert _map_metric("accuracy", "classification") == "accuracy"
    assert _map_metric("custom_metric", "regression") == "custom_metric"


def test_suggest_parameter() -> None:
    """Verify that _suggest_parameter correctly suggests values using Optuna's trial suggest methods."""
    # Test int suggestion
    trial_int = MagicMock(spec=optuna.Trial)
    _suggest_parameter(trial_int, "param_int", ("int", 1, 10))
    trial_int.suggest_int.assert_called_once_with("param_int", 1, 10)

    # Test float suggestion
    trial_float = MagicMock(spec=optuna.Trial)
    _suggest_parameter(trial_float, "param_float", ("float", 0.1, 1.0))
    trial_float.suggest_float.assert_called_once_with("param_float", 0.1, 1.0)

    # Test categorical suggestion
    trial_cat = MagicMock(spec=optuna.Trial)
    _suggest_parameter(trial_cat, "param_cat", ("categorical", ["a", "b", "c"]))
    trial_cat.suggest_categorical.assert_called_once_with("param_cat", ["a", "b", "c"])

    # Test loguniform suggestion
    trial_log = MagicMock(spec=optuna.Trial)
    _suggest_parameter(trial_log, "param_log", ("loguniform", 1e-3, 1e-1))
    trial_log.suggest_float.assert_called_once_with("param_log", 1e-3, 1e-1, log=True)

    # Test unknown type raises ValueError
    trial_bad = MagicMock(spec=optuna.Trial)
    with pytest.raises(ValueError, match="Unknown parameter type 'unknown'"):
        _suggest_parameter(trial_bad, "param_bad", ("unknown", 1, 5))



def test_build_optuna_objective_returns_callable() -> None:
    """Verify that build_optuna_objective returns a callable function."""
    X = np.random.randn(20, 4)
    y = np.random.randint(0, 2, size=20)
    
    objective = build_optuna_objective(
        model_key="logistic_regression",
        X_train=X,
        y_train=y,
        cv_folds=3,
        metric="f1",
    )
    
    assert callable(objective)


def test_objective_runs_without_error_classification() -> None:
    """Verify that objective function runs without error on synthetic classification datasets."""
    # Create simple synthetic dataset
    X = np.random.randn(30, 4)
    y = np.random.randint(0, 2, size=30)

    # Build objective for logistic regression
    objective = build_optuna_objective(
        model_key="logistic_regression",
        X_train=X,
        y_train=y,
        cv_folds=3,
        metric="f1",
    )

    # Create an Optuna study and run one trial
    study = optuna.create_study(direction="maximize")
    study.optimize(objective, n_trials=1)

    assert len(study.trials) == 1
    assert study.best_value is not None
    assert isinstance(study.best_value, float)


def test_objective_runs_without_error_regression() -> None:
    """Verify that objective function runs without error on synthetic regression datasets."""
    # Create simple synthetic regression dataset
    X = np.random.randn(30, 4)
    y = np.random.randn(30)

    # Build objective for ridge regression
    objective = build_optuna_objective(
        model_key="ridge_regression",
        X_train=X,
        y_train=y,
        cv_folds=3,
        metric="rmse",
    )

    # Create an Optuna study and run one trial
    study = optuna.create_study(direction="maximize")
    study.optimize(objective, n_trials=1)

    assert len(study.trials) == 1
    assert study.best_value is not None
    assert isinstance(study.best_value, float)


def test_build_objective_with_timeout_returns_callable() -> None:
    """Verify that build_objective_with_timeout returns a callable and runs successfully."""
    X = np.random.randn(20, 4)
    y = np.random.randn(20)

    objective = build_objective_with_timeout(
        model_key="ridge_regression",
        X_train=X,
        y_train=y,
        cv_folds=2,
        metric="rmse",
        timeout_seconds=5.0,
    )

    assert callable(objective)

    study = optuna.create_study(direction="maximize")
    study.optimize(objective, n_trials=1)

    assert len(study.trials) == 1
