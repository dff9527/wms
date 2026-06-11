from datetime import datetime, timezone


def utcnow() -> datetime:
    """返回 UTC 時間的 naive datetime 物件。

    用於取代 Python 3.12 弃用的 UTC now 方法。
    DB 欄位為 TIMESTAMP WITHOUT TIME ZONE，必須維持 naive datetime。"""
    return datetime.now(timezone.utc).replace(tzinfo=None)