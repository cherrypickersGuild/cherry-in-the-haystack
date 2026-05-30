"""임베딩 생성 유틸리티 - OpenAI API 사용"""

import os
from typing import List, Optional
from dataclasses import dataclass

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None


# 싱글톤 클라이언트
_openai_client: Optional["OpenAI"] = None

# 기본 설정
DEFAULT_MODEL = "text-embedding-3-small"
DEFAULT_DIMENSIONS = 1536
BATCH_SIZE = 100  # OpenAI 배치 제한


@dataclass
class EmbeddingResult:
    """임베딩 결과"""
    embedding: List[float]
    model: str
    tokens_used: int
    cost_cents: float


def get_openai_client() -> "OpenAI":
    """OpenAI 클라이언트 싱글톤 반환.

    Returns:
        OpenAI 클라이언트

    Raises:
        ImportError: openai 패키지 미설치
        ValueError: OPENAI_API_KEY 미설정
    """
    global _openai_client

    if OpenAI is None:
        raise ImportError("openai 패키지가 설치되지 않았습니다. pip install openai")

    if _openai_client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY 환경변수가 설정되지 않았습니다.")
        _openai_client = OpenAI(api_key=api_key)

    return _openai_client


def compute_embedding(
    text: str,
    model: str = DEFAULT_MODEL,
    dimensions: int = DEFAULT_DIMENSIONS
) -> EmbeddingResult:
    """단일 텍스트의 임베딩 생성.

    Args:
        text: 임베딩할 텍스트
        model: 사용할 모델 (기본: text-embedding-3-small)
        dimensions: 임베딩 차원 (기본: 1536)

    Returns:
        EmbeddingResult with embedding vector and metadata
    """
    client = get_openai_client()

    response = client.embeddings.create(
        model=model,
        input=text,
        dimensions=dimensions
    )

    embedding = response.data[0].embedding
    tokens_used = response.usage.total_tokens

    # 비용 계산 (text-embedding-3-small: $0.00002 / 1K tokens)
    cost_cents = (tokens_used / 1000) * 0.002

    return EmbeddingResult(
        embedding=embedding,
        model=model,
        tokens_used=tokens_used,
        cost_cents=cost_cents
    )


def compute_embeddings_batch(
    texts: List[str],
    model: str = DEFAULT_MODEL,
    dimensions: int = DEFAULT_DIMENSIONS,
    batch_size: int = BATCH_SIZE
) -> List[EmbeddingResult]:
    """여러 텍스트의 임베딩을 배치로 생성.

    Args:
        texts: 임베딩할 텍스트 리스트
        model: 사용할 모델
        dimensions: 임베딩 차원
        batch_size: 배치 크기 (기본: 100)

    Returns:
        EmbeddingResult 리스트 (입력 순서 유지)
    """
    client = get_openai_client()
    results = []

    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]

        response = client.embeddings.create(
            model=model,
            input=batch,
            dimensions=dimensions
        )

        tokens_used = response.usage.total_tokens
        tokens_per_text = tokens_used / len(batch)
        cost_per_text = (tokens_per_text / 1000) * 0.002

        for data in response.data:
            results.append(EmbeddingResult(
                embedding=data.embedding,
                model=model,
                tokens_used=int(tokens_per_text),
                cost_cents=cost_per_text
            ))

    return results


def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """두 벡터 간 코사인 유사도 계산.

    Args:
        vec1: 첫 번째 벡터
        vec2: 두 번째 벡터

    Returns:
        코사인 유사도 (-1 ~ 1, 텍스트는 보통 0 ~ 1)
    """
    if len(vec1) != len(vec2):
        raise ValueError("벡터 차원이 다릅니다")

    dot_product = sum(a * b for a, b in zip(vec1, vec2))
    norm1 = sum(a * a for a in vec1) ** 0.5
    norm2 = sum(b * b for b in vec2) ** 0.5

    if norm1 == 0 or norm2 == 0:
        return 0.0

    return dot_product / (norm1 * norm2)


def is_semantic_duplicate(
    vec1: List[float],
    vec2: List[float],
    threshold: float = 0.95
) -> bool:
    """의미적 중복 여부 판단.

    Args:
        vec1: 첫 번째 임베딩
        vec2: 두 번째 임베딩
        threshold: 유사도 임계값 (기본: 0.95)
            - >= 0.95: 거의 동일
            - >= 0.90: 매우 유사
            - >= 0.85: 유사

    Returns:
        중복 여부
    """
    return cosine_similarity(vec1, vec2) >= threshold
