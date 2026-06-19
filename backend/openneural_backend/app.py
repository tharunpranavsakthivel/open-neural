"""FastAPI application factory for the OpenNeural backend.

Exports create_app(), which builds the ASGI application used by Uvicorn. The
module depends on FastAPI and performs no network binding by itself.
"""

from fastapi import FastAPI

from openneural_backend import __version__


def create_app() -> FastAPI:
    """Create the OpenNeural FastAPI application.

    Returns:
        FastAPI: Configured ASGI app with the initial health endpoint.

    Raises:
        RuntimeError: Propagated from FastAPI if application construction fails.
    """
    app = FastAPI(title="OpenNeural API", version=__version__)

    @app.get("/health", tags=["system"])
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
