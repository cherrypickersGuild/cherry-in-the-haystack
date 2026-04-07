"""재매칭 모듈 - 매칭되지 않은 개념 또는 이미 매칭된 개념에 대해 재매칭 수행."""

import json
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime

from storage.graph_query_engine import GraphQueryEngine
from storage.vector_store import VectorStore
from pipeline.concept_matcher import ConceptMatcher
from pipeline.ontology_graph_manager import OntologyGraphManager
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from pydantic import BaseModel, Field
import os


class KoreanDescriptionResult(BaseModel):
    """한글 설명 결과 모델."""
    
    description: str = Field(..., description="생성된 한글 설명 (3-5문장)")


class AdditionalMatchResult:
    """추가 매칭 결과 모델."""
    
    def __init__(
        self,
        should_add: bool = False,
        concept_id: Optional[str] = None,
        reason: str = ""
    ):
        self.should_add = should_add
        self.concept_id = concept_id
        self.reason = reason


def generate_korean_description(concept: str, chunk_text: str, llm: ChatOpenAI) -> str:
    """개념을 한글 설명으로 변환.
    
    Args:
        concept: 개념 이름
        chunk_text: 개념이 추출된 원본 텍스트
        llm: LLM 인스턴스
        
    Returns:
        한글 설명 (3-5문장)
    """
    chunk_info = ""
    if chunk_text:
        chunk_info = f"\n\n원본 텍스트 맥락:\n{chunk_text[:500]}"
    
    structured_llm = llm.with_structured_output(KoreanDescriptionResult)
    
    messages = [
        SystemMessage(content="""당신은 LLM 및 AI 분야 전문가입니다.
주어진 개념에 대한 상세하고 정확한 한글 설명을 작성해주세요.

다음 내용을 3-5문장으로 포함하세요:
1. 개념의 핵심 정의 (무엇인가?)
2. 주요 특징이나 작동 원리 (어떻게 동작하는가?)
3. 대표적인 사용 사례나 적용 분야 (어디에 쓰이는가?)
4. 관련된 다른 개념들이나 대비되는 특징

원본 텍스트가 제공된 경우, 그 맥락을 고려하여 설명을 작성하세요.
벡터 검색에 유리하도록 다양한 표현과 키워드를 자연스럽게 포함하세요.
전문적이면서도 명확하게 작성하세요."""),
        HumanMessage(content=f"""다음 개념에 대한 상세 한글 설명을 작성해주세요:

개념: {concept}{chunk_info}

3-5문장으로 한글 설명을 작성하세요.""")
    ]
    
    try:
        result = structured_llm.invoke(messages)
        return result.description
    except Exception as e:
        return concept


