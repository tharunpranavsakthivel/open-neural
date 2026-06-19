"""OpenNeural backend API routers package.

Contains FastAPI routers for all API endpoints organized by domain.
"""

from openneural_backend.routers.dashboard import router as dashboard_router
from openneural_backend.routers.evaluation import router as evaluation_router
from openneural_backend.routers.experiments import router as experiments_router
from openneural_backend.routers.exports import router as exports_router
from openneural_backend.routers.leaderboard import router as leaderboard_router
from openneural_backend.routers.pipelines import router as pipelines_router
from openneural_backend.routers.projects import router as projects_router
from openneural_backend.routers.snapshots import router as snapshots_router
from openneural_backend.routers.stream import router as stream_router

__all__ = [
    "projects_router",
    "snapshots_router",
    "pipelines_router",
    "experiments_router",
    "evaluation_router",
    "leaderboard_router",
    "exports_router",
    "stream_router",
    "dashboard_router",
]
