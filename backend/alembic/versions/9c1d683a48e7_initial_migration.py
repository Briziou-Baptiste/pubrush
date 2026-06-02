"""initial migration

Revision ID: 9c1d683a48e7
Revises: 
Create Date: 2026-04-01 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9c1d683a48e7'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- Table users ---
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('username', sa.String(length=50), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('is_admin', sa.Boolean(), server_default='false', nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.create_index(op.f('ix_users_username'), 'users', ['username'], unique=True)

    # --- Table barathons ---
    op.create_table(
        'barathons',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('start_datetime', sa.DateTime(), nullable=False),
        sa.Column('end_datetime', sa.DateTime(), nullable=True),
        sa.Column('has_started', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('status', sa.String(length=20), server_default='planned', nullable=False),
        sa.Column('travel_time_between_bars_minutes', sa.Integer(), nullable=False),
        sa.Column('max_time_in_bar_minutes', sa.Integer(), nullable=False),
        sa.Column('created_by_user_id', sa.Integer(), nullable=False),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('ended_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['created_by_user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_barathons_created_by_user_id'), 'barathons', ['created_by_user_id'], unique=False)
    op.create_index(op.f('ix_barathons_name'), 'barathons', ['name'], unique=False)
    op.create_index(op.f('ix_barathons_start_datetime'), 'barathons', ['start_datetime'], unique=False)

    # --- Table barathon_participants ---
    op.create_table(
        'barathon_participants',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('barathon_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('role', sa.String(length=20), server_default='participant', nullable=False),
        sa.Column('joined_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['barathon_id'], ['barathons.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('barathon_id', 'user_id', name='uq_barathon_participant')
    )
    op.create_index(op.f('ix_barathon_participants_barathon_id'), 'barathon_participants', ['barathon_id'], unique=False)
    op.create_index(op.f('ix_barathon_participants_user_id'), 'barathon_participants', ['user_id'], unique=False)

    # --- Table barathon_stops ---
    op.create_table(
        'barathon_stops',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('barathon_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('stop_type', sa.String(length=20), server_default='bar', nullable=False),
        sa.Column('latitude', sa.Numeric(precision=9, scale=6), nullable=False),
        sa.Column('longitude', sa.Numeric(precision=9, scale=6), nullable=False),
        sa.Column('stop_order', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['barathon_id'], ['barathons.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('barathon_id', 'stop_order', name='uq_barathon_stop_order')
    )
    op.create_index(op.f('ix_barathon_stops_barathon_id'), 'barathon_stops', ['barathon_id'], unique=False)


def downgrade() -> None:
    op.drop_table('barathon_stops')
    op.drop_table('barathon_participants')
    op.drop_table('barathons')
    op.drop_table('users')
