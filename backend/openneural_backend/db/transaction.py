"""Atomic transaction wrapper utilities for OpenNeural backend.

Provides context managers and decorators for ensuring database operations
are executed within atomic transactions. Uses SQLAlchemy's `begin()` context
manager to automatically handle commit/rollback based on exception state.

All write operations across services should use these wrappers to ensure
partial writes are rolled back on exception, maintaining database integrity.
"""

from contextlib import asynccontextmanager
from functools import wraps
import logging
from typing import Any, AsyncGenerator, Callable, Coroutine, ParamSpec, TypeVar

from sqlalchemy.ext.asyncio import AsyncSession

from openneural_backend.db.engine import async_session

T = TypeVar("T")
P = ParamSpec("P")

logger = logging.getLogger(__name__)


@asynccontextmanager
async def atomic_transaction() -> AsyncGenerator[AsyncSession, None]:
    """Context manager for atomic database transactions.
    
    Provides an async context manager that yields an AsyncSession with an active
    transaction. The transaction is automatically committed if the block exits
    normally, or rolled back if an exception is raised.
    
    This ensures atomicity: either all operations in the block succeed and are
    committed together, or none are committed and all changes are rolled back.
    
    Usage:
        async with atomic_transaction() as session:
            # All database operations here are in a single transaction
            project = Project(name="Test", task_type="classification")
            session.add(project)
            # Commit happens automatically on successful exit
    
    Args:
        None
    
    Yields:
        AsyncSession: A SQLAlchemy async session with an active transaction.
    
    Raises:
        Exception: Re-raises any exception after rolling back the transaction.
    
    Example:
        >>> async def create_project_with_snapshot(name: str, file_path: str) -> Project:
        ...     async with atomic_transaction() as session:
        ...         project = Project(name=name, task_type="classification")
        ...         session.add(project)
        ...         await session.flush()  # Get project.id without committing
        ...         
        ...         snapshot = DatasetSnapshot(
        ...             project_id=project.id,
        ...             file_name=file_path,
        ...             # ... other fields
        ...         )
        ...         session.add(snapshot)
        ...         # Both project and snapshot committed atomically on success
        ...         return project
    """
    async with async_session() as session:
        try:
            async with session.begin():
                yield session
        except Exception as e:
            logger.error(f"Database transaction rollback: {str(e)}", exc_info=True)
            raise


@asynccontextmanager
async def atomic_transaction_with_result() -> AsyncGenerator[AsyncSession, None]:
    """Context manager for atomic transactions with explicit result handling.
    
    Similar to atomic_transaction(), but designed for cases where you need
    to return database objects that may require the session to remain open
    for lazy loading. The session is committed but not closed on successful exit.
    
    Note: Prefer atomic_transaction() for most cases. Only use this when you
    specifically need access to ORM objects after the transaction commits.
    
    Args:
        None
    
    Yields:
        AsyncSession: A SQLAlchemy async session with an active transaction.
    """
    async with async_session() as session:
        try:
            async with session.begin():
                yield session
        except Exception as e:
            logger.error(f"Database transaction rollback: {str(e)}", exc_info=True)
            raise
        # Session remains open for lazy loading, but transaction is committed


def atomic(fn: Callable[P, Coroutine[Any, Any, T]]) -> Callable[P, Coroutine[Any, Any, T]]:
    """Decorator to wrap a function in an atomic transaction.
    
    Automatically wraps the decorated async function in an atomic transaction.
    The function receives an AsyncSession as its first argument after `self`
    (for methods) or as the first positional argument (for standalone functions).
    
    This is useful for service methods that perform database writes.
    
    Usage:
        class ProjectService:
            @atomic
            async def create_project(self, session: AsyncSession, name: str, task_type: str) -> Project:
                project = Project(name=name, task_type=task_type)
                session.add(project)
                return project
    
    Args:
        fn: The async function to wrap. Must accept AsyncSession as first parameter.
    
    Returns:
        Callable: The wrapped function that runs in an atomic transaction.
    
    Example:
        >>> @atomic
        ... async def transfer_funds(
        ...     session: AsyncSession,
        ...     from_account_id: str,
        ...     to_account_id: str,
        ...     amount: float
        ... ) -> None:
        ...     # Both debit and credit happen atomically
        ...     await debit_account(session, from_account_id, amount)
        ...     await credit_account(session, to_account_id, amount)
    """
    @wraps(fn)
    async def wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
        async with atomic_transaction() as session:
            # Insert session as first argument
            return await fn(session, *args, **kwargs)
    return wrapper


def service_method(fn: Callable[P, Coroutine[Any, Any, T]]) -> Callable[P, Coroutine[Any, Any, T]]:
    """Decorator for service class methods that need atomic transactions.
    
    Similar to @atomic, but designed for instance methods on service classes.
    Preserves `self` as the first argument and injects AsyncSession after it.
    
    Usage:
        class ProjectService:
            @service_method
            async def create_project(
                self,
                session: AsyncSession,
                name: str,
                task_type: str
            ) -> Project:
                project = Project(name=name, task_type=task_type)
                session.add(project)
                return project
    
    Args:
        fn: The async method to wrap. Must be an instance method that accepts
            AsyncSession as its second parameter (after self).
    
    Returns:
        Callable: The wrapped method that runs in an atomic transaction.
    
    Example:
        >>> class ExperimentService:
        ...     @service_method
        ...     async def create_experiment_with_runs(
        ...         self,
        ...         session: AsyncSession,
        ...         project_id: str,
        ...         pipeline_id: str,
        ...         models: list[str]
        ...     ) -> Experiment:
        ...         experiment = Experiment(
        ...             project_id=project_id,
        ...             pipeline_id=pipeline_id,
        ...             status="created"
        ...         )
        ...         session.add(experiment)
        ...         await session.flush()
        ...         
        ...         for model_type in models:
        ...             run = Run(
        ...                 experiment_id=experiment.id,
        ...                 model_type=model_type,
        ...                 status="queued"
        ...             )
        ...             session.add(run)
        ...         
        ...         # Experiment and all runs created atomically
        ...         return experiment
    """
    @wraps(fn)
    async def wrapper(self: Any, *args: P.args, **kwargs: P.kwargs) -> T:
        async with atomic_transaction() as session:
            return await fn(self, session, *args, **kwargs)
    return wrapper


# Convenience function for common transaction patterns
async def with_transaction(
    operation: Callable[[AsyncSession], Coroutine[Any, Any, T]]
) -> T:
    """Execute a database operation within an atomic transaction.
    
    A convenience function for executing a single operation in a transaction
    without needing to use the context manager syntax.
    
    Args:
        operation: An async callable that receives an AsyncSession and returns
            a result of type T.
    
    Returns:
        T: The result of the operation.
    
    Example:
        >>> async def create_project(name: str) -> Project:
        ...     async def operation(session: AsyncSession) -> Project:
        ...         project = Project(name=name, task_type="classification")
        ...         session.add(project)
        ...         return project
        ...     return await with_transaction(operation)
    """
    async with atomic_transaction() as session:
        return await operation(session)
