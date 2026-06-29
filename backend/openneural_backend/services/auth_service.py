"""Authentication service for OpenNeural backend.

Provides bcrypt-based password hashing and verification for local application
authentication. The Auth model stores a single bcrypt-hashed password for the
single-user, single-machine OpenNeural MVP.

Exports:
    - AuthenticationError: Exception raised on password verification failures.
    - hash_password: Create a bcrypt hash from a plain-text password.
    - verify_password: Verify a plain-text password against a stored bcrypt hash.
"""

import logging

import bcrypt

logger = logging.getLogger(__name__)


class AuthenticationError(Exception):
    """Raised when password verification fails.

    This exception is raised by verify_password() when the provided plain-text
    password does not match the stored bcrypt hash. It should be caught and
    handled by the caller to provide an appropriate error response.
    """

    pass


def hash_password(plain: str) -> str:
    """Hash a plain-text password using bcrypt.

    Uses bcrypt with a cost factor of 12 to generate a secure hash of the
    provided password. The resulting hash can be stored in the database and
    later verified using verify_password().

    Args:
        plain: The plain-text password to hash. Must be non-empty.

    Returns:
        str: The bcrypt hash string, including salt and cost factor, suitable
            for storage in the database.

    Raises:
        ValueError: If the plain password is empty or not a string.

    Example:
        >>> hashed = hash_password("my_secure_password")
        >>> # Store 'hashed' in the database
    """
    if not isinstance(plain, str) or not plain:
        raise ValueError("Password must be a non-empty string")

    # Encode the password to bytes and hash with bcrypt (cost factor 12)
    password_bytes = plain.encode("utf-8")
    hashed_bytes = bcrypt.hashpw(password_bytes, bcrypt.gensalt(rounds=12))

    # Decode the hash back to a string for storage
    return hashed_bytes.decode("utf-8")


def verify_password(plain: str, stored_hash: str) -> bool:
    """Verify a plain-text password against a stored bcrypt hash.

    Compares the provided plain-text password against the stored bcrypt hash
    using bcrypt's constant-time comparison function to prevent timing attacks.

    Args:
        plain: The plain-text password to verify.
        stored_hash: The bcrypt hash string retrieved from the database.

    Returns:
        bool: True if the password matches the hash, False otherwise.
            Note: This function raises AuthenticationError on mismatch rather
            than returning False.

    Raises:
        ValueError: If the plain password or stored_hash is empty.
        AuthenticationError: If the password does not match the stored hash.

    Example:
        >>> try:
        ...     verify_password("my_password", stored_hash_from_db)
        ...     print("Authentication successful")
        ... except AuthenticationError:
        ...     print("Authentication failed")
    """
    if not isinstance(plain, str) or not plain:
        raise ValueError("Password must be a non-empty string")

    if not isinstance(stored_hash, str) or not stored_hash:
        raise ValueError("Stored hash must be a non-empty string")

    # Encode both strings to bytes for bcrypt comparison
    password_bytes = plain.encode("utf-8")
    hash_bytes = stored_hash.encode("utf-8")

    # Use bcrypt.checkpw for constant-time comparison
    if not bcrypt.checkpw(password_bytes, hash_bytes):
        raise AuthenticationError("Password verification failed")

    return True
