# 相容 shim：部分 Round 2 產出的程式碼從 app.core.config import settings
from app.config.settings import Settings, settings

__all__ = ["Settings", "settings"]


# Security validation is performed by app.main before routers are imported.
