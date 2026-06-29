"""
Pipeline Validator

This module provides validation for pipeline configurations. It checks for
structural issues, incompatible block orderings, and column reference validity
against a dataset schema.
"""

from typing import Any

from openneural_backend.pipeline.registry import is_registered


def validate_pipeline(
    blocks: list[dict[str, Any]],
    schema_columns: list[str] | None = None,
) -> dict[str, Any]:
    """Validate a pipeline configuration.

    Performs comprehensive validation on a pipeline configuration including:
    - Structural validation (valid block types, required parameters)
    - Ordering validation (split block must be last, logical ordering)
    - Column reference validation (columns exist in dataset schema)

    Args:
        blocks: List of block configurations, each containing:
            - type: Block type string
            - params: Dictionary of block parameters
        schema_columns: Optional list of column names in the dataset schema.
            If provided, validates that referenced columns exist.

    Returns:
        Dict with keys:
            - valid (bool): True if no errors, False otherwise
            - warnings (list): List of warning message strings
            - errors (list): List of error message strings

    Example:
        >>> blocks = [
        ...     {"type": "drop_nulls", "params": {}},
        ...     {"type": "scale_numeric_standard", "params": {"columns": ["age"]}},
        ...     {"type": "train_val_test_split", "params": {}}
        ... ]
        >>> result = validate_pipeline(blocks, schema_columns=["age", "income", "target"])
        >>> print(result)
        {'valid': True, 'warnings': [], 'errors': []}
    """
    errors: list[str] = []
    warnings: list[str] = []

    # Validate input structure
    if not isinstance(blocks, list):
        return {
            "valid": False,
            "warnings": [],
            "errors": ["Pipeline configuration must be a list of blocks"],
        }

    if not blocks:
        return {
            "valid": False,
            "warnings": [],
            "errors": ["Pipeline must contain at least one block"],
        }

    # Track state during validation
    block_types: list[str] = []
    has_split_block = False
    split_block_position: int | None = None
    column_modifications: dict[str, list[str]] = {}  # Track column additions/deletions

    # Validate each block
    for idx, block_config in enumerate(blocks):
        block_errors, block_warnings = _validate_block_structure(idx, block_config)
        errors.extend(block_errors)
        warnings.extend(block_warnings)

        if block_errors:
            # Skip further validation for this block if structure is invalid
            continue

        block_type = block_config.get("type", "")
        block_types.append(block_type)
        params = block_config.get("params", {})

        # Check for split block
        if block_type == "train_val_test_split":
            has_split_block = True
            split_block_position = idx

        # Track column modifications
        _track_column_modifications(column_modifications, block_type, params, idx)

    # Validate ordering constraints
    ordering_errors, ordering_warnings = _validate_block_ordering(
        blocks, block_types, has_split_block, split_block_position
    )
    errors.extend(ordering_errors)
    warnings.extend(ordering_warnings)

    # Validate column references against schema
    if schema_columns is not None:
        column_errors, column_warnings = _validate_column_references(
            blocks, schema_columns, column_modifications
        )
        errors.extend(column_errors)
        warnings.extend(column_warnings)

    # Validate logical ordering (e.g., imputation before scaling)
    logical_errors, logical_warnings = _validate_logical_ordering(block_types)
    errors.extend(logical_errors)
    warnings.extend(logical_warnings)

    return {
        "valid": len(errors) == 0,
        "warnings": warnings,
        "errors": errors,
    }


def _validate_block_structure(
    idx: int, block_config: Any
) -> tuple[list[str], list[str]]:
    """Validate the structure of a single block configuration.

    Args:
        idx: Block index for error messages.
        block_config: The block configuration to validate.

    Returns:
        Tuple of (errors, warnings) lists.
    """
    errors: list[str] = []
    warnings: list[str] = []

    if not isinstance(block_config, dict):
        errors.append(f"Block at index {idx} must be a dictionary")
        return errors, warnings

    # Check for required 'type' field
    if "type" not in block_config:
        errors.append(f"Block at index {idx} is missing required 'type' field")
        return errors, warnings

    block_type = block_config["type"]
    if not isinstance(block_type, str):
        errors.append(f"Block at index {idx}: 'type' must be a string")
        return errors, warnings

    # Check if block type is registered
    if not is_registered(block_type):
        errors.append(
            f"Block at index {idx}: Unknown block type '{block_type}'. "
            f"Ensure the block is registered in the pipeline registry."
        )
        return errors, warnings

    # Validate params field
    params = block_config.get("params")
    if params is not None and not isinstance(params, dict):
        errors.append(f"Block at index {idx}: 'params' must be a dictionary")
        return errors, warnings

    return errors, warnings


