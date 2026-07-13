"""Add MSL bag opening timestamp.

Revision ID: 20260713_0004
Revises: 20260713_0003
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260713_0004"
down_revision: Union[str, None] = "20260713_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("inventory_lots", sa.Column("bag_opened_at", sa.DateTime()))


def downgrade() -> None:
    op.drop_column("inventory_lots", "bag_opened_at")
