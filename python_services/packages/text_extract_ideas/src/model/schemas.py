from pydantic import BaseModel, Field
from dataclasses import dataclass, field
from typing import List, Optional


class Book(BaseModel):
    """books 테이블 매칭"""
    id: int | None = Field(default=None, description="책 ID (DB 자동생성)")
    title: str = Field(description="책 제목")
    author: str | None = Field(default=None, description="저자")
    source_path: str | None = Field(default=None, description="원본 파일 경로")


class Chapter(BaseModel):
    """chapters 테이블 매칭"""
    id: int | None = Field(default=None, description="챕터 ID (DB 자동생성)")
    book_id: int = Field(description="책 ID (FK)")
    chapter_number: int = Field(description="챕터 순서 번호")
    title: str | None = Field(default=None, description="챕터 제목")
    start_page: int | None = Field(default=None, description="시작 페이지 (PDF 참조용)")
    end_page: int | None = Field(default=None, description="끝 페이지 (PDF 참조용)")
    level: int = Field(default=1, description="계층 레벨 (1=Chapter, 2=Section)")
    parent_chapter_id: int | None = Field(default=None, description="상위 챕터 ID")
    detection_method: str = Field(default="toc", description="감지 방법: toc, pattern, fallback")


class ParagraphChunk(BaseModel):
    """paragraph_chunks 테이블 매칭 (확장)"""
    id: int | None = Field(default=None, description="청크 ID (DB 자동생성)")
    book_id: int | None = Field(default=None, description="책 ID (FK)")
    page_number: int | None = Field(default=None, description="페이지 번호 (호환성)")
    paragraph_index: int | None = Field(default=None, description="전역 문단 인덱스")
    body_text: str = Field(description="원본 문단 텍스트")
    # 챕터 메타데이터 (확장)
    chapter_id: int | None = Field(default=None, description="챕터 ID (FK)")
    chapter_paragraph_index: int | None = Field(default=None, description="챕터 내 문단 인덱스")
    section_id: int | None = Field(default=None, description="섹션 ID (FK)")


class KeyIdea(BaseModel):
    """key_ideas 테이블 매칭 : LLM이 추출하는 핵심 아이디어"""
    id: int | None = Field(default=None, description="아이디어 ID (DB 자동생성)")
    chunk_id: int | None = Field(default=None, description="청크 ID (FK)")
    book_id: int | None = Field(default=None, description="책 ID (FK)")
    core_idea_text: str = Field(description="핵심 아이디어 텍스트")
    idea_group_id: int | None = Field(default=None, description="아이디어 그룹 ID (중복제거용)")


class IdeaGroup(BaseModel):
    """idea_groups 테이블 매칭 (중복 제거용)"""
    id: int | None = Field(default=None, description="그룹 ID (DB 자동생성)")
    canonical_idea_text: str = Field(description="정규화된 대표 아이디어 텍스트")


# LLM 출력용 스키마 (DB 스키마와 별도)
class ExtractedIdea(BaseModel):
    """LLM이 추출하는 핵심 아이디어 (프롬프트 출력용)"""
    concept: str = Field(description="온톨로지 노드 제목 (예: LoRA, Attention, Transformer)")

@dataclass
class DetectedSection:
    """TOC에서 감지한 섹션/서브섹션"""
    title: str
    level: int  # 2=섹션, 3=서브섹션, 4=서브서브섹션
    start_char: int  # 텍스트 내 시작 위치
    end_char: int  # 텍스트 내 끝 위치
    content: str  # 섹션 본문 텍스트
    parent_title: str | None = None  # 상위 섹션 제목
    children: List["DetectedSection"] = field(default_factory=list)  # 하위 섹션들


@dataclass
class DetectedChapter:
    """TOC에서 감지한 챕터"""
    title: str
    chapter_number: int
    start_char: int  # 텍스트 내 시작 위치
    end_char: int  # 텍스트 내 끝 위치
    content: str  # 챕터 본문 텍스트
    sections: List[DetectedSection] = field(default_factory=list)  # 하위 섹션들
    detection_method: str = "toc"


# LLM 출력용 Pydantic 스키마 (문단 분할용)
class ParagraphInfo(BaseModel):
    """문단 정보 (LLM 출력용)"""
    text: str = Field(description="문단 텍스트 (원문 그대로)")
    start_marker: str = Field(default="", description="문단 시작 마커 (처음 30-50자)")


class ParagraphSplitResult(BaseModel):
    """LLM 문단 분할 결과"""
    paragraphs: List[ParagraphInfo] = Field(
        description="분할된 문단 리스트"
    )


# 계층적 청크 (chunker 출력용)
@dataclass
class HierarchicalChunk:
    """계층적 문단 청크 (챕터 컨텍스트 포함)"""
    text: str
    chapter_id: int | None
    chapter_title: str | None
    section_id: int | None = None  # 섹션 ID (DB 저장 후 할당)
    section_title: str | None = None  # 섹션 제목 (LLM 출력)
    paragraph_index: int = 0  # 전역 인덱스
    chapter_paragraph_index: int = 0  # 챕터 내 인덱스
    start_char: int = 0  # 텍스트 내 시작 위치
    end_char: int = 0  # 텍스트 내 끝 위치
    # 계층 정보
    section_level: int = 2  # 레벨 (2=section, 3=subsection)
    detection_method: str = "toc"  # 감지 방법: 'toc'
    parent_section_title: str | None = None  # 상위 섹션 제목
    hierarchy_path: str = ""  # 전체 계층 경로 (예: "Chapter 1 > Section 1.1 > ...")


class SemanticParagraph(BaseModel):
    """LLM이 추출하는 의미 단위 문단"""
    text: str = Field(description="의미적으로 완결된 문단 텍스트 (원문 그대로)")
    concept: str = Field(description="이 문단의 핵심 개념 (기술 용어, 예: Transformer, LoRA)")
    section_title: str | None = Field(
        default=None,
        description="이 문단이 속한 섹션 제목 (예: 'What This Book Is Not'). 섹션이 없으면 null"
    )


class ChunkAndExtractResult(BaseModel):
    """청킹 + 아이디어 추출 통합 결과"""
    paragraphs: List[SemanticParagraph] = Field(
        description="의미 단위로 분할된 문단들 (각각 하나의 핵심 개념 포함)"
    )