def _track_column_modifications(
    modifications: dict[str, list[str]],
    block_type: str,
    params: dict[str, Any],
    idx: int,
) -> None:
    """Track how columns are modified by blocks for later validation.

    Args:
        modifications: Dictionary to track modifications by column.
        block_type: The type of block.
        params: Block parameters.
        idx: Block index.
    """
    # Track which blocks add or remove columns
    if block_type in [
        "encode_categoricals_onehot",
        "encode_categoricals_ordinal",
    ]:
        # These blocks may add columns (one-hot) or modify existing
        cols = params.get("columns", [])
        for col in cols:
            if col not in modifications:
                modifications[col] = []
            modifications[col].append(f"{block_type} at index {idx}")

    elif block_type == "feature_selection":
        # This block removes columns
        cols = params.get("columns", [])
        for col in cols:
            if col not in modifications:
                modifications[col] = []
            modifications[col].append(f"removed by {block_type} at index {idx}")


def _validate_block_ordering(
    blocks: list[dict[str, Any]],
    block_types: list[str],
    has_split_block: bool,
    split_block_position: int | None,
) -> tuple[list[str], list[str]]:
    """Validate block ordering constraints.

    Args:
        blocks: List of block configurations.
        block_types: List of block type strings.
        has_split_block: Whether a split block is present.
        split_block_position: Index of split block if present.

    Returns:
        Tuple of (errors, warnings) lists.
    """
    errors: list[str] = []
    warnings: list[str] = []

    # Check that split block is last if present
    if has_split_block and split_block_position is not None:
        if split_block_position != len(blocks) - 1:
            errors.append(
                f"Train/Val/Test Split block must be the last block in the pipeline. "
                f"It is currently at position {split_block_position + 1} of {len(blocks)}. "
                f"Move it to the end of the pipeline."
            )

    # Check for multiple split blocks
    split_count = block_types.count("train_val_test_split")
    if split_count > 1:
        errors.append(
            f"Pipeline contains {split_count} Train/Val/Test Split blocks. "
            f"Only one split block is allowed per pipeline."
        )

    # Warn if no split block present
    if not has_split_block:
        warnings.append(
            "No Train/Val/Test Split block found in pipeline. "
            "Data will not be split into train/validation/test sets."
        )

    return errors, warnings


def _validate_column_references(
    blocks: list[dict[str, Any]],
    schema_columns: list[str],
    column_modifications: dict[str, list[str]],
) -> tuple[list[str], list[str]]:
    """Validate that referenced columns exist in the dataset schema.

    Args:
        blocks: List of block configurations.
        schema_columns: List of column names in the dataset schema.
        column_modifications: Dictionary tracking column modifications.

    Returns:
        Tuple of (errors, warnings) lists.
    """
    errors: list[str] = []
    warnings: list[str] = []

    schema_set = set(schema_columns)
    available_columns = set(schema_columns)  # Columns available at each step
    removed_columns: set[str] = set()

    for idx, block_config in enumerate(blocks):
        if not isinstance(block_config, dict):
            continue
        block_type = block_config.get("type", "")
        params = block_config.get("params", {})
        if not isinstance(params, dict):
            continue

        # Get columns referenced by this block
        referenced_cols = _get_referenced_columns(block_type, params)

        # Check if referenced columns exist in schema
        for col in referenced_cols:
            if col not in schema_set:
                errors.append(
                    f"Block at index {idx} ({block_type}): "
                    f"Referenced column '{col}' does not exist in dataset schema. "
                    f"Available columns: {sorted(schema_columns)}"
                )
            elif col in removed_columns:
                errors.append(
                    f"Block at index {idx} ({block_type}): "
                    f"Referenced column '{col}' was removed by an earlier block. "
                    f"Check the ordering of your feature selection and other blocks."
                )

        # Update available columns based on this block
        if block_type == "feature_selection":
            cols_to_remove = set(params.get("columns", []))
            removed_columns.update(cols_to_remove)
            available_columns -= cols_to_remove

    return errors, warnings


def _get_referenced_columns(block_type: str, params: dict[str, Any]) -> list[str]:
    """Extract column names referenced by a block configuration.

    Args:
        block_type: The type of block.
        params: Block parameters.

    Returns:
        List of column names referenced by this block.
    """
    # Blocks that have a 'columns' parameter
    column_param_blocks = {
        "drop_nulls",
        "fill_missing_mean",
        "fill_missing_median",
        "encode_categoricals_onehot",
        "encode_categoricals_ordinal",
        "scale_numeric_standard",
        "scale_numeric_minmax",
        "log_transform",
        "remove_outliers_iqr",
        "feature_selection",
    }

    if block_type in column_param_blocks:
        cols = params.get("columns", [])
        if isinstance(cols, list):
            return cols
        elif isinstance(cols, str):
            return [cols]

    # Special handling for split block's stratify column
    if block_type == "train_val_test_split":
        stratify_col = params.get("stratify_column")
        if stratify_col:
            return [stratify_col]

    return []


