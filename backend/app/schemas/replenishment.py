from pydantic import BaseModel, Field


class ReplenishmentRuleUpdate(BaseModel):
    internalSku: str = Field(min_length=1, max_length=50)
    minimumQty: int = Field(ge=0)
    maximumQty: int = Field(gt=0)


class ReplenishmentTaskOut(BaseModel):
    taskId: int
    internalSku: str
    lotId: int
    fromLocationId: int
    toLocationId: int
    quantity: int
    status: str
