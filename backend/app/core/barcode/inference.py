"""純 Python 條碼規則推導(不依賴 AI)。

使用者提供 2–5 個同供應商條碼樣本,並針對「第一個樣本」標註各欄位的實際值
(如 vendor_pn=TPS54331DRCR)。演算法:

1. 在第一個樣本中定位各欄位值,欄位之間的固定字元視為「錨點字面值」。
2. 用錨點建立骨架正則,從其餘樣本抽出對應欄位值。
3. 依所有樣本的欄位值歸納字元類型(\\d / [A-Z0-9]…)與長度範圍,產生最終正則。
4. 用最終正則回驗全部樣本;第一個樣本抽出的值必須與標註完全一致。
"""

import re
from typing import Dict, List

FIELD_KEYS = ("vendor_pn", "qty", "lot_code", "date_code")


class InferenceError(ValueError):
    pass


def _char_class(values: List[str]) -> str:
    chars = set("".join(values))
    has_digit = any(c.isdigit() for c in chars)
    has_upper = any(c.isupper() for c in chars)
    has_lower = any(c.islower() for c in chars)
    extras = sorted(c for c in chars if not c.isalnum())

    parts = []
    if has_upper and has_lower:
        parts.append("A-Za-z")
    elif has_upper:
        parts.append("A-Z")
    elif has_lower:
        parts.append("a-z")
    if has_digit:
        parts.append("0-9")
    body = "".join(parts) + "".join(re.escape(c) for c in extras)
    if body == "0-9":
        return r"\d"
    return f"[{body}]"


def _quantifier(values: List[str]) -> str:
    lengths = {len(v) for v in values}
    low, high = min(lengths), max(lengths)
    if low == high:
        return f"{{{low}}}"
    return f"{{{low},{high}}}"


def infer_pattern(samples: List[str], labels: Dict[str, str]) -> Dict:
    samples = [s.strip() for s in samples if s and s.strip()]
    if not samples:
        raise InferenceError("請至少提供一筆條碼樣本")
    labels = {
        k: v.strip() for k, v in labels.items() if k in FIELD_KEYS and v and v.strip()
    }
    if not labels:
        raise InferenceError("請至少標註一個欄位值(以第一筆樣本為準)")

    base = samples[0]

    # 1. 在第一筆樣本中定位各欄位
    spans = []
    for field, value in labels.items():
        count = base.count(value)
        if count == 0:
            raise InferenceError(f"在第一筆樣本中找不到「{field}」的值:{value}")
        if count > 1:
            raise InferenceError(
                f"值「{value}」在第一筆樣本中出現 {count} 次,無法唯一定位「{field}」;"
                "請改用更完整的欄位值"
            )
        start = base.index(value)
        spans.append((start, start + len(value), field))
    spans.sort()
    for (_, prev_end, prev_field), (start, _, field) in zip(spans, spans[1:]):
        if prev_end > start:
            raise InferenceError(
                f"欄位「{prev_field}」與「{field}」的值重疊,請確認標註"
            )

    # 2. 錨點字面值 + 骨架正則
    literals: List[str] = []
    prev_end = 0
    fields: List[str] = []
    for start, end, field in spans:
        literals.append(base[prev_end:start])
        fields.append(field)
        prev_end = end
    literals.append(base[prev_end:])

    for (_, prev_end, prev_field), (start, _, field) in zip(spans, spans[1:]):
        if prev_end == start:
            raise InferenceError(
                f"欄位「{prev_field}」與「{field}」之間沒有固定分隔字元,"
                "自動推導無法區分邊界;請改用手動模式"
            )

    skeleton = "^"
    for literal, field in zip(literals, fields):
        skeleton += re.escape(literal) + f"(?P<{field}>.+?)"
    skeleton += re.escape(literals[-1]) + "$"
    skeleton_re = re.compile(skeleton)

    # 3. 從所有樣本抽出欄位值
    extracted: Dict[str, List[str]] = {field: [] for field in fields}
    for sample in samples:
        match = skeleton_re.match(sample)
        if not match:
            raise InferenceError(
                f"樣本「{sample}」與第一筆樣本的固定結構不一致,無法歸納同一條規則"
            )
        for field in fields:
            extracted[field].append(match.group(field))

    # 4. 產生最終正則並回驗
    final = "^"
    for literal, field in zip(literals, fields):
        cls = _char_class(extracted[field])
        final += (
            re.escape(literal) + f"(?P<{field}>{cls}{_quantifier(extracted[field])})"
        )
    final += re.escape(literals[-1]) + "$"
    final_re = re.compile(final)

    previews = []
    for sample in samples:
        match = final_re.match(sample)
        if not match:
            raise InferenceError(
                f"推導出的規則無法匹配樣本「{sample}」;樣本格式差異過大,請改用手動模式"
            )
        previews.append({"barcode": sample, "parsed": match.groupdict()})

    for field, value in labels.items():
        if previews[0]["parsed"].get(field) != value:
            raise InferenceError(
                f"回驗失敗:「{field}」抽出「{previews[0]['parsed'].get(field)}」"
                f"與標註「{value}」不符;請改用手動模式"
            )

    return {
        "regex_rule": final,
        "field_mapping": {field: field for field in fields},
        "previews": previews,
    }
