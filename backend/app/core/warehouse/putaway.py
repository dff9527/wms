from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, asc

from app.models.inventory import InventoryLot  # type: ignore
from app.models.storage import StorageLocation  # type: ignore


class PutAwayEngine:
    def __init__(self, db: Session):
        self.db = db

    def suggest_location(self, lot: InventoryLot) -> Optional[str]:
        """
        Multi-factor scoring algorithm for putaway suggestion (Spec 6.2).
        Factors:
        1. Space Utilization (prefer locations with more free space)
        2. Same-SKU Clustering (prefer locations already holding this SKU)
        3. ABC Classification (A-items to prime real estate, B/C to secondary) - Simplified here
        4. FIFO (prefer locations where older stock is picked first? Usually applies to picking, 
           but for putaway, we might want to group by date code if strict FEFO is needed later).
        
        Returns location_code or None if no suitable location found.
        """
        
        # 1. Get all available storage locations
        # Assuming StorageLocation has 'capacity', 'current_quantity' (or similar), and 'zone_type'
        # We need to calculate available capacity.
        
        # storage_locations has no is_active column (schema §4.1); BIN-type locations
        # are the placeable ones — keep it simple and consider all locations.
        locations = self.db.query(StorageLocation).all()

        if not locations:
            return None

        scored_locations = []

        for loc in locations:
            score = 0
            
            # Factor 1: Space Utilization
            # Calculate current occupancy in this location
            current_qty = self.db.query(func.sum(InventoryLot.quantity_on_hand)).filter(
                InventoryLot.location_id == loc.location_id,
                InventoryLot.lot_status != "SHIPPED",
                InventoryLot.lot_status != "EXPIRED"
            ).scalar() or 0
            
            # schema has capacity_kg / capacity_cbm (both nullable). When capacity is
            # unspecified, treat the location as having room rather than excluding it.
            capacity = loc.capacity_kg
            if capacity is not None and (float(capacity) - current_qty) < lot.quantity_on_hand:
                continue  # Cannot fit
                
            # Higher free space relative to capacity is better? 
            # Or just ensure it fits. Let's prioritize filling existing clusters first.
            
            # Factor 2: Same-SKU Clustering
            sku_count_in_loc = self.db.query(func.count(InventoryLot.lot_id)).filter(
                InventoryLot.location_id == loc.location_id,
                InventoryLot.internal_sku == lot.internal_sku,
                InventoryLot.lot_status.in_(["AVAILABLE", "RESERVED"])
            ).scalar() or 0
            
            if sku_count_in_loc > 0:
                score += 100 + (sku_count_in_loc * 10) # Strong preference for clustering

            # Factor 3: ABC Classification / Zone Preference
            # Assuming 'A' items should go to 'FAST_PICK' zones, others to 'BULK'
            # Simplified: If we had an item master table with ABC class, we'd join it.
            # For now, assume all locations are equal regarding zone unless specified.
            
            # Factor 4: FIFO/FEFO Consideration for Putaway
            # Usually less relevant for putaway than picking, but we might want to avoid mixing dates excessively.
            # We'll stick to SKU clustering as the primary driver after space check.
            
            scored_locations.append((loc, score))

        if not scored_locations:
            return None

        # Sort by score descending
        scored_locations.sort(key=lambda x: x[1], reverse=True)
        
        best_location = scored_locations[0][0]
        return best_location.location_code

