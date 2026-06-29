"""
Drop Nulls Pipeline Block

This module implements the DropNullsBlock for removing rows containing null values
from specified columns. It provides a custom scikit-learn compatible transformer
and the corresponding PipelineBlock implementation.
"""


import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin

from openneural_backend.pipeline.block_interface import PipelineBlock


class DropNullsTransformer(BaseEstimator, TransformerMixin):
    """Scikit-learn compatible transformer that drops rows with null values.

    This transformer removes rows from a DataFrame that contain null (NaN)
    values in the specified columns. If no columns are specified, it drops
    rows with nulls in any column.

    Attributes:
        columns (List[str]): List of column names to check for null values.
            If empty, all columns are checked.

    Example:
        >>> transformer = DropNullsTransformer(columns=["age", "income"])
        >>> X_clean = transformer.fit_transform(X)
    """

    def __init__(self, columns: list[str] | None = None) -> None:
        """Initialize the transformer.

        Args:
            columns: List of column names to check for null values. If None
                or empty, all columns are checked. Defaults to None.
        """
        self.columns = columns if columns is not None else []

    def fit(
        self, X: pd.DataFrame, y: pd.Series | None = None
    ) -> "DropNullsTransformer":
        """Fit the transformer to the data.

        For DropNullsTransformer, fitting does not learn any statistics from
        the data. This method validates that the specified columns exist in
        the input DataFrame and marks the transformer as fitted.

        Args:
            X: Training data as a pandas DataFrame.
            y: Optional target values (ignored).

        Returns:
            self: The fitted transformer instance.

        Raises:
            ValueError: If any specified column does not exist in X.
        """
        if not isinstance(X, pd.DataFrame):
            raise ValueError(f"Expected pandas DataFrame, got {type(X).__name__}")

        if self.columns:
            missing_cols = set(self.columns) - set(X.columns)
            if missing_cols:
                raise ValueError(
                    f"Specified columns not found in data: {sorted(missing_cols)}"
                )

        return self

    def transform(self, X: pd.DataFrame) -> pd.DataFrame:
        """Transform the data by dropping rows with null values.

        Drops rows that contain null values in the specified columns (or all
        columns if none specified).

        Args:
            X: Input data as a pandas DataFrame.

        Returns:
            pd.DataFrame: DataFrame with rows containing nulls removed.

        Raises:
            ValueError: If the input is not a pandas DataFrame.
        """
        if not isinstance(X, pd.DataFrame):
            raise ValueError(f"Expected pandas DataFrame, got {type(X).__name__}")

        columns_to_check = self.columns if self.columns else X.columns.tolist()
        return X.dropna(subset=columns_to_check).reset_index(drop=True)


class DropNullsBlock(PipelineBlock):
    """Pipeline block for dropping rows with null values.

    This block removes rows containing null (NaN) values from specified columns.
    If no columns are specified, rows with nulls in any column are dropped.

    Parameters:
        columns: Optional list of column names to check for null values.
            If not provided or empty, all columns are checked.

    Example:
        >>> block = DropNullsBlock(columns=["age", "income"])
        >>> X_clean = block.fit_transform(X)

        >>> # Drop rows with nulls in any column
        >>> block = DropNullsBlock()
        >>> X_clean = block.fit_transform(X)
    """

    block_type = "drop_nulls"
    param_schema = {
        "type": "object",
        "properties": {
            "columns": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Column names to check for null values. "
                "If empty or not provided, all columns are checked.",
            }
        },
        "required": [],
    }

    def __init__(self, columns: list[str] | None = None) -> None:
        """Initialize the DropNullsBlock.

        Args:
            columns: Optional list of column names to check for null values.
                If None or empty, all columns are checked.
        """
        super().__init__(columns=columns if columns is not None else [])
        self._transformer: DropNullsTransformer | None = None

    def fit(self, X: pd.DataFrame, y: pd.Series | None = None) -> "DropNullsBlock":
        """Fit the block to the data.

        Validates that the specified columns exist in the input data and
        creates the internal transformer.

        Args:
            X: Training data as a pandas DataFrame.
            y: Optional target values (ignored).

        Returns:
            self: The fitted block instance.

        Raises:
            ValueError: If any specified column does not exist in X.
        """
        columns = self.params.get("columns", [])
        self._transformer = DropNullsTransformer(columns=columns if columns else None)
        self._transformer.fit(X, y)
        self._is_fitted = True
        return self

    def transform(self, X: pd.DataFrame) -> pd.DataFrame:
        """Transform the data by dropping rows with null values.

        Args:
            X: Input data as a pandas DataFrame.

        Returns:
            pd.DataFrame: DataFrame with rows containing nulls removed.

        Raises:
            RuntimeError: If transform() is called before fit().
            ValueError: If the input is not a pandas DataFrame.
        """
        if not self._is_fitted or self._transformer is None:
            raise RuntimeError(
                "DropNullsBlock has not been fitted. " "Call fit() before transform()."
            )
        return self._transformer.transform(X)

    def to_sklearn(self) -> DropNullsTransformer:
        """Convert this block to a scikit-learn transformer.

        Returns:
            DropNullsTransformer: A fitted scikit-learn compatible transformer
                that implements the same null-dropping logic.

        Raises:
            RuntimeError: If to_sklearn() is called before fit().
        """
        if not self._is_fitted or self._transformer is None:
            raise RuntimeError(
                "Cannot convert to sklearn transformer: "
                "DropNullsBlock has not been fitted."
            )
        return self._transformer
