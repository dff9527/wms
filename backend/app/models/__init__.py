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
]
