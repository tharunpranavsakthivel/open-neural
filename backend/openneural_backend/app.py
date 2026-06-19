"""FastAPI application factory for the OpenNeural backend.

Exports create_app(), which builds the ASGI application used by Uvicorn. The
module depends on FastAPI and performs no network binding by itself.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from openneural_backend import __version__

# API version prefix for all routes
API_V1_PREFIX = "/api/v1"


def create_app() -> FastAPI:
    """Create the OpenNeural FastAPI application.

    Returns:
        FastAPI: Configured ASGI app with CORS, API prefix, and health endpoint.

    Raises:
        RuntimeError: Propagated from FastAPI if application construction fails.
    """
    app = FastAPI(
        title="OpenNeural API",
        version=__version__,
        docs_url=f"{API_V1_PREFIX}/docs",
        openapi_url=f"{API_V1_PREFIX}/openapi.json",
    )

    # Configure CORS restricted to localhost origins only
    # This ensures the API only accepts requests from local Electron renderer
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://127.0.0.1",
            "http://127.0.0.1:*",  # Allow any port on localhost
            "http://localhost",
            "http://localhost:*",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get(f"{API_V1_PREFIX}/health", tags=["system"])
    def health_check() -> dict[str, str]:
        """Report backend process health.

        Returns:
            dict[str, str]: Static status payload for local process checks.

        Raises:
            No application-level exceptions are expected.
        """
        return {"status": "ok", "version": __version__}

    return app


app = create_app()
