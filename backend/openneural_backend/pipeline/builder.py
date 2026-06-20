"""
Pipeline Builder

This module provides functionality to build scikit-learn Pipeline objects
from JSON configuration. It handles the instantiation of pipeline blocks
from the registry and composes them into an executable sklearn pipeline.
"""

from typing import Any, Dict, List, Optional, Tuple

from sklearn.pipeline import Pipeline as SklearnPipeline

from openneural_backend.pipeline.block_interface import PipelineBlock
from openneural_backend.pipeline.blocks.split import TrainValTestSplitBlock
from openneural_backend.pipeline.registry import get_block_or_raise


def build_sklearn_pipeline(
    config_json: Dict[str, Any]
) -> Tuple[SklearnPipeline, Optional[Dict[str, Any]]]:
    """Build a scikit-learn Pipeline from JSON configuration.

    Parses an ordered array of block configurations, instantiates each block
    from the registry, and composes a scikit-learn Pipeline from the blocks
    that support sklearn transformation (i.e., not TrainValTestSplitBlock).

    The split block is handled specially since it is not a sklearn transformer
    but a pipeline stage that partitions data. It is returned separately
    for execution outside the sklearn pipeline.

    Args:
        config_json: Pipeline configuration as a dictionary containing:
            - blocks: List of block configurations, each with:
                - type: Block type string (e.g., "drop_nulls", "scale_numeric_standard")
                - params: Dictionary of block parameters

    Returns:
        Tuple containing:
            - SklearnPipeline: Composed sklearn pipeline with all transformer blocks
            - Optional[Dict]: Split configuration if a split block is present, else None
                The split config has keys: train, val, test, stratify_column

    Raises:
        ValueError: If config_json is missing 'blocks' key.
        ValueError: If a block type is not registered.
        ValueError: If block instantiation fails.

    Example:
        >>> config = {
        ...     "blocks": [
        ...         {"type": "drop_nulls", "params": {}},
        ...         {"type": "fill_missing_mean", "params": {"columns": ["age"]}},
        ...         {"type": "scale_numeric_standard", "params": {}},
        ...         {"type": "train_val_test_split", "params": {"train": 0.7, "val": 0.15, "test": 0.15}}
        ...     ]
        ... }
        >>> pipeline, split_config = build_sklearn_pipeline(config)
    """
    if not isinstance(config_json, dict):
        raise ValueError(f"config_json must be a dict, got {type(config_json).__name__}")

    blocks_config = config_json.get("blocks")
    if blocks_config is None:
        raise ValueError("config_json must contain a 'blocks' key with a list of block configurations")

    if not isinstance(blocks_config, list):
        raise ValueError(f"'blocks' must be a list, got {type(blocks_config).__name__}")

    sklearn_steps: List[Tuple[str, Any]] = []
    split_config: Optional[Dict[str, Any]] = None
    split_block: Optional[TrainValTestSplitBlock] = None

    for idx, block_config in enumerate(blocks_config):
        if not isinstance(block_config, dict):
            raise ValueError(f"Block configuration at index {idx} must be a dict, got {type(block_config).__name__}")

        block_type = block_config.get("type")
        if not block_type:
            raise ValueError(f"Block configuration at index {idx} is missing 'type' key")

        if not isinstance(block_type, str):
            raise ValueError(f"Block type at index {idx} must be a string, got {type(block_type).__name__}")

        block_params = block_config.get("params", {})
        if not isinstance(block_params, dict):
            raise ValueError(f"Block params at index {idx} must be a dict, got {type(block_params).__name__}")

        # Get the block class from registry
        block_class = get_block_or_raise(block_type)

        # Instantiate the block
        try:
            block_instance = block_class(**block_params)
        except Exception as e:
            raise ValueError(
                f"Failed to instantiate block '{block_type}' at index {idx}: {str(e)}"
            ) from e

        # Handle split block specially - it's not a sklearn transformer
        if isinstance(block_instance, TrainValTestSplitBlock):
            if split_config is not None:
                raise ValueError(
                    "Multiple train_val_test_split blocks are not allowed. "
                    "Only one split block per pipeline."
                )
            split_block = block_instance
            split_config = {
                "train": block_params.get("train", 0.70),
                "val": block_params.get("val", 0.15),
                "test": block_params.get("test", 0.15),
                "stratify_column": block_params.get("stratify_column"),
            }
        else:
            # This is a regular transformer block - add to sklearn pipeline
            step_name = f"step_{idx}_{block_type}"
            sklearn_steps.append((step_name, block_instance))

    # Create the sklearn pipeline with all non-split blocks
    if sklearn_steps:
        pipeline = SklearnPipeline(steps=sklearn_steps)
    else:
        # No transformer blocks - create empty pipeline
        pipeline = SklearnPipeline(steps=[])

    return pipeline, split_config


