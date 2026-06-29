"""
Feature Selection Pipeline Block

This module implements a pipeline block for feature selection by dropping
specified columns from the dataset. This is useful for removing features
that are not relevant for the model or may cause data leakage.
"""

import pandas as pd
from sklearn.compose import ColumnTransformer

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


class FeatureSelectionBlock(PipelineBlock):
    """Pipeline block for dropping specified columns (feature selection).

    This block removes columns from the dataset that are specified in the
    `columns` parameter. This is useful for:
    - Removing irrelevant features
    - Removing highly correlated features (multicollinearity)
    - Removing features that may cause data leakage
    - Removing identifier columns (IDs, names)
    - Removing columns with too many missing values

    The columns to drop are specified explicitly, allowing precise control
    over which features are excluded from the model.

    Parameters:
        columns: List of column names to drop from the dataset.
            Required - must specify at least one column.

    Example:
        >>> block = FeatureSelectionBlock(columns=["customer_id", "name", "email"])
        >>> X_selected = block.fit_transform(X)

        >>> # Drop multiple irrelevant features
        >>> block = FeatureSelectionBlock(columns=["timestamp", "session_id"])
        >>> X_selected = block.fit_transform(X)
    """

    block_type = "feature_selection"
    param_schema = {
        "type": "object",
        "properties": {
            "columns": {
                "type": "array",
                "items": {"type": "string"},
                "description": "List of column names to drop from the dataset. "
                "All other columns are retained.",
            }
        },
        "required": ["columns"],
    }

    def __init__(self, columns: list[str]) -> None:
        """Initialize the FeatureSelectionBlock.

        Args:
            columns: List of column names to drop from the dataset.

        Raises:
            ValueError: If columns list is empty.
        """
        if not columns:
            raise ValueError(
                "FeatureSelectionBlock requires at least one column to drop. "
                "Specify columns=['col1', 'col2', ...]"
            )
        super().__init__(columns=columns)
        self._column_transformer: ColumnTransformer | None = None
        self._kept_columns: list[str] = []

    def fit(
        self, X: pd.DataFrame, y: pd.Series | None = None
    ) -> "FeatureSelectionBlock":
        """Fit the block to the data.

        Validates that the specified columns exist and determines which
        columns to keep. Sets up the ColumnTransformer for sklearn compatibility.

        Args:
            X: Training data as a pandas DataFrame.
            y: Optional target values (ignored).

        Returns:
            self: The fitted block instance.

        Raises:
            ValueError: If any specified column does not exist in X.
        """
        columns_to_drop = self.params.get("columns", [])
        _validate_columns(X, columns_to_drop, "FeatureSelectionBlock")

        # Determine columns to keep
        self._kept_columns = [col for col in X.columns if col not in columns_to_drop]

        if not self._kept_columns:
            raise ValueError(
                "FeatureSelectionBlock would drop all columns. "
                "At least one column must be retained."
            )

        # Create ColumnTransformer that applies passthrough to kept columns
        # and drops the specified columns
        self._column_transformer = ColumnTransformer(
            transformers=[("keep", "passthrough", self._kept_columns)],
            remainder="drop",  # Drop all other columns
            verbose_feature_names_out=False,
        )

        self._column_transformer.fit(X)
        self._is_fitted = True
        return self

    def transform(self, X: pd.DataFrame) -> pd.DataFrame:
        """Transform the data by dropping specified columns.

        Args:
            X: Input data as a pandas DataFrame.

        Returns:
            pd.DataFrame: DataFrame with specified columns removed.

        Raises:
            RuntimeError: If transform() is called before fit().
            ValueError: If the input is not a pandas DataFrame.
        """
        if not self._is_fitted:
            raise RuntimeError(
                "FeatureSelectionBlock has not been fitted. "
                "Call fit() before transform()."
            )

        if not isinstance(X, pd.DataFrame):
            raise ValueError(f"Expected pandas DataFrame, got {type(X).__name__}")

        if self._column_transformer is None:
            raise RuntimeError(
                "FeatureSelectionBlock: internal transformer not initialized"
            )

        # Transform and convert back to DataFrame
        X_transformed = self._column_transformer.transform(X)

        return pd.DataFrame(X_transformed, columns=self._kept_columns, index=X.index)

    def to_sklearn(self) -> ColumnTransformer:
        """Convert this block to a scikit-learn ColumnTransformer.

        Returns:
            ColumnTransformer: A fitted scikit-learn ColumnTransformer that
                passes through the kept columns and drops the specified ones.

        Raises:
            RuntimeError: If to_sklearn() is called before fit().
        """
        if not self._is_fitted or self._column_transformer is None:
            raise RuntimeError(
                "Cannot convert to sklearn transformer: "
                "FeatureSelectionBlock has not been fitted."
            )
        return self._column_transformer

    def get_dropped_columns(self) -> list[str]:
        """Get the list of columns that will be dropped.

        Returns:
            List[str]: List of column names configured to be dropped.
        """
        return self.params.get("columns", []).copy()

    def get_kept_columns(self) -> list[str]:
        """Get the list of columns that will be kept after transformation.

        Only valid after fit() has been called.

        Returns:
            List[str]: List of column names that will be retained.

        Raises:
            RuntimeError: If get_kept_columns() is called before fit().
        """
        if not self._is_fitted:
            raise RuntimeError(
                "Cannot get kept columns: FeatureSelectionBlock has not been fitted."
            )
        return self._kept_columns.copy()
