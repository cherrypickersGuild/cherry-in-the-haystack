"""Staging manager for batch concept addition with review."""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional
from pipeline.ontology_graph_manager import OntologyGraphManager
from storage.graph_query_engine import GraphQueryEngine
from storage.vector_store import VectorStore


class StagingManager:
    """스테이징된 개념들을 관리하고 최종 확인 후 실제 DB에 반영."""
    
    def __init__(
        self,
        graph_manager: OntologyGraphManager,
        graph_engine: GraphQueryEngine,
        vector_store: VectorStore,
        db_path: Optional[str] = None
    ) -> None:
        """StagingManager 초기화.
        
        Args:
            graph_manager: OntologyGraphManager 인스턴스
            graph_engine: GraphQueryEngine 인스턴스
            vector_store: VectorStore 인스턴스
            db_path: 스테이징 파일 저장 경로 (None이면 vector_store의 db_path 사용)
        """
        self.graph_manager = graph_manager
        self.graph_engine = graph_engine
        self.vector_store = vector_store
        
        # 스테이징된 개념들 저장 (확인용)
        self.staged_concepts: List[Dict[str, Any]] = []
        
        # 스테이징 파일 경로 설정 (db/stage/{task_id}/staged_result/ 디렉토리에 저장)
        if db_path:
            base_path = Path(db_path).parent / "staged_result"
        else:
            base_path = Path(vector_store.db_path).parent / "staged_result"
        
        self.staging_file_path = str(base_path / "staging_concepts.json")
        base_path.mkdir(parents=True, exist_ok=True)
    
    def _save_to_file(self) -> None:
        """스테이징 데이터를 JSON 파일로 저장."""
        data = {
            "staged_concepts": self.staged_concepts,
            "last_updated": datetime.now().isoformat()
        }
        with open(self.staging_file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def add_staged_concept(
        self,
        concept_id: str,
        label: str,
        description: str,
        parent_concept: str,
        original_keywords: Optional[List[str]] = None,
        parent_assignment_reason: Optional[str] = None,
        parent_candidates: Optional[List[Dict[str, Any]]] = None
    ) -> None:
        """스테이징된 개념 추가 (메타데이터 저장).
        
        Args:
            concept_id: 개념 ID
            label: 개념 레이블
            description: 개념 설명
            parent_concept: 부모 개념 ID (Graph DB 추가용, parent_candidates의 첫 번째 것)
            original_keywords: 클러스터에 있던 오리지널 키워드 리스트 및 할당된 개념
            parent_assignment_reason: 부모 할당 이유
            parent_candidates: 부모 개념 후보 리스트 (최대 3개, 각각 {concept: str, score: int} 형식)
        """
        concept_data = {
            "concept_id": concept_id,
            "label": label,
            "description": description
        }
        
        if original_keywords:
            concept_data["original_keywords"] = original_keywords
        
        if parent_assignment_reason:
            concept_data["parent_assignment_reason"] = parent_assignment_reason
        
        if parent_candidates:
            concept_data["parent_candidates"] = parent_candidates
        
        self.staged_concepts.append(concept_data)
        self._save_to_file()  # 자동 저장
    
    def get_staging_summary(self) -> Dict[str, Any]:
        """스테이징된 변경사항 요약.
        
        Returns:
            변경사항 요약 딕셔너리
        """
        changes = self.graph_manager.get_staging_changes()
        
        # 부모 개념별로 그룹화 (parent_candidates의 첫 번째 것 사용)
        by_parent = {}
        for concept in self.staged_concepts:
            parent_candidates = concept.get("parent_candidates", [])
            if parent_candidates:
                parent = parent_candidates[0]["concept"]
            else:
                parent = "Unknown"
            if parent not in by_parent:
                by_parent[parent] = []
            by_parent[parent].append(concept)
        
        return {
            "total_concepts": len(self.staged_concepts),
            "added_concepts": changes.get("added", []),
            "by_parent": by_parent,
            "graph_stats": {
                "total_nodes": len(self.graph_manager.staging_graph.nodes()),
                "total_edges": len(self.graph_manager.staging_graph.edges()),
                "staging_nodes": len(self.graph_manager.staging_concepts)
            }
        }
    
    def sync_from_graph_manager(self) -> None:
        """graph_manager의 스테이징 정보를 기반으로 staged_concepts를 채움.
        
        add_staged_concept()가 호출되지 않은 경우를 대비하여,
        graph_manager와 vector_store의 스테이징 정보를 기반으로
        staged_concepts를 자동으로 채웁니다.
        """
        changes = self.graph_manager.get_staging_changes()
        added_concept_ids = set(changes.get("added", []))
        
        if not added_concept_ids:
            return
        
        staging_data = self.vector_store.staging_collection.get()
        
        if not staging_data["ids"]:
            return
        
        for i, concept_id in enumerate(staging_data["ids"]):
            if concept_id in added_concept_ids:
                metadata = staging_data["metadatas"][i]
                description = staging_data["documents"][i]
                label = metadata.get("label", concept_id)
                
                parent_candidates = metadata.get("parent_candidates", [])
                if parent_candidates:
                    parent_concept = parent_candidates[0]["concept"]
                else:
                    parent_concept = metadata.get("parent", "")
                
                if not parent_concept or parent_concept not in self.graph_manager.staging_graph:
                    predecessors = list(self.graph_manager.staging_graph.predecessors(concept_id))
                    if predecessors:
                        parent_concept = predecessors[0]
                    else:
                        parent_concept = "LLMConcept"
                
                existing = any(c["concept_id"] == concept_id for c in self.staged_concepts)
                if not existing:
                    self.staged_concepts.append({
                        "concept_id": concept_id,
                        "label": label,
                        "description": description,
                        "parent_concept": parent_concept
                    })
        
        if self.staged_concepts:
            self._save_to_file()
    
    def print_staging_summary(self) -> None:
        """스테이징된 변경사항을 출력."""
        self.sync_from_graph_manager()
        summary = self.get_staging_summary()
        
        print(f"\n{'='*80}")
        print(f"스테이징된 변경사항 요약")
        print(f"{'='*80}")
        print(f"\n총 추가될 개념 수: {summary['total_concepts']}개")
        print(f"그래프 노드 수: {summary['graph_stats']['total_nodes']}개")
        print(f"그래프 엣지 수: {summary['graph_stats']['total_edges']}개")
        
        print(f"\n부모 개념별 분류:")
        for parent, concepts in summary['by_parent'].items():
            print(f"\n  [{parent}] ({len(concepts)}개)")
            for concept in concepts:
                path = self.graph_manager.get_path_to_root(concept["concept_id"])
                print(f"    - {concept['concept_id']}")
                print(f"      경로: {' → '.join(path)}")
                if concept.get("description"):
                    print(f"      설명: {concept['description'][:80]}...")
    
    
    def rollback_staging(self) -> None:
        """스테이징된 변경사항을 취소."""
        print(f"\n스테이징 롤백 중...")
        self.graph_manager.rollback_staging()
        self.vector_store.rollback_staging()
        self.staged_concepts.clear()
        
        # 스테이징 파일도 삭제
        if os.path.exists(self.staging_file_path):
            os.remove(self.staging_file_path)
        
        print(f"✓ 스테이징 롤백 완료")
        print(f"  - 그래프 매니저: 롤백 완료")
        print(f"  - Vector DB: 스테이징 컬렉션 초기화")
        print(f"  - 스테이징 파일: 삭제됨")

