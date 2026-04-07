from typing import Optional
from langgraph.graph import StateGraph, END

from src.workflow.state import PipelineState, create_initial_state
from src.workflow.nodes import (
    extract_text,
    detect_structure,
    create_book_node,
    process_section,
    route_sections,
    finalize,
)


def create_pdf_pipeline() -> StateGraph:
    workflow = StateGraph(PipelineState)

    # 노드 추가
    workflow.add_node("extract_text", extract_text)
    workflow.add_node("detect_structure", detect_structure)
    workflow.add_node("create_book", create_book_node)
    workflow.add_node("process_section", process_section)
    workflow.add_node("finalize", finalize)

    # 엣지 정의: 순차 흐름
    workflow.set_entry_point("extract_text")
    workflow.add_edge("extract_text", "detect_structure")
    workflow.add_edge("detect_structure", "create_book")
    workflow.add_edge("create_book", "process_section")

    # 조건부 라우팅: 섹션 순회 루프
    workflow.add_conditional_edges(
        "process_section",
        route_sections,
        {
            "continue": "process_section",  # 다음 섹션 처리
            "finalize": "finalize",         # 모든 섹션 완료
        }
    )

    workflow.add_edge("finalize", END)

    return workflow.compile()


# 컴파일된 파이프라인 그래프 인스턴스
pdf_pipeline = create_pdf_pipeline()


def run_pdf_pipeline(
    pdf_path: str,
    resume: bool = False,
    book_id: Optional[int] = None,
    model_version: str = "gemini-2.5-flash",
) -> dict:
    """
    단일 LangGraph를 통해 전체 PDF 처리 수행:
    1. PDF → Plain Text + TOC 추출
    2. TOC 기반 챕터/섹션 구조 감지
    3. DB에 책/챕터/섹션 저장
    4. 각 섹션별 문단 분할 및 아이디어 추출
    5. 처리 결과 요약
    """
    # 초기 상태 생성
    initial_state = create_initial_state(
        pdf_path=pdf_path,
        book_id=book_id,
        resume=resume,
        model_version=model_version,
    )

    print(f"📄 PDF 파이프라인 시작: {pdf_path}")

    # 그래프 실행 (섹션 수 + 여유분으로 recursion_limit 설정)
    result_state = pdf_pipeline.invoke(
        initial_state,
        config={"recursion_limit": 500}  # 최대 500개 섹션까지 지원
    )

    # 에러 체크
    if result_state.get("error"):
        return {"error": result_state["error"]}

    return result_state.get("stats", {})
