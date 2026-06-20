"""
OpenNeural Preprocessing Pipeline Module

This module provides the preprocessing pipeline engine for OpenNeural.
It includes the block interface, block implementations, registry, builder,
and validator for constructing and executing preprocessing pipelines.
"""

from openneural_backend.pipeline.block_interface import PipelineBlock

__all__ = ["PipelineBlock"]
