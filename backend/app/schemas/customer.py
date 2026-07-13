from typing import Optional, Any
from pydantic import BaseModel, Field


class CustomerOut(BaseModel):
    customer_id: int
    customer_code: str
    customer_name: str
    approved_avl: Optional[Any] = None
    is_active: bool

    class Config:
        from_attributes = True


# FIX: [fix_3] — Add max_length constraints to CustomerCreate fields to match DB column limits
class CustomerCreate(BaseModel):
    customer_code: str = Field(..., max_length=50)
    customer_name: str = Field(..., max_length=255)
    approved_avl: Optional[Any] = None
    is_active: bool = True


class CustomerUpdate(BaseModel):
    customer_name: Optional[str] = Field(None, max_length=255)
    approved_avl: Optional[Any] = None
    is_active: Optional[bool] = None
