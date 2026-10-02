"""add_attempts_to_password_reset_tokens

Revision ID: a7b8c9d0e1f2
Revises: f1c4e7239abc
Create Date: 2026-10-02 08:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a7b8c9d0e1f2"
down_revision: Union[str, Sequence[str], None] = "f1c4e7239abc"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add attempts column with IF NOT EXISTS for idempotency
    op.execute("ALTER TABLE password_reset_tokens ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;")


def downgrade() -> None:
    op.drop_column("password_reset_tokens", "attempts")
