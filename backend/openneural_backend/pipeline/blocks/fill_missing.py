"""
Fill Missing Values Pipeline Blocks

This module implements pipeline blocks for imputing missing values using
mean or median strategies. It wraps scikit-learn's SimpleImputer and handles
column selection via ColumnTransformer for applying different imputation
strategies to different columns.
"""

from typing import List, Optional, Union

import pandas as pd
from sklearn.base import TransformerMixin
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline as SklearnPipeline

from openneural_backend.pipeline.block_interface import PipelineBlock


def _validate_columns(X: pd.DataFrame, columns: List[str], block_name: str) -> None:
    """Validate that specified columns exist in the DataFrame.

    Args:
        X: The input DataFrame.
        columns: List of column names to validate.
        block_name: Name of the block for error messages.

    Raises:
        ValueError: If any specified column does not exist in X.
    """
    if not isinstance(X, pd.DataFrame):
        raise ValueError(f"Expected pandas DataFrame, got {type(X).__name__}")

    if columns:
        missing_cols = set(columns) - set(X.columns)
        if missing_cols:
            raise ValueError(
                f"{block_name}: Specified columns not found in data: {sorted(missing_cols)}"
            )


class FillMissingMeanBlock(PipelineBlock):
    """Pipeline block for filling missing values with the mean.

    This block imputes missing (null/NaN) values in specified numeric columns
    using the mean of each column computed from the training data. If no
columns are specified, all numeric columns are imputed.

    Parameters:
        columns: Optional list of column names to impute. If not provided,
            all numeric columns are imputed.

    Example:
        >>> block = FillMissingMeanBlock(columns=["age", "income"])
        >>> X_imputed = block.fit_transform(X)

        >>> # Impute all numeric columns
        >>> block = FillMissingMeanBlock()
        >>> X_imputed = block.fit_transform(X)
    """

    block_type = "fill_missing_mean"
    param_schema = {
        "type": "object",
        "properties": {
            "columns": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Column names to impute with mean. "
                               "If empty or not provided, all numeric columns are imputed.",
            }
        },
        "required": [],
    }

    def __init__(self, columns: Optional[List[str]] = None) -> None:
        """Initialize the FillMissingMeanBlock.

        Args:
            columns: Optional list of column names to impute. If None or empty,
                all numeric columns are imputed.
        """
        super().__init__(columns=columns if columns is not None else [])
        self._imputer: Optional[SimpleImputer] = None
        self._column_transformer: Optional[ColumnTransformer] = None

    def fit(self, X: pd.DataFrame, y: Optional[pd.Series] = None) -> "FillMissingMeanBlock":
        """Fit the imputer to the training data.

        Computes the mean for each specified numeric column from the training data.

        Args:
            X: Training data as a pandas DataFrame.
            y: Optional target values (ignored).

        Returns:
            self: The fitted block instance.

        Raises:
            ValueError: If any specified column does not exist in X.
        """
        columns = self.params.get("columns", [])
        _validate_columns(X, columns, "FillMissingMeanBlock")

        # If no columns specified, use all numeric columns
        if not columns:
            columns = X.select_dtypes(include=["number"]).columns.tolist()

        if not columns:
            # No numeric columns to impute
            self._is_fitted = True
            return self

        # Create SimpleImputer with mean strategy
        self._imputer = SimpleImputer(strategy="mean")

        # Wrap in ColumnTransformer to apply only to specified columns
        # Use remainder='passthrough' to keep other columns unchanged
        self._column_transformer = ColumnTransformer(
            transformers=[
                ("imputer", self._imputer, columns)
            ],
            remainder="passthrough",
            verbose_feature_names_out=False,
        )

        self._column_transformer.fit(X)
        self._is_fitted = True
        return self

    def transform(self, X: pd.DataFrame) -> pd.DataFrame:
        """Transform the data by filling missing values with the mean.

        Args:
            X: Input data as a pandas DataFrame.

        Returns:
            pd.DataFrame: DataFrame with missing values imputed.

        Raises:
            RuntimeError: If transform() is called before fit().
            ValueError: If the input is not a pandas DataFrame.
        """
        if not self._is_fitted:
            raise RuntimeError(
                "FillMissingMeanBlock has not been fitted. "
                "Call fit() before transform()."
            )

        if not isinstance(X, pd.DataFrame):
            raise ValueError(f"Expected pandas DataFrame, got {type(X).__name__}")

        if self._column_transformer is None:
            # No numeric columns were found during fit
            return X.copy()

        # Transform and convert back to DataFrame
        X_transformed = self._column_transformer.transform(X)

        # Get column names in the order they appear after transformation
        # ColumnTransformer applies transformers in order, then remainder columns
        imputed_cols = self._column_transformer.transformers_[0][2]  # columns from first transformer
        remainder_cols = [col for col in X.columns if col not in imputed_cols]
        output_columns = imputed_cols + remainder_cols

        return pd.DataFrame(X_transformed, columns=output_columns, index=X.index)

    def to_sklearn(self) -> Union[SimpleImputer, ColumnTransformer]:
        """Convert this block to a scikit-learn transformer.

        Returns:
            Union[SimpleImputer, ColumnTransformer]: A fitted scikit-learn
                compatible transformer. Returns the ColumnTransformer if
                columns were specified, otherwise the SimpleImputer.

        Raises:
            RuntimeError: If to_sklearn() is called before fit().
        """
        if not self._is_fitted:
            raise RuntimeError(
                "Cannot convert to sklearn transformer: "
                "FillMissingMeanBlock has not been fitted."
            )

        if self._column_transformer is not None:
            return self._column_transformer
        return self._imputer if self._imputer is not None else SimpleImputer(strategy="mean")


