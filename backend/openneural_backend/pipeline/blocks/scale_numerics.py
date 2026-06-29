"""
Scale Numerics Pipeline Blocks

This module implements pipeline blocks for scaling numeric columns.
Supports standard scaling (z-score: mean=0, std=1) and min-max scaling
(range: 0-1). Uses scikit-learn scalers with proper handling of column
selection via ColumnTransformer.
"""

import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import MinMaxScaler, StandardScaler

from openneural_backend.pipeline.block_interface import PipelineBlock


def _validate_columns(X: pd.DataFrame, columns: list[str], block_name: str) -> None:
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


class ScaleNumericStandardBlock(PipelineBlock):
    """Pipeline block for standard scaling (z-score) of numeric columns.

    This block standardizes numeric columns by removing the mean and scaling
    to unit variance. The result has mean=0 and standard deviation=1.

    Formula: z = (x - mean) / std

    This is the most common scaling method and is suitable for data that
    follows a normal distribution or when using algorithms that assume
    normally distributed features (e.g., linear models, SVM with RBF kernel).

    Uses StandardScaler from scikit-learn.

    Parameters:
        columns: Optional list of column names to scale. If not provided,
            all numeric columns (int, float dtypes) are scaled.

    Example:
        >>> block = ScaleNumericStandardBlock(columns=["age", "income"])
        >>> X_scaled = block.fit_transform(X)

        >>> # Scale all numeric columns
        >>> block = ScaleNumericStandardBlock()
        >>> X_scaled = block.fit_transform(X)
    """

    block_type = "scale_numeric_standard"
    param_schema = {
        "type": "object",
        "properties": {
            "columns": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Column names to standard scale (z-score). "
                "If empty or not provided, all numeric columns are scaled.",
            }
        },
        "required": [],
    }

    def __init__(self, columns: list[str] | None = None) -> None:
        """Initialize the ScaleNumericStandardBlock.

        Args:
            columns: Optional list of column names to scale. If None or empty,
                all numeric columns are scaled.
        """
        super().__init__(columns=columns if columns is not None else [])
        self._scaler: StandardScaler | None = None
        self._column_transformer: ColumnTransformer | None = None

    def fit(
        self, X: pd.DataFrame, y: pd.Series | None = None
    ) -> "ScaleNumericStandardBlock":
        """Fit the scaler to the training data.

        Computes the mean and standard deviation for each specified numeric column.

        Args:
            X: Training data as a pandas DataFrame.
            y: Optional target values (ignored).

        Returns:
            self: The fitted block instance.

        Raises:
            ValueError: If any specified column does not exist in X.
        """
        columns = self.params.get("columns", [])
        _validate_columns(X, columns, "ScaleNumericStandardBlock")

        # If no columns specified, use all numeric columns
        if not columns:
            columns = X.select_dtypes(include=["number"]).columns.tolist()

        if not columns:
            # No numeric columns to scale
            self._is_fitted = True
            return self

        # Create StandardScaler
        self._scaler = StandardScaler()

        # Wrap in ColumnTransformer to apply only to specified columns
        self._column_transformer = ColumnTransformer(
            transformers=[("scaler", self._scaler, columns)],
            remainder="passthrough",
            verbose_feature_names_out=False,
        )

        self._column_transformer.fit(X)
        self._is_fitted = True
        return self

    def transform(self, X: pd.DataFrame) -> pd.DataFrame:
        """Transform the data by standard scaling numeric columns.

        Args:
            X: Input data as a pandas DataFrame.

        Returns:
            pd.DataFrame: DataFrame with numeric columns standardized.

        Raises:
            RuntimeError: If transform() is called before fit().
            ValueError: If the input is not a pandas DataFrame.
        """
        if not self._is_fitted:
            raise RuntimeError(
                "ScaleNumericStandardBlock has not been fitted. "
                "Call fit() before transform()."
            )

        if not isinstance(X, pd.DataFrame):
            raise ValueError(f"Expected pandas DataFrame, got {type(X).__name__}")

        if self._column_transformer is None:
            # No numeric columns were found during fit
            return X.copy()

        # Transform and convert to DataFrame
        X_transformed = self._column_transformer.transform(X)

        # Get column names in order
        scaled_cols = self._column_transformer.transformers_[0][2]
        remainder_cols = [col for col in X.columns if col not in scaled_cols]
        output_columns = scaled_cols + remainder_cols

        return pd.DataFrame(X_transformed, columns=output_columns, index=X.index)

    def to_sklearn(self) -> StandardScaler | ColumnTransformer:
        """Convert this block to a scikit-learn transformer.

        Returns:
            Union[StandardScaler, ColumnTransformer]: A fitted scikit-learn
                compatible transformer. Returns the ColumnTransformer if
                columns were specified, otherwise the StandardScaler.

        Raises:
            RuntimeError: If to_sklearn() is called before fit().
        """
        if not self._is_fitted:
            raise RuntimeError(
                "Cannot convert to sklearn transformer: "
                "ScaleNumericStandardBlock has not been fitted."
            )

        if self._column_transformer is not None:
            return self._column_transformer
        return self._scaler if self._scaler is not None else StandardScaler()


