"""
Remove Outliers Pipeline Block

This module implements a pipeline block for removing outliers using the
Interquartile Range (IQR) method. Rows containing values outside the
[Q1 - k*IQR, Q3 + k*IQR] range are filtered out.
"""

import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin

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


class RemoveOutliersIQRTransformer(BaseEstimator, TransformerMixin):
    """Scikit-learn compatible transformer that removes outliers using IQR method.

    This transformer filters out rows where values in specified columns fall
    outside the range [Q1 - k*IQR, Q3 + k*IQR], where:
    - Q1 = 25th percentile (first quartile)
    - Q3 = 75th percentile (third quartile)
    - IQR = Q3 - Q1 (interquartile range)
    - k = configurable multiplier (default 1.5)

    A row is removed if ANY of its specified columns contain an outlier value.

    Attributes:
        columns (List[str]): List of column names to check for outliers.
        iqr_multiplier (float): Multiplier for IQR to define outlier bounds.
        lower_bounds (dict): Computed lower bounds for each column.
        upper_bounds (dict): Computed upper bounds for each column.

    Example:
        >>> transformer = RemoveOutliersIQRTransformer(
        ...     columns=["income", "age"], iqr_multiplier=1.5
        ... )
        >>> X_clean = transformer.fit_transform(X)
    """

    def __init__(
        self,
        columns: list[str] | None = None,
        iqr_multiplier: float = 1.5,
    ) -> None:
        """Initialize the transformer.

        Args:
            columns: List of column names to check for outliers. If None
                or empty, all numeric columns are checked. Defaults to None.
            iqr_multiplier: Multiplier for IQR to define outlier bounds.
                Default is 1.5 (Tukey's fences). Values outside
                [Q1 - k*IQR, Q3 + k*IQR] are considered outliers.
                Use 3.0 for more conservative outlier detection.
        """
        self.columns = columns if columns is not None else []
        self.iqr_multiplier = iqr_multiplier
        self.lower_bounds: dict = {}
        self.upper_bounds: dict = {}

    def fit(
        self, X: pd.DataFrame, y: pd.Series | None = None
    ) -> "RemoveOutliersIQRTransformer":
        """Fit the transformer to the training data.

        Computes Q1, Q3, and IQR for each specified column to determine
        the acceptable value range for outlier detection.

        Args:
            X: Training data as a pandas DataFrame.
            y: Optional target values (ignored).

        Returns:
            self: The fitted transformer instance.

        Raises:
            ValueError: If any specified column does not exist in X.
            ValueError: If iqr_multiplier is not positive.
        """
        if not isinstance(X, pd.DataFrame):
            raise ValueError(f"Expected pandas DataFrame, got {type(X).__name__}")

        if self.iqr_multiplier <= 0:
            raise ValueError(
                f"iqr_multiplier must be positive, got {self.iqr_multiplier}"
            )

        # Determine columns to check
        columns_to_check = (
            self.columns
            if self.columns
            else X.select_dtypes(include=["number"]).columns.tolist()
        )

        if columns_to_check:
            missing_cols = set(columns_to_check) - set(X.columns)
            if missing_cols:
                raise ValueError(
                    f"Specified columns not found in data: {sorted(missing_cols)}"
                )

        # Compute bounds for each column
        self.lower_bounds = {}
        self.upper_bounds = {}

        for col in columns_to_check:
            if col in X.columns:
                q1 = X[col].quantile(0.25)
                q3 = X[col].quantile(0.75)
                iqr = q3 - q1

                self.lower_bounds[col] = q1 - self.iqr_multiplier * iqr
                self.upper_bounds[col] = q3 + self.iqr_multiplier * iqr

        return self

    def transform(self, X: pd.DataFrame) -> pd.DataFrame:
        """Transform the data by removing outlier rows.

        Removes rows where ANY specified column contains a value outside the
        computed acceptable range.

        Args:
            X: Input data as a pandas DataFrame.

        Returns:
            pd.DataFrame: DataFrame with outlier rows removed.

        Raises:
            ValueError: If the input is not a pandas DataFrame.
        """
        if not isinstance(X, pd.DataFrame):
            raise ValueError(f"Expected pandas DataFrame, got {type(X).__name__}")

        if not self.lower_bounds:
            # No bounds computed, return copy
            return X.copy()

        # Create mask for rows to keep (non-outliers)
        mask = pd.Series(True, index=X.index)

        for col, lower in self.lower_bounds.items():
            if col in X.columns:
                upper = self.upper_bounds[col]
                # Keep rows where value is within bounds (inclusive)
                col_mask = (X[col] >= lower) & (X[col] <= upper)
                mask = mask & col_mask

        # Return filtered DataFrame with reset index
        return X[mask].reset_index(drop=True)


