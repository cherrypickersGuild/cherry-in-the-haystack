import re
import fitz  # PyMuPDF
from typing import Generator, Dict, Any, List, Tuple


def extract_page_text(pdf_path: str, page_num: int) -> str:
   
    doc = fitz.open(pdf_path)
    try:
        if page_num >= len(doc):
            raise IndexError(f"Page {page_num} out of range (total: {len(doc)})")

        page = doc[page_num]
        text = page.get_text()
        return text
    finally:
        doc.close()


def extract_pages_lazy(pdf_path: str) -> Generator[tuple[int, str], None, None]:
   
    doc = fitz.open(pdf_path)
    try:
        for page_num in range(len(doc)):
            page = doc[page_num]
            text = page.get_text()
            yield page_num, text
            # Explicitly delete page to free memory
            page = None
    finally:
        doc.close()


def get_pdf_metadata(pdf_path: str) -> Dict[str, Any]:
    
    doc = fitz.open(pdf_path)
    try:
        metadata = doc.metadata
        return {
            "title": metadata.get("title", ""),
            "author": metadata.get("author", ""),
            "total_pages": len(doc),
            "producer": metadata.get("producer", ""),
            "creator": metadata.get("creator", ""),
        }
    finally:
        doc.close()


def get_total_pages(pdf_path: str) -> int:
    
    doc = fitz.open(pdf_path)
    try:
        return len(doc)
    finally:
        doc.close()


def extract_full_text(pdf_path: str, normalize: bool = True) -> str:
    """PDF 전체 텍스트 추출.
    모든 페이지를 연결하여 단일 텍스트로 반환.
    페이지 경계 문제 해결을 위해 정규화 적용.
    """
    doc = fitz.open(pdf_path)
    try:
        pages = []
        for page in doc:
            pages.append(page.get_text())

        if normalize:
            return _normalize_pages(pages)
        else:
            return '\n'.join(pages)
    finally:
        doc.close()


def _normalize_pages(pages: List[str]) -> str:
    """페이지 리스트를 정규화하여 단일 텍스트로 연결.
    - 페이지 경계에서 하이픈 연결 처리
    - 여러 공백/줄바꿈 정규화
    - 기본적인 텍스트 정리
    """
    result = []

    for i, page_text in enumerate(pages):
        # 페이지 텍스트 정리
        text = page_text.strip()

        if not text:
            continue

        # 여러 줄바꿈 → 더블 뉴라인
        text = re.sub(r'\n{3,}', '\n\n', text)

        # 페이지 경계 처리: 이전 페이지와 현재 페이지 연결
        if result and result[-1]:
            prev = result[-1]
            # 이전 페이지가 하이픈으로 끝나면 연결
            if prev.endswith('-'):
                result[-1] = prev[:-1]  # 하이픈 제거
                # 현재 페이지 첫 단어와 연결 (줄바꿈 없이)
                text = text.lstrip()

        result.append(text)

    return '\n\n'.join(result)


def extract_toc(pdf_path: str) -> List[Dict[str, Any]]:
    """PDF 목차(TOC) 추출"""
    doc = fitz.open(pdf_path)
    try:
        toc = doc.get_toc()  # [[level, title, page], ...]
        return [
            {
                "level": level,
                "title": title.strip(),
                "page": page - 1,  # 0-indexed로 변환
            }
            for level, title, page in toc
        ]
    finally:
        doc.close()


def extract_all_pages(pdf_path: str) -> List[str]:
    """모든 페이지 텍스트를 리스트로 추출"""
    doc = fitz.open(pdf_path)
    try:
        pages = []
        for page in doc:
            pages.append(page.get_text())
        return pages
    finally:
        doc.close()


def extract_text_with_page_positions(pdf_path: str) -> List[Tuple[int, int, int, str]]:
    """페이지별 텍스트와 문자 위치 정보 추출"""
    doc = fitz.open(pdf_path)
    try:
        result = []
        char_offset = 0

        for page_num, page in enumerate(doc):
            text = page.get_text()
            start = char_offset
            char_offset += len(text) + 1  # +1 for newline
            result.append((page_num, start, char_offset, text))

        return result
    finally:
        doc.close()
