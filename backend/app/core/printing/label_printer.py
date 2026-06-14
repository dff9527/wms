"""LabelPrinter class for rendering lots to ZPL and sending to printers."""

import socket
from datetime import date, datetime
from typing import Any, Dict

from app.core.printing.zpl_templates import ZPLTemplates


class LabelPrinter:
    """Renders a lot object to ZPL and optionally sends it to a printer."""

    def render(self, lot: Any) -> str:
        """Builds a data dict from the lot's fields and calls ZPLTemplates.standard_label(data)."""

        # Map lot attribute names to spec dict keys with safe fallbacks
        vendor_lot = (
            getattr(lot, "vendor_lot_code", None)
            or getattr(lot, "vendor_lot", None)
            or "N/A"
        )
        quantity = getattr(lot, "quantity_on_hand", None) or getattr(lot, "quantity", 0)
        receive_date_raw = getattr(lot, "receive_date", None)

        if isinstance(receive_date_raw, (date, datetime)):
            receive_date_str = receive_date_raw.isoformat()[:10]
        else:
            receive_date_str = str(receive_date_raw) if receive_date_raw else ""

        data: Dict[str, Any] = {
            "internal_barcode": getattr(lot, "internal_barcode", ""),
            "description": getattr(lot, "description", ""),
            "vendor_lot": vendor_lot,
            "quantity": quantity,
            "unit": getattr(lot, "unit", ""),
            "receive_date": receive_date_str,
        }

        return ZPLTemplates.standard_label(data)

    def send_to_printer(self, zpl: str, printer_ip: str) -> bool:
        """Sends ZPL to a printer over TCP on port 9100. Returns True on success."""
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(5)
            sock.connect((printer_ip, 9100))
            sock.sendall(zpl.encode("utf-8"))
            sock.close()
            return True
        except Exception:
            return False
