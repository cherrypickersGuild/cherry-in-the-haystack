"""
LangGraph 워크플로우 노드들.

각 노드는 PipelineState를 받아 업데이트된 상태를 반환.
"""

from src.workflow.nodes.extract_text import extract_text
from src.workflow.nodes.detect_structure import detect_structure
from src.workflow.nodes.create_book import create_book_node
from src.workflow.nodes.process_section import process_section, route_sections
from src.workflow.nodes.finalize import finalize

__all__ = [
    "extract_text",
    "detect_structure",
    "create_book_node",
    "process_section",
    "route_sections",
    "finalize",
]
