from typing import List, Optional
from sqlalchemy.orm import Session

from src.db.models import Book, Chapter, Section, ParagraphChunk, KeyIdea, ProcessingProgress
from src.model.schemas import DetectedChapter, DetectedSection, HierarchicalChunk


def create_book(session: Session, title: str, author: str = None, source_path: str = None) -> Book:
    book = Book(
        title=title,
        author=author,
        source_path=source_path,
    )
    session.add(book)
    session.commit()
    session.refresh(book)
    return book


def save_chunks_batch(session: Session, chunks: List[ParagraphChunk]) -> None:
    
    session.bulk_save_objects(chunks)
    session.commit()


def save_ideas_batch(session: Session, ideas: List[dict]) -> None:
   
    session.bulk_insert_mappings(KeyIdea, ideas)
    session.commit()


def get_book_by_id(session: Session, book_id: int) -> Book:
    
    return session.query(Book).filter_by(id=book_id).first()


def get_book_by_title(session: Session, title: str) -> Book:
    
    return session.query(Book).filter_by(title=title).first()


def is_book_processed(session: Session, book_id: int) -> bool:
    
    total = session.query(ProcessingProgress).filter_by(book_id=book_id).count()
    completed = session.query(ProcessingProgress).filter_by(
        book_id=book_id,
        status="completed"
    ).count()
    return total > 0 and total == completed


def get_chunks_by_book(session: Session, book_id: int) -> List[ParagraphChunk]:
    
    return session.query(ParagraphChunk).filter_by(book_id=book_id).order_by(ParagraphChunk.page_number, ParagraphChunk.paragraph_index).all()


def get_ideas_by_book(session: Session, book_id: int) -> List[KeyIdea]:
    
    return session.query(KeyIdea).filter_by(book_id=book_id).all()


# ============================================================
# 챕터 관련 CRUD 함수
# ============================================================

def create_chapter(
    session: Session,
    book_id: int,
    chapter_number: int,
    title: Optional[str] = None,
    start_page: Optional[int] = None,
    end_page: Optional[int] = None,
    level: int = 1,
    parent_chapter_id: Optional[int] = None,
    detection_method: str = "pattern"
) -> Chapter:
    """챕터 레코드 생성.

    Args:
        session: DB 세션
        book_id: 책 ID
        chapter_number: 챕터 순서
        title: 챕터 제목
        start_page: 시작 페이지
        end_page: 끝 페이지
        level: 계층 레벨 (1=Chapter, 2=Section)
        parent_chapter_id: 상위 챕터 ID
        detection_method: 감지 방법 ('toc', 'pattern', 'fallback')

    Returns:
        생성된 Chapter 객체
    """
    chapter = Chapter(
        book_id=book_id,
        chapter_number=chapter_number,
        title=title,
        start_page=start_page,
        end_page=end_page,
        level=level,
        parent_chapter_id=parent_chapter_id,
        detection_method=detection_method,
    )
    session.add(chapter)
    session.commit()
    session.refresh(chapter)
    return chapter


def create_chapters_from_detected(
    session: Session,
    book_id: int,
    detected_chapters: List[DetectedChapter]
) -> List[Chapter]:
    """감지된 챕터 리스트를 DB에 저장.

    Args:
        session: DB 세션
        book_id: 책 ID
        detected_chapters: DetectedChapter 리스트

    Returns:
        생성된 Chapter 객체 리스트
    """
    chapters = []
    for i, detected in enumerate(detected_chapters):
        chapter = Chapter(
            book_id=book_id,
            chapter_number=i + 1,
            title=detected.title,
            start_page=detected.start_page,
            end_page=detected.end_page,
            level=detected.level,
            detection_method=detected.detection_method,
        )
        session.add(chapter)
        chapters.append(chapter)

    session.commit()

    # ID 갱신을 위해 refresh
    for chapter in chapters:
        session.refresh(chapter)

    return chapters


def get_chapters_by_book(session: Session, book_id: int) -> List[Chapter]:
    """책의 모든 챕터 조회.

    Args:
        session: DB 세션
        book_id: 책 ID

    Returns:
        Chapter 리스트 (chapter_number 순)
    """
    return (
        session.query(Chapter)
        .filter_by(book_id=book_id)
        .order_by(Chapter.chapter_number)
        .all()
    )


def get_chapter_by_id(session: Session, chapter_id: int) -> Optional[Chapter]:
    """챕터 ID로 조회.

    Args:
        session: DB 세션
        chapter_id: 챕터 ID

    Returns:
        Chapter 객체 또는 None
    """
    return session.query(Chapter).filter_by(id=chapter_id).first()


def get_chunks_by_chapter(session: Session, chapter_id: int) -> List[ParagraphChunk]:
    """챕터의 모든 청크 조회.

    Args:
        session: DB 세션
        chapter_id: 챕터 ID

    Returns:
        ParagraphChunk 리스트
    """
    return (
        session.query(ParagraphChunk)
        .filter_by(chapter_id=chapter_id)
        .order_by(ParagraphChunk.chapter_paragraph_index)
        .all()
    )


