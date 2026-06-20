"""
OpenNeural Preprocessing Pipeline Module

This module provides the preprocessing pipeline engine for OpenNeural.
It includes the block interface, block implementations, registry, builder,
and validator for constructing and executing preprocessing pipelines.
"""

from openneural_backend.pipeline.block_interface import PipelineBlock
from openneural_backend.pipeline.registry import (
    BLOCK_REGISTRY,
    get_block,
    get_block_or_raise,
    is_registered,
    list_blocks,
    register_block,
    unregister_block,
)

__all__ = [
    "PipelineBlock",
    "BLOCK_REGISTRY",
    "get_block",
    "get_block_or_raise",
    "is_registered",
    "list_blocks",
    "register_block",
    "unregister_block",
]
