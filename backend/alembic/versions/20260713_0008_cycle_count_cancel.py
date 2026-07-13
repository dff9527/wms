"""Allow CANCELLED status on cycle counts (soft delete).

Revision ID: 20260713_0008
Revises: 20260713_0007
"""

from alembic import op

revision = "20260713_0008"
down_revision = "20260713_0007"
branch_labels = None
depends_on = None

_STATUSES_OLD = "'DRAFT','FROZEN','COUNTING','REVIEW','APPROVED','REJECTED'"
_STATUSES_NEW = _STATUSES_OLD + ",'CANCELLED'"


def upgrade() -> None:
    op.drop_constraint("ck_cycle_counts_status", "cycle_counts", type_="check")
    op.create_check_constraint(
        "ck_cycle_counts_status",
        "cycle_counts",
        f"status IN ({_STATUSES_NEW})",
    )


def downgrade() -> None:
    op.drop_constraint("ck_cycle_counts_status", "cycle_counts", type_="check")
    op.create_check_constraint(
        "ck_cycle_counts_status",
        "cycle_counts",
        f"status IN ({_STATUSES_OLD})",
    )
