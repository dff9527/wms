"""Add auditable customer and supplier returns."""

from alembic import op
import sqlalchemy as sa

revision = "20260713_0006"
down_revision = "20260713_0005"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "return_orders",
        sa.Column("return_id", sa.Integer(), primary_key=True),
        sa.Column("return_number", sa.String(50), nullable=False, unique=True),
        sa.Column("return_type", sa.String(20), nullable=False),
        sa.Column(
            "lot_id",
            sa.Integer(),
            sa.ForeignKey("inventory_lots.lot_id"),
            nullable=False,
        ),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="COMPLETED"),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("counterparty_reference", sa.String(100)),
        sa.Column("created_by", sa.String(50), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_return_orders_lot", "return_orders", ["lot_id"])


def downgrade():
    op.drop_index("ix_return_orders_lot", table_name="return_orders")
    op.drop_table("return_orders")
