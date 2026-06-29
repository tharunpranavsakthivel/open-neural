"""Model Registry for OpenNeural.

Defines the MODEL_REGISTRY mapping model key strings to ModelSpec dataclasses
containing model configuration, supported task types, default parameters,
and Optuna hyperparameter search spaces.

Exposes functions for looking up, listing, and registering models.
"""

from dataclasses import dataclass, field
from typing import Any

# Type alias for Optuna search space parameter specification
# Supports: int range ("int", min, max), float range ("float", min, max),
# categorical ("categorical", [values]), loguniform ("loguniform", min, max)
OptunaParamSpec = tuple


@dataclass
class ModelSpec:
    """Specification for a registered machine learning model.

    Encapsulates all metadata and configuration needed to instantiate,
    train, and optimize a model within the OpenNeural AutoML system.

    Attributes:
        model_class: The scikit-learn or XGBoost estimator class.
        task_types: List of task types this model supports
            (e.g., ["classification"], ["regression"], or both).
        default_params: Default hyperparameters for model instantiation.
        search_space: Optuna hyperparameter search space specification.
            Maps parameter names to OptunaParamSpec tuples defining
            the parameter distribution (type, min, max) or categorical options.
    """

    model_class: type[Any]
    task_types: list[str]
    default_params: dict[str, Any] = field(default_factory=dict)
    search_space: dict[str, OptunaParamSpec] = field(default_factory=dict)


# Central registry mapping model key strings to ModelSpec dataclasses
MODEL_REGISTRY: dict[str, ModelSpec] = {}


def register_model(key: str, spec: ModelSpec) -> None:
    """Register a model specification in the MODEL_REGISTRY.

    Associates a unique string key with a ModelSpec dataclass containing
    the model class, supported task types, default parameters, and
    hyperparameter search space.

    Args:
        key: Unique identifier for the model (e.g., "random_forest", "xgboost").
        spec: ModelSpec dataclass containing model configuration.

    Raises:
        ValueError: If the key is already registered.
        TypeError: If spec is not a ModelSpec instance.

    Example:
        >>> from sklearn.ensemble import RandomForestClassifier
        >>> spec = ModelSpec(
        ...     model_class=RandomForestClassifier,
        ...     task_types=["classification"],
        ...     default_params={"random_state": 42},
        ...     search_space={
        ...         "n_estimators": ("int", 50, 500),
        ...         "max_depth": ("int", 3, 20),
        ...     }
        ... )
        >>> register_model("random_forest", spec)
    """
    if not isinstance(spec, ModelSpec):
        raise TypeError(f"spec must be a ModelSpec instance, got {type(spec).__name__}")

    if key in MODEL_REGISTRY:
        raise ValueError(
            f"Model key '{key}' is already registered. "
            f"Use unregister_model('{key}') first if you want to replace it."
        )

    MODEL_REGISTRY[key] = spec


def get_model(key: str) -> ModelSpec:
    """Look up a model specification by its key.

    Args:
        key: The unique identifier for the model in the registry.

    Returns:
        ModelSpec: The model specification dataclass.

    Raises:
        KeyError: If the key is not found in the registry.

    Example:
        >>> spec = get_model("random_forest")
        >>> model = spec.model_class(**spec.default_params)
    """
    if key not in MODEL_REGISTRY:
        available = list(MODEL_REGISTRY.keys())
        raise KeyError(
            f"Model key '{key}' not found in registry. "
            f"Available models: {available}"
        )
    return MODEL_REGISTRY[key]


def list_models(task_type: str | None = None) -> dict[str, ModelSpec]:
    """List all registered models, optionally filtered by task type.

    Args:
        task_type: Optional filter to return only models supporting
            the specified task type (e.g., "classification" or "regression").
            If None, returns all registered models.

    Returns:
        Dict[str, ModelSpec]: Mapping from model keys to their specifications.

    Example:
        >>> all_models = list_models()
        >>> classification_models = list_models("classification")
        >>> for key, spec in classification_models.items():
        ...     print(f"{key}: {spec.model_class.__name__}")
    """
    if task_type is None:
        return dict(MODEL_REGISTRY)

    return {
        key: spec
        for key, spec in MODEL_REGISTRY.items()
        if task_type in spec.task_types
    }


def unregister_model(key: str) -> bool:
    """Unregister a model from the registry.

    Primarily useful for testing or for replacing built-in models
    with custom implementations.

    Args:
        key: The model key to unregister.

    Returns:
        bool: True if the model was removed, False if not found.
    """
    if key in MODEL_REGISTRY:
        del MODEL_REGISTRY[key]
        return True
    return False


def clear_registry() -> None:
    """Clear all registered models from the registry.

    WARNING: This removes ALL models including built-in ones.
    Primarily useful for testing. Use with caution.
    """
    MODEL_REGISTRY.clear()


def is_registered(key: str) -> bool:
    """Check if a model key is registered.

    Args:
        key: The model key to check.

    Returns:
        bool: True if registered, False otherwise.
    """
    return key in MODEL_REGISTRY


