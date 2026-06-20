"""
Log Transform Pipeline Block

This module implements a pipeline block for applying logarithmic transformation
to numeric columns using np.log1p. The log1p function computes log(1 + x),
which is useful for handling zero or near-zero values that would cause
undefined results with a standard log transform.
"""

from typing import List, Optional, Union

import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import FunctionTransformer

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


def _log1p_transform(X: np.ndarray) -> np.ndarray:
    """Apply log1p transformation to numeric data.

    Computes log(1 + x) element-wise. This is safer than log(x) for
    data containing zeros or small positive values.

    Args:
        X: Input array of numeric values. Should be non-negative.

    Returns:
        np.ndarray: Transformed array with log1p applied.

    Raises:
        RuntimeWarning: If input contains negative values, may produce NaN.
    """
    return np.log1p(X)


def _log1p_inverse_transform(X: np.ndarray) -> np.ndarray:
    """Apply inverse of log1p transformation (expm1).

    Computes exp(x) - 1 element-wise, which is the inverse of log1p.

    Args:
        X: Input array of log-transformed values.

    Returns:
        np.ndarray: Inverse transformed array.
    """
    return np.expm1(X)


class LogTransformer(BaseEstimator, TransformerMixin):
    """Scikit-learn compatible transformer that applies log1p transformation.

    This transformer applies the natural logarithm of 1 + x to numeric columns.
    The log1p function is useful for:
    - Reducing skewness in right-skewed distributions
    - Handling data with zeros (since log(0) is undefined, but log1p(0) = 0)
    - Making multiplicative relationships additive

    The transformation is invertible via the expm1 function (exp(x) - 1).

    Attributes:
        columns (List[str]): List of column names to transform.

    Example:
        >>> transformer = LogTransformer(columns=["income", "sales"])
        >>> X_transformed = transformer.fit_transform(X)
    """

    def __init__(self, columns: Optional[List[str]] = None) -> None:
        """Initialize the transformer.

        Args:
            columns: List of column names to transform. If None or empty,
                all numeric columns are transformed. Defaults to None.
        """
        self.columns = columns if columns is not None else []

    def fit(self, X: pd.DataFrame, y: Optional[pd.Series] = None) -> "LogTransformer":
        """Fit the transformer to the data.

        For LogTransformer, fitting validates that the specified columns exist
        and checks that data is suitable for log transformation (non-negative).

        Args:
            X: Training data as a pandas DataFrame.
            y: Optional target values (ignored).

        Returns:
            self: The fitted transformer instance.

        Raises:
            ValueError: If any specified column does not exist in X.
            ValueError: If data contains negative values in specified columns.
        """
        if not isinstance(X, pd.DataFrame):
            raise ValueError(f"Expected pandas DataFrame, got {type(X).__name__}")

        # Determine columns to transform
        columns_to_check = self.columns if self.columns else X.select_dtypes(
            include=["number"]
        ).columns.tolist()

        if columns_to_check:
            missing_cols = set(columns_to_check) - set(X.columns)
            if missing_cols:
                raise ValueError(
                    f"Specified columns not found in data: {sorted(missing_cols)}"
                )

            # Check for negative values
            for col in columns_to_check:
                if col in X.columns and (X[col] < 0).any():
                    raise ValueError(
                        f"Column '{col}' contains negative values. "
                        f"Log transformation requires non-negative values."
                    )

        return self

    def transform(self, X: pd.DataFrame) -> pd.DataFrame:
        """Transform the data by applying log1p.

        Args:
            X: Input data as a pandas DataFrame.

        Returns:
            pd.DataFrame: DataFrame with log1p applied to specified columns.

        Raises:
            ValueError: If the input is not a pandas DataFrame.
        """
        if not isinstance(X, pd.DataFrame):
            raise ValueError(f"Expected pandas DataFrame, got {type(X).__name__}")

        columns_to_transform = self.columns if self.columns else X.select_dtypes(
            include=["number"]
        ).columns.tolist()

        if not columns_to_transform:
            return X.copy()

        # Create a copy to avoid modifying original
        X_transformed = X.copy()

        # Apply log1p to specified columns
        for col in columns_to_transform:
            if col in X_transformed.columns:
                X_transformed[col] = np.log1p(X_transformed[col])

        return X_transformed