class FillMissingMedianBlock(PipelineBlock):
    """Pipeline block for filling missing values with the median.

    This block imputes missing (null/NaN) values in specified numeric columns
    using the median of each column computed from the training data. If no
columns are specified, all numeric columns are imputed.

    The median is more robust to outliers than the mean, making it a better
    choice when data contains extreme values.

    Parameters:
        columns: Optional list of column names to impute. If not provided,
            all numeric columns are imputed.

    Example:
        >>> block = FillMissingMedianBlock(columns=["age", "income"])
        >>> X_imputed = block.fit_transform(X)

        >>> # Impute all numeric columns
        >>> block = FillMissingMedianBlock()
        >>> X_imputed = block.fit_transform(X)
    """

    block_type = "fill_missing_median"
    param_schema = {
        "type": "object",
        "properties": {
            "columns": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Column names to impute with median. "
                               "If empty or not provided, all numeric columns are imputed.",
            }
        },
        "required": [],
    }

    def __init__(self, columns: Optional[List[str]] = None) -> None:
        """Initialize the FillMissingMedianBlock.

        Args:
            columns: Optional list of column names to impute. If None or empty,
                all numeric columns are imputed.
        """
        super().__init__(columns=columns if columns is not None else [])
        self._imputer: Optional[SimpleImputer] = None
        self._column_transformer: Optional[ColumnTransformer] = None

    def fit(self, X: pd.DataFrame, y: Optional[pd.Series] = None) -> "FillMissingMedianBlock":
        """Fit the imputer to the training data.

        Computes the median for each specified numeric column from the training data.

        Args:
            X: Training data as a pandas DataFrame.
            y: Optional target values (ignored).

        Returns:
            self: The fitted block instance.

        Raises:
            ValueError: If any specified column does not exist in X.
        """
        columns = self.params.get("columns", [])
        _validate_columns(X, columns, "FillMissingMedianBlock")

        # If no columns specified, use all numeric columns
        if not columns:
            columns = X.select_dtypes(include=["number"]).columns.tolist()

        if not columns:
            # No numeric columns to impute
            self._is_fitted = True
            return self

        # Create SimpleImputer with median strategy
        self._imputer = SimpleImputer(strategy="median")

        # Wrap in ColumnTransformer to apply only to specified columns
        self._column_transformer = ColumnTransformer(
            transformers=[
                ("imputer", self._imputer, columns)
            ],
            remainder="passthrough",
            verbose_feature_names_out=False,
        )

        self._column_transformer.fit(X)
        self._is_fitted = True
        return self

    def transform(self, X: pd.DataFrame) -> pd.DataFrame:
        """Transform the data by filling missing values with the median.

        Args:
            X: Input data as a pandas DataFrame.

        Returns:
            pd.DataFrame: DataFrame with missing values imputed.

        Raises:
            RuntimeError: If transform() is called before fit().
            ValueError: If the input is not a pandas DataFrame.
        """
        if not self._is_fitted:
            raise RuntimeError(
                "FillMissingMedianBlock has not been fitted. "
                "Call fit() before transform()."
            )

        if not isinstance(X, pd.DataFrame):
            raise ValueError(f"Expected pandas DataFrame, got {type(X).__name__}")

        if self._column_transformer is None:
            # No numeric columns were found during fit
            return X.copy()

        # Transform and convert back to DataFrame
        X_transformed = self._column_transformer.transform(X)

        # Get column names in order
        imputed_cols = self._column_transformer.transformers_[0][2]
        remainder_cols = [col for col in X.columns if col not in imputed_cols]
        output_columns = imputed_cols + remainder_cols

        return pd.DataFrame(X_transformed, columns=output_columns, index=X.index)

    def to_sklearn(self) -> Union[SimpleImputer, ColumnTransformer]:
        """Convert this block to a scikit-learn transformer.

        Returns:
            Union[SimpleImputer, ColumnTransformer]: A fitted scikit-learn
                compatible transformer. Returns the ColumnTransformer if
                columns were specified, otherwise the SimpleImputer.

        Raises:
            RuntimeError: If to_sklearn() is called before fit().
        """
        if not self._is_fitted:
            raise RuntimeError(
                "Cannot convert to sklearn transformer: "
                "FillMissingMedianBlock has not been fitted."
            )

        if self._column_transformer is not None:
            return self._column_transformer
        return self._imputer if self._imputer is not None else SimpleImputer(strategy="median")
