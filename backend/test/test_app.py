"""Unit tests for the OpenNeural FastAPI application factory.

Validates metadata and route registration without making network calls. Depends
on Python's unittest module and the local backend package.
"""

import unittest

from openneural_backend.app import create_app


class CreateAppTests(unittest.TestCase):
    """Tests for create_app application construction behavior."""

    def test_create_app_sets_metadata_and_health_route(self) -> None:
        """Verify app metadata and the initial health route exist.

        Returns:
            None: Assertions validate expected app state.

        Raises:
            AssertionError: If metadata or route registration regresses.
        """
        app = create_app()
        paths = {route.path for route in app.routes}

        self.assertEqual(app.title, "OpenNeural API")
        self.assertEqual(app.version, "0.1.0")
        self.assertIn("/health", paths)


if __name__ == "__main__":
    unittest.main()
