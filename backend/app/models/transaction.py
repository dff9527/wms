# 相容 shim：部分程式碼從 app.models.transaction import InventoryTransaction。
# 正式定義在 app.models.inventory，這裡只 re-export 同一個類別，避免重複建表。
from app.models.inventory import InventoryTransaction

__all__ = ["InventoryTransaction"]
