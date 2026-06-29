"""Unit tests for the pipeline configuration validator.

Validates that validate_pipeline detects structural ordering violations,
identifies logical and ordering warnings, detects column-not-in-schema errors,
and successfully verifies valid configurations with valid: True.
"""

from openneural_backend.pipeline.validator import validate_pipeline


def test_validator_split_not_last_raises_error() -> None:
    """Verify that a Train/Val/Test Split block placed before other blocks raises an error."""
    blocks = [
        {"type": "train_val_test_split", "params": {"train": 0.7, "val": 0.15, "test": 0.15}},
        {"type": "drop_nulls", "params": {"columns": ["col_a"]}},
    ]

    result = validate_pipeline(blocks, schema_columns=["col_a"])

    assert result["valid"] is False
    assert any(
        "Train/Val/Test Split block must be the last block in the pipeline" in err
        for err in result["errors"]
    )


def test_validator_incompatible_ordering_warnings() -> None:
    """Verify that logical order issues (e.g. scaling or encoding before imputation) trigger warnings."""
    # Scenario: scale_numeric_standard occurs before fill_missing_mean
    blocks = [
        {"type": "scale_numeric_standard", "params": {"columns": ["col_a"]}},
        {"type": "fill_missing_mean", "params": {"columns": ["col_a"]}},
    ]

    result = validate_pipeline(blocks, schema_columns=["col_a"])

    # Ordering issues trigger warnings, but can still be mathematically computed (so valid can be True or False depending on columns)
    assert any(
        "occurs before imputation block" in warn
        for warn in result["warnings"]
    )


def test_validator_column_not_in_schema_error() -> None:
    """Verify that referencing columns not present in the dataset schema returns an error."""
    blocks = [
        {"type": "drop_nulls", "params": {"columns": ["non_existent_column"]}},
    ]

    result = validate_pipeline(blocks, schema_columns=["col_a", "col_b"])

    assert result["valid"] is False
    assert any(
        "Referenced column 'non_existent_column' does not exist in dataset schema" in err
        for err in result["errors"]
    )


def test_validator_valid_pipeline_returns_valid_true() -> None:
    """Verify that a standard, logically-sound pipeline returns valid: True."""
    blocks = [
        {"type": "drop_nulls", "params": {"columns": ["col_a"]}},
        {"type": "fill_missing_mean", "params": {"columns": ["col_a"]}},
        {"type": "scale_numeric_standard", "params": {"columns": ["col_a"]}},
        {"type": "train_val_test_split", "params": {"train": 0.7, "val": 0.15, "test": 0.15}},
    ]

    result = validate_pipeline(blocks, schema_columns=["col_a"])

    assert result["valid"] is True
    assert len(result["errors"]) == 0


def test_validator_non_list_blocks() -> None:
    """Verify validate_pipeline handles blocks being non-list."""
    result = validate_pipeline("not a list", schema_columns=["col_a"])  # type: ignore
    assert result["valid"] is False
    assert "Pipeline configuration must be a list of blocks" in result["errors"][0]


def test_validator_empty_blocks() -> None:
    """Verify validate_pipeline handles empty blocks."""
    result = validate_pipeline([], schema_columns=["col_a"])
    assert result["valid"] is False
    assert "Pipeline must contain at least one block" in result["errors"][0]


def test_validator_block_non_dict() -> None:
    """Verify validate_pipeline handles blocks not being dictionaries."""
    result = validate_pipeline(["not a dict"], schema_columns=["col_a"])
    assert result["valid"] is False
    assert "Block at index 0 must be a dictionary" in result["errors"][0]


def test_validator_block_missing_type() -> None:
    """Verify validate_pipeline handles blocks missing 'type' field."""
    result = validate_pipeline([{"params": {}}], schema_columns=["col_a"])
    assert result["valid"] is False
    assert "Block at index 0 is missing required 'type' field" in result["errors"][0]


def test_validator_block_type_non_string() -> None:
    """Verify validate_pipeline handles blocks where 'type' is not a string."""
    result = validate_pipeline([{"type": 123}], schema_columns=["col_a"])
    assert result["valid"] is False
    assert "Block at index 0: 'type' must be a string" in result["errors"][0]


def test_validator_block_type_unregistered() -> None:
    """Verify validate_pipeline handles blocks where 'type' is unregistered."""
    result = validate_pipeline([{"type": "nonexistent_block_type"}], schema_columns=["col_a"])
    assert result["valid"] is False
    assert "Unknown block type" in result["errors"][0]


def test_validator_block_params_non_dict() -> None:
    """Verify validate_pipeline handles blocks where 'params' is not a dictionary."""
    result = validate_pipeline([{"type": "drop_nulls", "params": "not a dict"}], schema_columns=["col_a"])  # type: ignore
    assert result["valid"] is False
    assert "Block at index 0: 'params' must be a dictionary" in result["errors"][0]


