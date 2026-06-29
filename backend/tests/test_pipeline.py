"""Unit tests for the preprocessing pipeline builder and blocks.

Validates that build_sklearn_pipeline returns a valid scikit-learn Pipeline,
each of the 11 block types transforms data correctly on mock datasets,
and TrainValTestSplitBlock ratio validation and stratification function as expected.
"""

import numpy as np
import pandas as pd
import pytest
from sklearn.pipeline import Pipeline as SklearnPipeline

from openneural_backend.pipeline.builder import build_sklearn_pipeline
from openneural_backend.pipeline.blocks import (
    DropNullsBlock,
    EncodeCategoricalsOneHotBlock,
    EncodeCategoricalsOrdinalBlock,
    FeatureSelectionBlock,
    FillMissingMeanBlock,
    FillMissingMedianBlock,
    LogTransformBlock,
    RemoveOutliersIQRBlock,
    ScaleNumericMinMaxBlock,
    ScaleNumericStandardBlock,
    TrainValTestSplitBlock,
)


@pytest.fixture
def sample_numeric_df() -> pd.DataFrame:
    """Fixture with basic numeric columns containing some nulls and outliers."""
    return pd.DataFrame({
        "col_a": [1.0, 2.0, np.nan, 4.0, 100.0],  # Outlier at index 4 (100.0), Null at 2
        "col_b": [10.0, 20.0, 30.0, np.nan, 50.0],  # Null at 3
        "col_c": [5.0, 6.0, 7.0, 8.0, 9.0],
    })


@pytest.fixture
def sample_categorical_df() -> pd.DataFrame:
    """Fixture with categorical and string columns."""
    return pd.DataFrame({
        "cat_a": ["low", "medium", "high", "medium", "low"],
        "cat_b": ["yes", "no", "yes", "no", "yes"],
    })


@pytest.fixture
def stratification_df() -> pd.DataFrame:
    """Fixture with classes suitable for stratified splitting."""
    return pd.DataFrame({
        "feature_1": range(20),
        "target": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],  # balanced classes (10 of each)
    })


def test_build_sklearn_pipeline_produces_valid_pipeline() -> None:
    """Verify build_sklearn_pipeline creates a valid sklearn Pipeline with expected steps."""
    config = {
        "blocks": [
            {"type": "drop_nulls", "params": {"columns": ["col_a"]}},
            {"type": "scale_numeric_standard", "params": {"columns": ["col_a", "col_b"]}},
            {"type": "train_val_test_split", "params": {"train": 0.6, "val": 0.2, "test": 0.2}},
        ]
    }

    pipeline, split_config = build_sklearn_pipeline(config)

    assert isinstance(pipeline, SklearnPipeline)
    assert len(pipeline.steps) == 2  # The split block is handled separately

    # Check step names
    step_names = [step[0] for step in pipeline.steps]
    assert "step_0_drop_nulls" in step_names
    assert "step_1_scale_numeric_standard" in step_names

    # Check split config
    assert split_config is not None
    assert split_config["train"] == 0.6
    assert split_config["val"] == 0.2
    assert split_config["test"] == 0.2


# --- 11 Block Types Correct Transformation Tests ---

def test_drop_nulls_block(sample_numeric_df: pd.DataFrame) -> None:
    """Test 1: DropNullsBlock removes rows with missing values."""
    block = DropNullsBlock(columns=["col_a"])
    res = block.fit_transform(sample_numeric_df)
    
    # "col_a" has nan at index 2. This row should be dropped.
    assert len(res) == 4
    assert np.nan not in res["col_a"].values


def test_fill_missing_mean_block(sample_numeric_df: pd.DataFrame) -> None:
    """Test 2: FillMissingMeanBlock imputes nulls using column mean."""
    block = FillMissingMeanBlock(columns=["col_a"])
    res = block.fit_transform(sample_numeric_df)
    
    # col_a: [1.0, 2.0, nan, 4.0, 100.0] -> mean of non-nulls is (1+2+4+100)/4 = 26.75
    assert res.loc[2, "col_a"] == 26.75
    # col_b should not be imputed since it wasn't specified
    assert pd.isna(res.loc[3, "col_b"])


def test_fill_missing_median_block(sample_numeric_df: pd.DataFrame) -> None:
    """Test 3: FillMissingMedianBlock imputes nulls using column median."""
    block = FillMissingMedianBlock(columns=["col_a"])
    res = block.fit_transform(sample_numeric_df)
    
    # col_a: [1.0, 2.0, nan, 4.0, 100.0] -> median of non-nulls [1.0, 2.0, 4.0, 100.0] is (2.0 + 4.0)/2 = 3.0
    assert res.loc[2, "col_a"] == 3.0


