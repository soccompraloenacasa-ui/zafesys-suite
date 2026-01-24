"""Add category and supplier_cost to products

Revision ID: 004
Revises: 003
Create Date: 2026-01-24

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None


def upgrade():
    # Add category column with default 'silver'
    op.add_column('products', sa.Column('category', sa.String(20), nullable=True))
    op.execute("UPDATE products SET category = 'silver' WHERE category IS NULL")
    
    # Add supplier_cost column with default 0
    op.add_column('products', sa.Column('supplier_cost', sa.Numeric(10, 2), nullable=True))
    op.execute("UPDATE products SET supplier_cost = 0 WHERE supplier_cost IS NULL")


def downgrade():
    op.drop_column('products', 'category')
    op.drop_column('products', 'supplier_cost')
