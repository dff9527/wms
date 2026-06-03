# 相容 shim：部分 Round 2–4 產出的程式碼從 app.dependencies import get_db
from app.db.session import get_db

__all__ = ["get_db"]