def _validate_logical_ordering(block_types: list[str]) -> tuple[list[str], list[str]]:
    """Validate logical ordering of blocks.

    Checks for common ordering issues that may cause problems:
    - Scaling before imputation (scaled values used for imputation)
    - Encoding before imputation (nulls may cause encoding errors)
    - Outlier removal before imputation (nulls affect outlier detection)

    Args:
        block_types: Ordered list of block type strings.

    Returns:
        Tuple of (errors, warnings) lists.
    """
    errors: list[str] = []
    warnings: list[str] = []

    # Find positions of relevant block types
    def find_positions(types_to_find: set[str]) -> list[int]:
        return [idx for idx, bt in enumerate(block_types) if bt in types_to_find]

    impute_positions = find_positions({"fill_missing_mean", "fill_missing_median"})
    scale_positions = find_positions({"scale_numeric_standard", "scale_numeric_minmax"})
    encode_positions = find_positions(
        {"encode_categoricals_onehot", "encode_categoricals_ordinal"}
    )
    outlier_positions = find_positions({"remove_outliers_iqr"})

    # Check: Scaling before imputation
    for scale_pos in scale_positions:
        for impute_pos in impute_positions:
            if scale_pos < impute_pos:
                warnings.append(
                    f"Scaling block at position {scale_pos + 1} occurs before "
                    f"imputation block at position {impute_pos + 1}. "
                    f"Consider moving imputation before scaling to ensure "
                    f"missing values are handled before scaling is applied."
                )

    # Check: Encoding before imputation
    for encode_pos in encode_positions:
        for impute_pos in impute_positions:
            if encode_pos < impute_pos:
                warnings.append(
                    f"Encoding block at position {encode_pos + 1} occurs before "
                    f"imputation block at position {impute_pos + 1}. "
                    f"Consider moving imputation before encoding to handle "
                    f"missing values that may cause encoding errors."
                )

    # Check: Outlier removal before imputation
    for outlier_pos in outlier_positions:
        for impute_pos in impute_positions:
            if outlier_pos < impute_pos:
                warnings.append(
                    f"Outlier removal block at position {outlier_pos + 1} occurs before "
                    f"imputation block at position {impute_pos + 1}. "
                    f"Consider moving imputation before outlier removal since "
                    f"missing values can affect outlier detection."
                )

    # Check: Multiple transformations on same columns without clear ordering
    transform_types = {
        "scale_numeric_standard",
        "scale_numeric_minmax",
        "log_transform",
        "encode_categoricals_onehot",
        "encode_categoricals_ordinal",
    }
    transform_positions = [
        (idx, bt) for idx, bt in enumerate(block_types) if bt in transform_types
    ]

    if len(transform_positions) > 2:
        warnings.append(
            f"Pipeline contains {len(transform_positions)} transformation blocks. "
            f"Ensure transformations are applied in the correct order: "
            f"imputation -> outlier removal -> encoding -> scaling."
        )

    return errors, warnings


def validate_block_params(block_type: str, params: dict[str, Any]) -> dict[str, Any]:
    """Validate parameters for a specific block type.

    Args:
        block_type: The type of block to validate.
        params: Parameters to validate.

    Returns:
        Dict with keys: valid (bool), warnings (list), errors (list).
    """
    errors: list[str] = []
    warnings: list[str] = []

    if not is_registered(block_type):
        return {
            "valid": False,
            "warnings": [],
            "errors": [f"Unknown block type: {block_type}"],
        }

    # Validate train_val_test_split specific parameters
    if block_type == "train_val_test_split":
        train = params.get("train", 0.70)
        val = params.get("val", 0.15)
        test = params.get("test", 0.15)

        total = train + val + test
        if not (0.999 <= total <= 1.001):
            errors.append(
                f"Split ratios must sum to 1.0, got train={train}, val={val}, "
                f"test={test} (sum={total})"
            )

        if train <= 0:
            errors.append("Training ratio must be greater than 0")

        for name, ratio in [("train", train), ("val", val), ("test", test)]:
            if ratio < 0 or ratio > 1:
                errors.append(f"{name} ratio must be between 0 and 1, got {ratio}")

    # Warn about potentially risky configurations
    if block_type in ["scale_numeric_standard", "scale_numeric_minmax"]:
        if not params.get("columns"):
            warnings.append(
                f"{block_type} will scale all numeric columns. "
                f"Ensure this is intended, or specify columns explicitly."
            )

    if block_type in ["encode_categoricals_onehot", "encode_categoricals_ordinal"]:
        if not params.get("columns"):
            warnings.append(
                f"{block_type} will encode all categorical columns. "
                f"Ensure this is intended, or specify columns explicitly."
            )

    return {
        "valid": len(errors) == 0,
        "warnings": warnings,
        "errors": errors,
    }
