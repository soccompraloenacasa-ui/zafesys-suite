"""Initial tables

Revision ID: 001_initial
Revises:
Create Date: 2024-01-18

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '001_initial'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Users table
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        sa.Column('full_name', sa.String(255), nullable=False),
        sa.Column('phone', sa.String(20), nullable=True),
        sa.Column('role', sa.Enum('admin', 'sales', 'technician', name='userrole'), nullable=False),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_users_id', 'users', ['id'])
    op.create_index('ix_users_email', 'users', ['email'], unique=True)

    # Products table
    op.create_table(
        'products',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('sku', sa.String(50), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('model', sa.String(100), nullable=False),
        sa.Column('price', sa.Numeric(10, 2), nullable=False),
        sa.Column('installation_price', sa.Numeric(10, 2), default=0),
        sa.Column('stock', sa.Integer(), default=0),
        sa.Column('min_stock_alert', sa.Integer(), default=5),
        sa.Column('features', sa.Text(), nullable=True),
        sa.Column('image_url', sa.String(500), nullable=True),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_products_id', 'products', ['id'])
    op.create_index('ix_products_sku', 'products', ['sku'], unique=True)

    # Technicians table
    op.create_table(
        'technicians',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('full_name', sa.String(255), nullable=False),
        sa.Column('phone', sa.String(20), nullable=False),
        sa.Column('email', sa.String(255), nullable=True),
        sa.Column('document_id', sa.String(20), nullable=True),
        sa.Column('zone', sa.String(100), nullable=True),
        sa.Column('specialties', sa.Text(), nullable=True),
        sa.Column('is_available', sa.Boolean(), default=True),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.UniqueConstraint('user_id')
    )
    op.create_index('ix_technicians_id', 'technicians', ['id'])

    # Leads table
    op.create_table(
        'leads',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('phone', sa.String(20), nullable=False),
        sa.Column('email', sa.String(255), nullable=True),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('city', sa.String(100), nullable=True),
        sa.Column('status', sa.Enum('nuevo', 'en_conversacion', 'potencial', 'venta_cerrada', 'perdido', name='leadstatus'), nullable=False, default='nuevo'),
        sa.Column('source', sa.Enum('website', 'whatsapp', 'elevenlabs', 'referido', 'otro', name='leadsource'), nullable=False, default='website'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('product_interest', sa.String(255), nullable=True),
        sa.Column('assigned_to_id', sa.Integer(), nullable=True),
        sa.Column('elevenlabs_conversation_id', sa.String(255), nullable=True),
        sa.Column('conversation_transcript', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now()),
        sa.Column('contacted_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['assigned_to_id'], ['users.id'])
    )
    op.create_index('ix_leads_id', 'leads', ['id'])
    op.create_index('ix_leads_phone', 'leads', ['phone'])
    op.create_index('ix_leads_status', 'leads', ['status'])

    # Installations table
    op.create_table(
        'installations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('lead_id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('quantity', sa.Integer(), default=1),
        sa.Column('technician_id', sa.Integer(), nullable=True),
        sa.Column('scheduled_date', sa.Date(), nullable=True),
        sa.Column('scheduled_time', sa.Time(), nullable=True),
        sa.Column('estimated_duration', sa.Integer(), default=60),
        sa.Column('address', sa.Text(), nullable=False),
        sa.Column('city', sa.String(100), nullable=True),
        sa.Column('address_notes', sa.Text(), nullable=True),
        sa.Column('status', sa.Enum('pendiente', 'programada', 'en_camino', 'en_progreso', 'completada', 'cancelada', name='installationstatus'), nullable=False, default='pendiente'),
        sa.Column('total_price', sa.Numeric(10, 2), nullable=False),
        sa.Column('payment_status', sa.Enum('pendiente', 'parcial', 'pagado', name='paymentstatus'), nullable=False, default='pendiente'),
        sa.Column('payment_method', sa.Enum('efectivo', 'transferencia', 'tarjeta', 'nequi', 'daviplata', name='paymentmethod'), nullable=True),
        sa.Column('amount_paid', sa.Numeric(10, 2), default=0),
        sa.Column('customer_notes', sa.Text(), nullable=True),
        sa.Column('technician_notes', sa.Text(), nullable=True),
        sa.Column('internal_notes', sa.Text(), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('photo_proof_url', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['lead_id'], ['leads.id']),
        sa.ForeignKeyConstraint(['product_id'], ['products.id']),
        sa.ForeignKeyConstraint(['technician_id'], ['technicians.id'])
    )
    op.create_index('ix_installations_id', 'installations', ['id'])
    op.create_index('ix_installations_status', 'installations', ['status'])


def downgrade() -> None:
    op.drop_table('installations')
    op.drop_table('leads')
    op.drop_table('technicians')
    op.drop_table('products')
    op.drop_table('users')

    # Drop enums
    op.execute('DROP TYPE IF EXISTS installationstatus')
    op.execute('DROP TYPE IF EXISTS paymentstatus')
    op.execute('DROP TYPE IF EXISTS paymentmethod')
    op.execute('DROP TYPE IF EXISTS leadstatus')
    op.execute('DROP TYPE IF EXISTS leadsource')
    op.execute('DROP TYPE IF EXISTS userrole')
