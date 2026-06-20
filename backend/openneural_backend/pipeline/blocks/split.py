"""
Train/Val/Test Split Pipeline Block

This module implements a pipeline block for splitting data into training,
validation, and test sets. Unlike other blocks, this is not a scikit-learn
transformer but a pipeline stage that partitions the dataset and returns
the split data directly.
"""

from typing import Optional, Tuple

import pandas as pd
from sklearn.model_selection import train_test_split

from openneural_backend.pipeline.block_interface import PipelineBlock


class TrainValTestSplitBlock(PipelineBlock):
    """Pipeline block for splitting data into train/validation/test sets.

    This block splits the dataset into three partitions: training (fit),
    validation (tune), and test (evaluate). The split is performed using
    stratified sampling when a stratify column is specified.

    Unlike other pipeline blocks, this block does not transform data in-place.
    Instead, it partitions the dataset and returns six separate DataFrames/Series.

    The split ratios must sum to 1.0. The split is performed in two steps:
    1. First split: separate test set from the rest
    2. Second split: separate train and validation from the remaining data

    Parameters:
        train: Proportion of data for training set (default: 0.70).
        val: Proportion of data for validation set (default: 0.15).
        test: Proportion of data for test set (default: 0.15).
        stratify_column: Optional column name to use for stratified splitting.
            If specified, ensures class proportions are maintained in each split.

    Returns:
        Tuple containing (X_train, X_val, X_test, y_train, y_val, y_test).

    Example:
        >>> block = TrainValTestSplitBlock(
        ...     train=0.70, val=0.15, test=0.15,
        ...     stratify_column="target"
        ... )
        >>> X_train, X_val, X_test, y_train, y_val, y_test = block.fit_transform(X, y)
    """

    block_type = "train_val_test_split"
    param_schema = {
        "type": "object",
        "properties": {
            "train": {
                "type": "number",
                "default": 0.70,
                "minimum": 0.01,
                "maximum": 0.99,
                "description": "Proportion of data for training set (0.0-1.0).",
            },
            "val": {
                "type": "number",
                "default": 0.15,
                "minimum": 0.0,
                "maximum": 0.99,
                "description": "Proportion of data for validation set (0.0-1.0).",
            },
            "test": {
                "type": "number",
                "default": 0.15,
                "minimum": 0.0,
                "maximum": 0.99,
                "description": "Proportion of data for test set (0.0-1.0).",
            },
            "stratify_column": {
                "type": "string",
                "description": "Optional column name for stratified splitting. "
                               "If provided, class proportions are maintained in each split.",
            }
        },
        "required": [],
    }

    def __init__(
        self,
        train: float = 0.70,
        val: float = 0.15,
        test: float = 0.15,
        stratify_column: Optional[str] = None,
    ) -> None:
        """Initialize the TrainValTestSplitBlock.

        Args:
            train: Proportion for training set (default: 0.70).
            val: Proportion for validation set (default: 0.15).
            test: Proportion for test set (default: 0.15).
            stratify_column: Optional column for stratified splitting.

        Raises:
            ValueError: If ratios do not sum to approximately 1.0.
            ValueError: If any ratio is negative or greater than 1.0.
        """
        # Validate individual ratios
        for name, ratio in [("train", train), ("val", val), ("test", test)]:
            if ratio < 0:
                raise ValueError(f"{name} ratio must be non-negative, got {ratio}")
            if ratio > 1:
                raise ValueError(f"{name} ratio must be at most 1.0, got {ratio}")

        # Validate ratios sum to 1.0 (with small tolerance for floating point)
        total = train + val + test
        if not (0.999 <= total <= 1.001):
            raise ValueError(
                f"Split ratios must sum to 1.0, got train={train}, val={val}, "
                f"test={test} (sum={total}). "
                f"Please adjust the ratios so they sum to 1.0."
            )

        # Ensure at least training data exists
        if train == 0:
            raise ValueError("train ratio must be greater than 0")

        super().__init__(
            train=train,
            val=val,
            test=test,
            stratify_column=stratify_column,
        )
        self._train_indices: Optional[pd.Index] = None
        self._val_indices: Optional[pd.Index] = None
        self._test_indices: Optional[pd.Index] = None

    def fit(
        self, X: pd.DataFrame, y: Optional[pd.Series] = None
    ) -> "TrainValTestSplitBlock":
        """Fit the block to the data by computing split indices.

        This method determines which rows belong to train, validation, and test
        sets based on the configured ratios. The indices are stored for use
        in transform().

        Args:
            X: Training data as a pandas DataFrame.
            y: Optional target values as a pandas Series.

        Returns:
            self: The fitted block instance.

        Raises:
            ValueError: If X is not a DataFrame or is empty.
            ValueError: If stratify_column is specified but doesn't exist in X.
            ValueError: If stratify_column is specified but y is None.
        """
        if not isinstance(X, pd.DataFrame):
            raise ValueError(f"Expected pandas DataFrame, got {type(X).__name__}")

        if len(X) == 0:
            raise ValueError("Cannot split empty DataFrame")

        stratify_column = self.params.get("stratify_column")

        # Validate stratify column exists
        if stratify_column and stratify_column not in X.columns:
            raise ValueError(
                f"Stratify column '{stratify_column}' not found in data. "
                f"Available columns: {list(X.columns)}"
            )

        train_ratio = self.params.get("train", 0.70)
        val_ratio = self.params.get("val", 0.15)
        test_ratio = self.params.get("test", 0.15)

        # Determine stratification
        stratify = None
        if stratify_column:
            stratify = X[stratify_column]

        # Step 1: Split off test set
        # The remaining data will be split into train and validation
        remaining_ratio = train_ratio + val_ratio

        if test_ratio > 0:
            # Split: remaining vs test
            remaining_idx, test_idx = train_test_split(
                X.index,
                test_size=test_ratio,
                stratify=stratify if stratify is not None else None,
                random_state=42,
            )
            self._test_indices = test_idx
        else:
            # No test set
            remaining_idx = X.index
            self._test_indices = pd.Index([])

        # Step 2: Split remaining into train and validation
        if val_ratio > 0 and remaining_ratio > 0:
            # Calculate validation proportion of remaining data
            val_proportion = val_ratio / remaining_ratio

            # Get stratify values for remaining data if needed
            remaining_stratify = None
            if stratify is not None:
                remaining_stratify = stratify.loc[remaining_idx]

            train_idx, val_idx = train_test_split(
                remaining_idx,
                test_size=val_proportion,
                stratify=remaining_stratify,
                random_state=42,
            )
            self._train_indices = train_idx
            self._val_indices = val_idx
        elif val_ratio == 0:
            # No validation set
            self._train_indices = remaining_idx
            self._val_indices = pd.Index([])
        else:
            # This shouldn't happen due to validation in __init__
            raise ValueError("Invalid split ratios")

        self._is_fitted = True
        return self

    def transform(self, X: pd.DataFrame) -> pd.DataFrame:
        """Transform is not supported for TrainValTestSplitBlock.

        This block does not transform data in-place. Use fit_transform() to
        get the split datasets.

        Args:
            X: Input data (ignored).

        Raises:
            NotImplementedError: Always raised. Use fit_transform() instead.
        """
        raise NotImplementedError(
            "TrainValTestSplitBlock does not support transform(). "
            "Use fit_transform(X, y) to get (X_train, X_val, X_test, y_train, y_val, y_test)."
        )

    def fit_transform(
        self, X: pd.DataFrame, y: Optional[pd.Series] = None
    ) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, Optional[pd.Series], Optional[pd.Series], Optional[pd.Series]]:
        """Split the data into train/validation/test sets.

        This is the primary method for using this block. It fits the split
        indices and immediately applies them to partition the data.

        Args:
            X: Input features as a pandas DataFrame.
            y: Optional target values as a pandas Series.

        Returns:
            Tuple of (X_train, X_val, X_test, y_train, y_val, y_test).
            If y is None, the y_* elements will be None.

        Raises:
            ValueError: If X is not a DataFrame.
            ValueError: If y is provided but doesn't match X length.
        """
        self.fit(X, y)

        if not isinstance(X, pd.DataFrame):
            raise ValueError(f"Expected pandas DataFrame, got {type(X).__name__}")

        # Validate y if provided
        if y is not None and len(y) != len(X):
            raise ValueError(
                f"Target y length ({len(y)}) does not match X length ({len(X)})"
            )

        # Extract splits
        X_train = X.loc[self._train_indices] if len(self._train_indices) > 0 else pd.DataFrame()
        X_val = X.loc[self._val_indices] if len(self._val_indices) > 0 else pd.DataFrame()
        X_test = X.loc[self._test_indices] if len(self._test_indices) > 0 else pd.DataFrame()

        y_train = y.loc[self._train_indices] if y is not None and len(self._train_indices) > 0 else None
        y_val = y.loc[self._val_indices] if y is not None and len(self._val_indices) > 0 else None
        y_test = y.loc[self._test_indices] if y is not None and len(self._test_indices) > 0 else None

        return X_train, X_val, X_test, y_train, y_val, y_test

    def to_sklearn(self) -> None:
        """Convert this block to a scikit-learn transformer.

        This block is not compatible with scikit-learn pipelines since it
        returns multiple outputs rather than a transformed DataFrame.

        Raises:
            NotImplementedError: This block cannot be converted to sklearn.
        """
        raise NotImplementedError(
            "TrainValTestSplitBlock cannot be converted to a scikit-learn transformer. "
            "It is a pipeline stage that returns multiple datasets, not a transformer."
        )

    def get_split_sizes(self) -> dict:
        """Get the sizes of each split.

        Only valid after fit() has been called.

        Returns:
            dict with keys 'train', 'val', 'test' containing the number of
            samples in each split.

        Raises:
            RuntimeError: If get_split_sizes() is called before fit().
        """
        if not self._is_fitted:
            raise RuntimeError(
                "Cannot get split sizes: TrainValTestSplitBlock has not been fitted."
            )

        return {
            "train": len(self._train_indices) if self._train_indices is not None else 0,
            "val": len(self._val_indices) if self._val_indices is not None else 0,
            "test": len(self._test_indices) if self._test_indices is not None else 0,
        }