def _register_builtin_models() -> None:
    """Register all built-in models at import time.

    Populates the MODEL_REGISTRY with all standard OpenNeural models
    including scikit-learn and XGBoost estimators for classification
    and regression tasks.
    """
    # Import models here to avoid circular imports at module level
    try:
        from sklearn.ensemble import (
            GradientBoostingClassifier,
            GradientBoostingRegressor,
            RandomForestClassifier,
            RandomForestRegressor,
        )
        from sklearn.linear_model import LogisticRegression, Ridge
        from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
        from sklearn.svm import SVC, SVR

        # XGBoost is optional
        try:
            from xgboost import XGBClassifier, XGBRegressor

            XGBOOST_AVAILABLE = True
        except ImportError:
            XGBOOST_AVAILABLE = False

        # Classification models
        register_model(
            "logistic_regression",
            ModelSpec(
                model_class=LogisticRegression,
                task_types=["classification"],
                default_params={"max_iter": 1000, "random_state": 42},
                search_space={
                    "C": ("loguniform", 1e-3, 1e3),
                },
            ),
        )

        register_model(
            "random_forest",
            ModelSpec(
                model_class=RandomForestClassifier,
                task_types=["classification"],
                default_params={"random_state": 42, "n_jobs": -1},
                search_space={
                    "n_estimators": ("int", 50, 500),
                    "max_depth": ("int", 3, 20),
                    "min_samples_split": ("int", 2, 20),
                },
            ),
        )

        register_model(
            "gradient_boosting",
            ModelSpec(
                model_class=GradientBoostingClassifier,
                task_types=["classification"],
                default_params={"random_state": 42},
                search_space={
                    "n_estimators": ("int", 50, 300),
                    "max_depth": ("int", 2, 8),
                    "learning_rate": ("loguniform", 0.01, 0.3),
                },
            ),
        )

        if XGBOOST_AVAILABLE:
            register_model(
                "xgboost",
                ModelSpec(
                    model_class=XGBClassifier,
                    task_types=["classification"],
                    default_params={"random_state": 42, "n_jobs": -1},
                    search_space={
                        "n_estimators": ("int", 50, 500),
                        "max_depth": ("int", 3, 10),
                        "learning_rate": ("loguniform", 0.01, 0.3),
                        "subsample": ("float", 0.5, 1.0),
                    },
                ),
            )

        register_model(
            "svm",
            ModelSpec(
                model_class=SVC,
                task_types=["classification"],
                default_params={"random_state": 42, "probability": True},
                search_space={
                    "C": ("loguniform", 1e-2, 1e2),
                    "gamma": ("categorical", ["scale", "auto"]),
                },
            ),
        )

        register_model(
            "knn",
            ModelSpec(
                model_class=KNeighborsClassifier,
                task_types=["classification"],
                default_params={"n_jobs": -1},
                search_space={
                    "n_neighbors": ("int", 3, 25),
                    "weights": ("categorical", ["uniform", "distance"]),
                },
            ),
        )

        # Regression models
        register_model(
            "ridge_regression",
            ModelSpec(
                model_class=Ridge,
                task_types=["regression"],
                default_params={"random_state": 42},
                search_space={
                    "alpha": ("loguniform", 0.01, 100.0),
                    "solver": ("categorical", ["auto", "svd", "cholesky", "lsqr"]),
                },
            ),
        )

        register_model(
            "random_forest_regressor",
            ModelSpec(
                model_class=RandomForestRegressor,
                task_types=["regression"],
                default_params={"random_state": 42, "n_jobs": -1},
                search_space={
                    "n_estimators": ("int", 50, 500),
                    "max_depth": ("int", 3, 20),
                    "min_samples_split": ("int", 2, 20),
                    "min_samples_leaf": ("int", 1, 10),
                    "max_features": ("categorical", ["sqrt", "log2"]),
                },
            ),
        )

        register_model(
            "gradient_boosting_regressor",
            ModelSpec(
                model_class=GradientBoostingRegressor,
                task_types=["regression"],
                default_params={"random_state": 42},
                search_space={
                    "n_estimators": ("int", 50, 500),
                    "max_depth": ("int", 3, 10),
                    "learning_rate": ("loguniform", 0.01, 0.3),
                    "subsample": ("float", 0.5, 1.0),
                    "min_samples_split": ("int", 2, 20),
                },
            ),
        )

        if XGBOOST_AVAILABLE:
            register_model(
                "xgboost_regressor",
                ModelSpec(
                    model_class=XGBRegressor,
                    task_types=["regression"],
                    default_params={"random_state": 42, "n_jobs": -1},
                    search_space={
                        "n_estimators": ("int", 50, 500),
                        "max_depth": ("int", 3, 10),
                        "learning_rate": ("loguniform", 0.01, 0.3),
                        "subsample": ("float", 0.5, 1.0),
                        "colsample_bytree": ("float", 0.5, 1.0),
                        "min_child_weight": ("int", 1, 10),
                    },
                ),
            )

        register_model(
            "svr",
            ModelSpec(
                model_class=SVR,
                task_types=["regression"],
                default_params={},
                search_space={
                    "C": ("loguniform", 0.1, 100.0),
                    "kernel": ("categorical", ["rbf", "linear", "poly"]),
                    "gamma": ("categorical", ["scale", "auto"]),
                    "epsilon": ("loguniform", 0.001, 1.0),
                },
            ),
        )

        register_model(
            "knn_regressor",
            ModelSpec(
                model_class=KNeighborsRegressor,
                task_types=["regression"],
                default_params={"n_jobs": -1},
                search_space={
                    "n_neighbors": ("int", 3, 20),
                    "weights": ("categorical", ["uniform", "distance"]),
                    "metric": ("categorical", ["euclidean", "manhattan", "minkowski"]),
                },
            ),
        )

    except ImportError as e:
        # If sklearn is not available (should not happen in normal operation),
        # we log a warning but don't fail the import
        import warnings

        warnings.warn(f"Could not register built-in models: {e}")


# Register all built-in models at import time
_register_builtin_models()
