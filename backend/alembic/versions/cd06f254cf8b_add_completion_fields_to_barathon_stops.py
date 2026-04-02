"""add completion fields to barathon stops

Revision ID: cd06f254cf8b
Revises: a64abd556f76
Create Date: 2026-04-02 16:52:14.019934

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cd06f254cf8b'
down_revision: Union[str, Sequence[str], None] = 'a64abd556f76'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
