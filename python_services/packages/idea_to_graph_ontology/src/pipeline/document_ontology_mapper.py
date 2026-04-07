"""Document ontology mapper using LangGraph workflow."""

import json
import os
import re
from typing import Dict, List, Any, TypedDict, Optional

from pydantic import BaseModel, Field

from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

from storage.graph_query_engine import GraphQueryEngine
from storage.vector_store import VectorStore
from storage.new_concept_manager import NewConceptManager
from pipeline.concept_matcher import ConceptMatcher
from pipeline.ontology_updater import OntologyUpdater


class KoreanDescriptionResult(BaseModel):
    """한글 설명 결과 모델."""
    
    description: str = Field(..., description="생성된 한글 설명 (3-5문장)")


class ClusterValidationResult(BaseModel):
    """클러스터 검증 결과 모델."""
    
    selected_noun_phrase: str = Field(..., description="선택된 대표 noun_phrase_summary")
    can_merge: bool = Field(..., description="모든 개념을 합칠 수 있는지 여부")
    reason: str = Field(..., description="합칠 수 있는지 여부에 대한 이유")
    representative_description: str = Field(..., description="클러스터의 모든 개념을 포괄하는 통합 description")


class MappingState(TypedDict):
    """LangGraph State 정의."""

    concept: str
    chunk_text: str
    source: str
    metadata: Dict[str, Any]
    matched_concept_id: Optional[str]
    matched_concept_ids: Optional[List[str]]
    is_new: bool
    candidates: List[Dict[str, Any]]
    korean_description: Optional[str]
    reason: Optional[str]
    noun_phrase_summary: Optional[str]
    should_add_to_ontology: Optional[bool]
    cluster: Optional[Dict[str, Any]]
    concepts: Optional[List[Dict[str, Any]]]
    matched_concepts: Optional[List[Dict[str, Any]]]
    new_concepts: Optional[List[Dict[str, Any]]]
    concept_candidates: Optional[Dict[str, List[Dict[str, Any]]]]


