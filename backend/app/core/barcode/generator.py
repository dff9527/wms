from datetime import date


class BarcodeGenerator:
    """
    Generates internal barcodes and ZPL payloads.
    
    Internal format convention (consistent with TraceabilityModule UI examples):
    YYYYMMDD-SKU-SEQ-WW
    
    Example: 240415-IC001-0001-W15
    """

    @staticmethod
    def generate_internal_barcode(
        sku: str, lot_number: str, sequence_number: int = 1, reference_date: date | None = None
    ) -> str:
        """
        Generate a standardized internal barcode string.
        
        Args:
            sku: Internal SKU code (e.g., 'IC001')
            lot_number: Lot identifier (e.g., 'L001' or 'AB12345')
            sequence_number: Sequential number for the batch/label
            reference_date: Date to use for prefix. Defaults to today.
            
        Returns:
            Formatted string like "240415-IC001-0001-W15"
        """
        if reference_date is None:
            reference_date = date.today()
            
        # Format date as YYMMDD
        date_str = reference_date.strftime("%y%m%d")
        
        # Extract week number from date for the suffix part if not explicitly provided in lot logic
        # The spec example shows W15 at the end. We will derive this from the date 
        # unless the lot_number itself implies it. To keep it generic and consistent with 
        # "YYYYMMDD-SKU-SEQ-WW", we calculate WW.
        iso_cal = reference_date.isocalendar()
        week_str = f"W{iso_cal[1]:02d}"
        
        seq_str = f"{sequence_number:04d}"
        
        return f"{date_str}-{sku}-{seq_str}-{week_str}"

    @staticmethod
    def generate_zpl_payload(
        internal_barcode: str,
        vendor_pn: str,
        qty: int,
        lot_code: str | None = None,
        date_code: str | None = None,
    ) -> dict:
        """
        Generate a ZPL-ready payload dictionary.
        
        This maps to the fields required by the frontend label printer or backend ZPL template engine.
        See Spec 9.1 ZPLTemplates.
        
        Args:
            internal_barcode: The generated internal barcode string.
            vendor_pn: Vendor part number.
            qty: Quantity count.
            lot_code: Lot code (optional).
            date_code: Date code (optional).
            
        Returns:
            Dict containing fields suitable for rendering into a ZPL template.
        """
        return {
            "internal_barcode": internal_barcode,
            "vendor_pn": vendor_pn,
            "qty": qty,
            "lot_code": lot_code or "",
            "date_code": date_code or "",
            # Standard ZPL commands might be constructed later using these values
            # e.g., ^FO50,50^A0N,30,30^FD{internal_barcode}^FS
        }

═══════════════════════════════════════════════════════════════
