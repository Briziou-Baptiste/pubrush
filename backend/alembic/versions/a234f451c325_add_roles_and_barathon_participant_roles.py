"""add roles and barathon participant roles

Revision ID: a234f451c325
Revises: b3e954d882eb
Create Date: 2026-04-02 15:25:52.140570

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a234f451c325'
down_revision: Union[str, Sequence[str], None] = 'b3e954d882eb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
