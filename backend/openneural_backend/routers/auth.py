"""Authentication router for OpenNeural backend.

Provides endpoints for first-launch password setup. The setup endpoint is only
available before authentication is configured (when the auth table has zero rows).
Once a password is set, the setup endpoint is disabled.

Exports:
    - router: FastAPI router for auth endpoints.
    - is_auth_configured: Check if authentication has been configured.
    - setup_auth: Configure initial authentication with a password.
"""

import logging
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select

from openneural_backend.db.engine import async_session
from openneural_backend.db.models import Auth
from openneural_backend.services.auth_service import (
    AuthenticationError,
    hash_password,
    verify_password,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


class AuthSetupRequest(BaseModel):
    """Request body for initial password setup.

    Attributes:
        password: The plain-text password to set. Must be at least 8 characters.
    """

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "password": "my_secure_password_123",
                }
            ]
        }
    }

    password: str = Field(..., description="The password to set for the application")

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        """Validate that the password meets minimum requirements.

        Args:
            v: The password string to validate.

        Returns:
            str: The validated password string.

        Raises:
            ValueError: If the password is empty or too short.
        """
        if not v or not v.strip():
            raise ValueError("Password cannot be empty")
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        return v


class AuthSetupResponse(BaseModel):
    """Response body for successful password setup.

    Attributes:
        configured: Whether authentication has been configured.
        message: Human-readable success message.
    """

    configured: bool
    message: str


class AuthStatusResponse(BaseModel):
    """Response body for auth configuration status.

    Attributes:
        configured: Whether authentication has been configured.
    """

    configured: bool


class AuthVerifyRequest(BaseModel):
    """Request body for password verification.

    Attributes:
        password: The plain-text password to verify.
    """

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "password": "my_password",
                }
            ]
        }
    }

    password: str = Field(..., description="The password to verify")

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        """Validate that the password is not empty.

        Args:
            v: The password string to validate.

        Returns:
            str: The validated password string.

        Raises:
            ValueError: If the password is empty.
        """
        if not v or not v.strip():
            raise ValueError("Password cannot be empty")
        return v


class AuthVerifyResponse(BaseModel):
    """Response body for password verification.

    Attributes:
        valid: Whether the password is valid.
    """

    valid: bool


async def is_auth_configured() -> bool:
    """Check if authentication has been configured.

    Queries the auth table to determine if at least one auth record exists.
    In OpenNeural MVP, there is only a single auth record for the local user.

    Returns:
        bool: True if an auth record exists (password is set), False otherwise.
    """
    async with async_session() as session:
        result = await session.execute(select(Auth))
        auth_record = result.scalar_one_or_none()
        return auth_record is not None


async def get_auth_hash() -> str | None:
    """Get the stored bcrypt hash from the auth table.

    Used by the Electron main process to validate passwords directly
    from the database without going through the backend API.

    Returns:
        str | None: The stored bcrypt hash, or None if no auth record exists.
    """
    async with async_session() as session:
        result = await session.execute(select(Auth))
        auth_record = result.scalar_one_or_none()
        return auth_record.password_hash if auth_record else None


async def setup_auth(password: str) -> None:
    """Configure initial authentication with a password.

    Creates an auth record with a bcrypt-hashed password. This should only
    be called when no auth record exists (first-launch setup).

    Args:
        password: The plain-text password to hash and store.

    Raises:
        RuntimeError: If authentication is already configured.
        ValueError: If the password is invalid.
    """
    # Check if auth is already configured
    if await is_auth_configured():
        raise RuntimeError("Authentication is already configured")

    # Hash the password
    hashed_password = hash_password(password)

    # Create the auth record
    async with async_session() as session:
        auth_record = Auth(password_hash=hashed_password)
        session.add(auth_record)
        await session.commit()

    logger.info("Authentication configured successfully (initial setup)")


@router.post(
    "/setup",
    response_model=AuthSetupResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        400: {"description": "Invalid password or validation error"},
        409: {"description": "Authentication is already configured"},
        500: {"description": "Internal server error"},
    },
)
async def auth_setup(request: AuthSetupRequest) -> AuthSetupResponse:
    """Set up initial authentication on first launch.

    This endpoint is only available before authentication is configured
    (when the auth table has zero rows). It accepts a password, hashes it
    using bcrypt (cost factor 12), and stores the hash in the database.

    After this endpoint is successfully called, it is permanently disabled
    and subsequent calls will return 409 Conflict.

    Args:
        request: The setup request containing the password to set.

    Returns:
        AuthSetupResponse: Success response indicating authentication is configured.

    Raises:
        HTTPException: 400 for validation errors, 409 if already configured,
            500 for unexpected errors.
    """
    # Check if auth is already configured
    if await is_auth_configured():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Authentication is already configured",
        )

    try:
        # Set up the password
        await setup_auth(request.password)

        return AuthSetupResponse(
            configured=True,
            message="Authentication configured successfully",
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to configure authentication: {str(e)}",
        )


@router.get(
    "/status",
    response_model=AuthStatusResponse,
    responses={
        500: {"description": "Internal server error"},
    },
)
async def auth_status() -> AuthStatusResponse:
    """Check if authentication has been configured.

    Returns the configuration status of authentication, which can be used
    by the frontend to determine whether to show the password setup screen
    or the login screen.

    Returns:
        AuthStatusResponse: Object containing the configured boolean.

    Raises:
        HTTPException: 500 for unexpected errors.
    """
    try:
        configured = await is_auth_configured()
        return AuthStatusResponse(configured=configured)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check auth status: {str(e)}",
        )


@router.post(
    "/verify",
    response_model=AuthVerifyResponse,
    responses={
        400: {"description": "Invalid password"},
        401: {"description": "Authentication failed"},
        500: {"description": "Internal server error"},
    },
)
async def auth_verify(request: AuthVerifyRequest) -> AuthVerifyResponse:
    """Verify a password against the stored bcrypt hash.

    This endpoint validates the provided password against the stored bcrypt
    hash in the database. It is used by the Electron main process during
    session authentication before spawning the backend.

    Note: According to TDD §5.1, the Electron main process should
    ideally validate the password directly against SQLite using better-sqlite3
    rather than calling this endpoint. This endpoint is provided as an
    alternative for scenarios where direct database access is not available.

    Args:
        request: The verify request containing the password to check.

    Returns:
        AuthVerifyResponse: Object containing the valid boolean.

    Raises:
        HTTPException: 400 for invalid password, 401 if authentication fails,
            500 for unexpected errors.
    """
    try:
        # Get the stored hash
        stored_hash = await get_auth_hash()

        if not stored_hash:
            # No auth record exists
            logger.info("Authentication failed - authentication not configured")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication not configured",
            )

        # Verify the password
        verify_password(request.password, stored_hash)

        logger.info("Authentication successful - password verified")
        return AuthVerifyResponse(valid=True)
    except AuthenticationError:
        logger.info("Authentication failed - invalid password")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid password",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to verify password: {str(e)}",
        )
