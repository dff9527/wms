"""Add cycle count documents and lines.

Revision ID: 20260713_0002
Revises: 20260713_0001
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260713_0002"
down_revision: Union[str, None] = "20260713_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "cycle_counts",
        sa.Column("cycle_count_id", sa.Integer(), primary_key=True),
        sa.Column("count_number", sa.String(50), nullable=False, unique=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="DRAFT"),
        sa.Column("created_by", sa.String(50), nullable=False),
        sa.Column("reviewed_by", sa.String(50)),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("frozen_at", sa.DateTime()),
        sa.Column("submitted_at", sa.DateTime()),
        sa.Column("reviewed_at", sa.DateTime()),
        sa.CheckConstraint(
            "status IN ('DRAFT','FROZEN','COUNTING','REVIEW','APPROVED','REJECTED')",
            name="ck_cycle_counts_status",
        ),
    )
    op.create_table(
        "cycle_count_lines",
        sa.Column("cycle_count_line_id", sa.Integer(), primary_key=True),
        sa.Column(
            "cycle_count_id",
            sa.Integer(),
            sa.ForeignKey("cycle_counts.cycle_count_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "location_id",
            sa.Integer(),
            sa.ForeignKey("storage_locations.location_id"),
            nullable=False,
        ),
        sa.Column(
            "lot_id",
            sa.Integer(),
            sa.ForeignKey("inventory_lots.lot_id"),
            nullable=False,
        ),
        sa.Column("internal_sku", sa.String(50), nullable=False),
        sa.Column("expected_quantity", sa.Integer(), nullable=False),
        sa.Column("counted_quantity", sa.Integer()),
        sa.Column("notes", sa.Text()),
        sa.UniqueConstraint("cycle_count_id", "lot_id", name="uq_cycle_count_lot"),
    )
    op.create_index(
        "ix_cycle_count_lines_count", "cycle_count_lines", ["cycle_count_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_cycle_count_lines_count", table_name="cycle_count_lines")
    op.drop_table("cycle_count_lines")
    op.drop_table("cycle_counts")
