import anthropic
import json
import re
from typing import List, Dict


class PatternInferenceEngine:
    """
    使用 Claude API 從範例中推斷條碼規則
    """

    def __init__(self, api_key: str):
        self.client = anthropic.Anthropic(api_key=api_key)

    def infer_pattern(
        self,
        barcode_samples: List[str],
        vendor_name: str,
        manual_labels: Dict | None = None,
    ) -> Dict:
        """
        從範例推斷 Regex 規則

        Args:
            barcode_samples: 至少 3-5 個同供應商的條碼範例
            vendor_name: 供應商名稱
            manual_labels: 人工標註的欄位 (可選)

        Returns:
             {
                 "regex_rule": "...",
                 "field_mapping": {...},
                 "confidence": 0.85,
                 "explanation": "..."
             }
        """
        prompt = self._build_prompt(barcode_samples, vendor_name, manual_labels)

        message = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2000,
            temperature=0,
            messages=[{"role": "user", "content": prompt}],
        )

        response_text = message.content[0].text
        return self._parse_response(response_text)

    def _build_prompt(
        self, samples: List[str], vendor_name: str, labels: Dict | None
    ) -> str:
        """建構給 Claude 的 Prompt"""

        prompt = f"""你是條碼格式分析專家。請分析以下來自 {vendor_name} 的條碼樣本,推斷通用解析規則。

**條碼樣本:**
{chr(10).join(f"{i+1}. {s}" for i, s in enumerate(samples))}
"""

        if labels:
            prompt += f"""
**人工標註範例:**
{json.dumps(labels, indent=2, ensure_ascii=False)}
"""

        prompt += """
請以 JSON 格式回傳 (不要使用 Markdown 包裝):
{
   "regex_rule": "完整的 Python Regex,使用 named groups (?P<name>...)",
   "field_mapping": {
     "group_name": "對應欄位 (vendor_pn/qty/lot_code/date_code)"
   },
   "confidence": 0.0-1.0,
   "explanation": "推斷邏輯說明"
}

**約束:**
1. Regex 必須能匹配所有樣本
2. 使用 (?P<name>...) 定義欄位
3. 考慮分隔符多樣性 (如 [-\\s]?)
"""

        return prompt

    def _parse_response(self, response: str) -> Dict:
        """解析 Claude 的 JSON 回應"""
        clean = re.sub(r"```json\s*|\s*```", "", response).strip()

        try:
            return json.loads(clean)
        except json.JSONDecodeError:
            json_match = re.search(r"\{.*\}", clean, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            raise ValueError(f"無法解析 Claude 回應")
