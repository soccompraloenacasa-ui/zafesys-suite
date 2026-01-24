"""Placeholder migration (originally add product category - removed)

Revision ID: 004_placeholder
Revises: 003_tech_pin
Create Date: 2026-01-24

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '004_placeholder'
down_revision = '003_tech_pin'
branch_labels = None
depends_on = None


def upgrade():
    # No-op: category feature was removed
    pass


def downgrade():
    # No-op
    pass
