from src.workflow.state import PipelineState
from src.utils.pdf.parser import (
    extract_full_text,
    extract_text_with_page_positions,
    extract_toc,
    get_pdf_metadata,
)


def extract_text(state: PipelineState) -> PipelineState:
    """
    PDF에서 Plain Text, TOC, 페이지 위치 정보 추출.
    pymupdf(fitz)를 사용하여:
    - 전체 페이지 텍스트 추출
    - 페이지별 문자 위치 매핑
    - TOC(목차) 추출
    - 메타데이터 추출
    """
    pdf_path = state.get("pdf_path")

    if not pdf_path:
        return {**state, "error": "pdf_path is required"}

    try:
        # Plain Text 추출 (정규화 포함)
        plain_text = extract_full_text(pdf_path, normalize=True)

        # 페이지별 문자 위치 정보 추출
        page_positions = extract_text_with_page_positions(pdf_path)

        # TOC 추출
        toc = extract_toc(pdf_path)

        # 메타데이터 추출
        metadata = get_pdf_metadata(pdf_path)

        return {
            **state,
            "plain_text": plain_text,
            "page_positions": page_positions,
            "toc": toc,
            "has_toc": len(toc) > 0,
            "metadata": metadata,
        }

    except FileNotFoundError:
        return {**state, "error": f"PDF file not found: {pdf_path}"}
    except Exception as e:
        return {**state, "error": f"Text extraction failed: {str(e)}"}