class ScaleNumericMinMaxBlock(PipelineBlock):
    """Pipeline block for min-max scaling of numeric columns.

    This block scales numeric columns to a fixed range, typically [0, 1].
    The minimum value becomes 0 and the maximum value becomes 1.

    Formula: x_scaled = (x - min) / (max - min)

    This scaling method is suitable when you need bounded values or when
    working with algorithms that require positive values (e.g., neural
    networks, distance-based algorithms). However, it's sensitive to
    outliers since they directly affect the min/max values.

    Uses MinMaxScaler from scikit-learn (default feature_range=(0, 1)).

    Parameters:
        columns: Optional list of column names to scale. If not provided,
            all numeric columns (int, float dtypes) are scaled.

    Example:
        >>> block = ScaleNumericMinMaxBlock(columns=["age", "income"])
        >>> X_scaled = block.fit_transform(X)

        >>> # Scale all numeric columns
        >>> block = ScaleNumericMinMaxBlock()
        >>> X_scaled = block.fit_transform(X)
    """

    block_type = "scale_numeric_minmax"
    param_schema = {
        "type": "object",
        "properties": {
            "columns": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Column names to min-max scale (range 0-1). "
                "If empty or not provided, all numeric columns are scaled.",
            }
        },
        "required": [],
    }

    def __init__(self, columns: list[str] | None = None) -> None:
        """Initialize the ScaleNumericMinMaxBlock.

        Args:
            columns: Optional list of column names to scale. If None or empty,
                all numeric columns are scaled.
        """
        super().__init__(columns=columns if columns is not None else [])
        self._scaler: MinMaxScaler | None = None
        self._column_transformer: ColumnTransformer | None = None

    def fit(
        self, X: pd.DataFrame, y: pd.Series | None = None
    ) -> "ScaleNumericMinMaxBlock":
        """Fit the scaler to the training data.

        Computes the minimum and maximum values for each specified numeric column.

        Args:
            X: Training data as a pandas DataFrame.
            y: Optional target values (ignored).

        Returns:
            self: The fitted block instance.

        Raises:
            ValueError: If any specified column does not exist in X.
        """
        columns = self.params.get("columns", [])
        _validate_columns(X, columns, "ScaleNumericMinMaxBlock")

        # If no columns specified, use all numeric columns
        if not columns:
            columns = X.select_dtypes(include=["number"]).columns.tolist()

        if not columns:
            # No numeric columns to scale
            self._is_fitted = True
            return self

        # Create MinMaxScaler (default range 0-1)
        self._scaler = MinMaxScaler()

        # Wrap in ColumnTransformer to apply only to specified columns
        self._column_transformer = ColumnTransformer(
            transformers=[("scaler", self._scaler, columns)],
            remainder="passthrough",
            verbose_feature_names_out=False,
        )

        self._column_transformer.fit(X)
        self._is_fitted = True
        return self

    def transform(self, X: pd.DataFrame) -> pd.DataFrame:
        """Transform the data by min-max scaling numeric columns.

        Args:
            X: Input data as a pandas DataFrame.

        Returns:
            pd.DataFrame: DataFrame with numeric columns scaled to [0, 1].

        Raises:
            RuntimeError: If transform() is called before fit().
            ValueError: If the input is not a pandas DataFrame.
        """
        if not self._is_fitted:
            raise RuntimeError(
                "ScaleNumericMinMaxBlock has not been fitted. "
                "Call fit() before transform()."
            )

        if not isinstance(X, pd.DataFrame):
            raise ValueError(f"Expected pandas DataFrame, got {type(X).__name__}")

        if self._column_transformer is None:
            # No numeric columns were found during fit
            return X.copy()

        # Transform and convert to DataFrame
        X_transformed = self._column_transformer.transform(X)

        # Get column names in order
        scaled_cols = self._column_transformer.transformers_[0][2]
        remainder_cols = [col for col in X.columns if col not in scaled_cols]
        output_columns = scaled_cols + remainder_cols

        return pd.DataFrame(X_transformed, columns=output_columns, index=X.index)

    def to_sklearn(self) -> MinMaxScaler | ColumnTransformer:
        """Convert this block to a scikit-learn transformer.

        Returns:
            Union[MinMaxScaler, ColumnTransformer]: A fitted scikit-learn
                compatible transformer. Returns the ColumnTransformer if
                columns were specified, otherwise the MinMaxScaler.

        Raises:
            RuntimeError: If to_sklearn() is called before fit().
        """
        if not self._is_fitted:
            raise RuntimeError(
                "Cannot convert to sklearn transformer: "
                "ScaleNumericMinMaxBlock has not been fitted."
            )

        if self._column_transformer is not None:
            return self._column_transformer
        return self._scaler if self._scaler is not None else MinMaxScaler()
