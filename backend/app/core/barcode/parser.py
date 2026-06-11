import re
from typing import Dict, Optional, List
from sqlalchemy.orm import Session
from app.models.vendor import BarcodePattern


class BarcodeParser:
    """
    條碼解析引擎
    
    核心功能:
     1. 依供應商自動選擇解析規則
     2. 使用 Regex 提取欄位
     3. 驗證提取結果
     4. 處理數量單位轉換 (K/M)
    """

    def __init__(self, db: Session):
        self.db = db
        self.pattern_cache: Dict[str, List[BarcodePattern]] = {}

    def parse(self, barcode: str, vendor_id: int) -> Optional[Dict]:
        """
        主解析函式
        
        Args:
            barcode: 原始條碼字串
            vendor_id: 供應商 ID
        
        Returns:
            解析結果 Dict 或 None
        """
        patterns = self._get_patterns(vendor_id)

        if not patterns:
            return None

        # 多段條碼 (multi_scan_mode, 如 ROHM):掃描器逐段送入時以換行分隔,
        # 組合成單一字串後再套用 regex(ROHM 規則的分隔符為 '-')
        joined = None
        if "\n" in barcode:
            segments = [s.strip() for s in barcode.splitlines() if s.strip()]
            if len(segments) > 1:
                joined = "-".join(segments)

        for pattern in patterns:
            candidates = [barcode]
            if joined and pattern.multi_scan_mode:
                candidates.append(joined)

            for candidate in candidates:
                match = re.match(pattern.regex_rule, candidate)
                if match:
                    parsed_data = self._extract_fields(match, pattern)
                    if self._validate(parsed_data, pattern):
                        parsed_data = self._convert_quantity(parsed_data, pattern)
                        parsed_data["pattern_used"] = pattern.pattern_name
                        parsed_data["pattern_id"] = pattern.pattern_id
                        return parsed_data

        return None

    def _get_patterns(self, vendor_id: int) -> List[BarcodePattern]:
        """取得供應商的所有條碼規則"""
        cache_key = f"vendor_{vendor_id}"

        if cache_key not in self.pattern_cache:
            patterns = (
                self.db.query(BarcodePattern)
                .filter(
                    BarcodePattern.vendor_id == vendor_id,
                    BarcodePattern.is_active == True,
                )
                .order_by(BarcodePattern.priority.desc())
                .all()
            )

            self.pattern_cache[cache_key] = patterns

        return self.pattern_cache[cache_key]

    def _extract_fields(self, match: "re.Match", pattern: BarcodePattern) -> Dict:
        """依 field_mapping 提取欄位"""
        extracted = {}
        for group_name, field_name in pattern.field_mapping.items():
            try:
                value = match.group(group_name)
                extracted[field_name] = value
            except IndexError:
                pass
        return extracted

    def _validate(self, data: Dict, pattern: BarcodePattern) -> bool:
        """驗證提取結果"""
        if not pattern.validation_rules:
            return True

        for field, rule in pattern.validation_rules.items():
            if field in data:
                if not re.match(rule, str(data[field])):
                    return False
        return True

    def _convert_quantity(self, data: Dict, pattern: BarcodePattern) -> Dict:
        """處理數量單位轉換"""
        if not pattern.quantity_conversion:
            # If no conversion rules defined but qty exists as string/int, ensure it's int
            for key in ["qty", "qty_raw", "quantity"]:
                if key in data:
                    try:
                        data[key] = int(str(data[key]).strip())
                    except (ValueError, TypeError):
                        pass
                    break
            return data

        qty_field = None
        for key in ["qty", "qty_raw", "quantity"]:
            if key in data:
                qty_field = key
                break

        if not qty_field:
            return data

        qty_str = str(data[qty_field])

        for suffix, multiplier in pattern.quantity_conversion.items():
            if qty_str.endswith(suffix):
                base_qty = int(qty_str[: -len(suffix)])
                data["qty"] = base_qty * multiplier
                return data

        try:
            data["qty"] = int(qty_str)
        except (ValueError, TypeError):
            pass
            
        return data

