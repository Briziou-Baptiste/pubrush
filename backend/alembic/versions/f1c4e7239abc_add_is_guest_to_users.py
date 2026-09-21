"""add_is_guest_to_users

Revision ID: f1c4e7239abc
Revises: e82b7194c5d1
Create Date: 2026-09-21 14:53:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f1c4e7239abc"
down_revision: Union[str, Sequence[str], None] = "e82b7194c5d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Use execute with IF NOT EXISTS to be fully idempotent on existing databases
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_guest BOOLEAN NOT NULL DEFAULT FALSE;")


def downgrade() -> None:
    op.drop_column("users", "is_guest")
