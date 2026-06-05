"""集中 import 所有 model，確保 Base.metadata 完整、relationship 字串可解析。"""

from app.models.warehouse import Warehouse, StorageLocation, LocationStatus
from app.models.item import Item
from app.models.vendor import Vendor, BarcodePattern, VendorItem
from app.models.inventory import InventoryLot, InventoryTransaction
from app.models.order import (
    PurchaseOrder,
    POLine,
    SalesOrder,
    SOLine,
    PickTask,
)
# FIX: fix_2 — Add User model import to register users table in Base.metadata
from app.models.user import User

__all__ = [
     "Warehouse",
     "StorageLocation",
     "LocationStatus",
     "Item",
     "Vendor",
     "BarcodePattern",
     "VendorItem",
     "InventoryLot",
     "InventoryTransaction",
     "PurchaseOrder",
     "POLine",
     "SalesOrder",
     "SOLine",
     "PickTask",
     # FIX: fix_2 — Export User so importing app.models registers the users table
     "User",
]
