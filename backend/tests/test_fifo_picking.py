import pytest
from datetime import date, timedelta

from app.models.inventory import InventoryLot
from app.models.order import SalesOrder, SOLine
from app.core.warehouse.picking import PickingEngine


class TestFIFOPicking:
    
    def test_fifo_basic(self, db_session):
        # Setup Lots
        lot_old = InventoryLot(
            internal_sku='IC-001',
            internal_lot_number='LOT-OLD',
            vendor_lot_code='V-OLD',
            quantity_on_hand=1000,
            quantity_reserved=0,
            status='AVAILABLE',
            receive_date=date.today() - timedelta(days=30),
            location_id='A-01'
        )
        
        lot_mid = InventoryLot(
            internal_sku='IC-001',
            internal_lot_number='LOT-MID',
            vendor_lot_code='V-MID',
            quantity_on_hand=1500,
            quantity_reserved=0,
            status='AVAILABLE',
            receive_date=date.today() - timedelta(days=15),
            location_id='A-02'
        )
        
        lot_new = InventoryLot(
            internal_sku='IC-001',
            internal_lot_number='LOT-NEW',
            vendor_lot_code='V-NEW',
            quantity_on_hand=2000,
            quantity_reserved=0,
            status='AVAILABLE',
            receive_date=date.today(),
            location_id='A-03'
        )
        
        db_session.add_all([lot_old, lot_mid, lot_new])
        db_session.commit()
        
        # Setup SO
        so = SalesOrder(
            so_number='SO-FIFO-TEST',
            customer_name='Test Customer',
            status='PENDING'
        )
        db_session.add(so)
        db_session.flush()
        
        line = SOLine(
            so_number='SO-FIFO-TEST',
            line_number=1,
            internal_sku='IC-001',
            ordered_qty=1500,
            picked_qty=0
        )
        db_session.add(line)
        db_session.commit()
        
        # Execute Allocation
        engine = PickingEngine(db_session)
        result = engine.allocate_lots_for_so('SO-FIFO-TEST')
        
        # Assert FIFO Order: LOT-OLD (1000) then LOT-MID (500). LOT-NEW excluded.
        details = result['details']
        assert len(details) == 2
        
        assert details[0]['internalLotNumber'] == 'LOT-OLD'
        assert details[0]['qty'] == 1000
        
        assert details[1]['internalLotNumber'] == 'LOT-MID'
        assert details[1]['qty'] == 500
        
    def test_fefo_with_expiry(self, db_session):
        # Setup Lots with Expiry Dates
        lot_soon = InventoryLot(
            internal_sku='IC-001',
            internal_lot_number='LOT-EXPIRE-SOON',
            vendor_lot_code='V-SOON',
            quantity_on_hand=1000,
            quantity_reserved=0,
            status='AVAILABLE',
            receive_date=date.today() - timedelta(days=30),
            expiry_date=date.today() + timedelta(days=10),
            location_id='B-01'
        )
        
        lot_later = InventoryLot(
            internal_sku='IC-001',
            internal_lot_number='LOT-EXPIRE-LATER',
            vendor_lot_code='V-LATER',
            quantity_on_hand=1000,
            quantity_reserved=0,
            status='AVAILABLE',
            receive_date=date.today() - timedelta(days=20),
            expiry_date=date.today() + timedelta(days=100),
            location_id='B-02'
        )
        
        db_session.add_all([lot_soon, lot_later])
        db_session.commit()
        
        # Setup SO with FEFO Strategy
        so = SalesOrder(
            so_number='SO-FEFO-TEST',
            customer_name='Test Customer',
            status='PENDING',
            fifo_strategy='FEFO'
        )
        db_session.add(so)
        db_session.flush()
        
        line = SOLine(
            so_number='SO-FEFO-TEST',
            line_number=1,
            internal_sku='IC-001',
            ordered_qty=500,
            picked_qty=0
        )
        db_session.add(line)
        db_session.commit()
        
        # Execute Allocation
        engine = PickingEngine(db_session)
        result = engine.allocate_lots_for_so('SO-FEFO-TEST')
        
        # Assert FEFO Order: LOT-EXPIRE-SOON first
        details = result['details']
        assert len(details) == 1
        
        assert details[0]['internalLotNumber'] == 'LOT-EXPIRE-SOON'
        assert details[0]['qty'] == 500
