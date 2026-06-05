from typing import Optional, Any
from pydantic import BaseModel


class CustomerOut(BaseModel):
    customer_id: int
    customer_code: str
    customer_name: str
    approved_avl: Optional[Any] = None
    is_active: bool

    class Config:
        from_attributes = True


class CustomerCreate(BaseModel):
    customer_code: str
    customer_name: str
    approved_avl: Optional[Any] = None
    is_active: bool = True
