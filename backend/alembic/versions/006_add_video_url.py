"""Add video_url to installations

Revision ID: 006_add_video_url
Revises: 005_add_customers_distributors
Create Date: 2026-01-27

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '006_add_video_url'
down_revision = '005_add_customers_distributors'
branch_labels = None
depends_on = None


def upgrade():
    # Add video_url column to installations table
    op.add_column('installations', sa.Column('video_url', sa.String(500), nullable=True))


def downgrade():
    op.drop_column('installations', 'video_url')
