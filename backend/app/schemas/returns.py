from pydantic import BaseModel, Field


class CustomerReturnCreate(BaseModel):
    lotId: int
    quantity: int = Field(gt=0)
    reason: str = Field(min_length=1, max_length=1000)
    reference: str | None = Field(default=None, max_length=100)


class SupplierReturnCreate(BaseModel):
    lotId: int
    quantity: int = Field(gt=0)
    reason: str = Field(min_length=1, max_length=1000)
    reference: str | None = Field(default=None, max_length=100)


class ReturnOut(BaseModel):
    returnId: int
    returnNumber: str
    returnType: str
    lotId: int
    quantity: int
    status: str
    requiresIqc: bool
