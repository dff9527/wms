from app.db.session import get_db

__all__ = ["get_db", "get_current_user"]


def get_current_user():
    """認證 stub —— 正式上線前替換為真正的 JWT 驗證。

    目前回傳固定使用者，讓需要 current_user 的端點能運作。
    """
    return {"username": "system", "role": "operator"}
