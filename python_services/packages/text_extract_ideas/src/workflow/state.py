from typing import TypedDict, List, Optional
from pydantic import BaseModel, Field

from src.model.schemas import (
    ParagraphChunk,
    ExtractedIdea,
    HierarchicalChunk,
    DetectedChapter,
    DetectedSection,
)


# PipelineState: 전체 PDF 처리 파이프라인용 (TypedDict)
class SectionInfo(TypedDict):
    """섹션 처리를 위한 정보 구조."""
    chapter: DetectedChapter
    chapter_id: int  # DB chapter ID
    section: DetectedSection
    section_id: int  # DB section ID
    hierarchy_path: str


class PipelineState(TypedDict, total=False):
    """
    PDF 처리 파이프라인 전체 상태.

    LangGraph에서 TypedDict 사용 권장.
    total=False로 모든 필드를 optional로 설정.
    """
    # ─── 입력 ───
    pdf_path: str
    book_id: Optional[int]
    resume: bool

    # ─── PDF 추출 결과 ───
    metadata: Optional[dict]  # title, author, total_pages
    plain_text: Optional[str]  # pymupdf로 추출한 순수 텍스트
    toc: Optional[List]  # TOC 항목 리스트
    has_toc: bool  # TOC 존재 여부
    page_positions: Optional[List]  # 페이지별 문자 위치 정보

    # ─── 구조 감지 결과 ───
    chapters: List[DetectedChapter]  # 감지된 챕터 리스트

    # ─── 섹션 순회 (그래프 루프용) ───
    all_sections: List[SectionInfo]  # 처리할 모든 leaf 섹션 (flattened)
    current_section_index: int  # 현재 처리 중인 섹션 인덱스

    # ─── 현재 처리 컨텍스트 ───
    current_chapter: Optional[DetectedChapter]
    current_chapter_id: Optional[int]
    current_section: Optional[DetectedSection]
    current_section_id: Optional[int]
    current_section_text: Optional[str]
    hierarchy_path: Optional[str]

    # ─── 문단 처리 ───
    chunks: List[HierarchicalChunk]
    current_chunk_index: int
    current_chunk: Optional[HierarchicalChunk]
    extracted_concepts: Optional[dict]

    # ─── 아이디어 추출 ───
    extracted_idea: Optional[ExtractedIdea]
    is_duplicate: bool
    saved_chunk_id: Optional[int]

    # ─── 결과/통계 ───
    stats: dict
    error: Optional[str]

    # ─── 설정 ───
    model_version: str


def create_initial_state(
    pdf_path: str,
    book_id: Optional[int] = None,
    resume: bool = False,
    model_version: str = "gemini-2.5-flash",
) -> PipelineState:
    """초기 PipelineState 생성."""
    return PipelineState(
        pdf_path=pdf_path,
        book_id=book_id,
        resume=resume,
        model_version=model_version,
        # 기본값 설정
        chapters=[],
        all_sections=[],
        current_section_index=0,
        chunks=[],
        current_chunk_index=0,
        has_toc=False,
        is_duplicate=False,
        stats={
            "total_chapters": 0,
            "total_sections": 0,
            "completed_sections": 0,
            "failed_sections": 0,
            "total_paragraphs": 0,
            "total_ideas": 0,
            "duplicates_skipped": 0,
            "detection_method": "toc",
        },
    )



# State: 개별 아이디어 추출용 (Pydantic)
class State(BaseModel):
    """개별 청크의 아이디어 추출 상태."""
    chunk: ParagraphChunk = Field(description="입력 문단 청크")
    result: ExtractedIdea | None = Field(default=None, description="추출된 핵심 아이디어")
    error: str | None = Field(default=None, description="에러 메시지")

    # 메타데이터 (DB 저장용)
    book_id: int | None = Field(default=None, description="책 ID")
    chunk_id: int | None = Field(default=None, description="저장된 청크 ID")
    model_version: str = Field(default="gemini-2.5-flash", description="LLM 모델 버전")
