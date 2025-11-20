import os
import httpx

LLM_API_KEY = os.getenv("LLM_API_KEY", "")

async def generate_text(prompt: str):
    # Replace this stub with actual provider call (Gemini / OpenAI etc.)
    # Example: use httpx.post to LLM endpoint with API key
    return f"LLM stub response for prompt: {prompt}"
