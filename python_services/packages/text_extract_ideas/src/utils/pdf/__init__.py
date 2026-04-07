"""PDF processing module for text extraction and hierarchy detection."""

from src.utils.pdf.parser import (
    extract_page_text,
    extract_pages_lazy,
    extract_full_text,
    extract_all_pages,
    extract_toc,
    extract_text_with_page_positions,
    get_pdf_metadata,
    get_total_pages,
)
from src.utils.pdf.hierarchy_detector import (
    detect_chapters_from_toc,
    split_into_paragraphs,
    build_hierarchy_path,
    get_leaf_sections,
)

__all__ = [
    # Parser functions
    "extract_page_text",
    "extract_pages_lazy",
    "extract_full_text",
    "extract_all_pages",
    "extract_toc",
    "extract_text_with_page_positions",
    "get_pdf_metadata",
    "get_total_pages",
    # Hierarchy detection (TOC-based)
    "detect_chapters_from_toc",
    "split_into_paragraphs",
    "build_hierarchy_path",
    "get_leaf_sections",
]
