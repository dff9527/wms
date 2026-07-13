"""Allow MOVE inventory transactions.

Revision ID: 20260713_0003
Revises: 20260713_0002
"""

from typing import Sequence, Union

from alembic import op

revision: str = "20260713_0003"
down_revision: Union[str, None] = "20260713_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_old = "('RECEIVE','PUT_AWAY','PICK','SHIP','ADJUST','SPLIT','MERGE','RETURN','SCRAP')"
_new = "('RECEIVE','PUT_AWAY','PICK','SHIP','ADJUST','SPLIT','MERGE','RETURN','SCRAP','MOVE')"


def upgrade() -> None:
    op.drop_constraint(
        "inventory_transactions_transaction_type_check",
        "inventory_transactions",
        type_="check",
    )
    op.create_check_constraint(
        "inventory_transactions_transaction_type_check",
        "inventory_transactions",
        f"transaction_type IN {_new}",
    )


def downgrade() -> None:
    op.drop_constraint(
        "inventory_transactions_transaction_type_check",
        "inventory_transactions",
        type_="check",
    )
    op.create_check_constraint(
        "inventory_transactions_transaction_type_check",
        "inventory_transactions",
        f"transaction_type IN {_old}",
    )
