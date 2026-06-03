from sqlalchemy.orm import Session
from app.core.barcode.parser import BarcodeParser
from app.core.barcode.learner import PatternInferenceEngine
from app.schemas.barcode import ParseResult, LearnResult, LearnRequest
from app.models.vendor import Vendor, BarcodePattern
from app.core.config import settings


def parse_barcode(db: Session, barcode: str, vendor_id: int) -> ParseResult | None:
    """
    Orchestrate parsing of a single barcode.
    
    Returns ParseResult if successful, None otherwise.
    """
    parser = BarcodeParser(db)
    result_dict = parser.parse(barcode, vendor_id)
    
    if not result_dict:
        return None
        
    # Map raw dict to Pydantic model
    # Ensure qty is present and integer as per spec invariants
    if "qty" not in result_dict or result_dict["qty"] is None:
         raise ValueError("Parsed result missing required 'qty' field")
         
    return ParseResult(**result_dict)


def learn_pattern(
    db: Session, req: LearnRequest, save: bool = False
) -> LearnResult:
    """
    Use AI to infer a pattern from samples. Optionally save it to DB.
    """
    api_key = getattr(settings, "CLAUDE_API_KEY", None)
    if not api_key:
        raise ValueError("CLAUDE_API_KEY not configured in settings")

    engine = PatternInferenceEngine(api_key=api_key)
    
    try:
        inference_result = engine.infer_pattern(
            barcode_samples=req.samples,
            vendor_name=req.vendor_name,
            manual_labels=req.manual_labels,
        )
    except Exception as e:
        raise RuntimeError(f"AI Inference failed: {str(e)}")

    saved = False
    pattern_id = None
    
    if save:
        try:
            # Resolve Vendor by name
            vendor = (
                db.query(Vendor)
                .filter(Vendor.vendor_name == req.vendor_name)
                .first()
            )
            
            if not vendor:
                 # If vendor doesn't exist, we cannot link the pattern securely without creating one first.
                 # For this scope, we assume vendor exists or fail gracefully/logically.
                 # Spec says "resolve/create Vendor". Let's create if missing to be robust.
                 vendor = Vendor(vendor_name=req.vendor_name, vendor_code=req.vendor_name[:3].upper())
                 db.add(vendor)
                 db.flush() # Get ID
            
            # Determine priority: get max existing priority for this vendor + 1
            max_priority = (
                db.query(BarcodePattern.priority)
                .filter(BarcodePattern.vendor_id == vendor.id)
                .order_by(BarcodePattern.priority.desc())
                .limit(1)
                .scalar_subquery()
            )
            new_priority = (max_priority or 0) + 1
            
            new_pattern = BarcodePattern(
                vendor_id=vendor.id,
                pattern_name=f"Inferred_{req.vendor_name}_{new_priority}",
                regex_rule=inference_result["regex_rule"],
                field_mapping=inference_result.get("field_mapping", {}),
                validation_rules={}, # AI might provide these in future, default empty for now
                quantity_conversion={}, 
                is_active=True,
                priority=new_priority,
            )
            
            db.add(new_pattern)
            db.commit()
            db.refresh(new_pattern)
            
            saved = True
            pattern_id = new_pattern.pattern_id
            
        except Exception as e:
            db.rollback()
            raise RuntimeError(f"Failed to save learned pattern: {str(e)}")

    return LearnResult(
        regex_rule=inference_result["regex_rule"],
        field_mapping=inference_result.get("field_mapping", {}),
        confidence=float(inference_result.get("confidence", 0.0)),
        explanation=inference_result.get("explanation", ""),
        pattern_id=pattern_id,
        saved=saved,
    )


def list_patterns(db: Session, vendor_id: int | None = None):
    """
    List active barcode patterns, optionally filtered by vendor.
    Ordered by priority descending.
    """
    query = db.query(BarcodePattern).filter(BarcodePattern.is_active == True)
    
    if vendor_id is not None:
        query = query.filter(BarcodePattern.vendor_id == vendor_id)
        
    return query.order_by(BarcodePattern.priority.desc()).all()

