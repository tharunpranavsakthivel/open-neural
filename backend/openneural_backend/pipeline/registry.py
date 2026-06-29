"""
Pipeline Block Registry

This module provides a central registry for all pipeline block types.
It maintains a mapping from block type strings to block classes, enabling
dynamic block instantiation from configuration. The registry supports
a decorator pattern for registering custom blocks.
"""

from openneural_backend.pipeline.block_interface import PipelineBlock

# Type alias for block classes
BlockClass = type[PipelineBlock]

# Central registry mapping block_type strings to block classes
BLOCK_REGISTRY: dict[str, BlockClass] = {}


def register_block(cls: BlockClass) -> BlockClass:
    """Decorator to register a PipelineBlock class in the BLOCK_REGISTRY.

    This decorator automatically registers a block class using its
    block_type class attribute. The block_type serves as the unique
    identifier for looking up the block class.

    Args:
        cls: A class that inherits from PipelineBlock and defines block_type.

    Returns:
        BlockClass: The registered class (unchanged), enabling decorator usage.

    Raises:
        ValueError: If the class does not define a block_type attribute.
        ValueError: If the block_type is already registered (duplicate).

    Example:
        >>> @register_block
        ... class MyCustomBlock(PipelineBlock):
        ...     block_type = "my_custom"
        ...     # ... implementation
    """
    block_type = getattr(cls, "block_type", None)

    if not block_type:
        raise ValueError(
            f"Cannot register {cls.__name__}: block_type class attribute is not defined. "
            f"All PipelineBlock subclasses must define block_type."
        )

    if not isinstance(block_type, str):
        raise ValueError(
            f"Cannot register {cls.__name__}: block_type must be a string, "
            f"got {type(block_type).__name__}"
        )

    if block_type in BLOCK_REGISTRY:
        existing = BLOCK_REGISTRY[block_type].__name__
        raise ValueError(
            f"Cannot register {cls.__name__}: block_type '{block_type}' "
            f"is already registered to {existing}. "
            f"Block types must be unique."
        )

    BLOCK_REGISTRY[block_type] = cls
    return cls


def get_block(block_type: str) -> BlockClass | None:
    """Look up a block class by its block_type string.

    Args:
        block_type: The unique identifier string for the block type.

    Returns:
        Optional[BlockClass]: The block class if found, None otherwise.

    Example:
        >>> block_class = get_block("drop_nulls")
        >>> block = block_class()
    """
    return BLOCK_REGISTRY.get(block_type)


def get_block_or_raise(block_type: str) -> BlockClass:
    """Look up a block class by its block_type string, raising if not found.

    Args:
        block_type: The unique identifier string for the block type.

    Returns:
        BlockClass: The block class.

    Raises:
        KeyError: If the block_type is not registered.

    Example:
        >>> block_class = get_block_or_raise("drop_nulls")
        >>> block = block_class()
    """
    if block_type not in BLOCK_REGISTRY:
        available = list(BLOCK_REGISTRY.keys())
        raise KeyError(
            f"Block type '{block_type}' is not registered. "
            f"Available block types: {available}"
        )
    return BLOCK_REGISTRY[block_type]


def list_blocks() -> dict[str, str]:
    """List all registered block types and their class names.

    Returns:
        Dict[str, str]: Mapping from block_type to class name.

    Example:
        >>> blocks = list_blocks()
        >>> print(blocks)
        {'drop_nulls': 'DropNullsBlock', 'scale_numeric_standard': 'ScaleNumericStandardBlock', ...}
    """
    return {block_type: cls.__name__ for block_type, cls in BLOCK_REGISTRY.items()}


def is_registered(block_type: str) -> bool:
    """Check if a block type is registered.

    Args:
        block_type: The block type string to check.

    Returns:
        bool: True if registered, False otherwise.
    """
    return block_type in BLOCK_REGISTRY


def unregister_block(block_type: str) -> bool:
    """Unregister a block type from the registry.

    This is primarily useful for testing or for replacing built-in
    blocks with custom implementations.

    Args:
        block_type: The block type to unregister.

    Returns:
        bool: True if the block was removed, False if not found.
    """
    if block_type in BLOCK_REGISTRY:
        del BLOCK_REGISTRY[block_type]
        return True
    return False


def clear_registry() -> None:
    """Clear all registered blocks from the registry.

    WARNING: This removes ALL blocks including built-in ones.
    Primarily useful for testing. Use with caution.
    """
    BLOCK_REGISTRY.clear()


def _register_builtin_blocks() -> None:
    """Register all built-in pipeline blocks.

    This function is called at module import time to populate the
    BLOCK_REGISTRY with all standard OpenNeural pipeline blocks.
    """
    # Import all block classes
    from openneural_backend.pipeline.blocks.drop_nulls import DropNullsBlock
    from openneural_backend.pipeline.blocks.encode_categoricals import (
        EncodeCategoricalsOneHotBlock,
        EncodeCategoricalsOrdinalBlock,
    )
    from openneural_backend.pipeline.blocks.feature_selection import (
        FeatureSelectionBlock,
    )
    from openneural_backend.pipeline.blocks.fill_missing import (
        FillMissingMeanBlock,
        FillMissingMedianBlock,
    )
    from openneural_backend.pipeline.blocks.log_transform import LogTransformBlock
    from openneural_backend.pipeline.blocks.remove_outliers import (
        RemoveOutliersIQRBlock,
    )
    from openneural_backend.pipeline.blocks.scale_numerics import (
        ScaleNumericMinMaxBlock,
        ScaleNumericStandardBlock,
    )
    from openneural_backend.pipeline.blocks.split import TrainValTestSplitBlock

    # Register all blocks using the decorator pattern
    # Each block's block_type attribute serves as the key
    blocks_to_register = [
        DropNullsBlock,
        FillMissingMeanBlock,
        FillMissingMedianBlock,
        EncodeCategoricalsOneHotBlock,
        EncodeCategoricalsOrdinalBlock,
        ScaleNumericStandardBlock,
        ScaleNumericMinMaxBlock,
        LogTransformBlock,
        RemoveOutliersIQRBlock,
        FeatureSelectionBlock,
        TrainValTestSplitBlock,
    ]

    for block_class in blocks_to_register:
        register_block(block_class)


# Register all built-in blocks at import time
_register_builtin_blocks()
