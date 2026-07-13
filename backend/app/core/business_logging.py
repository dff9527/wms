import json
import logging
from datetime import datetime, timezone
from typing import Any


class JsonBusinessFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "time": datetime.now(timezone.utc).isoformat(),
            "user": getattr(record, "user", None),
            "action": getattr(record, "action", None),
            "lot_id": getattr(record, "lot_id", None),
        }
        return json.dumps(payload, ensure_ascii=False, default=str)


logger = logging.getLogger("wms.business")
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(JsonBusinessFormatter())
    logger.addHandler(handler)
logger.setLevel(logging.INFO)
logger.propagate = False


def log_business_event(user: str, action: str, lot_id: Any = None) -> None:
    logger.info(
        action,
        extra={"user": user, "action": action, "lot_id": lot_id},
    )
