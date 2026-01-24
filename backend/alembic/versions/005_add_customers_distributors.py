"""add customers distributors and supplier_cost

Revision ID: 005_add_customers_distributors
Revises: 003_add_installations_quantity
Create Date: 2026-01-24

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision = '005_add_customers_distributors'
down_revision = '003_add_installations_quantity'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add supplier_cost to products table
    op.add_column('products', sa.Column('supplier_cost', sa.Numeric(12, 2), nullable=True))
    
    # Create customers table
    op.create_table(
        'customers',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('phone', sa.String(50), nullable=False),
        sa.Column('email', sa.String(255), nullable=True),
        sa.Column('document_type', sa.String(20), nullable=True),
        sa.Column('document_number', sa.String(50), nullable=True),
        sa.Column('address', sa.String(500), nullable=True),
        sa.Column('city', sa.String(100), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('lead_id', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['lead_id'], ['leads.id'], ondelete='SET NULL')
    )
    op.create_index('ix_customers_id', 'customers', ['id'])
    op.create_index('ix_customers_phone', 'customers', ['phone'])
    
    # Create distributors table
    op.create_table(
        'distributors',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('company_name', sa.String(255), nullable=True),
        sa.Column('nit', sa.String(50), nullable=True),
        sa.Column('phone', sa.String(50), nullable=False),
        sa.Column('email', sa.String(255), nullable=True),
        sa.Column('address', sa.String(500), nullable=True),
        sa.Column('city', sa.String(100), nullable=True),
        sa.Column('zone', sa.String(100), nullable=True),
        sa.Column('contact_person', sa.String(255), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('discount_percentage', sa.Numeric(5, 2), server_default='0'),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_distributors_id', 'distributors', ['id'])
    
    # Create distributor_sales table
    op.create_table(
        'distributor_sales',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('distributor_id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('unit_price', sa.Numeric(12, 2), nullable=False),
        sa.Column('total_price', sa.Numeric(12, 2), nullable=False),
        sa.Column('sale_date', sa.Date(), nullable=False),
        sa.Column('invoice_number', sa.String(100), nullable=True),
        sa.Column('payment_status', sa.String(20), server_default='pendiente'),
        sa.Column('amount_paid', sa.Numeric(12, 2), server_default='0'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['distributor_id'], ['distributors.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='RESTRICT')
    )
    op.create_index('ix_distributor_sales_id', 'distributor_sales', ['id'])
    op.create_index('ix_distributor_sales_distributor_id', 'distributor_sales', ['distributor_id'])
    op.create_index('ix_distributor_sales_sale_date', 'distributor_sales', ['sale_date'])


def downgrade() -> None:
    op.drop_table('distributor_sales')
    op.drop_table('distributors')
    op.drop_table('customers')
    op.drop_column('products', 'supplier_cost')
