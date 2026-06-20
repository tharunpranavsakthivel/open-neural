"""Optuna Adapter for OpenNeural.

Provides functions to build Optuna objective functions from model registry
definitions. Bridges the gap between model search spaces and Optuna's
optimization API.

The build_optuna_objective function creates a callable that can be passed
to Optuna's optimize() method for hyperparameter search.
"""

from typing import Any, Callable, Dict, Union

import optuna
from sklearn.model_selection import cross_val_score

from openneural_backend.models.registry import get_model


# Mapping from OpenNeural metric names to scikit-learn scoring names
# Classification metrics
CLASSIFICATION_METRICS: Dict[str, str] = {
    "f1": "f1_weighted",
    "auc_roc": "roc_auc",
    "precision": "precision_weighted",
    "recall": "recall_weighted",
}

# Regression metrics
REGRESSION_METRICS: Dict[str, str] = {
    "rmse": "neg_root_mean_squared_error",
    "mae": "neg_mean_absolute_error",
    "r2": "r2",
}

# Combined metric map
METRIC_MAP: Dict[str, str] = {**CLASSIFICATION_METRICS, **REGRESSION_METRICS}


def _map_metric(metric: str, task_type: str) -> str:
    """Map OpenNeural metric names to scikit-learn scoring names.

    Args:
        metric: OpenNeural metric name (e.g., "f1", "auc_roc", "rmse").
        task_type: Task type ("classification" or "regression") for validation.

    Returns:
        str: scikit-learn scoring name compatible with cross_val_score.

    Raises:
        ValueError: If the metric is not recognized or incompatible with task type.

    Example:
        >>> _map_metric("f1", "classification")
        'f1_weighted'
        >>> _map_metric("rmse", "regression")
        'neg_root_mean_squared_error'
    """
    if metric in METRIC_MAP:
        return METRIC_MAP[metric]

    # If already a valid sklearn metric, return as-is
    return metric


def _suggest_parameter(
    trial: optuna.Trial,
    param_name: str,
    spec: tuple,
) -> Any:
    """Suggest a parameter value from Optuna trial based on parameter spec.

    Args:
        trial: Optuna trial object for parameter suggestion.
        param_name: Name of the hyperparameter.
        spec: Parameter specification tuple defining the distribution.
            Format: ("int", min, max), ("float", min, max),
                   ("categorical", [values]), or ("loguniform", min, max).

    Returns:
        Suggested parameter value from the trial.

    Raises:
        ValueError: If the parameter type is not recognized.
    """
    param_type = spec[0]

    if param_type == "int":
        # spec: ("int", min, max)
        return trial.suggest_int(param_name, spec[1], spec[2])
    elif param_type == "float":
        # spec: ("float", min, max)
        return trial.suggest_float(param_name, spec[1], spec[2])
    elif param_type == "categorical":
        # spec: ("categorical", [values])
        return trial.suggest_categorical(param_name, spec[1])
    elif param_type == "loguniform":
        # spec: ("loguniform", min, max)
        return trial.suggest_float(param_name, spec[1], spec[2], log=True)
    else:
        raise ValueError(
            f"Unknown parameter type '{param_type}' for parameter '{param_name}'. "
            f"Supported types: 'int', 'float', 'categorical', 'loguniform'."
        )


