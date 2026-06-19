"""Request logging middleware for OpenNeural backend.

Provides a FastAPI middleware that logs every incoming request with method, path,
status code, and duration to a daily rotating log file.
"""

import os
import time
from collections.abc import Awaitable, Callable
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware that logs every request to a daily rotating log file.

    Logs include HTTP method, path, status code, and request duration.
    Log files are stored at {data_dir}/logs/openneural_{date}.log.
    """

    def __init__(self, app: Any) -> None:
        """Initialize the middleware with the ASGI app.

        Args:
            app: The ASGI application to wrap.

        Raises:
            RuntimeError: If OPENNEURAL_DATA_DIR environment variable is not set.
        """
        super().__init__(app)
        data_dir = os.environ.get("OPENNEURAL_DATA_DIR")
        if not data_dir:
            raise RuntimeError(
                "OPENNEURAL_DATA_DIR environment variable must be set. "
                "This is set by the CLI entry point at startup."
            )
        self._data_dir = Path(data_dir).expanduser()
        self._logs_dir = self._data_dir / "logs"

    def _get_log_file_path(self) -> Path:
        """Get the log file path for the current date.

        Returns:
            Path: Path to the daily log file.

        Raises:
            No exceptions are expected.
        """
        today = datetime.now().strftime("%Y%m%d")
        return self._logs_dir / f"openneural_{today}.log"

    def _ensure_logs_dir_exists(self) -> None:
        """Ensure the logs directory exists.

        Raises:
            OSError: If directory creation fails.
        """
        self._logs_dir.mkdir(parents=True, exist_ok=True)

    def _format_log_entry(
        self,
        method: str,
        path: str,
        status_code: int,
        duration_ms: float,
    ) -> str:
        """Format a log entry string.

        Args:
            method: HTTP method (GET, POST, etc.).
            path: Request path.
            status_code: HTTP status code.
            duration_ms: Request duration in milliseconds.

        Returns:
            str: Formatted log entry with timestamp.

        Raises:
            No exceptions are expected.
        """
        timestamp = datetime.now().isoformat()
        return f"{timestamp} {method} {path} {status_code} {duration_ms:.2f}ms\n"

    def _write_log(self, log_entry: str) -> None:
        """Write a log entry to the daily log file.

        Args:
            log_entry: The formatted log entry string.

        Raises:
            OSError: If file writing fails.
        """
        self._ensure_logs_dir_exists()
        log_file = self._get_log_file_path()
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(log_entry)

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        """Log the request and dispatch to the next handler.

        Args:
            request: The incoming HTTP request.
            call_next: The next middleware/handler in the chain.

        Returns:
            Response: The response from the next handler.

        Raises:
            No exceptions are raised; errors are silently logged but not propagated.
        """
        start_time = time.perf_counter()

        # Process the request
        response = await call_next(request)

        # Calculate duration
        duration_ms = (time.perf_counter() - start_time) * 1000

        # Extract request details
        method = request.method
        path = request.url.path
        status_code = response.status_code

        # Format and write log entry
        log_entry = self._format_log_entry(method, path, status_code, duration_ms)
        try:
            self._write_log(log_entry)
        except OSError:
            # Silently ignore logging errors to avoid disrupting request processing
            pass

        return response
