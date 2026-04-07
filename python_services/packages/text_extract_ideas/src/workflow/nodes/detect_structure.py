from src.workflow.state import PipelineState
from src.utils.pdf.hierarchy_detector import (
    detect_chapters_from_toc,
    get_leaf_sections,
)


def detect_structure(state: PipelineState) -> PipelineState:
    """
    TOC 기반 챕터/섹션 구조 감지.
    PDF에서 추출한 TOC를 분석하여 챕터/섹션 계층 구조를 생성하고,
    """
    if not state.get("has_toc"):
        return {
            **state,
            "error": "PDF에 TOC가 없습니다. TOC가 있는 PDF만 지원됩니다.",
        }

    pdf_path = state.get("pdf_path")
    plain_text = state.get("plain_text", "")
    page_positions = state.get("page_positions", [])

    try:
        # TOC 기반 챕터/섹션 구조 감지
        chapters = detect_chapters_from_toc(
            pdf_path=pdf_path,
            plain_text=plain_text,
            page_positions=page_positions,
        )

        if not chapters:
            return {
                **state,
                "error": "챕터를 감지하지 못했습니다.",
            }

        # 모든 leaf 섹션을 flat list로 준비
        # (chapter_id, section_id는 create_book 노드에서 DB 저장 후 설정)
        all_sections = []
        for chapter in chapters:
            leaf_sections = get_leaf_sections(chapter)
            for section, hierarchy_path in leaf_sections:
                all_sections.append({
                    "chapter": chapter,
                    "chapter_id": None,  # create_book에서 설정
                    "section": section,
                    "section_id": None,  # create_book에서 설정
                    "hierarchy_path": hierarchy_path,
                })

        # 통계 업데이트
        stats = state.get("stats", {})
        stats["total_chapters"] = len(chapters)
        stats["total_sections"] = len(all_sections)

        # 로그 출력
        print(f"📚 {len(chapters)}개 챕터, {len(all_sections)}개 섹션 감지됨")
        for chapter in chapters:
            section_count = _count_sections(chapter.sections)
            print(f"   # {chapter.title} ({section_count} sections)")

        return {
            **state,
            "chapters": chapters,
            "all_sections": all_sections,
            "current_section_index": 0,
            "stats": stats,
        }

    except Exception as e:
        return {
            **state,
            "error": f"구조 감지 실패: {str(e)}",
        }


def _count_sections(sections) -> int:
    """섹션 수 재귀 카운트."""
    count = len(sections)
    for section in sections:
        count += _count_sections(section.children)
    return count
