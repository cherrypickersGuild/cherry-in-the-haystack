from sqlalchemy import Column, Integer, Text, ForeignKey, String, Sequence
from sqlalchemy.dialects.postgresql import TIMESTAMP
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func

Base = declarative_base()


class Book(Base):
    """책 정보 테이블 (서버 PostgreSQL 스키마와 일치)"""

    __tablename__ = "books"

    id = Column(Integer, Sequence('books_id_seq'), primary_key=True)
    title = Column(Text, nullable=False)
    author = Column(Text)
    source_path = Column(Text)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class Chapter(Base):
    """챕터 정보 테이블 (신규)

    PDF의 챕터/섹션 구조를 저장.
    TOC 또는 패턴 기반으로 감지된 챕터 정보.
    """

    __tablename__ = "chapters"

    id = Column(Integer, Sequence('chapters_id_seq'), primary_key=True)
    book_id = Column(Integer, ForeignKey("books.id"), nullable=False)
    chapter_number = Column(Integer)  # 챕터 순서
    title = Column(Text)  # 챕터 제목
    start_page = Column(Integer)  # 원본 PDF 시작 페이지 (참조용)
    end_page = Column(Integer)  # 원본 PDF 끝 페이지 (참조용)
    level = Column(Integer, default=1)  # 계층 레벨 (1=Chapter, 2=Section)
    parent_chapter_id = Column(Integer, ForeignKey("chapters.id"))  # 상위 챕터 (중첩 구조용)
    detection_method = Column(String(50))  # 감지 방법: 'toc', 'pattern', 'fallback'
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class Section(Base):
    """섹션 정보 테이블

    챕터 내 서브섹션 (예: "The Rise of AI Engineering", "Language models")
    LLM이 감지한 섹션 제목을 정규화하여 저장.
    """

    __tablename__ = "sections"

    id = Column(Integer, Sequence('sections_id_seq'), primary_key=True)
    chapter_id = Column(Integer, ForeignKey("chapters.id"), nullable=False)
    book_id = Column(Integer, ForeignKey("books.id"), nullable=False)
    section_number = Column(Integer)  # 챕터 내 섹션 순서
    title = Column(Text, nullable=False)  # 섹션 제목 (예: "Language models")
    level = Column(Integer, default=1)  # 섹션 깊이 (1=직계, 2=하위 등)
    parent_section_id = Column(Integer, ForeignKey("sections.id"))  # 중첩 섹션용
    detection_method = Column(String(50), default='llm')  # 'llm', 'toc', 'pattern'
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class ParagraphChunk(Base):
    """문단(청크) 테이블
    기존 컬럼 유지 + 챕터 메타데이터 확장.
    """

    __tablename__ = "paragraph_chunks"

    # 기존 컬럼 (유지)
    id = Column(Integer, Sequence('paragraph_chunks_id_seq'), primary_key=True)
    book_id = Column(Integer, ForeignKey("books.id"))
    page_number = Column(Integer)  # 유지 (호환성)
    paragraph_index = Column(Integer)  # 전역 문단 인덱스
    body_text = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    # 추가 컬럼 (챕터 메타데이터)
    chapter_id = Column(Integer, ForeignKey("chapters.id"))  # 챕터 참조
    chapter_paragraph_index = Column(Integer)  # 챕터 내 문단 인덱스
    section_id = Column(Integer, ForeignKey("sections.id"))  # 섹션 참조 (정규화)


class IdeaGroup(Base):
    """아이디어 묶음 (중복 제거용) - 기존 스키마 유지"""

    __tablename__ = "idea_groups"

    id = Column(Integer, Sequence('idea_groups_id_seq'), primary_key=True)
    canonical_idea_text = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class KeyIdea(Base):
    """핵심 아이디어 테이블
    core_idea_text에 concept(영어 기술 용어)를 저장
    예: "Transformer", "LoRA", "RAG"
    """

    __tablename__ = "key_ideas"

    id = Column(Integer, Sequence('key_ideas_id_seq'), primary_key=True)
    chunk_id = Column(Integer, ForeignKey("paragraph_chunks.id"))
    book_id = Column(Integer, ForeignKey("books.id"))
    core_idea_text = Column(Text, nullable=False)  # concept를 여기에 저장
    idea_group_id = Column(Integer, ForeignKey("idea_groups.id"))
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class ProcessingProgress(Base):
    """처리 진행상황 테이블
    기존 페이지 기반 + 챕터 기반 진행 추적 지원.
    """

    __tablename__ = "processing_progress"

    # 기존 컬럼 (유지)
    id = Column(Integer, Sequence('processing_progress_id_seq'), primary_key=True)
    book_id = Column(Integer, ForeignKey("books.id"))
    page_number = Column(Integer)  # 유지 (호환성)
    status = Column(String(50))  # 'pending', 'processing', 'completed', 'failed'
    error_message = Column(Text)
    attempt_count = Column(Integer, default=0)
    last_attempt_at = Column(TIMESTAMP(timezone=True))
    completed_at = Column(TIMESTAMP(timezone=True))
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())

    # 추가 컬럼 (챕터 기반 추적)
    chapter_id = Column(Integer, ForeignKey("chapters.id"))  # 챕터 기반 진행 추적
    processing_unit = Column(String(50), default='page')  # 'page' or 'chapter'
