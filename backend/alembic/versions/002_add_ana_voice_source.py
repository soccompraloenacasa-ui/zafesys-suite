"""Add ana_voice to lead source enum

Revision ID: 002_ana_voice
Revises: 001_initial
Create Date: 2024-01-18

"""
from typing import Sequence, Union
from alembic import op

revision: str = '002_ana_voice'
down_revision: Union[str, None] = '001_initial'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add 'ana_voice' value to leadsource enum
    # PostgreSQL requires ALTER TYPE to add enum values
    op.execute("ALTER TYPE leadsource ADD VALUE IF NOT EXISTS 'ana_voice'")


def downgrade() -> None:
    # Note: PostgreSQL doesn't allow removing enum values directly
    # To fully downgrade, you'd need to:
    # 1. Create a new enum without 'ana_voice'
    # 2. Update all columns using the old enum
    # 3. Drop the old enum and rename the new one
    # For simplicity, we just leave the value (it won't cause issues)
    pass
