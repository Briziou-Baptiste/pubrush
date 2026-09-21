"""add_join_code_to_barathons

Revision ID: e82b7194c5d1
Revises: 4541c061ea47
Create Date: 2026-09-21 10:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e82b7194c5d1"
down_revision: Union[str, Sequence[str], None] = "4541c061ea47"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("barathons", sa.Column("join_code", sa.String(length=12), nullable=True))
    op.create_index(op.f("ix_barathons_join_code"), "barathons", ["join_code"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_barathons_join_code"), table_name="barathons")
    op.drop_column("barathons", "join_code")
