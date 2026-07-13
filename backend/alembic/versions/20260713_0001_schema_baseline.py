"""Baseline the schema managed previously by change_requests/schema.sql.

Revision ID: 20260713_0001
Revises:
Create Date: 2026-07-13

This revision is deliberately empty. Existing and newly provisioned databases first
load the historical schema snapshot, then stamp/upgrade from this baseline. All
schema changes after this point must be expressed as Alembic revisions.
"""

from typing import Sequence, Union

revision: str = "20260713_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
