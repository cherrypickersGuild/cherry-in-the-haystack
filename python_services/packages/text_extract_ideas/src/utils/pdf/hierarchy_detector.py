import re
from typing import List, Tuple, Optional, Dict, Any

from langchain_core.prompts import ChatPromptTemplate

from src.model.model import get_default_llm
from src.model.schemas import (
    DetectedChapter,
    DetectedSection,
    ParagraphSplitResult,
)
from src.prompts.hierarchy_detection import (
    PARAGRAPH_SPLIT_PROMPT,
    PARAGRAPH_SPLIT_HUMAN,
)
from src.utils.pdf.parser import extract_toc, extract_text_with_page_positions, extract_full_text


# 설정
MAX_TEXT_FOR_PARAGRAPH_SPLIT = 10000  # 문단 분할용 최대 텍스트 길이
MIN_SECTION_LENGTH = 100  # 최소 섹션 길이


def detect_chapters_from_toc(
    pdf_path: str,
    plain_text: Optional[str] = None,
    page_positions: Optional[List[Tuple[int, int, int, str]]] = None,
) -> List[DetectedChapter]:
    """PDF TOC에서 챕터/섹션 구조 추출"""
    # 필요시 텍스트/위치 정보 추출
    if plain_text is None:
        plain_text = extract_full_text(pdf_path)

    if page_positions is None:
        page_positions = extract_text_with_page_positions(pdf_path)

    # TOC 추출
    toc_entries = extract_toc(pdf_path)

    if not toc_entries:
        # TOC가 없으면 빈 리스트 반환
        return []

    # TOC → 계층 구조 변환
    return _build_hierarchy_from_toc(toc_entries, page_positions, plain_text)


def _build_hierarchy_from_toc(
    toc_entries: List[Dict[str, Any]],
    page_positions: List[Tuple[int, int, int, str]],
    plain_text: str,
) -> List[DetectedChapter]:
    """TOC 항목을 계층 구조로 변환"""
    if not toc_entries:
        return []

    chapters = []
    chapter_number = 0
    i = 0

    while i < len(toc_entries):
        entry = toc_entries[i]

        if entry["level"] == 1:
            chapter_number += 1

            # 현재 챕터의 시작 위치
            start_char = _page_to_char_position(entry["page"], page_positions)

            # 다음 level 1 항목 찾기 (챕터 끝 결정)
            next_chapter_idx = None
            for j in range(i + 1, len(toc_entries)):
                if toc_entries[j]["level"] == 1:
                    next_chapter_idx = j
                    break

            # 챕터 끝 위치 결정
            if next_chapter_idx is not None:
                end_char = _page_to_char_position(
                    toc_entries[next_chapter_idx]["page"], page_positions
                )
            else:
                end_char = len(plain_text)

            # 챕터 내용 추출
            content = plain_text[start_char:end_char]

            # 하위 섹션 추출 (level 2+)
            section_entries = []
            for j in range(i + 1, next_chapter_idx if next_chapter_idx else len(toc_entries)):
                if toc_entries[j]["level"] >= 2:
                    section_entries.append(toc_entries[j])
                else:
                    break

            # 섹션 계층 구조 생성
            sections = _build_sections_from_toc(
                section_entries,
                page_positions,
                plain_text,
                start_char,
                end_char,
                entry["title"],
            )

            chapter = DetectedChapter(
                title=entry["title"],
                chapter_number=chapter_number,
                start_char=start_char,
                end_char=end_char,
                content=content,
                sections=sections,
                detection_method="toc",
            )
            chapters.append(chapter)

            # 다음 챕터로 이동
            if next_chapter_idx:
                i = next_chapter_idx
            else:
                break
        else:
            i += 1

    return chapters


