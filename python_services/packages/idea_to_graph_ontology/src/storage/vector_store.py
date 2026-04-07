"""Vector store for ontology concepts using ChromaDB."""

from typing import Dict, List, Any, Optional
from pathlib import Path
import chromadb
from chromadb.config import Settings
from chromadb.utils import embedding_functions


class VectorStore:
    """ChromaDB 벡터 스토어 관리."""

    def __init__(
        self, 
        db_path: str, 
        collection_name: str = "ontology_concepts",
        task_id: Optional[str] = None
    ) -> None:
        """벡터 스토어 초기화.
        
        Args:
            db_path: ChromaDB 저장 경로
            collection_name: 컬렉션 이름
            task_id: task ID (stage 모드일 때 별도 디렉토리 사용)
        """
        if task_id:
            db_path = str(Path(db_path).parent / "stage" / task_id / "vector_store")
        
        db_path = str(Path(db_path).resolve())
        self.db_path = db_path
        self.collection_name = collection_name
        self.staging_collection_name = f"{collection_name}_staging"
        
        Path(db_path).mkdir(parents=True, exist_ok=True)
        
        self.client = chromadb.PersistentClient(
            path=db_path,
            settings=Settings(anonymized_telemetry=False)
        )
        
        embedding_function = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name="BAAI/bge-m3"
        )
        
        # 실제 컬렉션
        try:
            self.collection = self.client.get_collection(
                name=collection_name,
                embedding_function=embedding_function
            )
        except Exception:
            try:
                existing_collection = self.client.get_collection(name=collection_name)
                self.collection = existing_collection
            except Exception:
                self.collection = self.client.create_collection(
                    name=collection_name,
                    embedding_function=embedding_function,
                    metadata={"description": "LLM Ontology Concepts", "model": "BAAI/bge-m3"}
                )
        
        # 스테이징 컬렉션
        try:
            self.staging_collection = self.client.get_collection(
                name=self.staging_collection_name,
                embedding_function=embedding_function
            )
        except Exception:
            try:
                existing_staging = self.client.get_collection(name=self.staging_collection_name)
                self.staging_collection = existing_staging
            except Exception:
                self.staging_collection = self.client.create_collection(
                    name=self.staging_collection_name,
                    embedding_function=embedding_function,
                    metadata={"description": "LLM Ontology Concepts (Staging)", "model": "BAAI/bge-m3"}
                )

    def initialize(self, concepts: List[Dict[str, str]]) -> None:
        """온톨로지 개념들로 벡터 스토어 초기화.
        
        Args:
            concepts: 개념 정보 리스트 (concept_id, description 포함)
        """
        try:
            all_ids = self.collection.get()["ids"]
            if all_ids:
                self.collection.delete(ids=all_ids)
        except Exception:
            pass
        
        valid_concepts = [c for c in concepts if c.get("description")]
        
        if not valid_concepts:
            return
        
        ids = [c["concept_id"] for c in valid_concepts]
        documents = [c["description"] for c in valid_concepts]
        metadatas = [
            {
                "concept_id": str(c["concept_id"]),
                "label": str(c.get("label") or c["concept_id"]),
                "parent": str(c.get("parent")) if c.get("parent") else ""
            }
            for c in valid_concepts
        ]
        
        self.collection.add(
            ids=ids,
            documents=documents,
            metadatas=metadatas
        )

    def find_similar(
        self, 
        query: str, 
        k: int = 5, 
        include_staging: bool = True,
        exclude_concept_ids: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """유사 개념 검색.
        
        Args:
            query: 검색할 쿼리 (키워드 또는 문장)
            k: 반환할 유사 개념 개수
            include_staging: 스테이징 컬렉션도 검색할지 여부
            exclude_concept_ids: 검색에서 제외할 개념 ID 리스트
            
        Returns:
            유사 개념 리스트 (concept_id, description, distance 포함)
        """
        similar_concepts = []
        
        # 제외할 개념이 있으면 where 절 생성
        where_clause = None
        if exclude_concept_ids:
            where_clause = {
                "concept_id": {"$nin": exclude_concept_ids}
            }
        
        # 1. 실제 컬렉션에서 검색
        total_count = self.collection.count()
        if total_count > 0:
            # 제외할 개념이 있으면 더 많이 가져온 후 필터링
            n_results = min(k * 2 if exclude_concept_ids else k, total_count)
            
            query_params = {
                "query_texts": [query],
                "n_results": n_results
            }
            
            if where_clause:
                query_params["where"] = where_clause
            
            results = self.collection.query(**query_params)
            
            if results["ids"] and results["ids"][0]:
                for i in range(len(results["ids"][0])):
                    similar_concepts.append({
                        "concept_id": results["ids"][0][i],
                        "description": results["documents"][0][i],
                        "metadata": results["metadatas"][0][i],
                        "distance": results["distances"][0][i] if "distances" in results else None,
                        "source": "real"
                    })
        
        # 2. 스테이징 컬렉션에서도 검색 (옵션)
        if include_staging:
            staging_count = self.staging_collection.count()
            if staging_count > 0:
                n_results = min(k * 2 if exclude_concept_ids else k, staging_count)
                
                query_params = {
                    "query_texts": [query],
                    "n_results": n_results
                }
                
                if where_clause:
                    query_params["where"] = where_clause
                
                staging_results = self.staging_collection.query(**query_params)
                
                if staging_results["ids"] and staging_results["ids"][0]:
                    for i in range(len(staging_results["ids"][0])):
                        similar_concepts.append({
                            "concept_id": staging_results["ids"][0][i],
                            "description": staging_results["documents"][0][i],
                            "metadata": staging_results["metadatas"][0][i],
                            "distance": staging_results["distances"][0][i] if "distances" in staging_results else None,
                            "source": "staging"
                        })
        
        # 거리 순으로 정렬하고 k개만 반환
        similar_concepts.sort(key=lambda x: x.get("distance", float("inf")))
        return similar_concepts[:k]

    def add_concept(
        self, 
        concept_id: str, 
        description: str,
        label: str = None,
        parent: str = None,
        staging: bool = False
    ) -> None:
        """개념을 벡터 스토어에 추가.
        
        Args:
            concept_id: 개념 ID
            description: 개념 description
            label: 개념 레이블 (선택)
            parent: 부모 개념 ID (선택)
            staging: 스테이징 컬렉션에 추가할지 여부 (False면 실제 컬렉션에 추가)
        """
        if not description:
            return
        
        metadata = {
            "concept_id": str(concept_id),
            "label": str(label) if label else str(concept_id),
            "parent": str(parent) if parent else ""
        }
        
        target_collection = self.staging_collection if staging else self.collection
        target_collection.add(
            ids=[concept_id],
            documents=[description],
            metadatas=[metadata]
        )

    def update_concept(self, concept_id: str, description: str) -> None:
        """개념의 description 업데이트.
        
        Args:
            concept_id: 개념 ID
            description: 새 description
        """
        try:
            existing = self.collection.get(ids=[concept_id])
            if existing["ids"]:
                self.collection.update(
                    ids=[concept_id],
                    documents=[description]
                )
        except Exception:
            pass

    def delete_concept(self, concept_id: str) -> None:
        """개념을 벡터 스토어에서 삭제.
        
        Args:
            concept_id: 개념 ID
        """
        try:
            self.collection.delete(ids=[concept_id])
        except Exception:
            pass

    def get_concept(self, concept_id: str) -> Dict[str, Any]:
        """특정 개념 조회.
        
        Args:
            concept_id: 개념 ID
            
        Returns:
            개념 정보 딕셔너리
        """
        results = self.collection.get(ids=[concept_id])
        
        if not results["ids"]:
            return None
        
        return {
            "concept_id": results["ids"][0],
            "description": results["documents"][0],
            "metadata": results["metadatas"][0]
        }

    def count(self, include_staging: bool = False) -> int:
        """저장된 개념 개수 반환.
        
        Args:
            include_staging: 스테이징 개념도 포함할지 여부
            
        Returns:
            개념 개수
        """
        try:
            total = self.collection.count()
            if include_staging:
                total += self.staging_collection.count()
            return total
        except Exception as e:
            print(f"[경고] ChromaDB count() 실패: {e}")
            print(f"  DB 경로: {self.db_path}")
            print(f"  컬렉션 이름: {self.collection_name}")
            try:
                collections = self.client.list_collections()
                print(f"  사용 가능한 컬렉션: {[c.name for c in collections]}")
            except Exception:
                pass
            return 0
    
    def commit_staging(self) -> None:
        """스테이징 컬렉션의 내용을 실제 컬렉션으로 복사."""
        staging_data = self.staging_collection.get()
        
        if staging_data["ids"]:
            # 스테이징된 개념들을 실제 컬렉션에 추가
            self.collection.add(
                ids=staging_data["ids"],
                documents=staging_data["documents"],
                metadatas=staging_data["metadatas"]
            )
            
            # 스테이징 컬렉션 초기화
            self.clear_staging()
    
    def commit_staging_concepts(self, concept_ids: List[str]) -> None:
        """스테이징 컬렉션의 특정 개념들만 실제 컬렉션으로 커밋.
        
        Args:
            concept_ids: 커밋할 개념 ID 리스트
        """
        if not concept_ids:
            return
        
        staging_data = self.staging_collection.get()
        
        if not staging_data["ids"]:
            return
        
        filtered_indices = []
        for i, concept_id in enumerate(staging_data["ids"]):
            if concept_id in concept_ids:
                filtered_indices.append(i)
        
        if not filtered_indices:
            return
        
        filtered_ids = [staging_data["ids"][i] for i in filtered_indices]
        filtered_documents = [staging_data["documents"][i] for i in filtered_indices]
        filtered_metadatas = [staging_data["metadatas"][i] for i in filtered_indices]
        
        self.collection.add(
            ids=filtered_ids,
            documents=filtered_documents,
            metadatas=filtered_metadatas
        )
        
        self.staging_collection.delete(ids=filtered_ids)
    
    def clear_staging(self) -> None:
        """스테이징 컬렉션 초기화."""
        try:
            all_ids = self.staging_collection.get()["ids"]
            if all_ids:
                self.staging_collection.delete(ids=all_ids)
        except Exception:
            pass
    
    def rollback_staging(self) -> None:
        """스테이징 컬렉션의 변경사항 취소."""
        self.clear_staging()