def test_encode_categoricals_one_hot_block(sample_categorical_df: pd.DataFrame) -> None:
    """Test 4: EncodeCategoricalsOneHotBlock performs one-hot encoding on categorical/string variables."""
    block = EncodeCategoricalsOneHotBlock(columns=["cat_b"])
    res = block.fit_transform(sample_categorical_df)
    
    # cat_b had values "yes", "no"
    # Column "cat_b" is dropped, and new one-hot columns are created
    assert "cat_b" not in res.columns
    # Check generated column names format (usually "encoder__cat_b_yes" or similar depending on verbose_feature_names_out)
    assert any("cat_b_yes" in col or "cat_b_no" in col for col in res.columns)


def test_encode_categoricals_ordinal_block(sample_categorical_df: pd.DataFrame) -> None:
    """Test 5: EncodeCategoricalsOrdinalBlock maps categories to sequential integers."""
    block = EncodeCategoricalsOrdinalBlock(columns=["cat_a"])
    res = block.fit_transform(sample_categorical_df)
    
    # cat_a should be converted to numeric codes
    # low, medium, high should map to unique float/integer codes: {0.0, 1.0, 2.0}
    assert set(res["cat_a"].astype(float).unique()) == {0.0, 1.0, 2.0}


def test_scale_numeric_standard_block(sample_numeric_df: pd.DataFrame) -> None:
    """Test 6: ScaleNumericStandardBlock standardizes columns (mean=0, std=1)."""
    # Impute first so standard scaling doesn't error on nulls
    df_clean = sample_numeric_df.fillna(0.0)
    block = ScaleNumericStandardBlock(columns=["col_c"])
    res = block.fit_transform(df_clean)
    
    # col_c: [5, 6, 7, 8, 9] -> mean=7.0
    # verify res col_c has approximately 0 mean
    assert np.allclose(res["col_c"].mean(), 0.0, atol=1e-7)


def test_scale_numeric_min_max_block(sample_numeric_df: pd.DataFrame) -> None:
    """Test 7: ScaleNumericMinMaxBlock scales columns to range (default [0, 1])."""
    df_clean = sample_numeric_df.fillna(0.0)
    block = ScaleNumericMinMaxBlock(columns=["col_c"])
    res = block.fit_transform(df_clean)
    
    assert res["col_c"].min() == 0.0
    assert res["col_c"].max() == 1.0


def test_log_transform_block() -> None:
    """Test 8: LogTransformBlock applies log1p or log transformation."""
    df = pd.DataFrame({"col": [0.0, 1.0, 2.0]})
    block = LogTransformBlock(columns=["col"])
    res = block.fit_transform(df)
    
    # log1p(x) -> log(1) = 0.0, log(2), log(3)
    assert np.allclose(res.loc[0, "col"], 0.0)
    assert np.allclose(res.loc[1, "col"], np.log(2.0))


def test_remove_outliers_iqr_block(sample_numeric_df: pd.DataFrame) -> None:
    """Test 9: RemoveOutliersIQRBlock drops rows with severe outliers."""
    # We use a clean dataframe without nulls to focus on outliers
    df_clean = pd.DataFrame({
        "col_a": [1.0, 1.5, 1.2, 1.1, 100.0],  # 100.0 is clearly an outlier
    })
    block = RemoveOutliersIQRBlock(columns=["col_a"], iqr_multiplier=1.5)
    res = block.fit_transform(df_clean)
    
    # Outlier row 100.0 should be removed
    assert len(res) == 4
    assert 100.0 not in res["col_a"].values


def test_feature_selection_block(sample_numeric_df: pd.DataFrame) -> None:
    """Test 10: FeatureSelectionBlock drops the specified columns."""
    block = FeatureSelectionBlock(columns=["col_a", "col_c"])
    res = block.fit_transform(sample_numeric_df)
    
    # Re-verify that col_a and col_c are dropped, leaving only col_b
    assert list(res.columns) == ["col_b"]


