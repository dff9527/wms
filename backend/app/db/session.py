from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config.settings import settings
from app.db.base import Base  # noqa: F401  (re-exported for convenience)

engine = create_engine(settings.DATABASE_URL, future=True, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def get_db():
    """FastAPI 依賴：每個 request 一個 Session。"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
