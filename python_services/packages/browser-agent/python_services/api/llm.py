"""
LLM provider factory — pick Claude (Anthropic) or a local Qwen (OpenAI-compatible)
per role via env config. See docs/llm-provider-plan.md.

Roles (env var → value): ANALYZE_LLM / FALLBACK_LLM / CLASSIFY_LLM = anthropic | qwen
  - anthropic: ANTHROPIC_API_KEY, ANTHROPIC_MODEL
  - qwen:      QWEN_BASE_URL, QWEN_MODEL, QWEN_API_KEY, QWEN_DISABLE_THINKING

Two entry points:
  - make_browser_use_llm(role): a browser-use LLM object (ChatAnthropic | ChatOpenAI)
  - chat_json(prompt, role, ...): a plain JSON-returning chat call (Anthropic SDK | OpenAI SDK)
"""

from __future__ import annotations

import os

_DEFAULT_ANTHROPIC_MODEL = "claude-3-5-sonnet-20241022"
_DEFAULT_QWEN_MODEL = "nvidia/Qwen3.6-27B-NVFP4"


def provider_for(role: str) -> str:
    """Return 'anthropic' | 'qwen' for a role (ANALYZE / FALLBACK / CLASSIFY).

    Defaults to 'anthropic' when unset or unrecognized (safe / no behavior change).
    """
    value = os.environ.get(f"{role.upper()}_LLM", "anthropic").strip().lower()
    return value if value in ("anthropic", "qwen") else "anthropic"


def _anthropic_model() -> str:
    return os.environ.get("ANTHROPIC_MODEL", _DEFAULT_ANTHROPIC_MODEL)


def _qwen_model() -> str:
    return os.environ.get("QWEN_MODEL", _DEFAULT_QWEN_MODEL)


def _qwen_disable_thinking() -> bool:
    return os.environ.get("QWEN_DISABLE_THINKING", "true").strip().lower() != "false"


def _qwen_extra_body() -> dict:
    # Qwen3 reasoning models otherwise spend the whole token budget "thinking" and
    # return content=None. Disabling thinking yields clean JSON (verified).
    if _qwen_disable_thinking():
        return {"chat_template_kwargs": {"enable_thinking": False}}
    return {}


# ---------------------------------------------------------------------------
# (a) browser-use LLM object
# ---------------------------------------------------------------------------

def make_browser_use_llm(role: str):
    """Build a browser-use LLM for the given role's provider."""
    provider = provider_for(role)
    if provider == "qwen":
        from browser_use.llm.openai.chat import ChatOpenAI
        return ChatOpenAI(
            model=_qwen_model(),
            base_url=os.environ["QWEN_BASE_URL"],
            api_key=os.environ.get("QWEN_API_KEY", "dummy"),
        )
    from browser_use.llm.anthropic.chat import ChatAnthropic
    return ChatAnthropic(
        model=_anthropic_model(),
        api_key=os.environ["ANTHROPIC_API_KEY"],
    )


# ---------------------------------------------------------------------------
# (b) plain JSON chat (classification / summarization)
# ---------------------------------------------------------------------------

async def chat_json(prompt: str, role: str = "CLASSIFY", max_tokens: int = 600,
                    temperature: float = 0.0) -> str:
    """Single-shot chat returning the model's text (expected to be JSON).

    Routes to Anthropic or the OpenAI-compatible Qwen endpoint per role config.
    """
    provider = provider_for(role)
    if provider == "qwen":
        from openai import AsyncOpenAI
        client = AsyncOpenAI(
            base_url=os.environ["QWEN_BASE_URL"],
            api_key=os.environ.get("QWEN_API_KEY", "dummy"),
        )
        resp = await client.chat.completions.create(
            model=_qwen_model(),
            max_tokens=max_tokens,
            temperature=temperature,
            messages=[{"role": "user", "content": prompt}],
            extra_body=_qwen_extra_body(),
        )
        return resp.choices[0].message.content or ""

    from anthropic import AsyncAnthropic
    client = AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    msg = await client.messages.create(
        model=_anthropic_model(),
        max_tokens=max_tokens,
        temperature=temperature,
        messages=[{"role": "user", "content": prompt}],
    )
    parts = [b.text for b in msg.content if getattr(b, "type", None) == "text"]
    return "".join(parts)
