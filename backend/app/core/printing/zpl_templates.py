"""Pure ZPL string builder per spec §9.1. No I/O."""


class ZPLTemplates:
    """Generates ZPL strings for standard labels."""

    @staticmethod
    def standard_label(data: dict) -> str:
        internal_barcode = data.get("internal_barcode", "")
        description = (data.get("description") or "")[:20]
        vendor_lot = data.get("vendor_lot", "N/A")
        quantity = data.get("quantity", 0)
        unit = data.get("unit", "")
        receive_date = data.get("receive_date", "")

        # Format quantity with thousands separator
        if isinstance(quantity, (int, float)):
            qty_str = f"{quantity:,}"
        else:
            qty_str = str(quantity)

        qty_unit = f"{qty_str} {unit}".strip()

        return (
            "^XA"
            f"^FO50,50^BQN,2,8^FDQ,{internal_barcode}^FS"
            f"^FO50,200^A0N,30,30^FD{description}^FS"
            f"^FO50,250^A0N,20,20^FDLOT:{vendor_lot}^FS"
            f"^FO50,300^A0N,20,20^FDQTY:{qty_unit}^FS"
            f"^FO50,350^A0N,20,20^FDDATE:{receive_date}^FS"
            "^XZ"
        )
