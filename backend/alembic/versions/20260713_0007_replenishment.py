"""Add min/max replenishment rules and tasks."""

from alembic import op
import sqlalchemy as sa

revision = "20260713_0007"
down_revision = "20260713_0006"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "storage_locations",
        sa.Column(
            "replenishment_sku", sa.String(50), sa.ForeignKey("items.internal_sku")
        ),
    )
    op.add_column(
        "storage_locations",
        sa.Column(
            "replenishment_min_qty", sa.Integer(), nullable=False, server_default="0"
        ),
    )
    op.add_column(
        "storage_locations",
        sa.Column(
            "replenishment_max_qty", sa.Integer(), nullable=False, server_default="0"
        ),
    )
    op.create_table(
        "replenishment_tasks",
        sa.Column("task_id", sa.Integer(), primary_key=True),
        sa.Column(
            "internal_sku",
            sa.String(50),
            sa.ForeignKey("items.internal_sku"),
            nullable=False,
        ),
        sa.Column(
            "lot_id",
            sa.Integer(),
            sa.ForeignKey("inventory_lots.lot_id"),
            nullable=False,
        ),
        sa.Column(
            "from_location_id",
            sa.Integer(),
            sa.ForeignKey("storage_locations.location_id"),
            nullable=False,
        ),
        sa.Column(
            "to_location_id",
            sa.Integer(),
            sa.ForeignKey("storage_locations.location_id"),
            nullable=False,
        ),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="OPEN"),
        sa.Column("created_by", sa.String(50), nullable=False),
        sa.Column("completed_by", sa.String(50)),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime()),
    )


def downgrade():
    op.drop_table("replenishment_tasks")
    op.drop_column("storage_locations", "replenishment_max_qty")
    op.drop_column("storage_locations", "replenishment_min_qty")
    op.drop_column("storage_locations", "replenishment_sku")
