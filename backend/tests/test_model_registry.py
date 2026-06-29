"""Unit tests for the machine learning model spec registry.

Validates that all 12 models are correctly registered, classification and
regression spec counts are accurate, and unknown model keys raise KeyError.
"""

import sys
from unittest.mock import MagicMock
import pytest

# Mock xgboost module if not present to ensure all 12 models are registered
if "xgboost" not in sys.modules:
    mock_xgb = MagicMock()
    # Mock estimator classes
    mock_xgb.XGBClassifier = MagicMock
    mock_xgb.XGBRegressor = MagicMock
    sys.modules["xgboost"] = mock_xgb

# Now import the registry after xgboost is mocked, and reload to trigger registration
from openneural_backend.models.registry import (
    MODEL_REGISTRY,
    get_model,
    list_models,
    clear_registry,
    _register_builtin_models,
)

# Re-initialize registry with mocked xgboost active
clear_registry()
_register_builtin_models()


def test_registry_contains_all_12_models() -> None:
    """Verify that all 12 expected models are registered inside the central registry."""
    expected_keys = {
        # Classification
        "logistic_regression",
        "random_forest",
        "gradient_boosting",
        "xgboost",
        "svm",
        "knn",
        # Regression
        "ridge_regression",
        "random_forest_regressor",
        "gradient_boosting_regressor",
        "xgboost_regressor",
        "svr",
        "knn_regressor",
    }
    
    assert expected_keys.issubset(set(MODEL_REGISTRY.keys()))
    assert len(MODEL_REGISTRY) == 12


def test_list_models_classification_returns_exactly_6() -> None:
    """Verify that list_models('classification') returns exactly 6 classification models."""
    classification_models = list_models("classification")
    assert len(classification_models) == 6
    
    # Assert classification keys are correctly mapped
    expected_classification = {
        "logistic_regression",
        "random_forest",
        "gradient_boosting",
        "xgboost",
        "svm",
        "knn",
    }
    assert set(classification_models.keys()) == expected_classification


def test_list_models_regression_returns_exactly_6() -> None:
    """Verify that list_models('regression') returns exactly 6 regression models."""
    regression_models = list_models("regression")
    assert len(regression_models) == 6
    
    # Assert regression keys are correctly mapped
    expected_regression = {
        "ridge_regression",
        "random_forest_regressor",
        "gradient_boosting_regressor",
        "xgboost_regressor",
        "svr",
        "knn_regressor",
    }
    assert set(regression_models.keys()) == expected_regression


def test_get_model_raises_key_error_for_unknown_key() -> None:
    """Verify that looking up a non-registered model raises a KeyError."""
    with pytest.raises(KeyError) as exc_info:
        get_model("non_existent_neural_network_model_99")
        
    assert "not found in registry" in str(exc_info.value)
