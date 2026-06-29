"""Unit tests for the OpenNeural logging configuration and handlers.

Validates that logging configuration correctly sets up root and ML trainer log levels,
formats logs using ISO8601 timestamps, and rotates files daily while adhering
to retention policies.
"""

import logging
import os
import shutil
import tempfile
import unittest
from datetime import datetime, timedelta
from pathlib import Path

from openneural_backend.logging_config import (
    ISO8601Formatter,
    OpenNeuralDailyRotatingFileHandler,
    configure_logging,
)


class LoggingConfigTests(unittest.TestCase):
    """Tests for logging configuration and daily rotating file handler."""

    def setUp(self) -> None:
        """Create a temporary directory for logs before each test."""
        from openneural_backend.config import Settings

        self.temp_dir = Path(tempfile.mkdtemp())
        self.original_env_var = os.environ.get("OPENNEURAL_DATA_DIR")
        os.environ["OPENNEURAL_DATA_DIR"] = str(self.temp_dir)
        Settings.reset()
        Settings.get().ensure_directories()

    def tearDown(self) -> None:
        """Clean up the temporary directory after each test."""
        from openneural_backend.config import Settings

        if self.original_env_var is not None:
            os.environ["OPENNEURAL_DATA_DIR"] = self.original_env_var
        else:
            os.environ.pop("OPENNEURAL_DATA_DIR", None)

        shutil.rmtree(self.temp_dir)
        Settings.reset()

    def test_configure_logging_sets_levels_and_handlers(self) -> None:
        """Verify configure_logging configures root and ML trainer logger levels."""
        configure_logging()

        root_logger = logging.getLogger()
        self.assertEqual(root_logger.level, logging.INFO)

        ml_logger = logging.getLogger("openneural_backend.orchestrator.trainer")
        self.assertEqual(ml_logger.level, logging.DEBUG)

        # Verify handlers exist
        handlers = root_logger.handlers
        self.assertTrue(len(handlers) >= 2)
        has_file_handler = any(
            isinstance(h, OpenNeuralDailyRotatingFileHandler) for h in handlers
        )
        has_stream_handler = any(
            isinstance(h, logging.StreamHandler)
            and not isinstance(h, OpenNeuralDailyRotatingFileHandler)
            for h in handlers
        )
        self.assertTrue(has_file_handler)
        self.assertTrue(has_stream_handler)

    def test_daily_rotating_file_handler_creates_file_and_rotates(self) -> None:
        """Verify OpenNeuralDailyRotatingFileHandler creates directories and rotates on day change."""
        logs_dir = self.temp_dir / "logs"
        handler = OpenNeuralDailyRotatingFileHandler(logs_dir=logs_dir, backup_count=3)

        # Check file creation for today
        today_str = datetime.now().strftime("%Y-%m-%d")
        expected_file = logs_dir / f"openneural_{today_str}.log"
        self.assertTrue(expected_file.exists())

        # Test writing a log record
        logger = logging.getLogger("test_temp_logger")
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
        logger.info("Test log line")

        with open(expected_file, encoding="utf-8") as f:
            content = f.read()
            self.assertIn("Test log line", content)

        # Simulate date change by setting current_date to yesterday
        yesterday_str = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        handler.current_date = yesterday_str

        # Emit another log record to trigger rotation
        record = logging.LogRecord(
            name="test_temp_logger",
            level=logging.INFO,
            pathname="test_logging.py",
            lineno=10,
            msg="Post rotation log line",
            args=(),
            exc_info=None,
        )
        handler.emit(record)

        # New file for today should still exist, and should contain the post-rotation line
        with open(expected_file, encoding="utf-8") as f:
            content = f.read()
            self.assertIn("Post rotation log line", content)

        logger.removeHandler(handler)
        handler.close()

    def test_retention_policy_cleans_up_old_files(self) -> None:
        """Verify older log files are deleted when total exceeds backup_count."""
        logs_dir = self.temp_dir / "logs"
        logs_dir.mkdir(parents=True, exist_ok=True)

        # Create dummy log files for past days
        for i in range(10):
            past_date = (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d")
            log_file = logs_dir / f"openneural_{past_date}.log"
            log_file.write_text(f"dummy content {i}")

        # Instantiate handler with backup_count of 5
        handler = OpenNeuralDailyRotatingFileHandler(logs_dir=logs_dir, backup_count=5)

        # Verify that only 5 files remain
        remaining_files = sorted(list(logs_dir.glob("openneural_*.log")))
        self.assertEqual(len(remaining_files), 5)

        handler.close()

    def test_iso8601_formatter(self) -> None:
        """Verify ISO8601Formatter formats timestamp in strict ISO8601 format."""
        formatter = ISO8601Formatter("[%(asctime)s] %(message)s")
        record = logging.LogRecord(
            name="test_logger",
            level=logging.INFO,
            pathname="test.py",
            lineno=42,
            msg="hello",
            args=(),
            exc_info=None,
        )
        formatted = formatter.format(record)
        # Formatted string should match "[YYYY-MM-DDTHH:MM:SS" prefix
        self.assertIn("[", formatted)
        # Extract timestamp inside brackets
        timestamp = formatted.split("]")[0][1:]
        # Parse it with datetime.fromisoformat to verify strict ISO8601 compatibility
        try:
            parsed = datetime.fromisoformat(timestamp)
            self.assertIsNotNone(parsed)
        except ValueError as e:
            self.fail(
                f"Failed to parse formatted timestamp '{timestamp}' as ISO8601: {e}"
            )

    def test_database_rollback_logging(self) -> None:
        """Verify database transaction rollback is logged at ERROR level."""
        import asyncio

        from openneural_backend.db.transaction import atomic_transaction

        with self.assertLogs(
            "openneural_backend.db.transaction", level="ERROR"
        ) as log_cm, self.assertRaises(Exception):

            async def run_failing_tx():
                async with atomic_transaction() as session:
                    raise ValueError("Simulated DB Error")

            asyncio.run(run_failing_tx())
        self.assertTrue(
            any("Database transaction rollback" in line for line in log_cm.output)
        )

    def test_training_crash_logging(self) -> None:
        """Verify training process crash is logged at ERROR level."""
        import asyncio
        from unittest.mock import AsyncMock, MagicMock, patch

        from openneural_backend.orchestrator.experiment_manager import (
            _run_training as run_experiment_task,
        )

        with patch(
            "openneural_backend.orchestrator.trainer.run_experiment",
            side_effect=Exception("Simulated trainer crash"),
        ), patch(
            "openneural_backend.orchestrator.experiment_manager.async_session"
        ) as mock_session_cls:
            mock_session = MagicMock()
            mock_session.__aenter__.return_value = mock_session
            mock_session.execute = AsyncMock()
            mock_session.commit = AsyncMock()
            mock_session.refresh = AsyncMock()
            mock_scalar = MagicMock()
            mock_scalar.scalar_one_or_none.return_value = MagicMock()
            mock_session.execute.return_value = mock_scalar
            mock_session_cls.return_value = mock_session

            with self.assertLogs(
                "openneural_backend.orchestrator.experiment_manager", level="ERROR"
            ) as log_cm:

                async def run_crashing_trainer():
                    await run_experiment_task("fake-experiment-id")

                asyncio.run(run_crashing_trainer())
        self.assertTrue(any("Training process crash" in line for line in log_cm.output))

    def test_file_permission_failure_logging(self) -> None:
        """Verify file permission failure is logged at ERROR level."""
        import asyncio
        from unittest.mock import AsyncMock, MagicMock, patch

        from openneural_backend.services.dataset_service import import_file

        with patch(
            "pandas.DataFrame.to_parquet",
            side_effect=PermissionError("Permission denied"),
        ):
            fake_project = MagicMock()
            fake_project.id = "fake-project-id"
            with patch(
                "openneural_backend.services.dataset_service.async_session"
            ) as mock_session_cls:
                mock_session = MagicMock()
                mock_session.__aenter__.return_value = mock_session
                mock_session.execute = AsyncMock()
                mock_session.commit = AsyncMock()
                mock_session.refresh = AsyncMock()

                # Mock result scalars for select(Project)
                mock_scalar = MagicMock()
                mock_scalar.scalar_one_or_none.return_value = fake_project
                mock_session.execute.return_value = mock_scalar
                mock_session_cls.return_value = mock_session

                with self.assertLogs(
                    "openneural_backend.services.dataset_service", level="ERROR"
                ) as log_cm:
                    mock_file = MagicMock()
                    mock_file.filename = "test.csv"
                    mock_file.read = AsyncMock(side_effect=[b"col1,col2\n1,2", b""])
                    try:

                        async def run_import():
                            await import_file("fake-project-id", mock_file)

                        asyncio.run(run_import())
                    except Exception:
                        pass
        self.assertTrue(
            any("File permission failure" in line for line in log_cm.output)
        )


if __name__ == "__main__":
    unittest.main()