def save_hierarchical_chunk(
    session: Session,
    book_id: int,
    chunk: HierarchicalChunk
) -> ParagraphChunk:
    """계층적 청크를 DB에 저장.

    Args:
        session: DB 세션
        book_id: 책 ID
        chunk: HierarchicalChunk 객체

    Returns:
        생성된 ParagraphChunk 객체
    """
    db_chunk = ParagraphChunk(
        book_id=book_id,
        chapter_id=chunk.chapter_id,
        section_id=chunk.section_id,
        paragraph_index=chunk.paragraph_index,
        chapter_paragraph_index=chunk.chapter_paragraph_index,
        body_text=chunk.text,
    )
    session.add(db_chunk)
    session.commit()
    session.refresh(db_chunk)
    return db_chunk


def save_hierarchical_chunks_batch(
    session: Session,
    book_id: int,
    chunks: List[HierarchicalChunk]
) -> List[ParagraphChunk]:
    """계층적 청크 배치 저장.

    Args:
        session: DB 세션
        book_id: 책 ID
        chunks: HierarchicalChunk 리스트

    Returns:
        생성된 ParagraphChunk 리스트
    """
    db_chunks = []
    for chunk in chunks:
        db_chunk = ParagraphChunk(
            book_id=book_id,
            chapter_id=chunk.chapter_id,
            section_id=chunk.section_id,
            paragraph_index=chunk.paragraph_index,
            chapter_paragraph_index=chunk.chapter_paragraph_index,
            body_text=chunk.text,
        )
        db_chunks.append(db_chunk)

    session.bulk_save_objects(db_chunks)
    session.commit()
    return db_chunks


def delete_chapters_by_book(session: Session, book_id: int) -> int:
    """책의 모든 챕터 삭제.

    Args:
        session: DB 세션
        book_id: 책 ID

    Returns:
        삭제된 챕터 수
    """
    count = session.query(Chapter).filter_by(book_id=book_id).delete()
    session.commit()
    return count


# ============================================================
# 섹션 관련 CRUD 함수
# ============================================================

def get_or_create_section(
    session: Session,
    chapter_id: int,
    book_id: int,
    title: str,
    section_number: Optional[int] = None,
    level: int = 2,
    parent_section_id: Optional[int] = None,
    detection_method: str = "llm",
) -> Section:
    """섹션 조회 또는 생성 (중복 방지).

    동일 챕터 내 같은 제목의 섹션이 있으면 기존 반환,
    없으면 새로 생성.

    Args:
        session: DB 세션
        chapter_id: 챕터 ID
        book_id: 책 ID
        title: 섹션 제목
        section_number: 섹션 순서 (자동 계산 가능)
        level: 계층 레벨 (2=Section, 3=Subsection)
        parent_section_id: 상위 섹션 ID (Level 3인 경우)
        detection_method: 감지 방법 ('toc', 'llm', 'hybrid')

    Returns:
        Section 객체
    """
    from sqlalchemy.sql import func

    # 기존 섹션 조회
    existing = (
        session.query(Section)
        .filter_by(chapter_id=chapter_id, title=title)
        .first()
    )
    if existing:
        return existing

    # 새 섹션 생성
    if section_number is None:
        # 현재 챕터의 최대 섹션 번호 + 1
        max_num = (
            session.query(func.max(Section.section_number))
            .filter_by(chapter_id=chapter_id)
            .scalar()
        ) or 0
        section_number = max_num + 1

    section = Section(
        chapter_id=chapter_id,
        book_id=book_id,
        section_number=section_number,
        title=title,
        level=level,
        parent_section_id=parent_section_id,
        detection_method=detection_method,
    )
    session.add(section)
    session.flush()  # ID 즉시 할당
    return section


def find_parent_section(
    session: Session,
    chapter_id: int,
    parent_title: Optional[str],
) -> Optional[int]:
    """상위 섹션 ID 찾기.

    Args:
        session: DB 세션
        chapter_id: 챕터 ID
        parent_title: 상위 섹션 제목

    Returns:
        상위 섹션 ID 또는 None
    """
    if not parent_title:
        return None

    parent = (
        session.query(Section)
        .filter_by(chapter_id=chapter_id, title=parent_title)
        .first()
    )
    return parent.id if parent else None


def get_sections_by_chapter(session: Session, chapter_id: int) -> List[Section]:
    """챕터의 모든 섹션 조회.

    Args:
        session: DB 세션
        chapter_id: 챕터 ID

    Returns:
        Section 리스트 (section_number 순)
    """
    return (
        session.query(Section)
        .filter_by(chapter_id=chapter_id)
        .order_by(Section.section_number)
        .all()
    )


