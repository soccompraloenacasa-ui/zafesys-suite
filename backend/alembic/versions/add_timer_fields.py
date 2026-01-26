"""Add timer fields to installations

Revision ID: add_timer_fields
Revises: 
Create Date: 2026-01-26

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_timer_fields'
down_revision = None  # Update this to your last migration
branch_labels = None
depends_on = None


def upgrade():
    # Add timer columns to installations table
    op.add_column('installations', sa.Column('timer_started_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('installations', sa.Column('timer_ended_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('installations', sa.Column('timer_started_by', sa.Enum('admin', 'technician', name='timerstarted_by'), nullable=True))
    op.add_column('installations', sa.Column('installation_duration_minutes', sa.Integer(), nullable=True))


def downgrade():
    op.drop_column('installations', 'installation_duration_minutes')
    op.drop_column('installations', 'timer_started_by')
    op.drop_column('installations', 'timer_ended_at')
    op.drop_column('installations', 'timer_started_at')
    # Drop the enum type
    op.execute('DROP TYPE IF EXISTS timerstarted_by')
