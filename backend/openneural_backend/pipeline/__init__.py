"""
OpenNeural Preprocessing Pipeline Module

This module provides the preprocessing pipeline engine for OpenNeural.
It includes the block interface, block implementations, registry, builder,
and validator for constructing and executing preprocessing pipelines.
"""

from openneural_backend.pipeline.block_interface import PipelineBlock
from openneural_backend.pipeline.builder import (
    build_pipeline_config,
    build_sklearn_pipeline,
    extract_split_block,
    instantiate_block,
)
from openneural_backend.pipeline.registry import (
    BLOCK_REGISTRY,
    get_block,
    get_block_or_raise,
    is_registered,
    list_blocks,
    register_block,
    unregister_block,
)
from openneural_backend.pipeline.validator import (
    validate_block_params,
    validate_pipeline,
)

__all__ = [
    "PipelineBlock",
    "BLOCK_REGISTRY",
    "build_pipeline_config",
    "build_sklearn_pipeline",
    "extract_split_block",
    "get_block",
    "get_block_or_raise",
    "instantiate_block",
    "is_registered",
    "list_blocks",
    "register_block",
    "unregister_block",
    "validate_block_params",
    "validate_pipeline",
]
