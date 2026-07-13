"""Add item dimensions and label print audit records.

Revision ID: 20260713_0005
Revises: 20260713_0004
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260713_0005"
down_revision: Union[str, None] = "20260713_0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("items", sa.Column("unit_weight_kg", sa.Numeric(12, 6)))
    op.add_column("items", sa.Column("unit_volume_cbm", sa.Numeric(14, 9)))
    op.create_table(
        "label_prints",
        sa.Column("label_print_id", sa.Integer(), primary_key=True),
        sa.Column(
            "lot_id",
            sa.Integer(),
            sa.ForeignKey("inventory_lots.lot_id"),
            nullable=False,
        ),
        sa.Column("print_number", sa.Integer(), nullable=False),
        sa.Column("printed_by", sa.String(50), nullable=False),
        sa.Column(
            "is_reprint", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
        sa.Column(
            "printed_at", sa.DateTime(), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("voided_at", sa.DateTime()),
        sa.Column("voided_by", sa.String(50)),
        sa.Column("void_reason", sa.Text()),
        sa.UniqueConstraint("lot_id", "print_number", name="uq_label_print_lot_number"),
    )
    op.create_index("ix_label_prints_lot", "label_prints", ["lot_id"])


def downgrade() -> None:
    op.drop_index("ix_label_prints_lot", table_name="label_prints")
    op.drop_table("label_prints")
    op.drop_column("items", "unit_volume_cbm")
    op.drop_column("items", "unit_weight_kg")