def _build_sections_from_toc(
    section_entries: List[Dict[str, Any]],
    page_positions: List[Tuple[int, int, int, str]],
    plain_text: str,
    parent_start: int,
    parent_end: int,
    parent_title: str,
) -> List[DetectedSection]:
    """TOC 섹션 항목들을 계층적 섹션 구조로 변환"""
    if not section_entries:
        return []

    sections = []
    i = 0

    while i < len(section_entries):
        entry = section_entries[i]
        current_level = entry["level"]

        # 섹션 시작 위치
        start_char = _page_to_char_position(entry["page"], page_positions)
        start_char = max(start_char, parent_start)

        # 같은 레벨의 다음 항목 또는 상위 레벨 항목 찾기
        next_same_or_higher_idx = None
        for j in range(i + 1, len(section_entries)):
            if section_entries[j]["level"] <= current_level:
                next_same_or_higher_idx = j
                break

        # 섹션 끝 위치 결정
        if next_same_or_higher_idx is not None:
            end_char = _page_to_char_position(
                section_entries[next_same_or_higher_idx]["page"], page_positions
            )
        else:
            end_char = parent_end

        end_char = min(end_char, parent_end)

        # 섹션 내용 추출
        content = plain_text[start_char:end_char]

        # 하위 섹션 추출 (현재 레벨 + 1)
        child_entries = []
        for j in range(i + 1, next_same_or_higher_idx if next_same_or_higher_idx else len(section_entries)):
            if section_entries[j]["level"] == current_level + 1:
                child_entries.append(section_entries[j])
            elif section_entries[j]["level"] > current_level + 1:
                # 더 깊은 레벨은 하위 섹션에서 처리
                child_entries.append(section_entries[j])
            else:
                break

        # 재귀적으로 하위 섹션 생성
        children = _build_sections_from_toc(
            child_entries,
            page_positions,
            plain_text,
            start_char,
            end_char,
            entry["title"],
        ) if child_entries else []

        section = DetectedSection(
            title=entry["title"],
            level=current_level,
            start_char=start_char,
            end_char=end_char,
            content=content,
            parent_title=parent_title,
            children=children,
        )
        sections.append(section)

        # 다음 같은 레벨 항목으로 이동
        if next_same_or_higher_idx is not None:
            i = next_same_or_higher_idx
        else:
            break

    return sections


def _page_to_char_position(
    page_num: int,
    page_positions: List[Tuple[int, int, int, str]],
) -> int:
    """페이지 번호를 문자 위치로 변환"""
    for p_num, start, end, text in page_positions:
        if p_num == page_num:
            return start

    # 페이지를 찾지 못하면 마지막 위치 반환
    if page_positions:
        return page_positions[-1][2]  # 마지막 페이지의 끝 위치

    return 0


def split_into_paragraphs(
    text: str,
    section_title: Optional[str] = None,
) -> List[dict]:
    """섹션 텍스트를 의미 단위 문단으로 분할"""
    if not text or len(text.strip()) < MIN_SECTION_LENGTH:
        return [{"text": text, "start_char": 0, "end_char": len(text)}] if text else []

    # 텍스트가 너무 길면 truncate
    text_for_llm = _truncate_text(text, MAX_TEXT_FOR_PARAGRAPH_SPLIT)

    # LLM 호출
    llm = get_default_llm()
    structured_llm = llm.with_structured_output(
        ParagraphSplitResult,
        method="json_mode"
    )

    prompt = ChatPromptTemplate.from_messages([
        ("system", PARAGRAPH_SPLIT_PROMPT),
        ("human", PARAGRAPH_SPLIT_HUMAN),
    ])

    chain = prompt | structured_llm

    try:
        result = chain.invoke({"text": text_for_llm})
    except Exception as e:
        print(f"      [경고] 문단 분할 실패: {e}")
        # 폴백: 더블 뉴라인으로 단순 분할
        return _simple_paragraph_split(text)

    if not result or not result.paragraphs:
        return _simple_paragraph_split(text)

    paragraphs = []
    for para_info in result.paragraphs:
        para_text = para_info.text
        start_marker = para_info.start_marker

        # 위치 찾기
        start_char = _find_text_position(text, start_marker, para_text)
        end_char = start_char + len(para_text) if start_char >= 0 else 0

        paragraphs.append({
            "text": para_text,
            "start_char": start_char,
            "end_char": end_char,
        })

    return paragraphs