def instantiate_block(block_type: str, params: Optional[Dict[str, Any]] = None) -> PipelineBlock:
    """Instantiate a pipeline block by type.

    Convenience function to create a single block instance from the registry.

    Args:
        block_type: The block type string from the registry.
        params: Optional dictionary of block parameters.

    Returns:
        PipelineBlock: Instantiated block ready for fitting.

    Raises:
        KeyError: If the block type is not registered.
        ValueError: If block instantiation fails.

    Example:
        >>> block = instantiate_block("drop_nulls", {})
        >>> block = instantiate_block("scale_numeric_standard", {"columns": ["age", "income"]})
    """
    block_class = get_block_or_raise(block_type)
    params = params or {}

    try:
        return block_class(**params)
    except Exception as e:
        raise ValueError(
            f"Failed to instantiate block '{block_type}': {str(e)}"
        ) from e


def extract_split_block(
    blocks: List[PipelineBlock]
) -> Tuple[List[PipelineBlock], Optional[TrainValTestSplitBlock]]:
    """Extract the TrainValTestSplitBlock from a list of blocks.

    Separates the split block from regular transformer blocks. The split
    block is handled specially since it cannot be part of a sklearn pipeline.

    Args:
        blocks: List of instantiated PipelineBlock objects.

    Returns:
        Tuple containing:
            - List[PipelineBlock]: All blocks except the split block
            - Optional[TrainValTestSplitBlock]: The split block if present, else None

    Raises:
        ValueError: If multiple split blocks are found.
    """
    transformer_blocks: List[PipelineBlock] = []
    split_block: Optional[TrainValTestSplitBlock] = None

    for block in blocks:
        if isinstance(block, TrainValTestSplitBlock):
            if split_block is not None:
                raise ValueError("Multiple TrainValTestSplitBlock instances found. Only one split block is allowed.")
            split_block = block
        else:
            transformer_blocks.append(block)

    return transformer_blocks, split_block


def build_pipeline_config(
    sklearn_pipeline: SklearnPipeline,
    split_config: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Build pipeline configuration from a sklearn pipeline.

    Serializes a sklearn pipeline back to JSON configuration format.
    This is useful for saving and reloading pipelines.

    Args:
        sklearn_pipeline: The fitted sklearn pipeline.
        split_config: Optional split configuration dict.

    Returns:
        Dict containing the pipeline configuration.

    Example:
        >>> config = build_pipeline_config(pipeline, split_config)
        >>> # config can be saved as JSON
    """
    blocks_config: List[Dict[str, Any]] = []

    # Serialize sklearn pipeline steps
    for name, step in sklearn_pipeline.steps:
        if hasattr(step, 'block_type'):
            # This is one of our PipelineBlock instances
            block_config = {
                "type": step.block_type,
                "params": step.get_params() if hasattr(step, 'get_params') else {}
            }
            blocks_config.append(block_config)
        elif hasattr(step, '__class__'):
            # This is a sklearn transformer - note: we can't fully serialize these
            # without the custom block wrapper
            block_config = {
                "type": step.__class__.__name__,
                "params": step.get_params() if hasattr(step, 'get_params') else {}
            }
            blocks_config.append(block_config)

    # Add split block configuration if present
    if split_config:
        split_block_config = {
            "type": "train_val_test_split",
            "params": {
                k: v for k, v in split_config.items() if v is not None
            }
        }
        blocks_config.append(split_block_config)

    return {"blocks": blocks_config}
