#!/usr/bin/env python3
"""특정 챕터만 처리하는 PDF 파이프라인 실행 스크립트.

Usage:
    python run_chapters.py <pdf_path> <chapter_numbers> [model_version]

Examples:
    python run_chapters.py "AI Engineering.pdf" "9,10"
    python run_chapters.py "AI Engineering.pdf" "9,10" gemini-2.5-flash
"""
import sys
import io
import warnings

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

warnings.filterwarnings('ignore')

from dotenv import load_dotenv
load_dotenv()

from src.workflow.state import create_initial_state
from src.workflow.nodes.extract_text import extract_text
from src.workflow.nodes.detect_structure import detect_structure
from src.workflow.nodes.create_book import create_book_node
from src.workflow.nodes.process_section import process_section, route_sections
from src.workflow.nodes.finalize import finalize
from src.utils.pdf.hierarchy_detector import get_leaf_sections


def _matches_chapter(chapter, chapter_numbers: list[int]) -> bool:
    """챕터 번호 매칭: 제목에서 'Chapter N' 패턴 또는 내부 chapter_number로 매칭."""
    import re
    # 제목에서 "Chapter N" 패턴 추출 (e.g. "Chapter 9. Inference Optimization")
    m = re.search(r'Chapter\s+(\d+)', chapter.title, re.IGNORECASE)
    if m:
        return int(m.group(1)) in chapter_numbers
    # 폴백: 내부 chapter_number로 비교
    return chapter.chapter_number in chapter_numbers


def run_pipeline_for_chapters(
    pdf_path: str,
    chapter_numbers: list[int],
    model_version: str = "gemini-2.5-flash",
) -> dict:
    """지정한 챕터 번호만 처리하는 파이프라인.

    chapter_numbers는 책의 챕터 번호 (제목 기준)를 사용합니다.
    예: [9, 10] → "Chapter 9. ...", "Chapter 10. ..."
    """

    print(f"📄 PDF: {pdf_path}")
    print(f"📖 챕터 필터: {chapter_numbers}")
    print(f"🤖 Model: {model_version}")
    print()

    # 1. 초기 상태 생성
    state = create_initial_state(
        pdf_path=pdf_path,
        model_version=model_version,
    )

    # 2. 텍스트 추출
    print("🔍 텍스트 추출 중...")
    state = extract_text(state)
    if state.get("error"):
        print(f"❌ 텍스트 추출 실패: {state['error']}")
        return {"error": state["error"]}

    # 3. 구조 감지
    print("📐 구조 감지 중...")
    state = detect_structure(state)
    if state.get("error"):
        print(f"❌ 구조 감지 실패: {state['error']}")
        return {"error": state["error"]}

    # 4. 챕터 필터링 (제목의 "Chapter N" 번호 기준)
    all_chapters = state.get("chapters", [])
    filtered_chapters = [c for c in all_chapters if _matches_chapter(c, chapter_numbers)]

    if not filtered_chapters:
        print("❌ 지정한 챕터를 찾을 수 없습니다. 감지된 챕터 목록:")
        for c in all_chapters:
            print(f"   [{c.chapter_number}] {c.title}")
        return {"error": "chapter not found"}

    print(f"\n✅ 필터링된 챕터:")
    for c in filtered_chapters:
        print(f"   Chapter {c.chapter_number}: {c.title}")

    # filtered 챕터로 all_sections 재구성
    filtered_sections = []
    for chapter in filtered_chapters:
        leaf_sections = get_leaf_sections(chapter)
        for section, hierarchy_path in leaf_sections:
            filtered_sections.append({
                "chapter": chapter,
                "chapter_id": None,
                "section": section,
                "section_id": None,
                "hierarchy_path": hierarchy_path,
            })

    stats = state.get("stats", {})
    stats["total_chapters"] = len(filtered_chapters)
    stats["total_sections"] = len(filtered_sections)

    state = {
        **state,
        "chapters": filtered_chapters,
        "all_sections": filtered_sections,
        "current_section_index": 0,
        "stats": stats,
    }

    # 5. DB에 책/챕터/섹션 저장
    print(f"\n💾 DB 저장 중...")
    state = create_book_node(state)
    if state.get("error"):
        print(f"❌ DB 저장 실패: {state['error']}")
        return {"error": state["error"]}

    # 6. 섹션 순회 처리
    print(f"\n⚙️  섹션 처리 시작 ({len(state.get('all_sections', []))}개 섹션)...")
    while route_sections(state) == "continue":
        state = process_section(state)

    # 7. 마무리
    state = finalize(state)

    return state.get("stats", {})


def main():
    if len(sys.argv) < 3:
        print("Usage: python run_chapters.py <pdf_path> <chapter_numbers> [model_version]")
        print("Example: python run_chapters.py 'AI Engineering.pdf' '9,10'")
        sys.exit(1)

    pdf_path = sys.argv[1]
    chapter_numbers = [int(n.strip()) for n in sys.argv[2].split(",")]
    model_version = sys.argv[3] if len(sys.argv) > 3 else "gemini-2.5-flash"

    result = run_pipeline_for_chapters(
        pdf_path=pdf_path,
        chapter_numbers=chapter_numbers,
        model_version=model_version,
    )

    if isinstance(result, dict) and result.get("error"):
        print(f"\n❌ Error: {result['error']}")
        sys.exit(1)


if __name__ == "__main__":
    main()
