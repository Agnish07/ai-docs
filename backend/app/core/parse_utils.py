# backend/app/core/parse_utils.py
import json
import re
from typing import Any, Dict, Optional

_CODE_FENCE_RE = re.compile(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", re.IGNORECASE)
_INLINE_JSON_RE = re.compile(r"(\{[\s\S]*\})", re.DOTALL)

def extract_json_from_text(text: str) -> Optional[Dict[str, Any]]:
    """
    Try to extract & parse a JSON object from text returned by an LLM.
    Handles code fences and inline JSON. Returns dict or None.
    """
    if not text or not isinstance(text, str):
        return None
    s = text.strip()

    # 1) triple-backtick containing JSON
    m = _CODE_FENCE_RE.search(s)
    if m:
        candidate = m.group(1)
        try:
            return json.loads(candidate)
        except Exception:
            s = candidate  # fall through to lenient parsing

    # 2) any {...} block (first match)
    m = _INLINE_JSON_RE.search(s)
    if m:
        candidate = m.group(1)
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            # lenient fixes: replace single quotes, remove trailing commas
            cand2 = candidate.replace("'", '"')
            cand2 = re.sub(r",\s*(\}|])", r"\1", cand2)
            try:
                return json.loads(cand2)
            except Exception:
                pass

    # 3) try full-string JSON
    try:
        return json.loads(s)
    except Exception:
        return None
