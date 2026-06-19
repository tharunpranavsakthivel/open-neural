"""FastAPI application factory for the OpenNeural backend.

Exports create_app(), which builds the ASGI application used by Uvicorn. The
module depends on FastAPI and performs no network binding by itself.
"""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from openneural_backend import __version__
from openneural_backend.db.init import initialize_database
from openneural_backend.middleware import RequestLoggingMiddleware, SecretAuthMiddleware
from openneural_backend.routers import (
    evaluation_router,
    experiments_router,
    exports_router,
    leaderboard_router,
    pipelines_router,
    projects_router,
    snapshots_router,
    stream_router,
)

# API version prefix for all routes
API_V1_PREFIX = "/api/v1"

# Logger for startup events
logger = logging.getLogger(__name__)


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

    # Add request logging middleware
    # This logs every request to {data_dir}/logs/openneural_{date}.log
    app.add_middleware(RequestLoggingMiddleware)

    # Add secret-based authentication middleware
    # This validates the X-OpenNeural-Secret header matches the ephemeral secret
    app.add_middleware(SecretAuthMiddleware)

    # Register all API routers
    app.include_router(projects_router, prefix=API_V1_PREFIX)
    app.include_router(snapshots_router, prefix=API_V1_PREFIX)
    app.include_router(pipelines_router, prefix=API_V1_PREFIX)
    app.include_router(experiments_router, prefix=API_V1_PREFIX)
    app.include_router(evaluation_router, prefix=API_V1_PREFIX)
    app.include_router(leaderboard_router, prefix=API_V1_PREFIX)
    app.include_router(exports_router, prefix=API_V1_PREFIX)
    app.include_router(stream_router, prefix=API_V1_PREFIX)

    @app.get(f"{API_V1_PREFIX}/health", tags=["system"])
    def health_check() -> dict[str, str]:
        """Report backend process health.

        Returns:
            dict[str, str]: Static status payload for local process checks.

        Raises:
            No application-level exceptions are expected.
        """
        return {"status": "ok", "version": __version__}

    # Register startup event handler for database initialization
    @app.on_event("startup")
    async def on_startup() -> None:
        """Initialize database on application startup.

        Performs full database initialization:
        1. Ensures data directories exist
        2. Applies pending Alembic migrations
        3. Verifies WAL mode is active

        This runs automatically when the application starts.

        Raises:
            RuntimeError: If initialization fails.
        """
        logger.info("Running startup tasks...")
        await initialize_database()
        logger.info("Startup tasks completed.")

    return app


app = create_app()
