# 相容 shim：部分 Round 2 產出的程式碼從 app.core.config import settings
from app.config.settings import Settings, settings

__all__ = ["Settings", "settings"]

# FIX: [fix_4] — Validate SECRET_KEY security constraints (length and defaults) upon module load
def _validate_secret_key():
    key = settings.SECRET_KEY
    if not key or len(key) < 32:
        raise ValueError("SECRET_KEY must be non-empty and at least 32 characters long")
    if key.lower() in ['secret', 'changeme', 'your-secret-key']:
        raise ValueError("SECRET_KEY must not be a known insecure default")

_validate_secret_key()
