"""Unit and integration tests for XGBClassifierWrapper.

Verifies that XGBoost can successfully perform classification on datasets with
string-based and boolean target variables without raising ValueError, and
correctly decodes prediction labels back to the original classes.
"""

import numpy as np
import pandas as pd
import pytest
from sklearn.model_selection import cross_val_score

from openneural_backend.models.registry import XGBClassifierWrapper, get_model


def test_xgb_classifier_wrapper_string_targets() -> None:
    """Verify that XGBClassifierWrapper transparently supports string-based target labels."""
    # Create simple classification dataset with string targets
    X = pd.DataFrame(np.random.randn(30, 4), columns=[f"feat_{i}" for i in range(4)])
    y = pd.Series(["malignant" if i % 2 == 0 else "benign" for i in range(30)])

    # Retrieve from registry and instantiate
    spec = get_model("xgboost")
    assert spec is not None
    assert spec.model_class == XGBClassifierWrapper

    model = spec.model_class(random_state=42)
    assert isinstance(model, XGBClassifierWrapper)

    # Fit with string targets - should succeed without raising ValueError
    model.fit(X, y)
    assert getattr(model, "_is_encoded", False) is True
    assert list(model.classes_) == ["benign", "malignant"]

    # Predict - should output string classes, not integers
    preds = model.predict(X)
    assert isinstance(preds, np.ndarray)
    assert preds.dtype.kind in "UO"  # Unicode string or object
    assert set(preds).issubset({"benign", "malignant"})

    # Check predict_proba
    probas = model.predict_proba(X)
    assert probas.shape == (30, 2)


def test_xgb_classifier_wrapper_integer_targets() -> None:
    """Verify that XGBClassifierWrapper maintains standard behavior for integer target labels."""
    X = pd.DataFrame(np.random.randn(30, 4), columns=[f"feat_{i}" for i in range(4)])
    y = pd.Series([1 if i % 2 == 0 else 0 for i in range(30)])

    model = XGBClassifierWrapper(random_state=42)
    model.fit(X, y)

    # Should not trigger encoding on integer targets
    assert getattr(model, "_is_encoded", False) is False

    # Predict should output integers
    preds = model.predict(X)
    assert np.issubdtype(preds.dtype, np.integer)
    assert set(preds).issubset({0, 1})


def test_xgb_classifier_wrapper_boolean_targets() -> None:
    """Verify that XGBClassifierWrapper transparently supports boolean target variables."""
    X = pd.DataFrame(np.random.randn(30, 4), columns=[f"feat_{i}" for i in range(4)])
    y = pd.Series([True if i % 2 == 0 else False for i in range(30)])

    model = XGBClassifierWrapper(random_state=42)
    model.fit(X, y)

    assert getattr(model, "_is_encoded", False) is True

    preds = model.predict(X)
    assert preds.dtype == bool
    assert set(preds).issubset({True, False})


def test_xgb_classifier_wrapper_cross_validation() -> None:
    """Verify that XGBClassifierWrapper can undergo cross-validation with string targets."""
    X = pd.DataFrame(np.random.randn(30, 4), columns=[f"feat_{i}" for i in range(4)])
    y = pd.Series(["malignant" if i % 2 == 0 else "benign" for i in range(30)])

    model = XGBClassifierWrapper(random_state=42)

    # Run cross-validation with scoring="f1_weighted"
    scores = cross_val_score(model, X, y, cv=3, scoring="f1_weighted")
    assert len(scores) == 3
    assert not np.isnan(scores).any()
    assert (scores >= 0.0).all() and (scores <= 1.0).all()
