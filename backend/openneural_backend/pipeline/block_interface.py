"""
OpenNeural Preprocessing Pipeline Block Interface

This module defines the abstract base class for all preprocessing pipeline blocks.
All pipeline block implementations must subclass `PipelineBlock` and implement
the required methods. This ensures a consistent interface for the pipeline engine
while allowing new block types to be added without modifying the core engine.

Example:
    class DropNullsBlock(PipelineBlock):
        block_type = "drop_nulls"
        param_schema = {
            "columns": {"type": "array", "items": {"type": "string"}, "required": False}
        }

        def fit(self, X, y=None):
            # Implementation
            pass

        def transform(self, X):
            # Implementation
            pass
"""

from abc import ABC, abstractmethod
from typing import Any

import pandas as pd
from sklearn.base import TransformerMixin


class PipelineBlock(ABC):
    """Abstract base class for all preprocessing pipeline blocks.

    All preprocessing blocks must inherit from this class and implement the
    abstract methods. The block interface is designed to be compatible with
    scikit-learn's transformer API while adding OpenNeural-specific metadata
    and schema validation.

    Class Attributes:
        block_type (str): Unique identifier for this block type. Used for
            serialization and registry lookup. Must be set by subclasses.
        param_schema (dict): JSON Schema-like definition of the parameters
            this block accepts. Used for validation and UI generation.
            Must be set by subclasses.

    Instance Attributes:
        params (dict): Runtime parameter values for this block instance.
        _is_fitted (bool): Internal flag tracking whether fit() has been called.
    """

    block_type: str = ""
    param_schema: dict = {}

    def __init__(self, **params: Any) -> None:
        """Initialize the block with the given parameters.

        Args:
            **params: Keyword arguments matching the param_schema definition.
                These parameters configure the block's behavior.
        """
        self.params = params
        self._is_fitted = False

    @abstractmethod
    def fit(self, X: pd.DataFrame, y: pd.Series | None = None) -> "PipelineBlock":
        """Fit the block to the data.

        This method learns any necessary statistics from the training data
        (e.g., mean/median for imputation, categories for encoding). The block
        should store learned state as instance attributes.

        Args:
            X: Training data as a pandas DataFrame. Each column represents
                a feature; each row represents a sample.
            y: Optional target values as a pandas Series. Some blocks may
                use this for stratification or target-aware preprocessing,
                but many blocks will ignore it.

        Returns:
            self: The fitted block instance, enabling method chaining.

        Raises:
            ValueError: If the input data is invalid or incompatible with
                the block's configuration.
        """
        pass

    @abstractmethod
    def transform(self, X: pd.DataFrame) -> pd.DataFrame:
        """Transform the input data using the fitted state.

        This method applies the learned transformation to new data. It must
        be called after fit() and should not modify the learned state.

        Args:
            X: Input data as a pandas DataFrame to transform. Must have
                the same schema as the data passed to fit().

        Returns:
            pd.DataFrame: The transformed data. The output may have different
                shape or column names than the input (e.g., after one-hot
                encoding or feature selection).

        Raises:
            RuntimeError: If transform() is called before fit().
            ValueError: If the input data is incompatible with the fitted state.
        """
        pass

    def fit_transform(
        self, X: pd.DataFrame, y: pd.Series | None = None
    ) -> pd.DataFrame:
        """Fit the block to the data, then transform it.

        This is a convenience method that combines fit() and transform() in
        a single call. It is semantically equivalent to calling fit() followed
        by transform(), but may be more efficient for some implementations.

        Args:
            X: Training data as a pandas DataFrame.
            y: Optional target values as a pandas Series.

        Returns:
            pd.DataFrame: The transformed training data.
        """
        self.fit(X, y)
        return self.transform(X)

    @abstractmethod
    def to_sklearn(self) -> TransformerMixin:
        """Convert this block to a scikit-learn transformer.

        Returns a scikit-learn compatible transformer that implements the
        same transformation logic. This enables integration with scikit-learn
        pipelines and cross-validation utilities.

        Returns:
            TransformerMixin: A scikit-learn transformer instance (e.g.,
                SimpleImputer, OneHotEncoder, StandardScaler) that can be
                used in sklearn.pipeline.Pipeline.

        Note:
            The returned transformer should already be fitted if this block
            has been fitted. Calling fit() on the returned transformer will
            refit it from scratch.
        """
        pass

    def get_params(self) -> dict:
        """Get the current parameter values.

        Returns:
            dict: A copy of the block's parameter dictionary.
        """
        return self.params.copy()

    def set_params(self, **params: Any) -> "PipelineBlock":
        """Set parameter values.

        Args:
            **params: Keyword arguments to update in the parameter dict.

        Returns:
            self: The block instance, enabling method chaining.
        """
        self.params.update(params)
        return self

    def __repr__(self) -> str:
        """Return a string representation of the block.

        Returns:
            str: A string showing the block type and parameters.
        """
        params_str = ", ".join(f"{k}={v!r}" for k, v in self.params.items())
        return f"{self.__class__.__name__}({params_str})"
