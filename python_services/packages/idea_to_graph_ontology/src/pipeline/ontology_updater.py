"""Ontology updater for adding new concepts and relations."""

import os
from typing import Dict, List, Any, Optional, Tuple

from pydantic import BaseModel, Field

from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

from storage.graph_query_engine import GraphQueryEngine
from storage.vector_store import VectorStore
from pipeline.ontology_graph_manager import OntologyGraphManager
from pipeline.staging_manager import StagingManager


class ParentCandidate(BaseModel):
    """부모 개념 후보 모델."""
    
    concept: str = Field(..., description="부모 개념 ID")
    score: int = Field(..., description="적합도 점수 (1-3점 척도)")


class ParentCandidatesResult(BaseModel):
    """부모 개념 후보 결정 결과 모델."""
    
    candidates: List[ParentCandidate] = Field(
        ...,
        description="부모 개념 후보 리스트 (최대 3개, 점수 높은 순)"
    )
    reason: str = Field(
        ...,
        description="각 후보를 선택한 이유를 상세히 설명"
    )


class ParentConceptResult(BaseModel):
    """부모 개념 결정 결과 모델 (하위 호환성 유지용)."""
    
    parent_concept_id: Optional[str] = Field(
        None,
        description="부모 개념 ID. 적절한 부모가 없으면 None"
    )
    reason: str = Field(
        ...,
        description="이 부모 개념을 선택한 이유를 상세히 설명"
    )


class CriticReviewResult(BaseModel):
    """비평가 검토 결과 모델."""
    
    is_appropriate: bool = Field(
        ...,
        description="선택된 부모 개념이 적절한지 여부"
    )
    feedback: str = Field(
        ...,
        description="선택된 부모 개념에 대한 피드백 (한국어로 작성)"
    )
    alternative_parent: Optional[str] = Field(
        None,
        description="더 적절한 대안 부모 개념 ID (없으면 None)"
    )
    alternative_reason: Optional[str] = Field(
        None,
        description="대안 부모 개념을 제안하는 이유 (한국어로 작성)"
    )


class DescriptionResult(BaseModel):
    """설명 생성 결과 모델."""
    
    description: str = Field(..., description="생성된 설명 (3-5문장)")


