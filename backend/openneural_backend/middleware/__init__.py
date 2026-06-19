"""OpenNeural backend middleware package.

Contains FastAPI middleware for authentication, security, and request processing.
"""

from openneural_backend.middleware.secret_auth import SecretAuthMiddleware

__all__ = ["SecretAuthMiddleware"]
