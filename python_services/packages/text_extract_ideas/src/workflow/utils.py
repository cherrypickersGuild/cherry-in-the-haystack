from typing import Any, Union
from src.model.schemas import ExtractedIdea


def get_concept_from_idea(extracted_idea: Union[ExtractedIdea, dict, Any]) -> str:
    """아이디어 객체에서 핵심 개념(concept) 텍스트 추출"""
    if not extracted_idea:
        return ""
        
    if hasattr(extracted_idea, "concept"):
        return extracted_idea.concept
    elif isinstance(extracted_idea, dict):
        return extracted_idea.get("concept", "")
    else:
        # 기타 객체거나 문자열인 경우 문자열로 변환
        return str(extracted_idea)
