import datetime
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.inventory import InventoryLot
from app.models.transaction import InventoryTransaction
from app.models.order import SalesOrder, SOLine, PickTask


class TraceabilityEngine:
    def __init__(self, db: Session):
        self.db = db

    def trace_forward(self, query: str) -> Optional[Dict]:
        # Resolve lot by internal_barcode, internal_lot_number, or vendor_lot_code
        lot = (
            self.db.query(InventoryLot)
            .filter(
                (InventoryLot.internal_barcode == query) | 
                (InventoryLot.internal_lot_number == query) | 
                (InventoryLot.vendor_lot_code == query)
            )
            .first()
        )
        
        if not lot:
            return None
            
        # Supplier Info (via the vendor relationship)
        supplier_info = {
            "name": lot.vendor.vendor_name if lot.vendor else 'Unknown',
            "vendorLotCode": lot.vendor_lot_code,
            "dateCode": lot.vendor_date_code or '',
            "receiveDate": lot.receive_date.isoformat()[:10] if lot.receive_date else '',
            "poNumber": '',
            "qty": lot.quantity_on_hand + (lot.quantity_reserved or 0)  # Approximation of original qty
        }

        # Receiving Info
        receiving_info = {
            "date": lot.receive_date.isoformat()[:10] if lot.receive_date else '',
            "inspector": lot.iqc_inspector or '',
            "iqcResult": lot.iqc_result or '',
            "internalSku": lot.internal_sku,
            "internalLotNumber": lot.internal_lot_number,
            "internalBarcode": lot.internal_barcode
        }
        
        # Inventory Info
        inventory_info = {
            "location": lot.location_id,
            "currentQty": lot.quantity_on_hand,
            "reservedQty": lot.quantity_reserved or 0
        }
        
        # Shipments (from SHIP/PICK transactions referencing SOs)
        ship_txns = (
            self.db.query(InventoryTransaction)
            .filter(
                InventoryTransaction.lot_id == lot.lot_id,
                InventoryTransaction.transaction_type.in_(['SHIP', 'PICK'])
            )
            .all()
        )

        shipments = []
        seen_sos = set()
        for txn in ship_txns:
            so_num = txn.reference_number if txn.reference_type == 'SO' else None
            if so_num and so_num not in seen_sos:
                seen_sos.add(so_num)
                so = self.db.query(SalesOrder).filter(SalesOrder.so_number == so_num).first()

                # Calculate qty shipped from this lot to this SO
                total_qty = sum(abs(t.quantity_change) for t in ship_txns if t.reference_number == so_num)

                shipments.append({
                    "soNumber": so_num,
                    "customer": so.customer_id if so else '',
                    "shipDate": '',
                    "qty": total_qty,
                    "status": so.status.lower() if so and so.status else 'unknown'
                })
                
        return {
            "barcode": query,
            "type": "internal_barcode" if query == lot.internal_barcode else ("internal_lot" if query == lot.internal_lot_number else "vendor_lot"),
            "supplier": supplier_info,
            "receiving": receiving_info,
            "inventory": inventory_info,
            "shipments": shipments
        }

    def trace_backward(self, internal_barcode: str) -> Optional[Dict]:
        lot = (
            self.db.query(InventoryLot)
            .filter(InventoryLot.internal_barcode == internal_barcode)
            .first()
        )
        
        if not lot:
            return None
            
        return {
            "internalBarcode": lot.internal_barcode,
            "internalLotNumber": lot.internal_lot_number,
            "vendorLotCode": lot.vendor_lot_code,
            "vendorDateCode": lot.vendor_date_code or '',
            "supplierName": lot.vendor.vendor_name if lot.vendor else '',
            "originalBarcode": lot.original_barcode or ''
        }
