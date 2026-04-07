import os
from dotenv import load_dotenv
from langchain_google_vertexai import ChatVertexAI

load_dotenv()


def get_llm(
    model: str | None = None,
    temperature: float = 0.0,
    max_tokens: int = 50000,
) -> ChatVertexAI:
 
    model_name = model or os.getenv("VERTEX_AI_MODEL", "gemini-2.5-flash")

    return ChatVertexAI(
        model=model_name,
        temperature=temperature,
        max_tokens=max_tokens,
        project=os.getenv("GOOGLE_CLOUD_PROJECT"),
        location=os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1"),
    )


# 기본 모델 인스턴스 (싱글톤 패턴)
_default_llm: ChatVertexAI | None = None


def get_default_llm() -> ChatVertexAI:
    """기본 설정의 LLM 인스턴스 반환 (싱글톤)"""
    global _default_llm
    if _default_llm is None:
        _default_llm = get_llm()
    return _default_llm
