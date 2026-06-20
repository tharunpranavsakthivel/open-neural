"""Model registry and optimization module for OpenNeural.

Exports the model registry functionality for model registration,
lookup, and listing, as well as Optuna adapter functions for
hyperparameter optimization.
"""

from openneural_backend.models.optuna_adapter import (
    CLASSIFICATION_METRICS,
    METRIC_MAP,
    REGRESSION_METRICS,
    build_objective_with_timeout,
    build_optuna_objective,
)
from openneural_backend.models.registry import (
    MODEL_REGISTRY,
    ModelSpec,
    OptunaParamSpec,
    clear_registry,
    get_model,
    is_registered,
    list_models,
    register_model,
    unregister_model,
)

__all__ = [
    "CLASSIFICATION_METRICS",
    "METRIC_MAP",
    "MODEL_REGISTRY",
    "ModelSpec",
    "OptunaParamSpec",
    "REGRESSION_METRICS",
    "build_objective_with_timeout",
    "build_optuna_objective",
    "clear_registry",
    "get_model",
    "is_registered",
    "list_models",
    "register_model",
    "unregister_model",
]