def _simple_paragraph_split(text: str) -> List[dict]:
    """폴백용 단순 문단 분할 (더블 뉴라인 기준)"""
    paragraphs = []
    current_pos = 0

    for para in re.split(r'\n\n+', text):
        para = para.strip()
        if len(para) >= 50:  # 최소 50자 이상만
            start = text.find(para, current_pos)
            if start >= 0:
                paragraphs.append({
                    "text": para,
                    "start_char": start,
                    "end_char": start + len(para),
                })
                current_pos = start + len(para)

    return paragraphs if paragraphs else [{"text": text, "start_char": 0, "end_char": len(text)}]


def build_hierarchy_path(
    chapter: Optional[DetectedChapter] = None,
    section: Optional[DetectedSection] = None,
    include_parents: bool = True,
) -> str:
    """계층 경로 문자열 생성"""
    parts = []

    if chapter:
        parts.append(chapter.title)

    if section:
        # 섹션의 parent_title 체인 추적은 복잡하므로 단순히 현재 섹션만
        parts.append(section.title)

    return " > ".join(parts) if parts else ""


def get_leaf_sections(chapter: DetectedChapter) -> List[Tuple[DetectedSection, str]]:
    """챕터에서 모든 말단 섹션(leaf) 추출"""
    results = []

    def _traverse(section: DetectedSection, path: str):
        current_path = f"{path} > {section.title}" if path else section.title

        if not section.children:
            # 말단 노드
            results.append((section, current_path))
        else:
            for child in section.children:
                _traverse(child, current_path)

    chapter_path = chapter.title
    if not chapter.sections:
        # 챕터 자체가 말단
        dummy_section = DetectedSection(
            title="",
            level=2,
            start_char=0,
            end_char=len(chapter.content),
            content=chapter.content,
        )
        results.append((dummy_section, chapter_path))
    else:
        for section in chapter.sections:
            _traverse(section, chapter_path)

    return results


# ============================================================
# 내부 유틸리티 함수
# ============================================================

def _truncate_text(text: str, max_length: int) -> str:
    """텍스트를 최대 길이로 truncate"""
    if len(text) <= max_length:
        return text

    # 80% 앞 + 20% 뒤
    front_size = int(max_length * 0.8)
    back_size = max_length - front_size

    front = text[:front_size]
    back = text[-back_size:]

    return f"{front}\n\n[... truncated ...]\n\n{back}"


def _find_text_position(
    text: str,
    marker: str,
    full_text: str = "",
    search_from: int = 0,
) -> int:
    """텍스트에서 마커 위치 찾기"""
    if not marker:
        return search_from

    search_text = text[search_from:]

    # 1. 정확한 매칭 시도
    exact_pos = search_text.find(marker)
    if exact_pos >= 0:
        return search_from + exact_pos

    # 2. 공백 정규화 후 매칭
    normalized_marker = re.sub(r'\s+', ' ', marker.strip())
    normalized_text = re.sub(r'\s+', ' ', search_text)

    exact_pos = normalized_text.find(normalized_marker)
    if exact_pos >= 0:
        # 원본 텍스트에서 대략적 위치 추정
        return search_from + _estimate_original_position(search_text, exact_pos)

    # 3. full_text로 폴백
    if full_text and full_text != text:
        return _find_text_position(full_text, marker, "", 0)

    return search_from  # 못 찾으면 search_from 반환


def _estimate_original_position(original: str, normalized_pos: int) -> int:
    """정규화된 텍스트의 위치를 원본 텍스트의 대략적 위치로 변환"""
    # 간단한 추정: 정규화된 위치 비율로 원본 위치 계산
    normalized = re.sub(r'\s+', ' ', original)
    if len(normalized) == 0:
        return 0

    ratio = normalized_pos / len(normalized)
    return int(ratio * len(original))
