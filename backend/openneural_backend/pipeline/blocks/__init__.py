"""
OpenNeural Preprocessing Pipeline Blocks

This subpackage contains all pipeline block implementations for data preprocessing.
Each block provides specific transformation functionality and can be composed into
a full preprocessing pipeline.
"""

from openneural_backend.pipeline.blocks.drop_nulls import DropNullsBlock, DropNullsTransformer
from openneural_backend.pipeline.blocks.encode_categoricals import (
    EncodeCategoricalsOneHotBlock,
    EncodeCategoricalsOrdinalBlock,
)
from openneural_backend.pipeline.blocks.feature_selection import FeatureSelectionBlock
from openneural_backend.pipeline.blocks.fill_missing import (
    FillMissingMeanBlock,
    FillMissingMedianBlock,
)
from openneural_backend.pipeline.blocks.log_transform import LogTransformBlock, LogTransformer
from openneural_backend.pipeline.blocks.remove_outliers import (
    RemoveOutliersIQRBlock,
    RemoveOutliersIQRTransformer,
)
from openneural_backend.pipeline.blocks.scale_numerics import (
    ScaleNumericMinMaxBlock,
    ScaleNumericStandardBlock,
)
from openneural_backend.pipeline.blocks.split import TrainValTestSplitBlock

__all__ = [
    "DropNullsBlock",
    "DropNullsTransformer",
    "EncodeCategoricalsOneHotBlock",
    "EncodeCategoricalsOrdinalBlock",
    "FeatureSelectionBlock",
    "FillMissingMeanBlock",
    "FillMissingMedianBlock",
    "LogTransformBlock",
    "LogTransformer",
    "RemoveOutliersIQRBlock",
    "RemoveOutliersIQRTransformer",
    "ScaleNumericMinMaxBlock",
    "ScaleNumericStandardBlock",
    "TrainValTestSplitBlock",
]

# Note: builder.py and validator.py are imported from pipeline/__init__.py
# to avoid circular imports since they depend on blocks
