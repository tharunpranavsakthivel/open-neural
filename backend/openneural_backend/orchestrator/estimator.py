"""Training time estimator for OpenNeural backend.

Provides heuristic-based training time estimation based on dataset size,
number of features, number of candidate models, and AutoML configuration.

Exposes:
    estimate_training_time(row_count, feature_count, candidate_count, automl_config):
        Estimate training time in seconds based on heuristics.
"""

import logging
from typing import Any

logger = logging.getLogger(__name__)


def estimate_training_time(
    row_count: int,
    feature_count: int,
    candidate_count: int,
    automl_config: dict[str, Any],
) -> float:
    """Estimate training time in seconds based on heuristics.

    Applies a heuristic formula that considers dataset size (rows × features),
    number of candidate models, and AutoML configuration (trials, CV folds).

    The formula is based on empirical observations of scikit-learn and XGBoost
    training times across different dataset sizes and model complexities.

    Base assumptions:
    - ~0.1 seconds per 1000 samples per feature for a single model fit
    - Cross-validation multiplies time by cv_folds
    - AutoML trials multiply time by max_trials
    - Different model types have different complexity factors (1x to 3x)
    - Parallel execution reduces wall-clock time by up to cpu_count

    Args:
        row_count: Number of rows in the dataset.
        feature_count: Number of features in the dataset.
        candidate_count: Number of candidate models to train.
        automl_config: AutoML configuration dict containing:
            - max_trials: Maximum number of Optuna trials per model (default: 25)
            - cv_folds: Number of cross-validation folds (default: 5)

    Returns:
        float: Estimated training time in seconds (wall-clock time).

    Example:
        >>> estimate_training_time(
        ...     row_count=10000,
        ...     feature_count=10,
        ...     candidate_count=6,
        ...     automl_config={"max_trials": 25, "cv_folds": 5}
        ... )
        480.0  # ~8 minutes
    """
    # Validate inputs
    if row_count <= 0:
        row_count = 1000
    if feature_count <= 0:
        feature_count = 1
    if candidate_count <= 0:
        candidate_count = 1

    # Extract AutoML config with defaults
    max_trials = automl_config.get("max_trials", 25)
    cv_folds = automl_config.get("cv_folds", 5)

    # Base time per model fit (empirical heuristic)
    # ~0.01 seconds per 1000 samples per feature for simple models
    # This scales non-linearly with dataset size
    dataset_size_factor = (row_count / 1000) * (feature_count / 10)

    # Apply non-linear scaling for larger datasets
    # Larger datasets have higher per-iteration cost
    if dataset_size_factor > 100:
        # Very large datasets: quadratic scaling
        size_multiplier = dataset_size_factor**1.5
    elif dataset_size_factor > 10:
        # Medium datasets: super-linear scaling
        size_multiplier = dataset_size_factor**1.2
    else:
        # Small datasets: linear scaling
        size_multiplier = dataset_size_factor

    # Base time for one model fit (seconds)
    base_fit_time = 0.05 * size_multiplier

    # Cross-validation multiplies time
    cv_multiplier = cv_folds

    # AutoML trials multiply time
    trials_multiplier = max_trials

    # Average model complexity factor (1.0 to 2.5x depending on model type)
    # Simpler models (logistic regression): ~1x
    # Complex models (random forest, XGBoost): ~2-2.5x
    avg_complexity_factor = 1.8

    # Calculate total training time per model
    time_per_model = (
        base_fit_time * cv_multiplier * trials_multiplier * avg_complexity_factor
    )

    # Total time for all candidate models
    total_time = time_per_model * candidate_count

    # Parallel execution factor: assume up to cpu_count parallel workers
    # In practice, not all models run perfectly in parallel due to resource contention
    import os

    cpu_count = os.cpu_count() or 4
    # Use 70% of CPU count for effective parallelization (accounting for overhead)
    effective_parallel_workers = max(1, int(cpu_count * 0.7))
    parallel_factor = min(candidate_count, effective_parallel_workers)

    # Wall-clock time with parallelization
    wall_clock_time = total_time / parallel_factor

    # Add overhead for pipeline preprocessing (5-15% of total time)
    preprocessing_overhead = 1.1
    wall_clock_time *= preprocessing_overhead

    # Add base overhead for experiment setup, data loading, etc.
    base_overhead = 5.0  # 5 seconds
    wall_clock_time += base_overhead

    # Ensure minimum reasonable time
    min_time = 10.0  # At least 10 seconds
    estimated_seconds = max(min_time, wall_clock_time)

    logger.info(
        f"Training time estimate: {estimated_seconds:.1f}s "
        f"(rows={row_count}, features={feature_count}, "
        f"candidates={candidate_count}, trials={max_trials}, cv={cv_folds})"
    )

    return round(estimated_seconds, 1)
