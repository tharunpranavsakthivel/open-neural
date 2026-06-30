"""OpenNeural backend API routers package.

Contains FastAPI routers for all API endpoints organized by domain.
"""

from openneural_backend.routers.auth import router as auth_router
from openneural_backend.routers.dashboard import router as dashboard_router
from openneural_backend.routers.evaluation import router as evaluation_router
from openneural_backend.routers.experiments import router as experiments_router
from openneural_backend.routers.experiments import global_router as experiments_global_router
from openneural_backend.routers.exports import router as exports_router
from openneural_backend.routers.leaderboard import router as leaderboard_router
from openneural_backend.routers.pipelines import router as pipelines_router
from openneural_backend.routers.projects import router as projects_router
from openneural_backend.routers.recovery import router as recovery_router
from openneural_backend.routers.snapshots import router as snapshots_router
from openneural_backend.routers.stream import router as stream_router
from openneural_backend.routers.system import router as system_router

__all__ = [
    "auth_router",
    "projects_router",
    "snapshots_router",
    "pipelines_router",
    "experiments_router",
    "experiments_global_router",
    "evaluation_router",
    "leaderboard_router",
    "exports_router",
    "stream_router",
    "dashboard_router",
    "recovery_router",
    "system_router",
]
