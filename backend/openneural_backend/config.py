"""Configuration management for OpenNeural backend.

Provides a centralized Settings singleton that reads configuration from CLI
arguments and environment variables. Validates that required values are present
and raises startup errors if any are missing.
"""

import os
from pathlib import Path
from typing import Self


class Settings:
    """Application settings singleton.

    Reads configuration from CLI arguments (passed via environment variables)
    and environment variables. Validates required settings at startup.

    Required settings:
        - DATA_DIR: Path to the data directory for snapshots, pipelines, models, etc.
        - OPENNEURAL_SECRET: Ephemeral secret for authentication between Electron
          main process and Python backend.

    Attributes:
        data_dir: Path to the data directory (resolved and expanded).
        secret: The ephemeral authentication secret.
        db_path: Path to the SQLite database file.
        snapshots_dir: Path to the snapshots subdirectory.
        pipelines_dir: Path to the pipelines subdirectory.
        models_dir: Path to the models subdirectory.
        reports_dir: Path to the reports subdirectory.
        predictions_dir: Path to the predictions subdirectory.
        logs_dir: Path to the logs subdirectory.
    """

    _instance: Self | None = None

    def __new__(cls) -> Self:
        """Ensure singleton pattern - only one Settings instance exists."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self) -> None:
        """Initialize the settings (only runs once due to singleton pattern)."""
        if self._initialized:
            return

        self._load_settings()
        self._initialized = True

    def _load_settings(self) -> None:
        """Load and validate all settings from environment variables.

        Raises:
            RuntimeError: If DATA_DIR or OPENNEURAL_SECRET environment variables
                are not set.
        """
        # Load DATA_DIR (set by CLI --data-dir argument in __main__.py)
        data_dir = os.environ.get("OPENNEURAL_DATA_DIR")
        if not data_dir:
            raise RuntimeError(
                "DATA_DIR configuration is missing. "
                "OPENNEURAL_DATA_DIR environment variable must be set. "
                "This is typically set via the --data-dir CLI argument."
            )

        # Resolve and expand the data directory path
        self.data_dir: Path = Path(data_dir).expanduser().resolve()

        # Load OPENNEURAL_SECRET (set by __main__.py)
        secret = os.environ.get("OPENNEURAL_SECRET")
        if not secret:
            raise RuntimeError(
                "OPENNEURAL_SECRET configuration is missing. "
                "OPENNEURAL_SECRET environment variable must be set. "
                "This is typically generated and set by the CLI entry point."
            )
        self.secret: str = secret

        # Derive subdirectory paths
        self.snapshots_dir = self.data_dir / "snapshots"
        self.pipelines_dir = self.data_dir / "pipelines"
        self.models_dir = self.data_dir / "models"
        self.reports_dir = self.data_dir / "reports"
        self.predictions_dir = self.data_dir / "predictions"
        self.logs_dir = self.data_dir / "logs"

        # Database path
        self.db_path = self.data_dir / "openneural.db"

    @classmethod
    def get(cls) -> Self:
        """Get the Settings singleton instance.

        Returns:
            Settings: The singleton Settings instance.

        Example:
            >>> from openneural_backend.config import Settings
            >>> settings = Settings.get()
            >>> print(settings.data_dir)
        """
        if cls._instance is None:
            cls()
        return cls._instance

    @classmethod
    def reset(cls) -> None:
        """Reset the singleton instance (useful for testing).

        This clears the cached instance so a new one will be created on next access.
        """
        cls._instance = None

    def ensure_directories(self) -> None:
        """Create all required data directories if they don't exist.

        This should be called during application startup after settings are loaded.
        """
        directories = [
            self.data_dir,
            self.snapshots_dir,
            self.pipelines_dir,
            self.models_dir,
            self.reports_dir,
            self.predictions_dir,
            self.logs_dir,
        ]
        for directory in directories:
            directory.mkdir(parents=True, exist_ok=True)


def get_settings() -> Settings:
    """Convenience function to get the Settings singleton.

    Returns:
        Settings: The singleton Settings instance.

    Raises:
        RuntimeError: If required settings are missing.
    """
    return Settings.get()
