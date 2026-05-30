"""중복 제거 서비스 - 해시 및 임베딩 기반 중복 탐지"""

from dataclasses import dataclass
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import text

from python_services.packages.text_extract_ideas.src.db.models import ParagraphChunk, ParagraphEmbedding
from python_services.packages.text_extract_ideas.src.dedup.hash_utils import compute_paragraph_hash, compute_simhash64, hamming_distance


@dataclass
class DeduplicationResult:
    """중복 체크 결과"""
    is_duplicate: bool
    duplicate_type: Optional[str] = None  # 'exact', 'fuzzy', 'semantic', None
    existing_chunk_id: Optional[int] = None
    similarity_score: Optional[float] = None
    hamming_distance: Optional[int] = None


class DeduplicationService:
    """중복 제거 서비스.

    다단계 중복 탐지:
    1. 정확 해시 매칭 (가장 빠름)
    2. SimHash 퍼지 매칭
    3. 임베딩 의미적 매칭 (선택적, 가장 느림)
    """

    def __init__(
        self,
        session: Session, #DB세션
        fuzzy_threshold: int = 6, #SimHash 해밍 거리 임계값 (기본: 6)
        semantic_threshold: float = 0.95, #코사인 유사도 임계값 (기본: 0.95)
        enable_semantic: bool = False #기본 false, 비용 발생
    ):
        """초기화"""
        self.session = session
        self.fuzzy_threshold = fuzzy_threshold
        self.semantic_threshold = semantic_threshold
        self.enable_semantic = enable_semantic

    def check_duplicate(
        self,
        text: str,
        book_id: Optional[int] = None,
        cross_book: bool = True
    ) -> DeduplicationResult:
        """텍스트의 중복 여부 체크.

        Args:
            text: 체크할 텍스트
            book_id: 현재 책 ID (같은 책 내 중복만 체크 시 사용)
            cross_book: 모든 책에서 중복 체크 (기본: True)

        Returns:
            DeduplicationResult
        """
        paragraph_hash = compute_paragraph_hash(text)
        simhash64 = compute_simhash64(text)

        # 1. 정확 해시 매칭
        exact_match = self.find_exact_duplicate(paragraph_hash, book_id, cross_book)
        if exact_match:
            return DeduplicationResult(
                is_duplicate=True,
                duplicate_type='exact',
                existing_chunk_id=exact_match,
                similarity_score=1.0
            )

        # 2. 퍼지 매칭
        fuzzy_matches = self.find_fuzzy_duplicates(simhash64, book_id, cross_book)
        if fuzzy_matches:
            best_match = fuzzy_matches[0]  # 가장 유사한 것
            return DeduplicationResult(
                is_duplicate=True,
                duplicate_type='fuzzy',
                existing_chunk_id=best_match[0],
                hamming_distance=best_match[1],
                similarity_score=1 - (best_match[1] / 64)  # 해밍 거리를 유사도로 변환
            )

        # 3. 의미적 매칭 (활성화된 경우)
        if self.enable_semantic:
            semantic_match = self.find_semantic_duplicate(text, book_id, cross_book)
            if semantic_match:
                return DeduplicationResult(
                    is_duplicate=True,
                    duplicate_type='semantic',
                    existing_chunk_id=semantic_match[0],
                    similarity_score=semantic_match[1]
                )

        return DeduplicationResult(is_duplicate=False)

    def find_exact_duplicate(
        self,
        paragraph_hash: str,
        book_id: Optional[int] = None,
        cross_book: bool = True
    ) -> Optional[int]:
        """정확 해시로 중복 찾기.

        Args:
            paragraph_hash: SHA-256 해시
            book_id: 책 ID
            cross_book: 모든 책에서 검색

        Returns:
            중복 청크 ID 또는 None
        """
        query = self.session.query(ParagraphChunk.id).filter(
            ParagraphChunk.paragraph_hash == paragraph_hash
        )

        if not cross_book and book_id:
            query = query.filter(ParagraphChunk.book_id == book_id)

        result = query.first()
        return result[0] if result else None

    def find_fuzzy_duplicates(
        self,
        simhash64: int,
        book_id: Optional[int] = None,
        cross_book: bool = True,
        limit: int = 10
    ) -> List[Tuple[int, int]]:
        """SimHash로 퍼지 중복 찾기.

        PostgreSQL의 비트 연산을 사용하여 해밍 거리 계산.

        Args:
            simhash64: SimHash 값
            book_id: 책 ID
            cross_book: 모든 책에서 검색
            limit: 최대 결과 수

        Returns:
            [(chunk_id, hamming_distance), ...] 리스트 (거리순 정렬)
        """
        # PostgreSQL에서 해밍 거리 계산
        # bit_count((simhash64 # $1)::bit(64))
        sql = """
            SELECT id, simhash64,
                   bit_count((simhash64 # :target)::bit(64))::int as hamming_dist
            FROM paragraph_chunks
            WHERE simhash64 IS NOT NULL
              AND bit_count((simhash64 # :target)::bit(64))::int <= :threshold
        """

        if not cross_book and book_id:
            sql += " AND book_id = :book_id"

        sql += " ORDER BY hamming_dist ASC LIMIT :limit"

        params = {
            'target': simhash64,
            'threshold': self.fuzzy_threshold,
            'limit': limit
        }
        if not cross_book and book_id:
            params['book_id'] = book_id

        try:
            result = self.session.execute(text(sql), params)
            return [(row[0], row[2]) for row in result]
        except Exception:
            # PostgreSQL bit_count 미지원 시 Python으로 폴백
            return self._find_fuzzy_duplicates_fallback(simhash64, book_id, cross_book, limit)

    def _find_fuzzy_duplicates_fallback(
        self,
        simhash64: int,
        book_id: Optional[int] = None,
        cross_book: bool = True,
        limit: int = 10
    ) -> List[Tuple[int, int]]:
        """Python 기반 퍼지 중복 찾기 (폴백)."""
        query = self.session.query(
            ParagraphChunk.id,
            ParagraphChunk.simhash64
        ).filter(ParagraphChunk.simhash64.isnot(None))

        if not cross_book and book_id:
            query = query.filter(ParagraphChunk.book_id == book_id)

        results = []
        for chunk_id, stored_hash in query.all():
            dist = hamming_distance(simhash64, stored_hash)
            if dist <= self.fuzzy_threshold:
                results.append((chunk_id, dist))

        results.sort(key=lambda x: x[1])
        return results[:limit]

    def find_semantic_duplicate(
        self,
        text: str,
        book_id: Optional[int] = None,
        cross_book: bool = True
    ) -> Optional[Tuple[int, float]]:
        """임베딩 기반 의미적 중복 찾기.

        pgvector의 코사인 유사도 검색 사용.

        Args:
            text: 검색할 텍스트
            book_id: 책 ID
            cross_book: 모든 책에서 검색

        Returns:
            (chunk_id, similarity) 또는 None
        """
        from python_services.packages.text_extract_ideas.src.dedup.embedding_utils import compute_embedding

        # 임베딩 생성
        result = compute_embedding(text)
        embedding = result.embedding

        # pgvector 코사인 유사도 검색
        sql = """
            SELECT chunk_id, 1 - (embedding <=> :embedding::vector) as similarity
            FROM paragraph_embeddings
            WHERE 1 - (embedding <=> :embedding::vector) >= :threshold
        """

        if not cross_book and book_id:
            sql += " AND book_id = :book_id"

        sql += " ORDER BY similarity DESC LIMIT 1"

        params = {
            'embedding': str(embedding),
            'threshold': self.semantic_threshold
        }
        if not cross_book and book_id:
            params['book_id'] = book_id

        try:
            result = self.session.execute(text(sql), params)
            row = result.first()
            if row:
                return (row[0], row[1])
        except Exception:
            pass

        return None

    def compute_and_check(
        self,
        text: str,
        book_id: Optional[int] = None
    ) -> Tuple[str, int, DeduplicationResult]:
        """해시 계산과 중복 체크를 한번에 수행.

        Args:
            text: 체크할 텍스트
            book_id: 책 ID

        Returns:
            (paragraph_hash, simhash64, DeduplicationResult)
        """
        paragraph_hash = compute_paragraph_hash(text)
        simhash64 = compute_simhash64(text)
        result = self.check_duplicate(text, book_id)

        return paragraph_hash, simhash64, result