class LogTransformBlock(PipelineBlock):
    """Pipeline block for log transformation of numeric columns.

    This block applies the natural logarithm of 1 + x (log1p) to specified
    numeric columns. This transformation is useful for:

    - Right-skewed data (e.g., income, population, sales)
    - Data with zeros or small positive values (log1p handles zeros safely)
    - Making multiplicative relationships linear/additive
    - Reducing the impact of outliers

    The log1p function is preferred over log because:
    - log(0) is undefined (-inf), but log1p(0) = 0
    - More numerically stable for small values

    Note: Input data must be non-negative (>= 0). Negative values will raise
    an error since log of negative numbers is undefined.

    Parameters:
        columns: Optional list of column names to transform. If not provided,
            all numeric columns are transformed.

    Example:
        >>> block = LogTransformBlock(columns=["income", "sales"])
        >>> X_transformed = block.fit_transform(X)

        >>> # Transform all numeric columns
        >>> block = LogTransformBlock()
        >>> X_transformed = block.fit_transform(X)
    """

    block_type = "log_transform"
    param_schema = {
        "type": "object",
        "properties": {
            "columns": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Column names to apply log transformation. "
                               "If empty or not provided, all numeric columns are transformed. "
                               "Note: Values must be non-negative (>= 0).",
            }
        },
        "required": [],
    }

    def __init__(self, columns: Optional[List[str]] = None) -> None:
        """Initialize the LogTransformBlock.

        Args:
            columns: Optional list of column names to transform. If None or empty,
                all numeric columns are transformed.
        """
        super().__init__(columns=columns if columns is not None else [])
        self._transformer: Optional[LogTransformer] = None
        self._function_transformer: Optional[FunctionTransformer] = None

    def fit(self, X: pd.DataFrame, y: Optional[pd.Series] = None) -> "LogTransformBlock":
        """Fit the block to the data.

        Validates that the specified columns exist and checks for negative values.
        Creates the internal FunctionTransformer for scikit-learn compatibility.

        Args:
            X: Training data as a pandas DataFrame.
            y: Optional target values (ignored).

        Returns:
            self: The fitted block instance.

        Raises:
            ValueError: If any specified column does not exist in X.
            ValueError: If data contains negative values.
        """
        columns = self.params.get("columns", [])
        _validate_columns(X, columns, "LogTransformBlock")

        # If no columns specified, use all numeric columns
        if not columns:
            columns = X.select_dtypes(include=["number"]).columns.tolist()

        if not columns:
            # No numeric columns to transform
            self._is_fitted = True
            return self

        # Validate non-negative values
        for col in columns:
            if col in X.columns and (X[col] < 0).any():
                raise ValueError(
                    f"LogTransformBlock: Column '{col}' contains negative values. "
                    f"Log transformation requires non-negative values (>= 0)."
                )

        # Create the LogTransformer
        self._transformer = LogTransformer(columns=columns)
        self._transformer.fit(X, y)

        # Also create a FunctionTransformer for to_sklearn()
        self._function_transformer = FunctionTransformer(
            func=_log1p_transform,
            inverse_func=_log1p_inverse_transform,
            validate=False,
        )

        self._is_fitted = True
        return self

    def transform(self, X: pd.DataFrame) -> pd.DataFrame:
        """Transform the data by applying log1p.

        Args:
            X: Input data as a pandas DataFrame.

        Returns:
            pd.DataFrame: DataFrame with log1p applied to specified columns.

        Raises:
            RuntimeError: If transform() is called before fit().
            ValueError: If the input is not a pandas DataFrame.
        """
        if not self._is_fitted or self._transformer is None:
            raise RuntimeError(
                "LogTransformBlock has not been fitted. "
                "Call fit() before transform()."
            )

        if not isinstance(X, pd.DataFrame):
            raise ValueError(f"Expected pandas DataFrame, got {type(X).__name__}")

        return self._transformer.transform(X)

    def to_sklearn(self) -> FunctionTransformer:
        """Convert this block to a scikit-learn FunctionTransformer.

        Returns a FunctionTransformer that applies log1p transformation.
        Note: This transformer applies the transformation to ALL columns passed
        to it, so it should be used within a ColumnTransformer for column-specific
        application.

        Returns:
            FunctionTransformer: A scikit-learn compatible transformer with
                func=np.log1p and inverse_func=np.expm1.

        Raises:
            RuntimeError: If to_sklearn() is called before fit().
        """
        if not self._is_fitted:
            raise RuntimeError(
                "Cannot convert to sklearn transformer: "
                "LogTransformBlock has not been fitted."
            )

        # Return a FunctionTransformer configured for log1p
        return FunctionTransformer(
            func=_log1p_transform,
            inverse_func=_log1p_inverse_transform,
            validate=False,
        )