def load_mapping_results(results_file: str) -> Dict[str, Any]:
    """mapping_results.json 파일 로드.
    
    Args:
        results_file: mapping_results.json 파일 경로
        
    Returns:
        매핑 결과 데이터
    """
    with open(results_file, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_mapping_results(results_file: str, data: Dict[str, Any]) -> None:
    """mapping_results.json 파일 저장.
    
    Args:
        results_file: mapping_results.json 파일 경로
        data: 저장할 데이터
    """
    data["last_updated"] = datetime.now().isoformat()
    with open(results_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def get_excluded_concepts(graph_manager: OntologyGraphManager) -> List[str]:
    """LLMConcept과 1depth 자식들을 제외할 개념 리스트 반환.
    
    Args:
        graph_manager: OntologyGraphManager 인스턴스
        
    Returns:
        제외할 개념 ID 리스트
    """
    excluded = ["LLMConcept"]
    
    graph = graph_manager.staging_graph
    if "LLMConcept" in graph:
        llm_children = list(graph.successors("LLMConcept"))
        excluded.extend(llm_children)
    
    if "LLMConcept" in graph_manager.real_graph:
        real_graph = graph_manager.real_graph
        llm_children_real = list(real_graph.successors("LLMConcept"))
        excluded.extend(llm_children_real)
    
    return list(set(excluded))


def rematch_unmatched(
    results: List[Dict[str, Any]],
    concept_matcher: ConceptMatcher,
    vector_store: VectorStore,
    graph_manager: OntologyGraphManager,
    include_staging: bool = True,
    debug: bool = False
) -> int:
    """매칭되지 않은 항목에 대해 재매칭 수행 (최소 1개 무조건 추가).
    
    Args:
        results: 매핑 결과 리스트
        concept_matcher: ConceptMatcher 인스턴스
        vector_store: VectorStore 인스턴스
        graph_manager: OntologyGraphManager 인스턴스
        include_staging: 스테이징 컬렉션도 사용할지 여부
        debug: 디버그 모드
        
    Returns:
        재매칭된 항목 수
    """
    excluded_concepts = get_excluded_concepts(graph_manager)
    
    unmatched_results = [
        r for r in results 
        if not r.get("matched_concept_ids") or len(r.get("matched_concept_ids", [])) == 0
    ]
    
    if not unmatched_results:
        if debug:
            print("재매칭할 항목이 없습니다.")
        return 0
    
    if debug:
        print(f"\n재매칭 대상: {len(unmatched_results)}개")
    
    updated_count = 0
    
    for result in unmatched_results:
        concept = result.get("concept", "")
        chunk_text = result.get("chunk_text", "")
        section_title = result.get("section_title")
        
        if not concept or not chunk_text:
            continue
        
        if debug:
            print(f"\n[재매칭] {concept[:50]}...")
        
        korean_description = concept_matcher._generate_korean_description(concept, chunk_text)
        
        existing_matches = result.get("matched_concept_ids", []) or []
        all_excluded = excluded_concepts + existing_matches
        
        candidates = vector_store.find_similar(
            korean_description,
            k=10,
            include_staging=include_staging,
            exclude_concept_ids=all_excluded
        )
        
        if not candidates:
            if debug:
                print(f"  후보 없음")
            continue
        
        match_result = concept_matcher.match(
            keyword=concept,
            context=chunk_text,
            candidates=candidates,
            section_title=section_title,
            original_keyword=concept
        )
        
        matched_concept = match_result.get("matched")
        
        if matched_concept:
            matched_concept_ids = result.get("matched_concept_ids", [])
            if matched_concept not in matched_concept_ids:
                matched_concept_ids.append(matched_concept)
                result["matched_concept_ids"] = matched_concept_ids[:3]
                result["is_new"] = False
                updated_count += 1
                
                if debug:
                    print(f"  ✓ 매칭 추가: {matched_concept}")
        else:
            if candidates:
                most_similar = candidates[0].get("concept_id")
                matched_concept_ids = result.get("matched_concept_ids", [])
                if most_similar and most_similar not in matched_concept_ids:
                    matched_concept_ids.append(most_similar)
                    result["matched_concept_ids"] = matched_concept_ids[:3]
                    result["is_new"] = False
                    updated_count += 1
                    
                    if debug:
                        print(f"  ✓ 강제 매칭 추가: {most_similar} (후보 중 가장 유사)")
    
    return updated_count


def rematch_all(
    results: List[Dict[str, Any]],
    concept_matcher: ConceptMatcher,
    vector_store: VectorStore,
    graph_manager: OntologyGraphManager,
    include_staging: bool = True,
    debug: bool = False
) -> int:
    """모든 항목에 대해 재매칭 수행 (이미 매칭된 것도 추가 가능한 개념 찾기).
    
    Args:
        results: 매핑 결과 리스트
        concept_matcher: ConceptMatcher 인스턴스
        vector_store: VectorStore 인스턴스
        graph_manager: OntologyGraphManager 인스턴스
        include_staging: 스테이징 컬렉션도 사용할지 여부
        debug: 디버그 모드
        
    Returns:
        추가 매칭된 항목 수
    """
    excluded_concepts = get_excluded_concepts(graph_manager)
    
    if debug:
        print(f"\n전체 재매칭 대상: {len(results)}개")
    
    updated_count = 0
    
    for result in results:
        concept = result.get("concept", "")
        chunk_text = result.get("chunk_text", "")
        section_title = result.get("section_title")
        existing_matches = result.get("matched_concept_ids", []) or []
        
        if not concept or not chunk_text:
            continue
        
        if len(existing_matches) >= 3:
            continue
        
        if debug:
            print(f"\n[재매칭] {concept[:50]}... (기존 매칭: {len(existing_matches)}개)")
        
        korean_description = generate_korean_description(concept, chunk_text, concept_matcher.llm)
        
        all_excluded = excluded_concepts + existing_matches
        
        candidates = vector_store.find_similar(
            korean_description,
            k=10,
            include_staging=include_staging,
            exclude_concept_ids=all_excluded
        )
        
        if not candidates:
            continue
        
        if existing_matches:
            additional_match = judge_additional_match(
                concept=concept,
                chunk_text=chunk_text,
                existing_matches=existing_matches,
                candidates=candidates,
                concept_matcher=concept_matcher,
                section_title=section_title
            )
            
            if additional_match and additional_match.should_add and additional_match.concept_id:
                existing_matches.append(additional_match.concept_id)
                result["matched_concept_ids"] = existing_matches[:3]
                updated_count += 1
                
                if debug:
                    print(f"  ✓ 추가 매칭: {additional_match.concept_id}")
        else:
            match_result = concept_matcher.match(
                keyword=concept,
                context=chunk_text,
                candidates=candidates,
                section_title=section_title,
                original_keyword=concept
            )
            
            matched_concept = match_result.get("matched")
            
            if matched_concept:
                result["matched_concept_ids"] = [matched_concept]
                result["is_new"] = False
                updated_count += 1
                
                if debug:
                    print(f"  ✓ 매칭 추가: {matched_concept}")
            else:
                if candidates:
                    most_similar = candidates[0].get("concept_id")
                    if most_similar:
                        result["matched_concept_ids"] = [most_similar]
                        result["is_new"] = False
                        updated_count += 1
                        
                        if debug:
                            print(f"  ✓ 강제 매칭 추가: {most_similar}")
    
    return updated_count


def judge_additional_match(
    concept: str,
    chunk_text: str,
    existing_matches: List[str],
    candidates: List[Dict[str, Any]],
    concept_matcher: ConceptMatcher,
    section_title: Optional[str] = None
) -> AdditionalMatchResult:
    """LLM이 판단하여 기존 매칭과 다른 가치가 있는 개념인지 확인.
    
    Args:
        concept: 원본 키워드
        chunk_text: 원본 텍스트
        existing_matches: 기존 매칭된 개념 ID 리스트
        candidates: 후보 개념 리스트
        concept_matcher: ConceptMatcher 인스턴스
        section_title: 섹션 제목
        
    Returns:
        AdditionalMatchResult
    """
    class AdditionalMatchResultModel(BaseModel):
        should_add: bool = Field(..., description="기존 매칭에 추가할 가치가 있는지 여부")
        concept_id: Optional[str] = Field(None, description="추가할 개념 ID (should_add가 True인 경우)")
        reason: str = Field(..., description="추가할 가치가 있는지 여부에 대한 이유")
    
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    llm = ChatOpenAI(model=model, temperature=0)
    structured_llm = llm.with_structured_output(AdditionalMatchResultModel)
    
    existing_matches_str = ", ".join(existing_matches)
    candidates_text = "\n".join([
        f"{idx + 1}. 개념 ID: {c['concept_id']}\n   설명: {c.get('description', '')[:200]}..."
        for idx, c in enumerate(candidates[:5])
    ])
    
    section_info = f"\n섹션 제목: {section_title}" if section_title else ""
    
    messages = [
        SystemMessage(content="""당신은 온톨로지 전문가입니다.
기존에 매칭된 개념들이 있을 때, 추가로 매칭할 가치가 있는 개념인지 판단해야 합니다.

**판단 기준:**
1. 후보 개념이 기존 매칭과 중복되지 않는가?
2. 후보 개념이 새로운 관점이나 다른 측면을 제공하는가?
3. 후보 개념이 기존 매칭과 함께 사용될 때 의미가 있는가?

**추가해야 하는 경우:**
- 후보 개념이 기존 매칭과 다른 측면을 다루는 경우
- 예: 기존에 "LLM Twin"이 매칭되었고, 후보에 "Fine-tuning"이 있으면 추가 (LLM Twin을 만들기 위한 방법론)
- 예: 기존에 "RAG"가 매칭되었고, 후보에 "Vector Store"가 있으면 추가 (RAG의 구성 요소)

**추가하지 않아야 하는 경우:**
- 후보 개념이 기존 매칭과 동일하거나 매우 유사한 경우
- 후보 개념이 기존 매칭의 단순한 하위 개념인 경우
- 후보 개념이 기존 매칭과 관련이 없는 경우

**중요:**
- should_add가 True인 경우 반드시 concept_id를 제공해야 합니다.
- should_add가 False인 경우 concept_id는 None으로 설정하세요."""),
        HumanMessage(content=f"""다음 정보를 바탕으로 기존 매칭에 추가할 가치가 있는지 판단해주세요.

**원본 키워드:** {concept}
{section_info}

**원본 텍스트:**
{chunk_text[:500]}

**기존 매칭된 개념들:**
{existing_matches_str}

**후보 개념들:**
{candidates_text}

기존 매칭과 다른 가치가 있는 개념인지 판단하고, 추가할 가치가 있으면 concept_id를 제공해주세요.""")
    ]
    
    try:
        result = structured_llm.invoke(messages)
        return AdditionalMatchResult(
            should_add=result.should_add,
            concept_id=result.concept_id,
            reason=result.reason
        )
    except Exception as e:
        return AdditionalMatchResult(
            should_add=False,
            concept_id=None,
            reason=f"오류 발생: {str(e)}"
        )

