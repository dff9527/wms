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

═══════════════════════════════════════════════════════════════