class OntologyUpdater:
    """온톨로지 업데이트 (신규 개념 추가, relation 추가)."""

    def __init__(
        self,
        graph_engine: GraphQueryEngine,
        vector_store: VectorStore,
        llm: ChatOpenAI = None,
        graph_manager: Optional[OntologyGraphManager] = None,
        staging_manager: Optional[StagingManager] = None
    ) -> None:
        """OntologyUpdater 초기화.
        
        Args:
            graph_engine: GraphQueryEngine 인스턴스
            vector_store: VectorStore 인스턴스
            llm: LLM 인스턴스 (부모 개념 결정용)
            graph_manager: OntologyGraphManager 인스턴스 (선택)
            staging_manager: StagingManager 인스턴스 (선택)
        """
        self.graph_engine = graph_engine
        self.vector_store = vector_store
        model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        self.llm = llm or ChatOpenAI(model=model, temperature=0)
        self.structured_llm_parent = self.llm.with_structured_output(ParentConceptResult)
        self.structured_llm_parent_candidates = self.llm.with_structured_output(ParentCandidatesResult)
        self.structured_llm_critic = self.llm.with_structured_output(CriticReviewResult)
        self.structured_llm_description = self.llm.with_structured_output(DescriptionResult)
        self.graph_manager = graph_manager
        self.staging_manager = staging_manager

    def add_new_concept(
        self,
        concept_id: str,
        label: str,
        description: str,
        parent_concept: str,
        staging: bool = False,
        original_keywords: Optional[List[str]] = None,
        parent_assignment_reason: Optional[str] = None,
        parent_candidates: Optional[List[Dict[str, Any]]] = None
    ) -> None:
        """신규 개념을 Graph DB와 Vector DB에 추가.
        
        Args:
            concept_id: 개념 ID
            label: 개념 레이블
            description: 개념 설명
            parent_concept: 부모 개념 ID
            staging: 스테이징 모드 (임시 추가만, 실제 DB에는 반영 안 함)
            original_keywords: 클러스터에 있던 오리지널 키워드 리스트
            parent_assignment_reason: 부모 할당 이유
        """
        if staging:
            # 스테이징 모드: 그래프 매니저와 스테이징 컬렉션에만 추가
            if self.graph_manager:
                self.graph_manager.stage_add_concept(
                    concept_id=concept_id,
                    parent_id=parent_concept,
                    label=label,
                    description=description
                )
            
            # 스테이징 컬렉션에 추가 (유사도 검색을 위해)
            self.vector_store.add_concept(
                concept_id=concept_id,
                description=description,
                label=label,
                parent=parent_concept,
                staging=True  # 스테이징 컬렉션에 추가
            )
            
            # 스테이징 매니저에 메타데이터 저장
            if self.staging_manager:
                self.staging_manager.add_staged_concept(
                    concept_id=concept_id,
                    label=label,
                    description=description,
                    parent_concept=parent_concept,
                    original_keywords=original_keywords,
                    parent_assignment_reason=parent_assignment_reason,
                    parent_candidates=parent_candidates
                )
        else:
            # 실제 DB에 추가
            self.graph_engine.add_concept(concept_id, label, parent_concept, description)
            
            self.vector_store.add_concept(
                concept_id=concept_id,
                description=description,
                label=label,
                parent=parent_concept,
                staging=False  # 실제 컬렉션에 추가
            )
            
            # 그래프 매니저가 있으면 실제 그래프도 업데이트
            if self.graph_manager:
                self.graph_manager.stage_add_concept(
                    concept_id=concept_id,
                    parent_id=parent_concept,
                    label=label,
                    description=description
                )
                self.graph_manager.commit_staging()

    def add_new_concepts(
        self,
        concepts: List[Dict[str, Any]],
        parent_concept: Optional[str] = None,
        debug: bool = False,
        staging: bool = False
    ) -> None:
        """신규 개념들을 온톨로지에 추가.
        
        Args:
            concepts: 추가할 개념 리스트 (concept_id, label, description 포함)
            parent_concept: 부모 개념 ID (없으면 각 개념마다 LLM이 결정)
            debug: 디버그 모드 여부
            staging: 스테이징 모드 (임시 추가만, 실제 DB에는 반영 안 함)
        """
        if debug:
            mode_str = "[스테이징 모드]" if staging else "[실제 DB 추가]"
            print(f"{mode_str} 개념 수: {len(concepts)}개", flush=True)
        
        for idx, concept in enumerate(concepts, 1):
            # 각 개념마다 부모 개념 결정 (공통 부모가 없으면)
            concept_parent = parent_concept
            reason = None
            if not concept_parent:
                concept_parent, reason = self._decide_parent_concept(
                    concept_id=concept["concept_id"],
                    description=concept["description"],
                    debug=debug
                )
            
            if not concept_parent:
                concept_parent = "LLMConcept"
                if debug:
                    print(f"[기본값 사용] 부모 개념: {concept_parent}", flush=True)
            
            if debug:
                print(f"  [{idx}/{len(concepts)}] {concept['concept_id']} → {concept_parent}의 subclass로 추가", flush=True)
            
            original_keywords = concept.get("original_keywords")
            parent_assignment_reason = reason or concept.get("parent_assignment_reason")
            
            self.add_new_concept(
                concept_id=concept["concept_id"],
                label=concept.get("label", concept["concept_id"]),
                description=concept["description"],
                parent_concept=concept_parent,
                staging=staging,
                original_keywords=original_keywords,
                parent_assignment_reason=parent_assignment_reason
            )
        
        if debug:
            mode_str = "[스테이징 완료]" if staging else "[실제 DB 추가 완료]"
            print(f"{mode_str} 총 {len(concepts)}개 개념 추가됨", flush=True)

    def update_description(self, concept_id: str, description: str) -> None:
        """개념의 description을 Graph DB와 Vector DB에서 업데이트.
        
        Args:
            concept_id: 개념 ID
            description: 새 설명
        """
        self.graph_engine.update_description(concept_id, description)
        self.vector_store.update_concept(concept_id, description)

    def add_relations(self, concepts: List[str]) -> None:
        """동일 청크 개념 간 relation 추가.
        
        Args:
            concepts: 개념 ID 리스트
        """
        for i, concept1 in enumerate(concepts):
            for concept2 in concepts[i + 1:]:
                self.graph_engine.add_relation(concept1, concept2)

    def _decide_parent_candidates(
        self,
        concept_id: str,
        description: str,
        debug: bool = False
    ) -> Tuple[List[Dict[str, Any]], Optional[str]]:
        """LLM으로 부모 개념 후보 결정 (최대 3개, 점수 포함).
        
        Args:
            concept_id: 개념 ID
            description: 개념 설명
            debug: 디버그 모드 여부
            
        Returns:
            (부모 후보 리스트 [{concept: str, score: int}, ...], 결정 이유) 튜플
        """
        if debug:
            print(f"\n[부모 개념 후보 결정]", flush=True)
            print(f"입력 개념: {concept_id}", flush=True)
        
        similar_concepts = self.graph_manager.find_similar_concepts_in_graph(
            description,
            k=5
        )
        
        similar_concepts = [sim for sim in similar_concepts if sim.get("concept_id") != "LLMConcept"]
        
        if debug:
            print(f"\n[1단계] Vector DB에서 찾은 유사 개념:", flush=True)
            for idx, sim in enumerate(similar_concepts, 1):
                concept_id_sim = sim.get("concept_id", "")
                path = sim.get("path_to_root", [])
                print(f"  {idx}. {concept_id_sim}", flush=True)
                if path:
                    print(f"     경로: {' → '.join(path)}", flush=True)
        
        candidate_parents = set()
        for similar in similar_concepts:
            concept_id_sim = similar.get('concept_id', '')
            path = similar.get('path_to_root', [])
            
            if concept_id_sim and concept_id_sim != "LLMConcept":
                candidate_parents.add(concept_id_sim)
            
            if path:
                for node in path[1:-1]:
                    if node != "LLMConcept":
                        candidate_parents.add(node)
        
        candidate_parents.discard("LLMConcept")
        
        if not candidate_parents:
            if debug:
                print(f"\n[경고] 후보 부모 개념이 없습니다.", flush=True)
            return ([], None)
        
        if debug:
            print(f"\n[2단계] 계층적 후보 부모 개념들:", flush=True)
            for candidate in sorted(candidate_parents):
                print(f"  - {candidate}", flush=True)
        
        candidate_info_list = []
        for candidate_id in sorted(candidate_parents):
            subtree_viz = self.graph_manager.visualize_subtree(candidate_id, max_depth=2)
            
            path_to_candidate = self.graph_manager.get_path_to_root(candidate_id)
            siblings = []
            if len(path_to_candidate) > 1:
                parent_id = path_to_candidate[-2]
                if parent_id in self.graph_manager.staging_graph:
                    all_children = list(self.graph_manager.staging_graph.successors(parent_id))
                    siblings = [c for c in all_children if c != candidate_id]
            
            similarity_score = None
            try:
                similar_to_candidate = self.vector_store.find_similar(description, k=10, include_staging=True)
                for sim in similar_to_candidate:
                    if sim.get('concept_id') == candidate_id:
                        distance = sim.get('distance')
                        if distance is not None:
                            similarity_score = 1 - distance
                        break
            except Exception:
                pass
            
            candidate_info_list.append({
                "concept_id": candidate_id,
                "subtree": subtree_viz,
                "siblings": siblings[:5],
                "similarity": similarity_score,
                "path_to_root": path_to_candidate
            })
        
        if debug:
            print(f"\n[3단계] 후보 부모 개념 상세 정보:", flush=True)
            for info in candidate_info_list:
                print(f"  - {info['concept_id']}", flush=True)
                print(f"    형제 개념: {', '.join(info['siblings'][:3])}..." if info['siblings'] else "    형제 개념: 없음", flush=True)
                print(f"    유사도: {info['similarity']:.3f}" if info['similarity'] else "    유사도: N/A", flush=True)
        
        candidate_info_str = "\n\n".join([
            f"{idx}. {info['concept_id']}\n"
            f"   - 경로: {' → '.join(info['path_to_root'])}\n"
            f"   - 형제 개념: {', '.join(info['siblings'][:5]) if info['siblings'] else '없음'}\n"
            f"   - 유사도: {info['similarity']:.3f}" if info['similarity'] else f"   - 유사도: N/A"
            f"\n   - 서브트리:\n{info['subtree']}"
            for idx, info in enumerate(candidate_info_list, 1)
        ])
        
        messages = [
            SystemMessage(content="""당신은 온톨로지 전문가입니다.
새로운 개념을 온톨로지의 적절한 위치에 배치해야 합니다.

**작업:**
주어진 후보 부모 개념들 중에서 최대 3개를 선택하고, 각각에 대해 1-3점 척도로 적합도를 점수화하세요.

**점수 기준:**
- 3점: 매우 적합한 부모 개념 (논리적 일관성, 서브트리 구조, 형제 개념 비교, 의미적 유사도 모두 우수)
- 2점: 적합한 부모 개념 (대부분의 기준을 만족하지만 일부 부족한 점이 있음)
- 1점: 약간 적합한 부모 개념 (일부 기준은 만족하지만 다른 기준에서 부족함)

**판단 기준:**
1. 새 개념이 후보 부모의 하위 개념으로 논리적으로 적합한가?
2. 서브트리 구조를 보면 이 위치가 적절한가?
3. 형제 개념들과 비교했을 때 같은 레벨에 있어야 하는가?
4. 의미적 유사도가 높은가?

**중요:**
- 최대 3개까지만 선택하세요
- 점수가 높은 순으로 정렬하세요
- 각 후보에 대한 점수와 이유를 명확히 설명하세요
- 모든 피드백은 **한국어로** 작성하세요"""),
            HumanMessage(content=f"""다음 새 개념의 부모 개념 후보를 최대 3개까지 선택하고 각각에 점수를 부여해주세요:

**새 개념:**
- 개념 ID: {concept_id}
- 설명: {description[:500]}

**후보 부모 개념들:**

{candidate_info_str}

최대 3개를 선택하고 각각에 1-3점 척도로 점수를 부여해주세요. 점수가 높은 순으로 정렬하고, 각 후보를 선택한 이유를 **한국어로** 상세히 설명해주세요.""")
        ]
        
        try:
            if debug:
                print(f"\n[4단계] LLM으로 부모 개념 후보 결정 중...", flush=True)
            
            result = self.structured_llm_parent_candidates.invoke(messages)
            
            candidates = []
            for candidate in result.candidates[:3]:
                candidates.append({
                    "concept": candidate.concept,
                    "score": candidate.score
                })
            
            if debug:
                print(f"\n[부모 개념 후보 결정 결과]", flush=True)
                for idx, cand in enumerate(candidates, 1):
                    print(f"  {idx}. {cand['concept']} (점수: {cand['score']})", flush=True)
                if result.reason:
                    print(f"  결정 이유: {result.reason[:200]}...", flush=True)
            
            return (candidates, result.reason)
        
        except Exception as e:
            if debug:
                print(f"[LLM 오류] 부모 개념 후보 결정 실패: {e}", flush=True)
            return ([], None)

    def _decide_parent_concept(
        self,
        concept_id: str,
        description: str,
        debug: bool = False
    ) -> Tuple[Optional[str], Optional[str]]:
        """LLM으로 부모 개념 결정 (고도화된 버전).
        
        1. Vector DB에서 유사 개념 검색
        2. 계층적 후보 수집 (유사 개념의 경로상 모든 개념)
        3. 각 후보에 대한 정보 수집 (서브트리, 형제 개념, 유사도)
        4. LLM으로 최종 결정
        
        Args:
            concept_id: 개념 ID
            description: 개념 설명
            debug: 디버그 모드 여부
            
        Returns:
            (부모 개념 ID, 결정 이유) 튜플 (결정 실패시 (None, None))
        """
        
        if debug:
            print(f"\n[부모 개념 결정]", flush=True)
            print(f"입력 개념: {concept_id}", flush=True)
        
        # 1. Vector DB에서 유사 개념 검색
        similar_concepts = self.graph_manager.find_similar_concepts_in_graph(
            description,
            k=5
        )
        
        # LLMConcept은 검색 결과에서 제외
        similar_concepts = [sim for sim in similar_concepts if sim.get("concept_id") != "LLMConcept"]
        
        if debug:
            print(f"\n[1단계] Vector DB에서 찾은 유사 개념:", flush=True)
            for idx, sim in enumerate(similar_concepts, 1):
                concept_id_sim = sim.get("concept_id", "")
                path = sim.get("path_to_root", [])
                print(f"  {idx}. {concept_id_sim}", flush=True)
                if path:
                    print(f"     경로: {' → '.join(path)}", flush=True)
        
        # 2. 계층적 후보 수집 (유사 개념의 경로상 모든 개념 + 유사 개념들 자체)
        candidate_parents = set()
        for similar in similar_concepts:
            concept_id = similar.get('concept_id', '')
            path = similar.get('path_to_root', [])
            
            # 유사 개념 자체를 후보로 추가 (LLMConcept 제외)
            if concept_id and concept_id != "LLMConcept":
                candidate_parents.add(concept_id)
            
            # 경로상의 모든 개념도 후보로 추가 (루트와 자기 자신 제외)
            if path:
                # path[:-1]은 루트를 제외한 모든 개념 (자기 자신 포함)
                # path[1:-1]은 루트와 자기 자신을 제외한 중간 개념들
                for node in path[1:-1]:  # 루트와 자기 자신 제외
                    if node != "LLMConcept":
                        candidate_parents.add(node)
        
        # LLMConcept은 후보에서 제외
        candidate_parents.discard("LLMConcept")
        
        if debug:
            print(f"\n[디버깅] 유사 개념들의 경로:", flush=True)
            for similar in similar_concepts:
                concept_id = similar.get('concept_id', '')
                path = similar.get('path_to_root', [])
                print(f"  - {concept_id}: {path}", flush=True)
        
        if not candidate_parents:
            if debug:
                print(f"\n[경고] 후보 부모 개념이 없습니다.", flush=True)
            return (None, None)
        
        if debug:
            print(f"\n[2단계] 계층적 후보 부모 개념들:", flush=True)
            for candidate in sorted(candidate_parents):
                print(f"  - {candidate}", flush=True)
        
        # 3. 각 후보에 대한 정보 수집
        candidate_info_list = []
        for candidate_id in sorted(candidate_parents):
            # 서브트리 구조
            subtree_viz = self.graph_manager.visualize_subtree(candidate_id, max_depth=2)
            
            # 형제 개념들
            path_to_candidate = self.graph_manager.get_path_to_root(candidate_id)
            siblings = []
            if len(path_to_candidate) > 1:
                parent_id = path_to_candidate[-2]  # 부모 개념
                if parent_id in self.graph_manager.staging_graph:
                    all_children = list(self.graph_manager.staging_graph.successors(parent_id))
                    siblings = [c for c in all_children if c != candidate_id]
            
            # 의미적 유사도 (VectorStore에서 재계산)
            similarity_score = None
            try:
                similar_to_candidate = self.vector_store.find_similar(description, k=10, include_staging=True)
                for sim in similar_to_candidate:
                    if sim.get('concept_id') == candidate_id:
                        distance = sim.get('distance')
                        if distance is not None:
                            similarity_score = 1 - distance
                        break
            except Exception:
                pass
            
            candidate_info_list.append({
                "concept_id": candidate_id,
                "subtree": subtree_viz,
                "siblings": siblings[:5],  # 최대 5개만
                "similarity": similarity_score,
                "path_to_root": path_to_candidate
            })
        
        if debug:
            print(f"\n[3단계] 후보 부모 개념 상세 정보:", flush=True)
            for info in candidate_info_list:
                print(f"  - {info['concept_id']}", flush=True)
                print(f"    형제 개념: {', '.join(info['siblings'][:3])}..." if info['siblings'] else "    형제 개념: 없음", flush=True)
                print(f"    유사도: {info['similarity']:.3f}" if info['similarity'] else "    유사도: N/A", flush=True)
        
        # 4. LLM으로 최종 부모 개념 결정
        candidate_info_str = "\n\n".join([
            f"{idx}. {info['concept_id']}\n"
            f"   - 경로: {' → '.join(info['path_to_root'])}\n"
            f"   - 형제 개념: {', '.join(info['siblings'][:5]) if info['siblings'] else '없음'}\n"
            f"   - 유사도: {info['similarity']:.3f}" if info['similarity'] else f"   - 유사도: N/A"
            f"\n   - 서브트리:\n{info['subtree']}"
            for idx, info in enumerate(candidate_info_list, 1)
        ])
        
        messages = [
            SystemMessage(content="""당신은 온톨로지 전문가입니다.
새로운 개념을 온톨로지의 적절한 위치에 배치해야 합니다.

**판단 기준:**
1. 새 개념이 후보 부모의 하위 개념으로 논리적으로 적합한가?
2. 서브트리 구조를 보면 이 위치가 적절한가?
3. 형제 개념들과 비교했을 때 같은 레벨에 있어야 하는가?
4. 의미적 유사도가 높은가?

**중요:**
- 반드시 제공된 후보 중 하나를 선택하세요.
- 기존 온톨로지에 있는 개념 ID만 반환하세요.
- 적절한 부모 개념이 없으면 parent_concept_id를 None으로 설정하세요.
- reason 필드에는 이 부모 개념을 선택한 이유를 **한국어로** 상세히 설명하세요. 판단 기준(논리적 적합성, 서브트리 구조, 형제 개념 비교, 의미적 유사도)을 고려하여 작성하세요.
- reason은 다음 형식으로 작성하세요:
  - 논리적 적합성: 새 개념이 왜 이 부모 개념의 하위 개념으로 적합한지 설명
  - 서브트리 구조: 서브트리 구조상 이 위치가 적절한 이유
  - 형제 개념 비교: 형제 개념들과 비교했을 때 같은 레벨에 있어야 하는 이유
  - 의미적 유사도: 의미적 유사도 점수가 높은 이유"""),
            HumanMessage(content=f"""다음 새 개념의 부모 개념을 결정해주세요:

**새 개념:**
- 개념 ID: {concept_id}
- 설명: {description[:500]}

**후보 부모 개념들:**

{candidate_info_str}

가장 적절한 부모 개념 ID를 선택하고, 선택한 이유를 **한국어로** 상세히 설명해주세요.""")
        ]
        
        try:
            if debug:
                print(f"\n[3단계] LLM으로 최종 부모 개념 결정 중...", flush=True)
            
            result = self.structured_llm_parent.invoke(messages)
            parent_id = result.parent_concept_id
            reason = result.reason
            
            if not parent_id:
                if debug:
                    print(f"[LLM 응답] 부모 개념을 찾지 못함", flush=True)
                    if reason:
                        print(f"  이유: {reason}", flush=True)
                return (None, None)
            
            # LLMConcept 바로 아래 추가는 절대 허용하지 않음
            if parent_id == "LLMConcept":
                if debug:
                    print(f"[경고] LLMConcept 바로 아래 추가는 허용되지 않습니다.", flush=True)
                    print(f"  최소 1 depth 아래에만 추가 가능합니다.", flush=True)
                return (None, None)
            
            # 선택된 부모의 서브트리 시각화
            if debug and (parent_id in self.graph_manager.staging_graph or parent_id in self.graph_manager.real_graph):
                subtree_viz = self.graph_manager.visualize_subtree(parent_id, max_depth=2)
                print(f"\n[선택된 부모 개념의 서브트리]", flush=True)
                print(subtree_viz, flush=True)
            
            if debug:
                print(f"\n[초기 결정] 부모 개념: {parent_id}", flush=True)
                path_to_parent = self.graph_manager.get_path_to_root(parent_id)
                if path_to_parent:
                    print(f"  경로: {' → '.join(path_to_parent)}", flush=True)
                if reason:
                    print(f"  결정 이유: {reason}", flush=True)
            
            # 5. 비평가 검토
            final_parent_id, final_reason = self._review_with_critic(
                concept_id=concept_id,
                description=description,
                initial_parent_id=parent_id,
                initial_reason=reason,
                candidate_info_list=candidate_info_list,
                debug=debug
            )
            
            if debug:
                print(f"\n[최종 결정] 부모 개념: {final_parent_id}", flush=True)
                if final_reason:
                    print(f"  결정 이유: {final_reason}", flush=True)
            
            return (final_parent_id, final_reason)
        except Exception as e:
            if debug:
                print(f"[LLM 오류] 부모 개념 결정 실패: {e}", flush=True)
            return (None, None)

    def _review_with_critic(
        self,
        concept_id: str,
        description: str,
        initial_parent_id: str,
        initial_reason: str,
        candidate_info_list: List[Dict[str, Any]],
        debug: bool = False
    ) -> Tuple[Optional[str], Optional[str]]:
        """비평가로 초기 결정을 검토하고 피드백 반영.
        
        Args:
            concept_id: 새 개념 ID
            description: 새 개념 설명
            initial_parent_id: 초기에 선택된 부모 개념 ID
            initial_reason: 초기 결정 이유
            candidate_info_list: 후보 부모 개념 정보 리스트
            debug: 디버그 모드 여부
            
        Returns:
            (최종 부모 개념 ID, 최종 결정 이유) 튜플
        """
        if debug:
            print(f"\n[4단계] 비평가 검토 중...", flush=True)
        
        # 선택된 부모의 자식 개념들 수집
        children = []
        if initial_parent_id in self.graph_manager.staging_graph:
            children = list(self.graph_manager.staging_graph.successors(initial_parent_id))
        elif initial_parent_id in self.graph_manager.real_graph:
            children = list(self.graph_manager.real_graph.successors(initial_parent_id))
        
        children_info = []
        for child_id in children[:10]:  # 최대 10개만
            child_path = self.graph_manager.get_path_to_root(child_id)
            children_info.append({
                "concept_id": child_id,
                "path": child_path
            })
        
        children_str = "\n".join([
            f"  - {child['concept_id']} (경로: {' → '.join(child['path'])})"
            for child in children_info
        ]) if children_info else "  없음"
        
        # 다른 후보들 정보 정리
        other_candidates_str = "\n\n".join([
            f"{idx}. {info['concept_id']}\n"
            f"   - 경로: {' → '.join(info['path_to_root'])}\n"
            f"   - 형제 개념: {', '.join(info['siblings'][:5]) if info['siblings'] else '없음'}\n"
            f"   - 유사도: {info['similarity']:.3f}" if info['similarity'] else f"   - 유사도: N/A"
            for idx, info in enumerate(candidate_info_list, 1)
            if info['concept_id'] != initial_parent_id
        ])
        
        messages = [
            SystemMessage(content="""당신은 온톨로지 구조 비평가입니다.
초기에 선택된 부모 개념이 적절한지 검토하고, 더 나은 대안이 있는지 평가해야 합니다.

**검토 기준:**
1. 선택된 부모 개념에 이미 있는 자식 개념들과 새 개념이 논리적으로 일관성 있는가?
2. 새 개념이 기존 자식 개념들과 같은 레벨에 있어야 하는가, 아니면 다른 위치가 더 적절한가?
3. 다른 후보 부모 개념들 중에 더 적절한 것이 있는가?
4. 온톨로지의 계층 구조가 논리적으로 일관성 있게 유지되는가?

**중요:**
- is_appropriate가 False인 경우, alternative_parent에 더 적절한 부모 개념 ID를 제안하세요.
- 모든 피드백은 **한국어로** 작성하세요.
- alternative_parent는 반드시 제공된 후보 중 하나여야 합니다.
- 적절하다고 판단되면 is_appropriate를 True로 설정하고 alternative_parent는 None으로 설정하세요."""),
            HumanMessage(content=f"""다음 초기 결정을 검토해주세요:

**새 개념:**
- 개념 ID: {concept_id}
- 설명: {description[:500]}

**초기 결정:**
- 선택된 부모 개념: {initial_parent_id}
- 결정 이유: {initial_reason}

**선택된 부모 개념의 기존 자식 개념들:**
{children_str}

**다른 후보 부모 개념들:**
{other_candidates_str}

초기 결정이 적절한지 검토하고, 더 나은 대안이 있다면 제안해주세요.""")
        ]
        
        try:
            critic_result = self.structured_llm_critic.invoke(messages)
            
            if debug:
                print(f"\n[비평가 검토 결과]", flush=True)
                print(f"  적절성: {'적절함' if critic_result.is_appropriate else '부적절함'}", flush=True)
                print(f"  피드백: {critic_result.feedback}", flush=True)
                if critic_result.alternative_parent:
                    print(f"  대안 부모: {critic_result.alternative_parent}", flush=True)
                    print(f"  대안 이유: {critic_result.alternative_reason}", flush=True)
            
            # 비평가가 적절하다고 판단한 경우
            if critic_result.is_appropriate:
                final_reason = f"{initial_reason}\n\n[비평가 검토]\n{critic_result.feedback}"
                return (initial_parent_id, final_reason)
            
            # 비평가가 대안을 제안한 경우
            if critic_result.alternative_parent:
                # 대안이 유효한 후보인지 확인
                valid_alternative = any(
                    info['concept_id'] == critic_result.alternative_parent
                    for info in candidate_info_list
                )
                
                if valid_alternative:
                    if debug:
                        print(f"\n[비평가 제안 반영] 대안 부모 개념으로 변경: {critic_result.alternative_parent}", flush=True)
                    
                    final_reason = f"{initial_reason}\n\n[비평가 검토 및 제안]\n{critic_result.feedback}\n\n[최종 선택: {critic_result.alternative_parent}]\n{critic_result.alternative_reason}"
                    return (critic_result.alternative_parent, final_reason)
                else:
                    if debug:
                        print(f"[경고] 비평가가 제안한 대안이 유효한 후보가 아닙니다. 초기 결정을 유지합니다.", flush=True)
                    final_reason = f"{initial_reason}\n\n[비평가 검토]\n{critic_result.feedback}\n\n[참고: 제안된 대안이 유효하지 않아 초기 결정을 유지합니다.]"
                    return (initial_parent_id, final_reason)
            
            # 비평가가 부적절하다고 판단했지만 대안이 없는 경우
            final_reason = f"{initial_reason}\n\n[비평가 검토]\n{critic_result.feedback}\n\n[참고: 비평가가 부적절하다고 판단했으나 대안이 없어 초기 결정을 유지합니다.]"
            return (initial_parent_id, final_reason)
            
        except Exception as e:
            if debug:
                print(f"[비평가 오류] 검토 실패: {e}", flush=True)
                print(f"초기 결정을 유지합니다.", flush=True)
            return (initial_parent_id, initial_reason)

    def generate_description(
        self,
        concept_id: str,
        label: str,
        parent: str = None
    ) -> str:
        """LLM으로 개념 설명 생성.
        
        Args:
            concept_id: 개념 ID
            label: 개념 레이블
            parent: 부모 개념 ID
            
        Returns:
            생성된 설명 (3-5문장)
        """
        parent_info = f"\n상위 개념: {parent}" if parent else ""
        
        messages = [
            SystemMessage(content="""당신은 LLM 및 AI 분야 전문가입니다.
주어진 개념에 대한 상세하고 정확한 설명을 작성해주세요.

다음 내용을 3-5문장으로 포함하세요:
1. 개념의 핵심 정의 (무엇인가?)
2. 주요 특징이나 작동 원리 (어떻게 동작하는가?)
3. 대표적인 사용 사례나 적용 분야 (어디에 쓰이는가?)
4. 관련된 다른 개념들이나 대비되는 특징

벡터 검색에 유리하도록 다양한 표현과 키워드를 자연스럽게 포함하세요.
전문적이면서도 명확하게 작성하세요."""),
            HumanMessage(content=f"""다음 개념에 대한 상세 설명을 작성해주세요:

개념: {label}{parent_info}

3-5문장으로 설명을 작성하세요.""")
        ]
        
        try:
            result = self.structured_llm_description.invoke(messages)
            return result.description
        except Exception as e:
            return f"{label} 관련 개념"

    def bulk_generate_descriptions(
        self,
        concepts: List[Dict[str, str]]
    ) -> Dict[str, str]:
        """여러 개념에 대한 설명을 배치로 생성.
        
        Args:
            concepts: 개념 리스트 (concept_id, label, parent 포함)
            
        Returns:
            concept_id -> description 딕셔너리
        """
        descriptions = {}
        
        for concept in concepts:
            description = self.generate_description(
                concept_id=concept["concept_id"],
                label=concept.get("label", concept["concept_id"]),
                parent=concept.get("parent")
            )
            descriptions[concept["concept_id"]] = description
        
        return descriptions