def build_optuna_objective(
    model_key: str,
    X_train: Any,
    y_train: Any,
    cv_folds: int,
    metric: str,
) -> Callable[[optuna.Trial], float]:
    """Build an Optuna objective function for hyperparameter optimization.

    Creates a callable that can be passed to Optuna's optimize() method.
    The objective function suggests hyperparameters from the model's search
    space, instantiates the model, runs cross-validation, and returns the
    mean CV score.

    Args:
        model_key: Key identifying the model in the MODEL_REGISTRY.
        X_train: Training feature matrix (numpy array or DataFrame).
        y_train: Training target vector (numpy array or Series).
        cv_folds: Number of cross-validation folds.
        metric: Scoring metric for cross-validation (e.g., "f1", "accuracy",
            "roc_auc" for classification; "neg_mean_squared_error",
            "r2" for regression).

    Returns:
        Callable[[optuna.Trial], float]: An objective function that accepts
        an Optuna trial and returns the mean CV score.

    Raises:
        KeyError: If the model_key is not found in the registry.
        ValueError: If the metric is not compatible with the task type.

    Example:
        >>> import optuna
        >>> from sklearn.datasets import load_iris
        >>> from sklearn.model_selection import train_test_split
        >>>
        >>> # Load data
        >>> X, y = load_iris(return_X_y=True)
        >>> X_train, X_test, y_train, y_test = train_test_split(
        ...     X, y, test_size=0.2, random_state=42
        ... )
        >>>
        >>> # Build objective
        >>> objective = build_optuna_objective(
        ...     model_key="random_forest",
        ...     X_train=X_train,
        ...     y_train=y_train,
        ...     cv_folds=5,
        ...     metric="f1_macro"
        ... )
        >>>
        >>> # Run Optuna study
        >>> study = optuna.create_study(direction="maximize")
        >>> study.optimize(objective, n_trials=25)
        >>> print(f"Best score: {study.best_value:.4f}")
        >>> print(f"Best params: {study.best_params}")
    """
    # Retrieve model specification from registry
    model_spec = get_model(model_key)

    # Map the metric to sklearn-compatible scoring name
    task_type = model_spec.task_types[0] if model_spec.task_types else "classification"
    sklearn_metric = _map_metric(metric, task_type)

    def objective(trial: optuna.Trial) -> float:
        """Optuna objective function for a single trial.

        Suggests hyperparameters from the model's search space,
        instantiates the model, runs cross-validation, and returns
        the mean CV score.

        Args:
            trial: Optuna trial object for parameter suggestion.

        Returns:
            float: Mean cross-validation score.
        """
        # Build hyperparameters by suggesting from search space
        hyperparams: Dict[str, Any] = {}
        for param_name, param_spec in model_spec.search_space.items():
            hyperparams[param_name] = _suggest_parameter(trial, param_name, param_spec)

        # Merge with default parameters (defaults take precedence)
        final_params = {**hyperparams, **model_spec.default_params}

        # Instantiate the model
        model = model_spec.model_class(**final_params)

        # Run cross-validation
        # For classification: use stratified CV by default
        # For regression: use standard KFold
        from sklearn.model_selection import StratifiedKFold, KFold

        if "classification" in model_spec.task_types:
            cv = StratifiedKFold(n_splits=cv_folds, shuffle=True, random_state=42)
        else:
            cv = KFold(n_splits=cv_folds, shuffle=True, random_state=42)

        # Compute cross-validation scores
        scores = cross_val_score(
            model,
            X_train,
            y_train,
            cv=cv,
            scoring=sklearn_metric,
            n_jobs=-1,
        )

        # Return mean score (Optuna will maximize this)
        return float(scores.mean())

    return objective


def build_objective_with_timeout(
    model_key: str,
    X_train: Any,
    y_train: Any,
    cv_folds: int,
    metric: str,
    timeout_seconds: float = 300.0,
) -> Callable[[optuna.Trial], float]:
    """Build an Optuna objective function with per-trial timeout.

    Wraps build_optuna_objective with a timeout mechanism using
    signal-based interruption. Falls back to the standard objective
    on platforms where signal.SIGALRM is not available (Windows).

    Args:
        model_key: Key identifying the model in the MODEL_REGISTRY.
        X_train: Training feature matrix.
        y_train: Training target vector.
        cv_folds: Number of cross-validation folds.
        metric: Scoring metric for cross-validation.
        timeout_seconds: Maximum time allowed per trial in seconds.

    Returns:
        Callable[[optuna.Trial], float]: An objective function with
        timeout handling.
    """
    import sys

    base_objective = build_optuna_objective(
        model_key, X_train, y_train, cv_folds, metric
    )

    # Windows doesn't support SIGALRM
    if sys.platform == "win32":
        return base_objective

    import signal

    def objective_with_timeout(trial: optuna.Trial) -> float:
        """Objective function with signal-based timeout.

        Raises:
            optuna.TrialPruned: If the trial exceeds the timeout.
        """
        def timeout_handler(signum: int, frame: Any) -> None:
            """Signal handler for timeout."""
            raise optuna.TrialPruned(f"Trial timed out after {timeout_seconds}s")

        # Set up the timeout signal
        old_handler = signal.signal(signal.SIGALRM, timeout_handler)
        signal.alarm(int(timeout_seconds))

        try:
            result = base_objective(trial)
        finally:
            # Cancel the alarm and restore the old handler
            signal.alarm(0)
            signal.signal(signal.SIGALRM, old_handler)

        return result

    return objective_with_timeout
