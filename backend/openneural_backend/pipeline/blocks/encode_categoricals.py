"""
Encode Categoricals Pipeline Blocks

This module implements pipeline blocks for encoding categorical variables.
Supports one-hot encoding (creates binary columns for each category) and
ordinal encoding (maps categories to integers). Uses scikit-learn encoders
with appropriate configurations for production use.
"""

from typing import List, Optional, Union

import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, OrdinalEncoder

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


class EncodeCategoricalsOneHotBlock(PipelineBlock):
    """Pipeline block for one-hot encoding categorical columns.

    This block converts categorical columns into binary (0/1) columns for each
    unique category. For example, a "color" column with values ["red", "blue"]
    becomes two columns: "color_red" and "color_blue".

    Uses OneHotEncoder with handle_unknown='ignore' to gracefully handle
    unseen categories during inference, and sparse_output=False to return
    dense arrays compatible with all scikit-learn models.

    Parameters:
        columns: Optional list of column names to encode. If not provided,
            all categorical columns (object, category dtype) are encoded.

    Example:
        >>> block = EncodeCategoricalsOneHotBlock(columns=["contract_type", "region"])
        >>> X_encoded = block.fit_transform(X)

        >>> # Encode all categorical columns
        >>> block = EncodeCategoricalsOneHotBlock()
        >>> X_encoded = block.fit_transform(X)
    """

    block_type = "encode_categoricals_onehot"
    param_schema = {
        "type": "object",
        "properties": {
            "columns": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Column names to one-hot encode. "
                               "If empty or not provided, all categorical columns are encoded.",
            }
        },
        "required": [],
    }

    def __init__(self, columns: Optional[List[str]] = None) -> None:
        """Initialize the EncodeCategoricalsOneHotBlock.

        Args:
            columns: Optional list of column names to encode. If None or empty,
                all categorical columns are encoded.
        """
        super().__init__(columns=columns if columns is not None else [])
        self._encoder: Optional[OneHotEncoder] = None
        self._column_transformer: Optional[ColumnTransformer] = None

    def fit(self, X: pd.DataFrame, y: Optional[pd.Series] = None) -> "EncodeCategoricalsOneHotBlock":
        """Fit the encoder to the training data.

        Learns all unique categories for each specified column.

        Args:
            X: Training data as a pandas DataFrame.
            y: Optional target values (ignored).

        Returns:
            self: The fitted block instance.

        Raises:
            ValueError: If any specified column does not exist in X.
        """
        columns = self.params.get("columns", [])
        _validate_columns(X, columns, "EncodeCategoricalsOneHotBlock")

        # If no columns specified, use all categorical columns
        if not columns:
            columns = X.select_dtypes(include=["object", "category"]).columns.tolist()

        if not columns:
            # No categorical columns to encode
            self._is_fitted = True
            return self

        # Create OneHotEncoder with handle_unknown='ignore' for unseen categories
        # sparse_output=False for dense output compatible with all models
        self._encoder = OneHotEncoder(
            handle_unknown="ignore",
            sparse_output=False,
            dtype="float64",
        )

        # Wrap in ColumnTransformer to apply only to specified columns
        self._column_transformer = ColumnTransformer(
            transformers=[
                ("encoder", self._encoder, columns)
            ],
            remainder="passthrough",
            verbose_feature_names_out=True,  # Generates feature names like "encoder__col_category"
        )

        self._column_transformer.fit(X)
        self._is_fitted = True
        return self

    def transform(self, X: pd.DataFrame) -> pd.DataFrame:
        """Transform the data by one-hot encoding categorical columns.

        Args:
            X: Input data as a pandas DataFrame.

        Returns:
            pd.DataFrame: DataFrame with categorical columns replaced by
                one-hot encoded binary columns.

        Raises:
            RuntimeError: If transform() is called before fit().
            ValueError: If the input is not a pandas DataFrame.
        """
        if not self._is_fitted:
            raise RuntimeError(
                "EncodeCategoricalsOneHotBlock has not been fitted. "
                "Call fit() before transform()."
            )

        if not isinstance(X, pd.DataFrame):
            raise ValueError(f"Expected pandas DataFrame, got {type(X).__name__}")

        if self._column_transformer is None:
            # No categorical columns were found during fit
            return X.copy()

        # Transform and convert to DataFrame with proper column names
        X_transformed = self._column_transformer.transform(X)

        # Get feature names from the encoder
        feature_names = self._column_transformer.get_feature_names_out()

        return pd.DataFrame(X_transformed, columns=feature_names, index=X.index)

    def to_sklearn(self) -> Union[OneHotEncoder, ColumnTransformer]:
        """Convert this block to a scikit-learn transformer.

        Returns:
            Union[OneHotEncoder, ColumnTransformer]: A fitted scikit-learn
                compatible transformer. Returns the ColumnTransformer if
                columns were specified, otherwise the OneHotEncoder.

        Raises:
            RuntimeError: If to_sklearn() is called before fit().
        """
        if not self._is_fitted:
            raise RuntimeError(
                "Cannot convert to sklearn transformer: "
                "EncodeCategoricalsOneHotBlock has not been fitted."
            )

        if self._column_transformer is not None:
            return self._column_transformer
        return self._encoder if self._encoder is not None else OneHotEncoder(
            handle_unknown="ignore",
            sparse_output=False,
        )


