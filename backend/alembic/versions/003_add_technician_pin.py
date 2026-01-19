"""Add pin column to technicians table

Revision ID: 003_tech_pin
Revises: 002_ana_voice
Create Date: 2024-01-19

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '003_tech_pin'
down_revision: Union[str, None] = '002_ana_voice'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add pin column to technicians table for mobile app authentication
    op.add_column('technicians', sa.Column('pin', sa.String(6), nullable=True))


def downgrade() -> None:
    # Remove pin column
    op.drop_column('technicians', 'pin')