def test_validator_multiple_splits() -> None:
    """Verify validate_pipeline raises error when multiple split blocks are present."""
    blocks = [
        {"type": "train_val_test_split", "params": {"train": 0.7, "val": 0.15, "test": 0.15}},
        {"type": "train_val_test_split", "params": {"train": 0.6, "val": 0.2, "test": 0.2}},
    ]
    result = validate_pipeline(blocks, schema_columns=["col_a"])
    assert result["valid"] is False
    assert any("Only one split block is allowed per pipeline" in err for err in result["errors"])


def test_validator_missing_split_warning() -> None:
    """Verify validate_pipeline warns when no split block is present."""
    blocks = [
        {"type": "drop_nulls", "params": {"columns": ["col_a"]}},
    ]
    result = validate_pipeline(blocks, schema_columns=["col_a"])
    assert result["valid"] is True
    assert any("No Train/Val/Test Split block found in pipeline" in warn for warn in result["warnings"])


def test_validator_removed_column_referenced() -> None:
    """Verify validate_pipeline handles referenced columns that were already removed."""
    blocks = [
        {"type": "feature_selection", "params": {"columns": ["col_a"]}},
        {"type": "drop_nulls", "params": {"columns": ["col_a"]}},
    ]
    result = validate_pipeline(blocks, schema_columns=["col_a"])
    assert result["valid"] is False
    assert any("Referenced column 'col_a' was removed by an earlier block" in err for err in result["errors"])


def test_validator_columns_as_string() -> None:
    """Verify validate_pipeline supports 'columns' passed as a string."""
    blocks = [
        {"type": "drop_nulls", "params": {"columns": "col_a"}},
    ]
    result = validate_pipeline(blocks, schema_columns=["col_a"])
    assert result["valid"] is True


def test_validator_stratify_column() -> None:
    """Verify validate_pipeline validates stratify_column."""
    blocks = [
        {"type": "train_val_test_split", "params": {"train": 0.7, "val": 0.15, "test": 0.15, "stratify_column": "nonexistent"}},
    ]
    result = validate_pipeline(blocks, schema_columns=["col_a"])
    assert result["valid"] is False
    assert any("Referenced column 'nonexistent' does not exist in dataset schema" in err for err in result["errors"])


def test_validator_logical_warnings() -> None:
    """Verify validate_pipeline checks logical ordering like encoding, outlier, scaling before imputation, and multiple transformations."""
    # Encoding before imputation
    blocks = [
        {"type": "encode_categoricals_onehot", "params": {"columns": ["col_a"]}},
        {"type": "fill_missing_mean", "params": {"columns": ["col_a"]}},
    ]
    result = validate_pipeline(blocks, schema_columns=["col_a"])
    assert any("Encoding block" in warn and "occurs before imputation block" in warn for warn in result["warnings"])

    # Outlier before imputation
    blocks = [
        {"type": "remove_outliers_iqr", "params": {"columns": ["col_a"]}},
        {"type": "fill_missing_mean", "params": {"columns": ["col_a"]}},
    ]
    result = validate_pipeline(blocks, schema_columns=["col_a"])
    assert any("Outlier removal block" in warn and "occurs before imputation block" in warn for warn in result["warnings"])

    # Multiple transformations warning
    blocks = [
        {"type": "scale_numeric_standard", "params": {"columns": ["col_a"]}},
        {"type": "scale_numeric_minmax", "params": {"columns": ["col_a"]}},
        {"type": "log_transform", "params": {"columns": ["col_a"]}},
    ]
    result = validate_pipeline(blocks, schema_columns=["col_a"])
    assert any("Pipeline contains 3 transformation blocks" in warn for warn in result["warnings"])


def test_validate_block_params() -> None:
    """Verify validate_block_params utility function."""
    from openneural_backend.pipeline.validator import validate_block_params

    # Unregistered block
    res = validate_block_params("unknown_block", {})
    assert res["valid"] is False
    assert "Unknown block type" in res["errors"][0]

    # Split incorrect sum
    res = validate_block_params("train_val_test_split", {"train": 0.5, "val": 0.1, "test": 0.1})
    assert res["valid"] is False
    assert "Split ratios must sum to 1.0" in res["errors"][0]

    # Split train <= 0
    res = validate_block_params("train_val_test_split", {"train": 0.0, "val": 0.5, "test": 0.5})
    assert res["valid"] is False
    assert "Training ratio must be greater than 0" in res["errors"][0]

    # Split out of range
    res = validate_block_params("train_val_test_split", {"train": 1.2, "val": -0.1, "test": -0.1})
    assert res["valid"] is False
    assert any("ratio must be between 0 and 1" in err for err in res["errors"])

    # Warnings for scale_numeric and encode_categoricals without columns
    res = validate_block_params("scale_numeric_standard", {})
    assert "will scale all numeric columns" in res["warnings"][0]

    res = validate_block_params("encode_categoricals_onehot", {})
    assert "will encode all categorical columns" in res["warnings"][0]