class DocumentOntologyMapper:
    """LangGraph 플로우 오케스트레이터."""

    def __init__(
        self,
        graph_engine: GraphQueryEngine,
        vector_store: VectorStore,
        concept_matcher: ConceptMatcher,
        new_concept_manager: NewConceptManager,
        ontology_updater: OntologyUpdater,
        debug: bool = False,
    ) -> None:
        """DocumentOntologyMapper 초기화.
        
        Args:
            graph_engine: GraphQueryEngine 인스턴스
            vector_store: VectorStore 인스턴스
            concept_matcher: ConceptMatcher 인스턴스
            new_concept_manager: NewConceptManager 인스턴스
            ontology_updater: OntologyUpdater 인스턴스
            debug: 디버그 모드 활성화 여부
        """
        self.graph_engine = graph_engine
        self.vector_store = vector_store
        self.concept_matcher = concept_matcher
        self.new_concept_manager = new_concept_manager
        self.ontology_updater = ontology_updater
        self.debug = debug
        
        # 한글 description 생성을 위한 LLM 초기화
        model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        self.llm = ChatOpenAI(model=model, temperature=0)
        self.structured_llm_description = self.llm.with_structured_output(KoreanDescriptionResult)
        self.structured_llm_cluster_validation = self.llm.with_structured_output(ClusterValidationResult)
        
        self.workflow = self.create_mapping_workflow()

    def map_concept(
        self,
        concept: str,
        chunk_text: str,
        source: str,
        section_title: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """단일 개념 매핑 함수 (LangGraph 실행).
        
        Args:
            concept: 매핑할 개념
            chunk_text: 개념이 추출된 원본 텍스트
            source: 출처
            section_title: 섹션 제목 (매칭 시 활용)
            metadata: 추가 메타데이터
            
        Returns:
            매핑 결과 딕셔너리
        """
        metadata_dict = metadata or {}
        if section_title:
            metadata_dict["section_title"] = section_title
        
        initial_state: MappingState = {
            "concept": concept,
            "chunk_text": chunk_text,
            "source": source,
            "metadata": metadata_dict,
            "matched_concept_id": None,
            "matched_concept_ids": None,
            "is_new": False,
            "candidates": [],
            "korean_description": None,
            "reason": None,
            "noun_phrase_summary": None,
            "should_add_to_ontology": None,
            "cluster": None,
            "concepts": None,
            "matched_concepts": None,
            "new_concepts": None,
        }
        
        # stream 사용하여 각 노드 실행 확인 (디버그 모드에서)
        if self.debug:
            final_state = initial_state
            for step in self.workflow.stream(initial_state):
                # 각 step은 {node_name: state} 형태
                if step:
                    final_state = list(step.values())[0]
            result = final_state
        else:
            # 일반 모드에서는 invoke 사용
            result = self.workflow.invoke(initial_state)
        
        return result

    def create_mapping_workflow(self) -> Any:
        """LangGraph StateGraph 생성 및 노드 연결.
        
        Returns:
            구성된 StateGraph
        """
        workflow = StateGraph(MappingState)

        workflow.add_node("extract_noun_phrases", self.extract_noun_phrases)
        workflow.add_node("search_similar_concepts", self.search_similar_concepts)
        workflow.add_node("match_with_llm", self.match_with_llm)
        workflow.add_node("save_new_concept", self.save_new_concept)
        workflow.add_node("check_new_concept_clusters", self.check_new_concept_clusters)
        workflow.add_node("add_to_ontology", self.add_to_ontology)

        workflow.set_entry_point("extract_noun_phrases")
        workflow.add_edge("extract_noun_phrases", "search_similar_concepts")
        workflow.add_edge("search_similar_concepts", "match_with_llm")
        
        def should_save_new(state: MappingState) -> str:
            new_concepts = state.get("new_concepts", [])
            return "save_new_concept" if new_concepts else END
        
        workflow.add_conditional_edges("match_with_llm", should_save_new)
        workflow.add_edge("save_new_concept", "check_new_concept_clusters")
        
        def should_add_to_ontology(state: MappingState) -> str:
            return "add_to_ontology" if state.get("should_add_to_ontology", False) else END
        
        workflow.add_conditional_edges("check_new_concept_clusters", should_add_to_ontology)
        workflow.add_edge("add_to_ontology", END)

        return workflow.compile()

    def _generate_korean_description(self, concept: str, chunk_text: str = None) -> str:
        """개념을 한글 설명으로 변환 (상세 버전).
        
        Args:
            concept: 개념 이름
            chunk_text: 개념이 추출된 원본 텍스트 (선택)
            
        Returns:
            한글 설명 (3-5문장)
        """
        chunk_info = ""
        if chunk_text:
            chunk_info = f"\n\n원본 텍스트 맥락:\n{chunk_text[:500]}"
        
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
            result = self.structured_llm_description.invoke(messages)
            return result.description
        except Exception as e:
            if self.debug:
                print(f"한글 설명 생성 실패: {e}")
            # 실패 시 원본 개념 반환
            return concept
    
    def search_similar_concepts(self, state: MappingState) -> MappingState:
        """벡터 검색 노드 (vector_store 사용).
        
        추출된 여러 개념에 대해 벡터 검색 수행.
        LLMConcept과 1depth 자식들은 검색에서 제외.
        
        Args:
            state: 현재 상태
            
        Returns:
            업데이트된 상태
        """
        concepts = state.get("concepts")
        chunk_text = state.get("chunk_text", "")
        
        if not concepts:
            concepts = [{"concept": state["concept"], "context": chunk_text}]
        
        if self.debug:
            print(f"\n{'='*60}", flush=True)
            print(f"[search_similar_concepts]", flush=True)
            print(f"{'='*60}", flush=True)
            total_concepts = self.vector_store.count(include_staging=False)
            staging_concepts = self.vector_store.count(include_staging=True) - total_concepts
            print(f"ChromaDB 총 개념 수: {total_concepts} (스테이징: {staging_concepts})", flush=True)
            print(f"처리할 개념 수: {len(concepts)}개", flush=True)
        
        # LLMConcept과 1depth 자식들을 제외할 개념 집합 생성
        excluded_concept_ids = ["LLMConcept"]
        
        if self.ontology_updater.graph_manager:
            graph = self.ontology_updater.graph_manager.staging_graph
            if "LLMConcept" in graph:
                llm_children = list(graph.successors("LLMConcept"))
                excluded_concept_ids.extend(llm_children)
            
            # real_graph에도 확인
            if "LLMConcept" in self.ontology_updater.graph_manager.real_graph:
                real_graph = self.ontology_updater.graph_manager.real_graph
                llm_children_real = list(real_graph.successors("LLMConcept"))
                excluded_concept_ids.extend(llm_children_real)
        
        # 중복 제거
        excluded_concept_ids = list(set(excluded_concept_ids))
        
        if self.debug:
            print(f"벡터 검색에서 제외할 개념: {excluded_concept_ids}", flush=True)
        
        all_candidates = []
        korean_descriptions = []
        concept_candidates = {}
        
        for extracted_concept in concepts:
            concept_name = extracted_concept.get("concept", "")
            concept_context = extracted_concept.get("context", chunk_text)
            
            korean_description = self._generate_korean_description(concept_name, concept_context)
            korean_descriptions.append(korean_description)
            
            if self.debug:
                print(f"\n개념: {concept_name}", flush=True)
                print(f"생성된 한글 설명: {korean_description[:100]}...", flush=True)
            
            # 벡터 검색 시 제외할 개념들 전달
            candidates = self.vector_store.find_similar(
                korean_description, 
                k=5, 
                include_staging=True,
                exclude_concept_ids=excluded_concept_ids
            )
            
            if self.debug:
                print(f"검색된 후보 수: {len(candidates)}", flush=True)
                if candidates:
                    print(f"후보 개념 목록:", flush=True)
                    for idx, c in enumerate(candidates, 1):
                        concept_id = c.get('concept_id', 'N/A')
                        description = c.get('description', '')
                        distance = c.get('distance', 'N/A')
                        print(f"  {idx}. {concept_id} (거리: {distance})", flush=True)
                        print(f"     설명: {description[:100]}...", flush=True)
            
            # 각 개념별 후보 저장
            concept_candidates[concept_name] = candidates
            
            all_candidates.extend(candidates)
        
        # 하위 호환성을 위해 통합 후보도 저장 (기존 코드와의 호환성)
        unique_candidates = {}
        for candidate in all_candidates:
            concept_id = candidate.get('concept_id')
            if concept_id and (concept_id not in unique_candidates or 
                             candidate.get('distance', 1.0) < unique_candidates[concept_id].get('distance', 1.0)):
                unique_candidates[concept_id] = candidate
        
        candidates = list(unique_candidates.values())
        candidates.sort(key=lambda x: x.get('distance', 1.0))
        candidates = candidates[:5]
        
        state["candidates"] = candidates
        state["concept_candidates"] = concept_candidates
        state["korean_description"] = korean_descriptions[0] if korean_descriptions else None
        
        if self.debug:
            print(f"\n각 개념별 후보 저장 완료: {len(concept_candidates)}개 개념", flush=True)
        
        return state

    def extract_noun_phrases(self, state: MappingState) -> MappingState:
        """original keyword에서 noun phrase 최대 3개 추출 노드.
        
        Args:
            state: 현재 상태
            
        Returns:
            업데이트된 상태
        """
        original_keyword = state["concept"]
        chunk_text = state["chunk_text"]
        section_title = state.get("metadata", {}).get("section_title")
        
        if self.debug:
            print(f"\n{'='*60}", flush=True)
            print(f"[extract_noun_phrases]", flush=True)
            print(f"{'='*60}", flush=True)
            print(f"원본 키워드: {original_keyword}", flush=True)
        
        # LLMConcept의 직접 자식 카테고리 정보 가져오기
        top_level_categories = []
        if self.ontology_updater and self.ontology_updater.graph_manager:
            top_level_categories = self.ontology_updater.graph_manager.get_root_children()
        
        noun_phrases = self.concept_matcher.extract_noun_phrases_from_keyword(
            original_keyword=original_keyword,
            chunk_text=chunk_text,
            section_title=section_title,
            top_level_categories=top_level_categories
        )
        
        if not noun_phrases:
            noun_phrases = [original_keyword]
        
        if self.debug:
            print(f"추출된 noun phrase 수: {len(noun_phrases)}개", flush=True)
            for idx, np in enumerate(noun_phrases, 1):
                print(f"  {idx}. {np}", flush=True)
        
        state["concepts"] = [{"concept": np, "context": chunk_text} for np in noun_phrases]
        
        return state

    def match_with_llm(self, state: MappingState) -> MappingState:
        """LLM 매칭 노드 (concept_matcher 사용).
        
        각 noun phrase에 대해 최대 3개까지 매칭 시도.
        
        Args:
            state: 현재 상태
            
        Returns:
            업데이트된 상태
        """
        concepts = state.get("concepts")
        chunk_text = state["chunk_text"]
        concept_candidates = state.get("concept_candidates", {})
        section_title = state.get("metadata", {}).get("section_title")
        
        if not concepts:
            concepts = [{"concept": state["concept"], "context": chunk_text}]
        
        matched_concepts = []
        new_concepts = []
        all_matched_ids = []
        
        if self.debug:
            print(f"\n[개념별 매칭 시작] 총 {len(concepts)}개 noun phrase 처리", flush=True)
        
        for extracted_concept in concepts:
            concept_name = extracted_concept.get("concept", "")
            concept_context = extracted_concept.get("context", chunk_text)
            
            # 각 개념에 해당하는 후보 사용
            candidates = concept_candidates.get(concept_name, [])
            
            if self.debug:
                print(f"\n[noun phrase 매칭] {concept_name}", flush=True)
                print(f"  사용할 후보 수: {len(candidates)}개", flush=True)
            
            if not candidates:
                new_concepts.append({
                    "concept": concept_name,
                    "context": concept_context,
                    "match_result": {"matched": None, "reason": "후보 없음"}
                })
                if self.debug:
                    print(f"  ✗ 후보 없음 → 신규 개념", flush=True)
                continue
            
            match_result = self.concept_matcher.match(
                keyword=concept_name,
                context=concept_context,
                candidates=candidates,
                section_title=section_title,
                original_keyword=concept_name
            )
            
            matched_concept = match_result.get("matched")
            reason = match_result.get("reason", "")
            
            if matched_concept:
                matched_concepts.append({
                    "concept": concept_name,
                    "matched_id": matched_concept,
                    "match_result": match_result
                })
                if matched_concept not in all_matched_ids:
                    all_matched_ids.append(matched_concept)
                if self.debug:
                    print(f"  ✓ 매칭 성공: {matched_concept}", flush=True)
                    if reason:
                        print(f"  매칭 이유: {reason[:200]}...", flush=True)
            else:
                new_concepts.append({
                    "concept": concept_name,
                    "context": concept_context,
                    "match_result": match_result
                })
                if self.debug:
                    print(f"  ✗ 매칭 실패 → 신규 개념", flush=True)
                    if reason:
                        print(f"  실패 이유: {reason[:200]}...", flush=True)
        
        state["matched_concepts"] = matched_concepts
        state["new_concepts"] = new_concepts
        state["matched_concept_ids"] = all_matched_ids[:3]
        
        if matched_concepts:
            state["matched_concept_id"] = matched_concepts[0]["matched_id"]
            state["is_new"] = False
            state["reason"] = matched_concepts[0]["match_result"].get("reason", "이유 없음")
            state["noun_phrase_summary"] = matched_concepts[0]["match_result"].get("noun_phrase_summary", "")
        else:
            state["is_new"] = True
            if new_concepts and new_concepts[0].get("match_result"):
                state["reason"] = new_concepts[0]["match_result"].get("reason", "이유 없음")
                state["noun_phrase_summary"] = new_concepts[0]["match_result"].get("noun_phrase_summary", "")
        
        if self.debug:
            print(f"\n[매칭 결과 요약]", flush=True)
            print(f"  - 매칭 성공: {len(matched_concepts)}개", flush=True)
            print(f"  - 신규 개념: {len(new_concepts)}개", flush=True)
            print(f"  - matched_concept_ids: {state.get('matched_concept_ids')}", flush=True)
            print(f"  - is_new: {state['is_new']}", flush=True)
        
        return state

    def save_new_concept(self, state: MappingState) -> MappingState:
        """신규 개념 저장 노드 (new_concept_manager 사용).
        
        추출된 모든 신규 개념을 개별적으로 저장.
        
        Args:
            state: 현재 상태
            
        Returns:
            업데이트된 상태
        """
        new_concepts = state.get("new_concepts", [])
        source = state["source"]
        chunk_text = state["chunk_text"]
        
        if not new_concepts:
            if self.debug:
                print(f"\n{'='*60}", flush=True)
                print(f"[save_new_concept] 저장할 신규 개념 없음", flush=True)
                print(f"{'='*60}", flush=True)
            return state
        
        if self.debug:
            print(f"\n{'='*60}", flush=True)
            print(f"[save_new_concept] 신규 개념 {len(new_concepts)}개 저장 시작", flush=True)
            print(f"{'='*60}", flush=True)
        
        for idx, new_concept_info in enumerate(new_concepts, 1):
            concept_name = new_concept_info.get("concept", "")
            concept_context = new_concept_info.get("context", chunk_text)
            match_result = new_concept_info.get("match_result", {})
            
            noun_phrase_summary = match_result.get("noun_phrase_summary", "")
            reason = match_result.get("reason", "이유 없음")
            
            korean_description = self._generate_korean_description(concept_name, concept_context)
            
            if self.debug:
                print(f"\n[{idx}/{len(new_concepts)}] 개념: {concept_name}", flush=True)
                print(f"  출처: {source}", flush=True)
                print(f"  명사구 요약: {noun_phrase_summary}", flush=True)
                print(f"  판단 이유: {reason[:100] if reason else 'None'}...", flush=True)
            
            self.new_concept_manager.save_concept(
                concept=concept_name,
                description=korean_description,
                source=source,
                original_keyword=concept_name,
                noun_phrase_summary=noun_phrase_summary,
                reason=reason
            )
        
        if self.debug:
            print(f"\n✓ 신규 개념 {len(new_concepts)}개 저장 완료", flush=True)
        
        return state

    def check_new_concept_clusters(self, state: MappingState) -> MappingState:
        """클러스터 체크 노드 (new_concept_manager 사용).
        
        저장된 모든 신규 개념에 대해 클러스터를 확인합니다.
        
        Args:
            state: 현재 상태
            
        Returns:
            업데이트된 상태
        """
        new_concepts = state.get("new_concepts", [])
        
        if not new_concepts:
            state["should_add_to_ontology"] = False
            if self.debug:
                print(f"\n{'='*60}", flush=True)
                print(f"[check_new_concept_clusters] 확인할 신규 개념 없음", flush=True)
                print(f"{'='*60}", flush=True)
            return state
        
        if self.debug:
            print(f"\n{'='*60}", flush=True)
            print(f"[check_new_concept_clusters] 신규 개념 {len(new_concepts)}개에 대해 클러스터 확인", flush=True)
            print(f"{'='*60}", flush=True)
        
        for new_concept_info in new_concepts:
            concept_name = new_concept_info.get("concept", "")
            
            if self.debug:
                print(f"\n[클러스터 확인] 개념: {concept_name}", flush=True)
                
                # 디버깅: new_concepts 테이블에서 유사한 개념 찾기
                cursor = self.new_concept_manager.conn.cursor()
                cursor.execute(
                    "SELECT concept, COUNT(*) as count FROM new_concepts GROUP BY concept"
                )
                all_concepts = cursor.fetchall()
                
                # 개념 이름과 유사한 것 찾기 (대소문자 무시)
                similar_concepts = [
                    (c[0], c[1]) for c in all_concepts 
                    if c[0].lower().strip() == concept_name.lower().strip()
                ]
                
                print(f"[디버깅] new_concepts 테이블에 '{concept_name}'와 유사한 개념:", flush=True)
                if similar_concepts:
                    for similar_concept, count in similar_concepts:
                        print(f"  - '{similar_concept}': {count}개", flush=True)
                else:
                    print(f"  - 없음", flush=True)
                
                # 정확히 일치하는 개념 찾기
                cursor.execute(
                    "SELECT concept, COUNT(*) as count FROM new_concepts WHERE concept = ? GROUP BY concept",
                    (concept_name,)
                )
                exact_match = cursor.fetchone()
                if exact_match:
                    print(f"[디버깅] 정확히 일치하는 개념 '{concept_name}': {exact_match[1]}개", flush=True)
                else:
                    print(f"[디버깅] 정확히 일치하는 개념 '{concept_name}': 없음", flush=True)
                
                # 모든 new_concepts 개수
                cursor.execute("SELECT COUNT(*) FROM new_concepts")
                total_count = cursor.fetchone()[0]
                print(f"[디버깅] new_concepts 테이블 총 개념 수: {total_count}개", flush=True)
                
                # 클러스터 테이블 확인
                cursor.execute("SELECT COUNT(*) FROM concept_clusters")
                cluster_count = cursor.fetchone()[0]
                print(f"[디버깅] concept_clusters 테이블 총 클러스터 수: {cluster_count}개", flush=True)
                
                # min_size 필터링 전에 모든 클러스터 확인
                cursor.execute("SELECT id, cluster_name, concept_ids FROM concept_clusters")
                all_clusters = cursor.fetchall()
                print(f"[디버깅] min_size 필터링 전 클러스터 목록:", flush=True)
                if all_clusters:
                    for cluster_row in all_clusters:
                        cluster_id, cluster_name, concept_ids_str = cluster_row
                        concept_ids = concept_ids_str.split(",") if concept_ids_str else []
                        contains_concept = concept_name in concept_ids
                        print(f"  - {cluster_name}: {len(concept_ids)}개 개념 {f'(포함됨)' if contains_concept else ''}", flush=True)
                        if contains_concept:
                            print(f"    개념 목록: {', '.join(concept_ids)}", flush=True)
                else:
                    print(f"  - 클러스터 없음", flush=True)
            
            clusters = self.new_concept_manager.get_clusters(min_size=5, concept=concept_name, debug=self.debug)
        
            if self.debug:
                print(f"현재 개념이 포함된 클러스터 수: {len(clusters)}", flush=True)
                if len(clusters) == 0:
                    print(f"  ✗ 클러스터 없음 (5개 미만 또는 현재 개념이 포함된 클러스터 없음)", flush=True)
            
            for cluster in clusters:
                if self.debug:
                    print(f"\n[클러스터 검증 시작]", flush=True)
                    print(f"클러스터 개념 수: {len(cluster.get('concepts', []))}개", flush=True)
                
                # LLM으로 클러스터 검증
                validation_result = self._validate_cluster_with_llm(cluster)
                
                if validation_result and validation_result.can_merge:
                    # 대표 개념 설정
                    representative_concept = self._select_representative_by_noun_phrase(
                        cluster.get("concept_details", []),
                        validation_result.selected_noun_phrase
                    )
                    
                    if representative_concept:
                        # 클러스터에 대표 개념 정보 추가
                        cluster["representative_concept"] = representative_concept
                        cluster["selected_noun_phrase"] = validation_result.selected_noun_phrase
                        cluster["representative_description"] = validation_result.representative_description
                        
                        state["should_add_to_ontology"] = True
                        state["cluster"] = cluster
                        
                        if self.debug:
                            print(f"✓ 클러스터 검증 통과", flush=True)
                            print(f"  - 선택된 대표 noun_phrase: {validation_result.selected_noun_phrase}", flush=True)
                            print(f"  - 합치기 가능 이유: {validation_result.reason}", flush=True)
                            print(f"  - 대표 개념: {representative_concept.get('concept', 'N/A')}", flush=True)
                    else:
                        state["should_add_to_ontology"] = False
                        if self.debug:
                            print(f"✗ 대표 개념 선택 실패", flush=True)
                else:
                    state["should_add_to_ontology"] = False
                    if self.debug:
                        if validation_result:
                            print(f"✗ 클러스터 검증 실패", flush=True)
                            print(f"  - 선택된 noun_phrase: {validation_result.selected_noun_phrase}", flush=True)
                            print(f"  - 합치기 불가 이유: {validation_result.reason}", flush=True)
                        else:
                            print(f"✗ LLM 검증 실패", flush=True)
                
                return state
        
        state["should_add_to_ontology"] = False
        if self.debug:
            print("✗ 클러스터 없음 (5개 미만 또는 현재 개념이 포함된 클러스터 없음)", flush=True)
        
        return state
    
    def _validate_cluster_with_llm(self, cluster: Dict[str, Any]) -> Optional[ClusterValidationResult]:
        """LLM을 사용하여 클러스터의 개념들을 합칠 수 있는지 검증.
        
        Args:
            cluster: 클러스터 정보 (concept_details 포함)
            
        Returns:
            ClusterValidationResult 또는 None (실패 시)
        """
        if self.debug:
            print(f"\n{'='*60}", flush=True)
            print(f"[클러스터 검증]", flush=True)
            print(f"{'='*60}", flush=True)
            print(f"클러스터 개념 수: {len(cluster.get('concepts', []))}", flush=True)
        
        concept_details = cluster.get("concept_details", [])
        
        if not concept_details:
            return None
        
        if self.debug:
            print(f"\n[클러스터 개념 상세 정보]", flush=True)
            print(f"클러스터의 개념 수: {len(concept_details)}개", flush=True)
            for idx, c in enumerate(concept_details, 1):
                print(f"  {idx}. {c.get('concept', 'N/A')}", flush=True)
                print(f"     원본 키워드: {c.get('original_keyword', 'N/A')}", flush=True)
                print(f"     명사구 요약: {c.get('noun_phrase_summary', 'N/A')}", flush=True)
        
        # 클러스터 정보를 텍스트로 구성
        cluster_info = []
        for idx, c in enumerate(concept_details, 1):
            original_keyword = c.get("original_keyword", "N/A")
            noun_phrase_summary = c.get("noun_phrase_summary", "N/A")
            description = c.get("description", "N/A")
            
            cluster_info.append(
                f"{idx}. 원본 키워드: {original_keyword}\n"
                f"   noun_phrase_summary: {noun_phrase_summary}\n"
                f"   설명: {description[:200]}..."
            )
        
        cluster_text = "\n\n".join(cluster_info)
        
        messages = [
            SystemMessage(content="""당신은 온톨로지 전문가입니다.
주어진 클러스터의 개념들을 분석하여 하나의 통합된 개념으로 합칠 수 있는지 판단해주세요.

**작업 순서:**
1. 클러스터 내 모든 개념의 noun_phrase_summary를 검토
2. 가장 적절한 대표 noun_phrase_summary 하나를 선택
3. 클러스터의 모든 개념이 선택한 대표 개념과 합쳐질 수 있는지 판단
   - 모든 개념이 동일하거나 매우 유사한 의미를 나타내는가?
   - 개념들 간의 차이가 단순히 표현 방식의 차이인가, 아니면 본질적으로 다른 개념인가?
4. 합칠 수 있다면 can_merge=True, 그렇지 않다면 can_merge=False
5. 판단 이유를 명확하게 설명
6. 클러스터의 모든 개념을 포괄하는 통합 description 생성 (3-5문장)
   - 각 개념의 description을 종합하여 더 포괄적이고 정확한 설명 작성
   - 벡터 검색에 유리하도록 다양한 표현과 키워드를 자연스럽게 포함
   - 전문적이면서도 명확하게 작성

**주의사항:**
- 각각 독립적으로 구분이 필요한 (각각 학습이 필요한) 개념을 합치면 안됩니다.
- 완전히 동일하지 않더라도 세부적이어서 구분이 필요하지 않은 개념이라면 상위 개념으로 합칠 수 있습니다. 
- 선택한 noun_phrase_summary는 모든 개념을 대표할 수 있어야 합니다
- representative_description은 클러스터의 모든 개념을 포괄해야 합니다"""),
            HumanMessage(content=f"""다음 클러스터의 개념들을 분석해주세요:

{cluster_text}

1. 가장 적절한 대표 noun_phrase_summary를 선택하세요
2. 클러스터의 모든 개념이 선택한 대표 개념과 합쳐질 수 있는지 판단하세요
3. 판단 이유를 명확하게 설명하세요
4. 클러스터의 모든 개념을 포괄하는 통합 description을 생성하세요 (3-5문장)""")
        ]
        
        try:
            result = self.structured_llm_cluster_validation.invoke(messages)
            return result
        except Exception as e:
            if self.debug:
                print(f"LLM 검증 실패: {e}", flush=True)
            return None
    
    def _select_representative_by_noun_phrase(
        self,
        concept_details: List[Dict[str, Any]],
        selected_noun_phrase: str
    ) -> Optional[Dict[str, Any]]:
        """선택된 noun_phrase_summary를 가진 대표 개념 선택.
        
        Args:
            concept_details: 개념 상세 정보 리스트
            selected_noun_phrase: LLM이 선택한 noun_phrase_summary
            
        Returns:
            대표 개념 딕셔너리 또는 None
        """
        if not concept_details:
            return None
        
        # 선택된 noun_phrase_summary와 일치하는 개념 찾기
        for concept in concept_details:
            noun_phrase = concept.get("noun_phrase_summary", "").strip()
            if noun_phrase == selected_noun_phrase:
                return concept
        
        # 정확히 일치하는 것이 없으면 첫 번째 개념 반환
        return concept_details[0]

    def add_to_ontology(self, state: MappingState) -> MappingState:
        """온톨로지 추가 노드 (ontology_updater 사용).
        
        Args:
            state: 현재 상태
            
        Returns:
            업데이트된 상태
        """
        cluster = state.get("cluster", {})
        
        if not cluster:
            return state
        
        # LLM이 선택한 대표 개념 사용
        representative_concept = cluster.get("representative_concept")
        
        if not representative_concept:
            if self.debug:
                print("✗ 대표 개념 선택 실패", flush=True)
            return state
        
        # 대표 개념을 온톨로지에 추가
        concept_id = representative_concept.get('noun_phrase_summary') or representative_concept.get('concept', '')
        concept_to_add = {
            "concept_id": concept_id,
            "label": concept_id,
            "description": cluster.get('representative_description', '')
        }
        
        if self.debug:
            print(f"\n[대표 개념 선택]", flush=True)
            print(f"  선택된 대표 개념: {representative_concept.get('noun_phrase_summary', representative_concept.get('concept', 'N/A'))}", flush=True)
            print(f"  원본 키워드: {representative_concept.get('original_keyword', 'N/A')}", flush=True)
            print(f"\n[온톨로지에 추가할 개념]", flush=True)
            print(f"  - 개념 ID: {concept_to_add['concept_id']}", flush=True)
            print(f"  - 새로 생성된 Description:", flush=True)
            print(f"    {concept_to_add['description']}", flush=True)
        
        # 부모 개념 후보 결정 (LLM 사용, 최대 3개, 점수 포함)
        parent_candidates, reason = self.ontology_updater._decide_parent_candidates(
            concept_id=concept_to_add['concept_id'],
            description=concept_to_add['description'],
            debug=self.debug
        )
        
        if not parent_candidates:
            if self.debug:
                print(f"\n[온톨로지 추가 취소]", flush=True)
                print(f"  부모 개념 후보를 결정하지 못하여 개념 추가를 건너뜁니다.", flush=True)
            return state
        
        # parent_candidates의 첫 번째 것을 주 부모로 사용 (Graph DB 추가용)
        parent_concept = parent_candidates[0]["concept"]
        
        # 클러스터에서 오리지널 키워드 리스트 추출
        concept_details = cluster.get("concept_details", [])
        original_keywords = [
            detail.get("original_keyword")
            for detail in concept_details
            if detail.get("original_keyword")
        ]
        
        # 할당된 개념(concept_id)도 original_keywords에 추가
        original_keywords.append(concept_to_add['concept_id'])
        
        if self.debug:
            print(f"\n[온톨로지에 추가 중]", flush=True)
            print(f"주 부모 개념: {parent_concept}", flush=True)
            print(f"부모 후보 수: {len(parent_candidates)}개", flush=True)
            for idx, cand in enumerate(parent_candidates, 1):
                print(f"  {idx}. {cand['concept']} (점수: {cand['score']})", flush=True)
        
        # 스테이징 모드로 먼저 추가 (임시)
        self.ontology_updater.add_new_concept(
            concept_id=concept_to_add['concept_id'],
            label=concept_to_add['label'],
            description=concept_to_add['description'],
            parent_concept=parent_concept or "LLMConcept",
            staging=True,
            original_keywords=original_keywords,
            parent_assignment_reason=reason,
            parent_candidates=parent_candidates
        )
        
        # 스테이징된 변경사항 확인 및 표시
        if self.debug and self.ontology_updater.graph_manager:
            changes = self.ontology_updater.graph_manager.get_staging_changes()
            if changes.get("added"):
                print(f"\n[스테이징 확인] 추가될 개념들:", flush=True)
                for concept_id in changes["added"]:
                    path = self.ontology_updater.graph_manager.get_path_to_root(concept_id)
                    print(f"  - {concept_id} (경로: {' → '.join(path)})", flush=True)
                
        
        # 스테이징만 수행 (실제 DB 반영은 main.py 끝에서 일괄 처리)
        # 스테이징된 변경사항은 graph_manager에 저장됨
        
        self.new_concept_manager.remove_cluster(cluster["id"])
        
        # 추가된 concept_id를 state에 저장 (add_relations_by_source에서 사용)
        state["matched_concept_id"] = concept_to_add['concept_id']
        
        if self.debug:
            print(f"\n✓ 온톨로지 추가 완료", flush=True)
            print(f"  - 부모 개념: {parent_concept}", flush=True)
            print(f"  - 추가된 개념: {concept_to_add['concept_id']}", flush=True)
            print(f"  - 클러스터 ID {cluster['id']} 삭제됨", flush=True)
        
        return state

