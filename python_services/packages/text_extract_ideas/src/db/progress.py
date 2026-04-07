"""Progress tracking and recovery logic.

챕터 기반 진행 추적.
"""

from typing import List
from datetime import datetime
from sqlalchemy.orm import Session

from src.db.models import ProcessingProgress, Chapter


def initialize_chapter_progress(session: Session, book_id: int, chapters: List[Chapter]) -> None:
    """챕터 기반 진행 추적 초기화.

    Args:
        session: DB 세션
        book_id: 책 ID
        chapters: 챕터 리스트
    """
    # 기존 진행 상황 확인
    existing = (
        session.query(ProcessingProgress)
        .filter_by(book_id=book_id, processing_unit='chapter')
        .first()
    )
    if existing:
        print(f"⚠️  챕터 진행 추적이 이미 초기화됨 (book_id={book_id})")
        return

    # 챕터별 진행 레코드 생성
    progress_records = [
        ProcessingProgress(
            book_id=book_id,
            chapter_id=chapter.id,
            processing_unit='chapter',
            status='pending',
            attempt_count=0,
        )
        for chapter in chapters
    ]

    session.bulk_save_objects(progress_records)
    session.commit()
    print(f"✅ 챕터 진행 추적 초기화 완료: {len(chapters)}개 챕터")


def get_pending_chapters(session: Session, book_id: int) -> List[Chapter]:
    """처리 대기 중인 챕터 조회.

    Args:
        session: DB 세션
        book_id: 책 ID

    Returns:
        대기 중인 Chapter 리스트
    """
    pending_progress = (
        session.query(ProcessingProgress)
        .filter_by(book_id=book_id, processing_unit='chapter', status='pending')
        .all()
    )

    chapter_ids = [p.chapter_id for p in pending_progress]

    if not chapter_ids:
        return []

    return (
        session.query(Chapter)
        .filter(Chapter.id.in_(chapter_ids))
        .order_by(Chapter.chapter_number)
        .all()
    )


def mark_chapter_processing(session: Session, book_id: int, chapter_id: int) -> None:
    """챕터 처리 시작 표시.

    Args:
        session: DB 세션
        book_id: 책 ID
        chapter_id: 챕터 ID
    """
    progress = (
        session.query(ProcessingProgress)
        .filter_by(book_id=book_id, chapter_id=chapter_id, processing_unit='chapter')
        .first()
    )

    if progress:
        progress.status = 'processing'
        progress.last_attempt_at = datetime.utcnow()
        progress.attempt_count += 1
        session.commit()


def mark_chapter_completed(session: Session, book_id: int, chapter_id: int) -> None:
    """챕터 처리 완료 표시.

    Args:
        session: DB 세션
        book_id: 책 ID
        chapter_id: 챕터 ID
    """
    progress = (
        session.query(ProcessingProgress)
        .filter_by(book_id=book_id, chapter_id=chapter_id, processing_unit='chapter')
        .first()
    )

    if progress:
        progress.status = 'completed'
        progress.completed_at = datetime.utcnow()
        session.commit()


def mark_chapter_failed(
    session: Session,
    book_id: int,
    chapter_id: int,
    error_message: str
) -> None:
    """챕터 처리 실패 표시.

    Args:
        session: DB 세션
        book_id: 책 ID
        chapter_id: 챕터 ID
        error_message: 오류 메시지
    """
    progress = (
        session.query(ProcessingProgress)
        .filter_by(book_id=book_id, chapter_id=chapter_id, processing_unit='chapter')
        .first()
    )

    if progress:
        progress.status = 'failed'
        progress.error_message = error_message
        session.commit()


def get_chapter_progress_stats(session: Session, book_id: int) -> dict:
    """챕터 기반 진행 통계 조회.

    Args:
        session: DB 세션
        book_id: 책 ID

    Returns:
        진행 통계 딕셔너리
    """
    base_query = session.query(ProcessingProgress).filter_by(
        book_id=book_id,
        processing_unit='chapter'
    )

    total = base_query.count()
    pending = base_query.filter_by(status='pending').count()
    processing = base_query.filter_by(status='processing').count()
    completed = base_query.filter_by(status='completed').count()
    failed = base_query.filter_by(status='failed').count()

    completion_rate = (completed / total * 100) if total > 0 else 0

    return {
        'total_chapters': total,
        'pending': pending,
        'processing': processing,
        'completed': completed,
        'failed': failed,
        'completion_rate': completion_rate,
    }


def reset_stuck_chapters(session: Session, book_id: int) -> int:
    """처리 중 멈춘 챕터를 대기 상태로 리셋.

    Args:
        session: DB 세션
        book_id: 책 ID

    Returns:
        리셋된 챕터 수
    """
    stuck = (
        session.query(ProcessingProgress)
        .filter_by(book_id=book_id, processing_unit='chapter', status='processing')
        .all()
    )

    for progress in stuck:
        progress.status = 'pending'

    session.commit()
    return len(stuck)
