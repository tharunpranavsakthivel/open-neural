"""Script template for Alembic migration files.

This is a custom template that generates consistent migration files
for the OpenNeural backend.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# Revision identifiers, used by Alembic.
revision: str = ${up_revision}
down_revision: Union[str, None] = ${down_revision}
branch_labels: Union[str, Sequence[str], None] = ${branch_labels}
depends_on: Union[str, Sequence[str], None] = ${depends_on}


def upgrade() -> None:
    """Apply the migration.
    
    ${upgrade_operations}
    """
    ${upgrades if upgrades else "pass"}


def downgrade() -> None:
    """Revert the migration.
    
    ${downgrade_operations}
    """
    ${downgrades if downgrades else "pass"}
