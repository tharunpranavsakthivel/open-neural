"""Unit tests for the authentication service.

Validates password hashing (cost factor 12), verification, and security properties.
"""

from unittest.mock import patch

import bcrypt
import pytest

from openneural_backend.services.auth_service import (
    AuthenticationError,
    hash_password,
    verify_password,
)


def test_hash_password_cost_factor() -> None:
    """Verify that hash_password produces a bcrypt hash with cost factor 12."""
    password = "secure_password123"
    hashed = hash_password(password)

    # Bcrypt format: $2b$[cost]$[salt][hash]
    # Check prefix starts with '$2b$' (algorithm) and '12$' (cost factor)
    assert hashed.startswith("$2b$12$")


def test_verify_password_correct() -> None:
    """Verify that verify_password returns True for a correct password."""
    password = "my_secret_password"
    hashed = hash_password(password)

    assert verify_password(password, hashed) is True


def test_verify_password_wrong_raises_error() -> None:
    """Verify that verify_password raises AuthenticationError for wrong password."""
    password = "my_secret_password"
    hashed = hash_password(password)

    with pytest.raises(AuthenticationError):
        verify_password("wrong_password", hashed)


def test_verify_password_timing_consistency() -> None:
    """Verify timing consistency (no early return on mismatch).

    Ensures that for any non-matching but valid format passwords, bcrypt.checkpw
    is always executed to perform a constant-time cryptographic comparison, preventing
    timing-based side-channel attacks.
    """
    password = "my_secret_password"
    hashed = hash_password(password)

    # We patch bcrypt.checkpw to verify it is called even when the password doesn't match
    with patch("bcrypt.checkpw", wraps=bcrypt.checkpw) as mock_checkpw:
        try:
            verify_password("wrong_password", hashed)
        except AuthenticationError:
            pass

        # Verify checkpw was actually called to perform the comparison
        mock_checkpw.assert_called_once()

        # Verify it was called with the correct types
        args, _ = mock_checkpw.call_args
        assert isinstance(args[0], bytes)
        assert isinstance(args[1], bytes)


def test_invalid_arguments_raise_value_error() -> None:
    """Verify that invalid/empty arguments correctly raise ValueError."""
    with pytest.raises(ValueError, match="Password must be a non-empty string"):
        hash_password("")

    with pytest.raises(ValueError, match="Password must be a non-empty string"):
        verify_password("", "some_hash")

    with pytest.raises(ValueError, match="Stored hash must be a non-empty string"):
        verify_password("password", "")
