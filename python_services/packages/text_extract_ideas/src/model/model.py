import os
import json
import re

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI

load_dotenv()


def get_llm(
    model: str | None = None,
    temperature: float = 0.0,
    max_tokens: int = 50000,
) -> ChatOpenAI:
    model_name = model or os.getenv("LLM_MODEL", "deepseek-chat")

    kwargs: dict = {
        "model": model_name,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    base_url = os.getenv("LLM_BASE_URL")
    if base_url:
        kwargs["base_url"] = base_url

    api_key = os.getenv("LLM_API_KEY") or os.getenv("DEEPSEEK_API_KEY") or os.getenv("OPENAI_API_KEY")
    if api_key:
        kwargs["api_key"] = api_key

    return ChatOpenAI(**kwargs)


_default_llm: ChatOpenAI | None = None


def get_default_llm() -> ChatOpenAI:
    global _default_llm
    if _default_llm is None:
        _default_llm = get_llm()
    return _default_llm


def parse_json_response(text: str) -> dict:
    """Parse JSON from LLM response, handling markdown code fences."""
    text = text.strip()
    text = re.sub(r'^```(?:json)?\s*\n?', '', text)
    text = re.sub(r'\n?```\s*$', '', text)
    return json.loads(text)
