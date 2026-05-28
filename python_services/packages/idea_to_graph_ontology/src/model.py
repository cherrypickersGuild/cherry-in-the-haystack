"""Centralized LLM model factory.

Uses ChatOpenAI under the hood, which works with any OpenAI-compatible API.
Switch providers purely via environment variables — no code changes needed.

Environment variables:
    LLM_MODEL     — model name (default: deepseek-chat)
    LLM_BASE_URL  — provider endpoint (omit for OpenAI default)
    LLM_API_KEY   — provider API key (falls back to DEEPSEEK_API_KEY, then OPENAI_API_KEY)

Examples:
    # DeepSeek (default)
    LLM_MODEL=deepseek-chat
    LLM_BASE_URL=https://api.deepseek.com
    LLM_API_KEY=sk-...

    # OpenAI
    LLM_MODEL=gpt-4o
    # LLM_BASE_URL omitted → uses OpenAI default
    # LLM_API_KEY omitted → falls back to OPENAI_API_KEY

    # Any OpenAI-compatible provider (Groq, Together, Fireworks, etc.)
    LLM_MODEL=llama3-70b-8192
    LLM_BASE_URL=https://api.groq.com/openai/v1
    LLM_API_KEY=gsk_...
"""

import os

from langchain_openai import ChatOpenAI

_DEFAULT_MODEL = "deepseek-chat"


def get_llm(model: str | None = None, temperature: float = 0.0) -> ChatOpenAI:
    model_name = model or os.getenv("LLM_MODEL", _DEFAULT_MODEL)

    kwargs: dict = {
        "model": model_name,
        "temperature": temperature,
    }

    base_url = os.getenv("LLM_BASE_URL")
    if base_url:
        kwargs["base_url"] = base_url

    api_key = os.getenv("LLM_API_KEY") or os.getenv("DEEPSEEK_API_KEY") or os.getenv("OPENAI_API_KEY")
    if api_key:
        kwargs["api_key"] = api_key

    return ChatOpenAI(**kwargs)
