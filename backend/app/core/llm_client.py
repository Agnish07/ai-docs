import os
import asyncio
from typing import Optional, List, Dict, Any

import httpx

LLM_KEY = os.getenv("LLM_API_KEY")
LLM_MODEL_OVERRIDE = os.getenv("LLM_MODEL")  
PREFERRED_MODELS = [
    "models/gemini-flash-latest",
    "models/gemini-flash-lite-latest",
    "models/gemini-2.5-flash",
    "models/gemini-2.5-pro",
    "models/gemini-pro-latest",
]

LIST_MODELS_URL = "https://generativelanguage.googleapis.com/v1beta/models?key={key}"
MODEL_GEN_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"

# cached selection
_selected_model: Optional[str] = None
_model_lock = asyncio.Lock()


async def _list_models() -> List[Dict[str, Any]]:
    if not LLM_KEY:
        raise RuntimeError("LLM_API_KEY not set in environment")
    url = LIST_MODELS_URL.format(key=LLM_KEY)
    async with httpx.AsyncClient(timeout=20.0) as client:
        r = await client.get(url)
    # raise on bad HTTP status so callers see details
    r.raise_for_status()
    data = r.json()
    return data.get("models", [])


async def _select_model() -> str:
    """
    Choose and cache a model that supports generateContent.
    Honors LLM_MODEL_OVERRIDE if valid.
    """
    global _selected_model
    if _selected_model:
        return _selected_model

    async with _model_lock:
        if _selected_model:
            return _selected_model

        models = await _list_models()
        name_map = {m.get("name"): m for m in models}

        # 1) If override provided, validate it
        if LLM_MODEL_OVERRIDE:
            m = name_map.get(LLM_MODEL_OVERRIDE)
            if m and "generateContent" in m.get("supportedGenerationMethods", []):
                _selected_model = LLM_MODEL_OVERRIDE
                print(f"[llm_client] Using LLM_MODEL override: {_selected_model}")
                return _selected_model
            print(f"[llm_client] LLM_MODEL override invalid or doesn't support generateContent: {LLM_MODEL_OVERRIDE}")

        # 2) Try preferred list (in order)
        for pref in PREFERRED_MODELS:
            m = name_map.get(pref)
            if m and "generateContent" in m.get("supportedGenerationMethods", []):
                _selected_model = pref
                print(f"[llm_client] Selected preferred model: {_selected_model}")
                return _selected_model

        # 3) Fallback: pick first model that supports generateContent
        for m in models:
            if "generateContent" in m.get("supportedGenerationMethods", []):
                _selected_model = m.get("name")
                print(f"[llm_client] Auto-selected model: {_selected_model}")
                return _selected_model

        raise RuntimeError("No model supporting generateContent available for this API key")


def _parse_response(data: Dict[str, Any]) -> str:
    """
    Safely extract text from various Gemini response shapes.
    Returns a fallback string representation if none matched.
    """
    if not isinstance(data, dict):
        return str(data)

    # 1) top-level output_text
    if "output_text" in data and isinstance(data["output_text"], str):
        return data["output_text"]

    # 2) top-level 'candidates' list (many variants)
    if "candidates" in data and isinstance(data["candidates"], list) and data["candidates"]:
        c = data["candidates"][0]
        # candidate.output_text
        if isinstance(c, dict) and "output_text" in c and isinstance(c["output_text"], str):
            return c["output_text"]
        # candidate.content.parts[].text
        if isinstance(c, dict) and "content" in c:
            parts = c["content"].get("parts", [])
            if parts and isinstance(parts[0], dict) and "text" in parts[0]:
                return parts[0]["text"]

    # 3) older nested shapes
    # Try to find content.parts[*].text anywhere
    try:
        def find_parts_text(obj):
            if isinstance(obj, dict):
                if "parts" in obj and isinstance(obj["parts"], list):
                    for p in obj["parts"]:
                        if isinstance(p, dict) and "text" in p:
                            return p["text"]
                for v in obj.values():
                    res = find_parts_text(v)
                    if res:
                        return res
            elif isinstance(obj, list):
                for item in obj:
                    res = find_parts_text(item)
                    if res:
                        return res
            return None

        found = find_parts_text(data)
        if found:
            return found
    except Exception:
        pass

    # 4) prompt_feedback / safety info
    if "prompt_feedback" in data:
        return "⚠ Gemini blocked the request due to safety filters."

    # 5) fallback to JSON string
    try:
        return str(data)
    except Exception:
        return "LLM returned an unexpected response"


async def generate_text(prompt: str, temperature: float = 0.7, max_output_tokens: int = 1024) -> str:
    """
    Generate text for a prompt. Tries the cached model; if a model returns 404,
    clears cache and retries with another available model (up to a few attempts).
    Returns the generated plain text or an error description.
    """
    if not LLM_KEY:
        return "LLM_API_KEY missing in backend .env"

    tried = set()
    # try up to N attempts (number of PREFERRED_MODELS or until models exhausted)
    for attempt in range(max(3, len(PREFERRED_MODELS))):
        try:
            model = await _select_model()
        except Exception as e:
            return f"LLM model selection error: {e}"

        if model in tried:
            # nothing new to try
            break
        tried.add(model)

        model_for_path = model
        if "/" in model:
            # take part after the first slash, e.g. "models/gemini-flash-latest" -> "gemini-flash-latest"
            model_for_path = model.split("/", 1)[1]

        url = MODEL_GEN_URL.format(model=model_for_path, key=LLM_KEY)
        payload = {
            "contents": [
                {"parts": [{"text": prompt}]}
            ]
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                res = await client.post(url, json=payload)
            except Exception as e:
                # network or TLS error
                print(f"[llm_client] HTTP request failed for model {model}: {e}")
                # try next model
                # clear cached model so next loop reselects
                _clear_selected_model_cache()
                continue

        # debug logs (useful when troubleshooting)
        print(f"[llm_client] Request model={model} status={res.status_code}")
        preview = res.text[:200] if res.text else "<empty>"
        print(f"[llm_client] Response preview: {preview!r}")

        # If 404, model endpoint not available for generateContent -> try another
        if res.status_code == 404:
            print(f"[llm_client] Model {model} returned 404. Clearing cached model and retrying.")
            _clear_selected_model_cache()
            continue

        # Non-2xx errors: return JSON or text to caller for clarity
        if res.status_code >= 400:
            try:
                return f"Gemini Error: {res.json()}"
            except Exception:
                return f"Gemini HTTP Error: {res.status_code} - {res.text}"

        # parse success body
        try:
            data = res.json()
        except Exception:
            return f"Gemini returned non-JSON response: {res.text}"

        return _parse_response(data)

    return "Gemini Error: no available models accepted generateContent (all returned 404 or errors)."


def _clear_selected_model_cache():
    global _selected_model
    _selected_model = None