class EncodeCategoricalsOrdinalBlock(PipelineBlock):
    """Pipeline block for ordinal encoding categorical columns.

    This block converts categorical columns into integer values (0, 1, 2, ...).
    For example, a "size" column with values ["small", "medium", "large"]
    becomes [0, 1, 2] (alphabetically sorted by default).

    Uses OrdinalEncoder with handle_unknown='use_encoded_value' and
    unknown_value=-1 to gracefully handle unseen categories during inference.

    Note: This encoding implies an order relationship between categories that
    may not exist. Consider one-hot encoding for nominal categories without
    inherent ordering.

    Parameters:
        columns: Optional list of column names to encode. If not provided,
            all categorical columns (object, category dtype) are encoded.

    Example:
        >>> block = EncodeCategoricalsOrdinalBlock(columns=["size", "priority"])
        >>> X_encoded = block.fit_transform(X)

        >>> # Encode all categorical columns
        >>> block = EncodeCategoricalsOrdinalBlock()
        >>> X_encoded = block.fit_transform(X)
    """

    block_type = "encode_categoricals_ordinal"
    param_schema = {
        "type": "object",
        "properties": {
            "columns": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Column names to ordinal encode. "
                               "If empty or not provided, all categorical columns are encoded.",
            }
        },
        "required": [],
    }

    def __init__(self, columns: Optional[List[str]] = None) -> None:
        """Initialize the EncodeCategoricalsOrdinalBlock.

        Args:
            columns: Optional list of column names to encode. If None or empty,
                all categorical columns are encoded.
        """
        super().__init__(columns=columns if columns is not None else [])
        self._encoder: Optional[OrdinalEncoder] = None
        self._column_transformer: Optional[ColumnTransformer] = None

    def fit(self, X: pd.DataFrame, y: Optional[pd.Series] = None) -> "EncodeCategoricalsOrdinalBlock":
        """Fit the encoder to the training data.

        Learns the integer mapping for each unique category in each column.

        Args:
            X: Training data as a pandas DataFrame.
            y: Optional target values (ignored).

        Returns:
            self: The fitted block instance.

        Raises:
            ValueError: If any specified column does not exist in X.
        """
        columns = self.params.get("columns", [])
        _validate_columns(X, columns, "EncodeCategoricalsOrdinalBlock")

        # If no columns specified, use all categorical columns
        if not columns:
            columns = X.select_dtypes(include=["object", "category"]).columns.tolist()

        if not columns:
            # No categorical columns to encode
            self._is_fitted = True
            return self

        # Create OrdinalEncoder with handle_unknown for unseen categories
        self._encoder = OrdinalEncoder(
            handle_unknown="use_encoded_value",
            unknown_value=-1,
            dtype="float64",
        )

        # Wrap in ColumnTransformer to apply only to specified columns
        self._column_transformer = ColumnTransformer(
            transformers=[
                ("encoder", self._encoder, columns)
            ],
            remainder="passthrough",
            verbose_feature_names_out=False,
        )

        self._column_transformer.fit(X)
        self._is_fitted = True
        return self

    def transform(self, X: pd.DataFrame) -> pd.DataFrame:
        """Transform the data by ordinal encoding categorical columns.

        Args:
            X: Input data as a pandas DataFrame.

        Returns:
            pd.DataFrame: DataFrame with categorical columns replaced by
                integer-encoded columns.

        Raises:
            RuntimeError: If transform() is called before fit().
            ValueError: If the input is not a pandas DataFrame.
        """
        if not self._is_fitted:
            raise RuntimeError(
                "EncodeCategoricalsOrdinalBlock has not been fitted. "
                "Call fit() before transform()."
            )

        if not isinstance(X, pd.DataFrame):
            raise ValueError(f"Expected pandas DataFrame, got {type(X).__name__}")

        if self._column_transformer is None:
            # No categorical columns were found during fit
            return X.copy()

        # Transform and convert to DataFrame
        X_transformed = self._column_transformer.transform(X)

        # Get column names - encoded columns keep original names, remainder keeps theirs
        encoded_cols = self._column_transformer.transformers_[0][2]
        remainder_cols = [col for col in X.columns if col not in encoded_cols]
        output_columns = encoded_cols + remainder_cols

        return pd.DataFrame(X_transformed, columns=output_columns, index=X.index)

    def to_sklearn(self) -> Union[OrdinalEncoder, ColumnTransformer]:
        """Convert this block to a scikit-learn transformer.

        Returns:
            Union[OrdinalEncoder, ColumnTransformer]: A fitted scikit-learn
                compatible transformer. Returns the ColumnTransformer if
                columns were specified, otherwise the OrdinalEncoder.

        Raises:
            RuntimeError: If to_sklearn() is called before fit().
        """
        if not self._is_fitted:
            raise RuntimeError(
                "Cannot convert to sklearn transformer: "
                "EncodeCategoricalsOrdinalBlock has not been fitted."
            )

        if self._column_transformer is not None:
            return self._column_transformer
        return self._encoder if self._encoder is not None else OrdinalEncoder(
            handle_unknown="use_encoded_value",
            unknown_value=-1,
        )