class RemoveOutliersIQRBlock(PipelineBlock):
    """Pipeline block for removing outliers using the IQR method.

    This block filters out rows containing outlier values in specified columns.
    Outliers are defined as values outside the range:
    [Q1 - k*IQR, Q3 + k*IQR]

    where Q1 is the 25th percentile, Q3 is the 75th percentile, IQR = Q3 - Q1,
    and k is the configurable iqr_multiplier.

    The default multiplier of 1.5 follows Tukey's fences and identifies
    "mild" outliers. Use 3.0 for "extreme" outliers only.

    Parameters:
        columns: Optional list of column names to check for outliers. If not
            provided, all numeric columns are checked.
        iqr_multiplier: Multiplier for IQR (default: 1.5). Higher values
            are more conservative (fewer outliers removed).

    Example:
        >>> block = RemoveOutliersIQRBlock(
        ...     columns=["income", "age"], iqr_multiplier=1.5
        ... )
        >>> X_clean = block.fit_transform(X)

        >>> # Check all numeric columns with conservative threshold
        >>> block = RemoveOutliersIQRBlock(iqr_multiplier=3.0)
        >>> X_clean = block.fit_transform(X)
    """

    block_type = "remove_outliers_iqr"
    param_schema = {
        "type": "object",
        "properties": {
            "columns": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Column names to check for outliers. "
                "If empty or not provided, all numeric columns are checked.",
            },
            "iqr_multiplier": {
                "type": "number",
                "default": 1.5,
                "minimum": 0.1,
                "description": "Multiplier for IQR to define outlier bounds. "
                "Default 1.5 (Tukey's fences). Use 3.0 for more conservative detection.",
            },
        },
        "required": [],
    }

    def __init__(
        self,
        columns: list[str] | None = None,
        iqr_multiplier: float = 1.5,
    ) -> None:
        """Initialize the RemoveOutliersIQRBlock.

        Args:
            columns: Optional list of column names to check. If None or empty,
                all numeric columns are checked.
            iqr_multiplier: Multiplier for IQR (default: 1.5).
        """
        super().__init__(
            columns=columns if columns is not None else [],
            iqr_multiplier=iqr_multiplier,
        )
        self._transformer: RemoveOutliersIQRTransformer | None = None

    def fit(
        self, X: pd.DataFrame, y: pd.Series | None = None
    ) -> "RemoveOutliersIQRBlock":
        """Fit the block to the data.

        Computes the IQR-based bounds for outlier detection on each specified column.

        Args:
            X: Training data as a pandas DataFrame.
            y: Optional target values (ignored).

        Returns:
            self: The fitted block instance.

        Raises:
            ValueError: If any specified column does not exist in X.
            ValueError: If iqr_multiplier is not positive.
        """
        columns = self.params.get("columns", [])
        iqr_multiplier = self.params.get("iqr_multiplier", 1.5)

        _validate_columns(X, columns, "RemoveOutliersIQRBlock")

        if iqr_multiplier <= 0:
            raise ValueError(
                f"RemoveOutliersIQRBlock: iqr_multiplier must be positive, "
                f"got {iqr_multiplier}"
            )

        self._transformer = RemoveOutliersIQRTransformer(
            columns=columns if columns else None,
            iqr_multiplier=iqr_multiplier,
        )
        self._transformer.fit(X, y)
        self._is_fitted = True
        return self

    def transform(self, X: pd.DataFrame) -> pd.DataFrame:
        """Transform the data by removing outlier rows.

        Args:
            X: Input data as a pandas DataFrame.

        Returns:
            pd.DataFrame: DataFrame with outlier rows removed.

        Raises:
            RuntimeError: If transform() is called before fit().
            ValueError: If the input is not a pandas DataFrame.
        """
        if not self._is_fitted or self._transformer is None:
            raise RuntimeError(
                "RemoveOutliersIQRBlock has not been fitted. "
                "Call fit() before transform()."
            )

        if not isinstance(X, pd.DataFrame):
            raise ValueError(f"Expected pandas DataFrame, got {type(X).__name__}")

        return self._transformer.transform(X)

    def to_sklearn(self) -> RemoveOutliersIQRTransformer:
        """Convert this block to a scikit-learn transformer.

        Returns:
            RemoveOutliersIQRTransformer: A fitted scikit-learn compatible
                transformer implementing IQR-based outlier removal.

        Raises:
            RuntimeError: If to_sklearn() is called before fit().
        """
        if not self._is_fitted or self._transformer is None:
            raise RuntimeError(
                "Cannot convert to sklearn transformer: "
                "RemoveOutliersIQRBlock has not been fitted."
            )
        return self._transformer