def test_train_val_test_split_block_validation_and_stratification(stratification_df: pd.DataFrame) -> None:
    """Test 11 & TrainValTestSplitBlock: ratio validation, split partitions, and stratification."""
    # 1. Test ratio sum validation
    with pytest.raises(ValueError) as exc:
        TrainValTestSplitBlock(train=0.5, val=0.2, test=0.2)  # sums to 0.9, invalid
    assert "ratios must sum to 1.0" in str(exc.value)

    # 2. Test negative ratio validation
    with pytest.raises(ValueError):
        TrainValTestSplitBlock(train=-0.1, val=0.6, test=0.5)

    # Test ratio > 1.0 validation (covers line 108 in split.py)
    with pytest.raises(ValueError, match="must be at most 1.0"):
        TrainValTestSplitBlock(train=1.1, val=0.0, test=0.0)

    # Test train ratio == 0 validation (covers line 121 in split.py)
    with pytest.raises(ValueError, match="train ratio must be greater than 0"):
        TrainValTestSplitBlock(train=0.0, val=0.5, test=0.5)

    # Test empty dataframe split validation (covers line 158 in split.py)
    block_empty = TrainValTestSplitBlock(train=0.6, val=0.2, test=0.2)
    with pytest.raises(ValueError, match="Cannot split empty DataFrame"):
        block_empty.fit_transform(pd.DataFrame())

    # 3. Test stratification splits ratio accuracy
    block = TrainValTestSplitBlock(train=0.6, val=0.2, test=0.2, stratify_column="target")
    
    X = stratification_df[["feature_1", "target"]]
    y = stratification_df["target"]
    
    X_train, X_val, X_test, y_train, y_val, y_test = block.fit_transform(X, y)
    
    # 20 samples in total: 60% train (12), 20% val (4), 20% test (4)
    assert len(X_train) == 12
    assert len(X_val) == 4
    assert len(X_test) == 4
    
    # Verify target stratification proportions are preserved
    # Each split must have exactly 50% of target 0 and 50% of target 1
    assert (y_train == 0).sum() == 6
    assert (y_train == 1).sum() == 6
    assert (y_val == 0).sum() == 2
    assert (y_val == 1).sum() == 2
    assert (y_test == 0).sum() == 2
    assert (y_test == 1).sum() == 2


def test_blocks_not_fitted_runtime_error() -> None:
    """Verify that all block types raise RuntimeError when calling transform() or to_sklearn() before fit()."""
    from openneural_backend.pipeline.blocks import (
        DropNullsBlock,
        EncodeCategoricalsOneHotBlock,
        EncodeCategoricalsOrdinalBlock,
        FeatureSelectionBlock,
        FillMissingMeanBlock,
        FillMissingMedianBlock,
        LogTransformBlock,
        RemoveOutliersIQRBlock,
        ScaleNumericMinMaxBlock,
        ScaleNumericStandardBlock,
    )

    blocks = [
        DropNullsBlock(),
        EncodeCategoricalsOneHotBlock(),
        EncodeCategoricalsOrdinalBlock(),
        FeatureSelectionBlock(columns=["dummy_col"]),
        FillMissingMeanBlock(),
        FillMissingMedianBlock(),
        LogTransformBlock(),
        RemoveOutliersIQRBlock(),
        ScaleNumericMinMaxBlock(),
        ScaleNumericStandardBlock(),
    ]
    df = pd.DataFrame({"col": [1.0, 2.0]})
    for block in blocks:
        with pytest.raises(RuntimeError, match="has not been fitted"):
            block.transform(df)
        with pytest.raises(RuntimeError, match="has not been fitted"):
            block.to_sklearn()


def test_blocks_validation_errors() -> None:
    """Verify that blocks raise ValueError for invalid inputs and missing columns."""
    from openneural_backend.pipeline.blocks import (
        DropNullsBlock,
        EncodeCategoricalsOneHotBlock,
        EncodeCategoricalsOrdinalBlock,
        FillMissingMeanBlock,
        FillMissingMedianBlock,
        ScaleNumericStandardBlock,
        ScaleNumericMinMaxBlock,
        RemoveOutliersIQRBlock,
        LogTransformBlock,
    )
    df = pd.DataFrame({"col_a": [1.0, 2.0]})

    blocks = [
        DropNullsBlock(columns=["missing_col"]),
        EncodeCategoricalsOneHotBlock(columns=["missing_col"]),
        EncodeCategoricalsOrdinalBlock(columns=["missing_col"]),
        FillMissingMeanBlock(columns=["missing_col"]),
        FillMissingMedianBlock(columns=["missing_col"]),
        ScaleNumericStandardBlock(columns=["missing_col"]),
        ScaleNumericMinMaxBlock(columns=["missing_col"]),
        RemoveOutliersIQRBlock(columns=["missing_col"]),
        LogTransformBlock(columns=["missing_col"]),
    ]

    for block in blocks:
        with pytest.raises(ValueError, match="Specified columns not found in data"):
            block.fit(df)
        with pytest.raises(ValueError, match="Expected pandas DataFrame"):
            block.fit("not a dataframe")  # type: ignore
