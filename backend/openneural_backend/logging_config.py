"""Logging configuration for the OpenNeural backend.

Provides custom daily rotating file handler and a central function to configure
the Python standard logging library. Configures root logger to INFO and
the ML training logger (openneural_backend.orchestrator.trainer) to DEBUG.
"""

import logging
import os
from datetime import datetime
from pathlib import Path


class ISO8601Formatter(logging.Formatter):
    """Custom formatter to format asctime in strict ISO8601 format."""

    def formatTime(self, record: logging.LogRecord, datefmt: str | None = None) -> str:
        """Format the creation time of the LogRecord in ISO8601 format.

        Args:
            record: The LogRecord whose creation time is to be formatted.
            datefmt: Optional date/time format string (unused).

        Returns:
            str: The ISO8601 formatted timestamp with local timezone offset.
        """
        # Ensure timestamp includes microsecond precision and timezone offset
        dt = datetime.fromtimestamp(record.created).astimezone()
        return dt.isoformat()


class OpenNeuralDailyRotatingFileHandler(logging.FileHandler):
    """Custom FileHandler that implements daily rotation for OpenNeural.

    Writes logs to `{data_dir}/logs/openneural_{YYYY-MM-DD}.log`. Rotates daily
    by updating the target filename dynamically when the day changes, and
    retains a maximum of `backup_count` (default 14) files.
    """

    def __init__(
        self, logs_dir: Path, backup_count: int = 14, encoding: str = "utf-8"
    ) -> None:
        """Initialize the handler and clean up older log files.

        Args:
            logs_dir: The directory where log files should be written.
            backup_count: The number of historical log files to retain.
            encoding: Encoding to use when writing log files.
        """
        self.logs_dir = Path(logs_dir)
        self.backup_count = backup_count
        self.encoding = encoding
        self.current_date = datetime.now().strftime("%Y-%m-%d")

        # Ensure that logs directory exists before opening log file
        self.logs_dir.mkdir(parents=True, exist_ok=True)

        filename = self._get_filename()
        try:
            super().__init__(filename, encoding=self.encoding)
        except PermissionError:
            fallback = self.logs_dir / f"openneural_{self.current_date}_{os.getpid()}.log"
            super().__init__(fallback, encoding=self.encoding)

        # Remove historical logs exceeding the backup limit
        self._rotate_and_cleanup()

    def _get_filename(self) -> str:
        """Get the absolute file path for the current date's log file.

        Returns:
            str: Path string to the log file.
        """
        return str(self.logs_dir / f"openneural_{self.current_date}.log")

    def _rotate_and_cleanup(self) -> None:
        """Enforce log retention policy by deleting oldest files beyond the backup limit."""
        try:
            log_files = sorted(
                self.logs_dir.glob("openneural_*.log"), key=lambda p: p.name
            )
            # Remove oldest files if total log file count exceeds backup count limit
            if len(log_files) > self.backup_count:
                files_to_delete = log_files[: -self.backup_count]
                for f in files_to_delete:
                    try:
                        f.unlink()
                    except OSError:
                        # Silently ignore OS-level file deletion errors
                        pass
        except Exception:
            # Prevent failures in cleanup from blocking app startup or logging
            pass

    def emit(self, record: logging.LogRecord) -> None:
        """Emit a LogRecord, rotating the file stream if the calendar day has changed.

        Args:
            record: The LogRecord to be logged.
        """
        now_date = datetime.now().strftime("%Y-%m-%d")
        if now_date != self.current_date:
            self.current_date = now_date
            self.close()
            # Redirect future logs to the file for the new day
            self.baseFilename = os.path.abspath(self._get_filename())
            try:
                self.stream = self._open()
            except PermissionError:
                fallback = self.logs_dir / f"openneural_{self.current_date}_{os.getpid()}.log"
                self.baseFilename = os.path.abspath(fallback)
                self.stream = self._open()
            self._rotate_and_cleanup()

        super().emit(record)


def configure_logging() -> None:
    """Configure python logging globally.

    Sets up a daily rotating file handler writing to {data_dir}/logs/openneural_{YYYY-MM-DD}.log,
    and a console StreamHandler.
    - Log format: [ISO8601] [LEVEL] [module] message
    - Root Logger: INFO
    - ML Training Logger (openneural_backend.orchestrator.trainer): DEBUG
    """
    # Load DATA_DIR from environment variable set at startup
    data_dir_str = os.environ.get("OPENNEURAL_DATA_DIR")
    if not data_dir_str:
        # Fallback to local default directory if environment variable is missing
        data_dir_str = "~/openneural"

    data_dir = Path(data_dir_str).expanduser().resolve()
    logs_dir = data_dir / "logs"

    # Define the required log format
    log_format = "[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s"
    formatter = ISO8601Formatter(log_format)

    # Configure console handler to view logs in standard output
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    console_handler.setLevel(logging.INFO)

    # Get the root logger and configure handlers
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)

    # Clear existing handlers to prevent duplicate logging
    root_logger.handlers.clear()
    root_logger.addHandler(console_handler)

    # Configure the daily rotating file handler. If the data directory is not
    # writable, keep the backend usable with console logging only.
    try:
        file_handler = OpenNeuralDailyRotatingFileHandler(
            logs_dir=logs_dir, backup_count=14
        )
        file_handler.setFormatter(formatter)
        file_handler.setLevel(logging.DEBUG)
        root_logger.addHandler(file_handler)
    except OSError as e:
        root_logger.warning(f"File logging disabled: {e}")

    # Configure ML training logger specifically to run at DEBUG level
    ml_logger = logging.getLogger("openneural_backend.orchestrator.trainer")
    ml_logger.setLevel(logging.DEBUG)
