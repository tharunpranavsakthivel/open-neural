"""Secret-based authentication middleware for OpenNeural backend.

Provides a FastAPI middleware that validates an ephemeral shared secret passed
via the X-OpenNeural-Secret HTTP header. This ensures only the Electron main
process (which spawns the Python backend) can make requests to the local API.
"""

import hmac
import os
from collections.abc import Awaitable, Callable
from typing import Any

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware


class SecretAuthMiddleware(BaseHTTPMiddleware):
    """Middleware that validates the X-OpenNeural-Secret header.

    Compares the incoming request's secret header against the expected secret
    stored in the OPENNEURAL_SECRET environment variable using constant-time
    comparison to prevent timing attacks. Returns 401 Unauthorized if the header
    is missing or does not match.
    """

    def __init__(self, app: Any) -> None:
        """Initialize the middleware with the ASGI app.

        Args:
            app: The ASGI application to wrap.

        Raises:
            RuntimeError: If OPENNEURAL_SECRET environment variable is not set.
        """
        super().__init__(app)
        self._expected_secret = os.environ.get("OPENNEURAL_SECRET")
        if not self._expected_secret:
            raise RuntimeError(
                "OPENNEURAL_SECRET environment variable must be set. "
                "This is injected by the Electron main process at startup."
            )

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        """Validate the secret header and dispatch the request.

        Args:
            request: The incoming HTTP request.
            call_next: The next middleware/handler in the chain.

        Returns:
            Response: The response from the next handler (if authorized),
                or a 401 Unauthorized response if the secret is missing/invalid.

        Raises:
            No exceptions are raised; returns 401 response on auth failure.
        """
        # Extract the secret header from the request
        provided_secret = request.headers.get("X-OpenNeural-Secret")

        # Check if header is present and matches expected secret using constant-time comparison
        if provided_secret is None or not hmac.compare_digest(
            provided_secret, self._expected_secret
        ):
            # Return 401 Unauthorized without calling the next handler
            return Response(
                content='{"detail": "Unauthorized"}',
                status_code=401,
                headers={"Content-Type": "application/json"},
            )

        # Secret is valid, proceed to the next handler
        return await call_next(request)
