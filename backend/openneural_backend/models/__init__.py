"""Model registry module for OpenNeural.

Exports the model registry functionality for model registration,
lookup, and listing.
"""

from openneural_backend.models.registry import (
    MODEL_REGISTRY,
    ModelSpec,
    OptunaParamSpec,
    clear_registry,
    get_model,
    is_registered,
    list_models,
    register_model,
    unregister_model,
)

__all__ = [
    "MODEL_REGISTRY",
    "ModelSpec",
    "OptunaParamSpec",
    "clear_registry",
    "get_model",
    "is_registered",
    "list_models",
    "register_model",
    "unregister_model",
]