def get_section_by_id(session: Session, section_id: int) -> Optional[Section]:
    """섹션 ID로 조회.

    Args:
        session: DB 세션
        section_id: 섹션 ID

    Returns:
        Section 객체 또는 None
    """
    return session.query(Section).filter_by(id=section_id).first()


def get_chunks_by_section(session: Session, section_id: int) -> List[ParagraphChunk]:
    """섹션의 모든 청크 조회.

    Args:
        session: DB 세션
        section_id: 섹션 ID

    Returns:
        ParagraphChunk 리스트
    """
    return (
        session.query(ParagraphChunk)
        .filter_by(section_id=section_id)
        .order_by(ParagraphChunk.chapter_paragraph_index)
        .all()
    )


def delete_sections_by_chapter(session: Session, chapter_id: int) -> int:
    """챕터의 모든 섹션 삭제.

    Args:
        session: DB 세션
        chapter_id: 챕터 ID

    Returns:
        삭제된 섹션 수
    """
    count = session.query(Section).filter_by(chapter_id=chapter_id).delete()
    session.commit()
    return count


# ============================================================
# LLM 기반 CRUD 함수
# ============================================================

# 챕터 번호 추적을 위한 모듈 레벨 카운터
_chapter_counter = 0


def create_chapter_from_llm(
    session: Session,
    book_id: int,
    chapter: DetectedChapter,
) -> Chapter:
    """LLM 감지 결과로 챕터 레코드 생성.

    Args:
        session: DB 세션
        book_id: 책 ID
        chapter: DetectedChapter 객체

    Returns:
        생성된 Chapter 객체
    """
    global _chapter_counter
    _chapter_counter += 1

    db_chapter = Chapter(
        book_id=book_id,
        chapter_number=chapter.chapter_number or _chapter_counter,
        title=chapter.title,
        level=1,  # 챕터는 항상 레벨 1
        detection_method=chapter.detection_method or "llm",
    )
    session.add(db_chapter)
    session.flush()  # ID 즉시 할당
    return db_chapter


def create_section_from_llm(
    session: Session,
    chapter_id: int,
    book_id: int,
    section: DetectedSection,
) -> Section:
    """LLM 감지 결과로 섹션 레코드 생성.

    Args:
        session: DB 세션
        chapter_id: 챕터 ID
        book_id: 책 ID
        section: DetectedSection 객체

    Returns:
        생성된 Section 객체
    """
    from sqlalchemy.sql import func

    # 현재 챕터의 최대 섹션 번호 + 1
    max_num = (
        session.query(func.max(Section.section_number))
        .filter_by(chapter_id=chapter_id)
        .scalar()
    ) or 0
    section_number = max_num + 1

    # 상위 섹션 ID 찾기
    parent_section_id = None
    if section.parent_title:
        parent_section_id = find_parent_section(
            session, chapter_id, section.parent_title
        )

    db_section = Section(
        chapter_id=chapter_id,
        book_id=book_id,
        section_number=section_number,
        title=section.title,
        level=section.level,
        parent_section_id=parent_section_id,
        detection_method="llm",
    )
    session.add(db_section)
    session.flush()  # ID 즉시 할당
    return db_section


def reset_chapter_counter() -> None:
    """챕터 카운터 초기화 (새 책 처리 시작 시 호출)."""
    global _chapter_counter
    _chapter_counter = 0


# ============================================================
# 섹션 계층 저장 함수
# ============================================================

def save_all_sections_recursive(
    session: Session,
    chapter_id: int,
    book_id: int,
    sections: List[DetectedSection],
    parent_section_id: Optional[int] = None,
) -> dict:
    """
    섹션 트리를 재귀적으로 DB에 저장.

    모든 레벨의 섹션(L2, L3, L4...)을 저장하여
    parent_section_id로 계층 구조를 유지.

    Args:
        session: DB 세션
        chapter_id: 챕터 ID
        book_id: 책 ID
        sections: DetectedSection 리스트
        parent_section_id: 부모 섹션 ID (재귀 호출용)

    Returns:
        {section_title: section_id} 매핑
    """
    from sqlalchemy.sql import func

    section_id_map = {}

    for section in sections:
        # 현재 챕터의 최대 섹션 번호 + 1
        max_num = (
            session.query(func.max(Section.section_number))
            .filter_by(chapter_id=chapter_id)
            .scalar()
        ) or 0
        section_number = max_num + 1

        # 현재 섹션 저장
        db_section = Section(
            chapter_id=chapter_id,
            book_id=book_id,
            section_number=section_number,
            title=section.title,
            level=section.level,
            parent_section_id=parent_section_id,
            detection_method="toc",
        )
        session.add(db_section)
        session.flush()  # ID 즉시 할당

        section_id_map[section.title] = db_section.id

        # 자식 섹션 재귀 저장
        if section.children:
            child_map = save_all_sections_recursive(
                session=session,
                chapter_id=chapter_id,
                book_id=book_id,
                sections=section.children,
                parent_section_id=db_section.id,
            )
            section_id_map.update(child_map)

    return section_id_map
