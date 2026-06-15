from pydantic import BaseModel, Field
from typing import Optional, List, Dict


class ScanRequest(BaseModel):
    barcode: str
    vendor_id: int


class ParseResult(BaseModel):
    vendor_pn: str
    qty: int
    lot_code: Optional[str] = None
    date_code: Optional[str] = None
    pattern_used: str
    pattern_id: Optional[int] = None

    class Config:
        from_attributes = True


class LearnRequest(BaseModel):
    vendor_name: str
    samples: List[str]
    manual_labels: Optional[Dict] = None
    save_pattern: bool = False


class LearnResult(BaseModel):
    regex_rule: str
    field_mapping: Dict
    confidence: float
    explanation: str
    pattern_id: Optional[int] = None
    saved: bool = False


class CreatePatternRequest(BaseModel):
    vendor_id: int
    pattern_name: str
    regex_rule: str
    field_mapping: Dict
    validation_rules: Optional[Dict] = None
    priority: int = 100


class PatternOut(BaseModel):
    pattern_id: int
    vendor_id: Optional[int] = None
    pattern_name: str
    is_active: bool

    class Config:
        from_attributes = True


class SetPatternActiveRequest(BaseModel):
    is_active: bool


class UpdatePatternRequest(BaseModel):
    pattern_name: str | None = None
    regex_rule: str | None = None
    field_mapping: dict | None = None
    priority: int | None = None
    is_active: bool | None = None
