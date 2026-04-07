"""New concept manager using SQLite."""

from typing import Dict, List, Any, Optional
import sqlite3
from pathlib import Path
import numpy as np
from sklearn.cluster import DBSCAN
from sklearn.metrics.pairwise import cosine_similarity
from collections import defaultdict
from sklearn.preprocessing import normalize


class NewConceptManager:
    """신규 개념 관리 (SQLite)."""

    def __init__(
        self, 
        db_path: str, 
        vector_store=None,
        mode: str = "real",
        task_id: Optional[str] = None,
        real_new_concept_db_path: Optional[str] = None
    ) -> None:
        """NewConceptManager 초기화.
        
        Args:
            db_path: SQLite DB 파일 경로
            vector_store: VectorStore 인스턴스 (벡터 유사도 계산용)
            mode: 'real' 또는 'stage' 모드
            task_id: task ID (stage 모드일 때 사용)
            real_new_concept_db_path: Real DB 경로 (stage 모드일 때 클러스터링에 사용)
        """
        self.mode = mode
        self.task_id = task_id
        self.real_new_concept_db_path = real_new_concept_db_path
        
        if mode == "stage" and task_id:
            db_path_obj = Path(db_path)
            if "stage" in str(db_path_obj) and task_id in str(db_path_obj):
                self.db_path = db_path
            else:
                db_dir = Path(db_path).parent / "stage" / task_id
                db_dir.mkdir(parents=True, exist_ok=True)
                self.db_path = str(db_dir / "new_concepts.db")
        else:
            self.db_path = db_path
        
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        
        self.conn = sqlite3.connect(self.db_path)
        self.vector_store = vector_store
        self._create_tables()
        
        # 마지막 클러스터링 시점의 개념 개수 추적
        self._init_clustering_tracker()

    def _create_tables(self) -> None:
        """DB 테이블 생성."""
        cursor = self.conn.cursor()
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS new_concepts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                concept TEXT NOT NULL,
                description TEXT,
                source TEXT,
                embedding BLOB,
                original_keyword TEXT,
                noun_phrase_summary TEXT,
                reason TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS concept_clusters (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cluster_name TEXT,
                concept_ids TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # 클러스터링 추적용 테이블
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS clustering_metadata (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        """)
        
        self.conn.commit()
    
    def _init_clustering_tracker(self) -> None:
        """클러스터링 추적 초기화."""
        cursor = self.conn.cursor()
        cursor.execute(
            "SELECT value FROM clustering_metadata WHERE key = 'last_clustering_count'"
        )
        result = cursor.fetchone()
        if not result:
            # 처음이면 현재 개념 개수를 저장
            count = self._get_concept_count()
            cursor.execute(
                "INSERT INTO clustering_metadata (key, value) VALUES (?, ?)",
                ('last_clustering_count', str(count))
            )
            self.conn.commit()
    
    def _get_concept_count(self) -> int:
        """현재 저장된 개념 개수 반환."""
        cursor = self.conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM new_concepts")
        return cursor.fetchone()[0]
    
    def _should_run_clustering(self) -> bool:
        """클러스터링을 실행해야 하는지 확인 (3개 단위)."""
        current_count = self._get_concept_count()
        cursor = self.conn.cursor()
        cursor.execute(
            "SELECT value FROM clustering_metadata WHERE key = 'last_clustering_count'"
        )
        result = cursor.fetchone()
        
        if not result:
            return False
        
        last_count = int(result[0])
        # 3개 이상 추가되었으면 클러스터링 실행
        return (current_count - last_count) >= 3
    
    def _update_clustering_tracker(self) -> None:
        """클러스터링 실행 후 추적 정보 업데이트."""
        current_count = self._get_concept_count()
        cursor = self.conn.cursor()
        cursor.execute(
            "UPDATE clustering_metadata SET value = ? WHERE key = 'last_clustering_count'",
            (str(current_count),)
        )
        if cursor.rowcount == 0:
            cursor.execute(
                "INSERT INTO clustering_metadata (key, value) VALUES (?, ?)",
                ('last_clustering_count', str(current_count))
            )
        self.conn.commit()

    def _compute_embedding(self, description: str) -> Optional[bytes]:
        """Description에 대한 임베딩 계산 및 직렬화.
        
        Args:
            description: 개념 설명
            
        Returns:
            직렬화된 임베딩 (bytes) 또는 None
        """
        if not self.vector_store or not description:
            return None
        
        try:
            embedding_fn = self.vector_store.collection._embedding_function
            
            if hasattr(embedding_fn, 'embed'):
                emb_list = embedding_fn.embed([description])
                emb = emb_list[0] if isinstance(emb_list, list) else emb_list
            elif hasattr(embedding_fn, '__call__'):
                emb = embedding_fn([description])
                if isinstance(emb, list):
                    emb = emb[0]
            else:
                return None
            
            # numpy array를 bytes로 직렬화
            emb_array = np.array(emb)
            return emb_array.tobytes()
        except Exception:
            return None
    
    def save_concept(
        self,
        concept: str,
        description: str,
        source: str,
        original_keyword: Optional[str] = None,
        noun_phrase_summary: Optional[str] = None,
        reason: Optional[str] = None
    ) -> None:
        """신규 개념 저장.
        
        Args:
            concept: 개념 이름
            description: description
            source: 출처
            original_keyword: 원본 키워드
            noun_phrase_summary: 명사구 요약
            reason: 판단 이유
        """
        # 임베딩 계산 (한 번만)
        embedding_bytes = self._compute_embedding(description)
        
        cursor = self.conn.cursor()
        cursor.execute(
            """INSERT INTO new_concepts 
               (concept, description, source, embedding, original_keyword, noun_phrase_summary, reason) 
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (concept, description, source, embedding_bytes, original_keyword, noun_phrase_summary, reason)
        )
        self.conn.commit()
        
        # 3개 단위로 클러스터링 실행
        if self._should_run_clustering():
            self._create_clusters(real_new_concept_db_path=self.real_new_concept_db_path)
            self._update_clustering_tracker()

    def get_all_concepts(self, include_embedding: bool = False) -> List[Dict[str, Any]]:
        """모든 신규 개념 조회.
        
        Args:
            include_embedding: 임베딩 포함 여부
            
        Returns:
            신규 개념 리스트
        """
        cursor = self.conn.cursor()
        if include_embedding:
            cursor.execute("""SELECT id, concept, description, source, embedding, 
                            original_keyword, noun_phrase_summary, reason 
                            FROM new_concepts""")
        else:
            cursor.execute("""SELECT id, concept, description, source, 
                            original_keyword, noun_phrase_summary, reason 
                            FROM new_concepts""")
        
        concepts = []
        for row in cursor.fetchall():
            concept_dict = {
                "id": row[0],
                "concept": row[1],
                "description": row[2],
                "source": row[3]
            }
            if include_embedding:
                if len(row) > 4:
                    concept_dict["embedding"] = row[4]
                if len(row) > 5:
                    concept_dict["original_keyword"] = row[5]
                if len(row) > 6:
                    concept_dict["noun_phrase_summary"] = row[6]
                if len(row) > 7:
                    concept_dict["reason"] = row[7]
            else:
                if len(row) > 4:
                    concept_dict["original_keyword"] = row[4]
                if len(row) > 5:
                    concept_dict["noun_phrase_summary"] = row[5]
                if len(row) > 6:
                    concept_dict["reason"] = row[6]
            concepts.append(concept_dict)
        
        return concepts

    def _create_clusters(self, real_new_concept_db_path: Optional[str] = None) -> None:
        """신규 개념들을 벡터 유사도 기반으로 클러스터링.
        
        description의 임베딩을 비교하여 유사한 개념들을 클러스터로 묶습니다.
        DBSCAN 알고리즘을 사용하여 밀도 기반 클러스터링을 수행합니다.
        
        Args:
            real_new_concept_db_path: Real DB 경로 (stage 모드일 때 Real 개념도 함께 클러스터링)
        """
        
        # Stage DB의 모든 신규 개념 가져오기
        stage_concepts = self.get_all_concepts()
        
        # Real DB의 개념도 함께 로드 (stage 모드이고 real 경로가 제공된 경우)
        real_concepts = []
        if self.mode == "stage" and real_new_concept_db_path and Path(real_new_concept_db_path).exists():
            try:
                real_conn = sqlite3.connect(real_new_concept_db_path)
                real_cursor = real_conn.cursor()
                real_cursor.execute("""SELECT concept, description, source, embedding, 
                                    original_keyword, noun_phrase_summary, reason 
                                    FROM new_concepts""")
                for row in real_cursor.fetchall():
                    real_concepts.append({
                        "concept": row[0],
                        "description": row[1],
                        "source": row[2],
                        "embedding": row[3],
                        "original_keyword": row[4],
                        "noun_phrase_summary": row[5],
                        "reason": row[6]
                    })
                real_conn.close()
            except Exception as e:
                print(f"[경고] Real DB 로드 실패: {e}")
        
        # Stage + Real 개념 합치기
        all_concepts = stage_concepts + real_concepts
        
        if len(all_concepts) < 2:
            return
        
        # 기존 클러스터 삭제 (Stage DB에만 저장)
        cursor = self.conn.cursor()
        cursor.execute("DELETE FROM concept_clusters")
        self.conn.commit()
        
        # Stage 개념의 임베딩 가져오기
        stage_concepts_with_emb = self.get_all_concepts(include_embedding=True)
        
        # Real 개념의 임베딩 처리
        real_concepts_with_emb = []
        if real_concepts:
            for rc in real_concepts:
                real_concept_dict = {
                    "concept": rc["concept"],
                    "description": rc["description"],
                    "embedding": rc.get("embedding"),
                    "is_real": True
                }
                real_concepts_with_emb.append(real_concept_dict)
        
        # Stage 개념에 is_real 플래그 추가
        for sc in stage_concepts_with_emb:
            sc["is_real"] = False
        
        # 모든 개념 합치기
        all_concepts_with_emb = stage_concepts_with_emb + real_concepts_with_emb
        concept_names = [c["concept"] for c in all_concepts_with_emb]
        
        # 임베딩 복원
        try:
            embeddings = []
            cursor = self.conn.cursor()
            zero_emb_count = 0
            computed_emb_count = 0
            for c in all_concepts_with_emb:
                if c.get("embedding"):
                    # bytes에서 numpy array로 복원
                    emb_array = np.frombuffer(c["embedding"], dtype=np.float32)
                    embeddings.append(emb_array)
                else:
                    # 임베딩이 없으면 계산
                    if self.vector_store and c.get("description"):
                        embedding_bytes = self._compute_embedding(c["description"])
                        if embedding_bytes:
                            emb_array = np.frombuffer(embedding_bytes, dtype=np.float32)
                            embeddings.append(emb_array)
                            computed_emb_count += 1
                            # Stage 개념만 DB에 저장 (Real 개념은 저장하지 않음)
                            if not c.get("is_real") and "id" in c:
                                cursor.execute(
                                    "UPDATE new_concepts SET embedding = ? WHERE id = ?",
                                    (embedding_bytes, c["id"])
                                )
                        else:
                            embeddings.append(np.zeros(1024))
                            zero_emb_count += 1
                    else:
                        embeddings.append(np.zeros(1024))
                        zero_emb_count += 1
            
            embeddings = np.array(embeddings, dtype=np.float32)
            self.conn.commit()
            
            # 임베딩 정규화 (코사인 유사도 계산 전)
            # sklearn cosine_similarity가 내부 정규화를 하지만, 명시적으로 정규화
            embeddings_normalized = normalize(embeddings, norm='l2')
            
            # 코사인 유사도 행렬 계산
            similarity_matrix = cosine_similarity(embeddings_normalized)
            
            # 거리 행렬로 변환 (1 - similarity)
            # 수치 오차로 인한 음수 값 방지 (clip to [0, 2])
            distance_matrix = np.clip(1 - similarity_matrix, 0, 2)
            
            # 정확히 일치하는 개념 이름들을 찾아서 거리를 0으로 설정
            # 같은 이름의 개념들은 같은 클러스터에 묶이도록 함
            for i in range(len(concept_names)):
                for j in range(i + 1, len(concept_names)):
                    if concept_names[i] == concept_names[j]:
                        distance_matrix[i, j] = 0.0
                        distance_matrix[j, i] = 0.0
            
            # 거리 행렬이 유효한지 확인
            if np.any(np.isnan(distance_matrix)) or np.any(np.isinf(distance_matrix)):
                raise ValueError("거리 행렬에 NaN 또는 Inf 값이 있습니다")
            
            if np.any(distance_matrix < 0):
                raise ValueError(f"거리 행렬에 음수 값이 있습니다: min={distance_matrix.min()}")
            
            # DBSCAN 클러스터링
            # eps: 최대 거리 (0.25 = 75% 이상 유사도)
            # min_samples: 최소 샘플 수 (3개 이상)
            clustering = DBSCAN(eps=0.25, min_samples=3, metric='precomputed')
            cluster_labels = clustering.fit_predict(distance_matrix)
            
            # 클러스터별로 개념 그룹화
            clusters_dict = {}
            # stage 모드일 때만 real 개념 구분
            if self.mode == "stage":
                concept_to_is_real = {c["concept"]: c.get("is_real", False) for c in all_concepts_with_emb}
            else:
                concept_to_is_real = {}
            
            for idx, label in enumerate(cluster_labels):
                if label == -1:  # 노이즈 (클러스터에 속하지 않음)
                    continue
                
                if label not in clusters_dict:
                    clusters_dict[label] = []
                clusters_dict[label].append(concept_names[idx])
            
            # 클러스터를 DB에 저장
            # mode가 "real"이면 모든 개념을 저장, "stage"면 stage 개념만 저장
            cluster_id = 1
            saved_cluster_count = 0
            for label, concept_list in clusters_dict.items():
                if self.mode == "real":
                    # Real 모드: 모든 개념 포함
                    filtered_concept_list = concept_list
                else:
                    # Stage 모드: Stage 개념만 필터링
                    filtered_concept_list = [c for c in concept_list if not concept_to_is_real.get(c, False)]
                
                if len(filtered_concept_list) >= 2:
                    # 클러스터 크기가 10개를 초과하면 재분할
                    if len(filtered_concept_list) > 10:
                        # 필터링된 개념만으로 재분할
                        filtered_indices = [concept_names.index(c) for c in filtered_concept_list]
                        filtered_embeddings = embeddings_normalized[filtered_indices]
                        filtered_similarity = cosine_similarity(filtered_embeddings)
                        filtered_distance = np.clip(1 - filtered_similarity, 0, 2)
                        
                        # 작은 클러스터로 재분할
                        sub_clustering = DBSCAN(eps=0.15, min_samples=2, metric='precomputed')
                        sub_labels = sub_clustering.fit_predict(filtered_distance)
                        
                        # 서브클러스터별로 저장
                        sub_clusters = {}
                        for sub_idx, sub_label in enumerate(sub_labels):
                            if sub_label == -1:
                                continue
                            if sub_label not in sub_clusters:
                                sub_clusters[sub_label] = []
                            sub_clusters[sub_label].append(filtered_concept_list[sub_idx])
                        
                        # 각 서브클러스터 저장 (2개 이상 10개 이하인 것만)
                        for sub_concept_list in sub_clusters.values():
                            if len(sub_concept_list) >= 2 and len(sub_concept_list) <= 10:
                                cluster_name = f"cluster_{cluster_id}"
                                concept_ids_str = ",".join(sub_concept_list)
                                cursor.execute(
                                    "INSERT INTO concept_clusters (cluster_name, concept_ids) VALUES (?, ?)",
                                    (cluster_name, concept_ids_str)
                                )
                                cluster_id += 1
                                saved_cluster_count += 1
                    else:
                        # 10개 이하면 그대로 저장
                        cluster_name = f"cluster_{cluster_id}"
                        concept_ids_str = ",".join(filtered_concept_list)
                        cursor.execute(
                            "INSERT INTO concept_clusters (cluster_name, concept_ids) VALUES (?, ?)",
                            (cluster_name, concept_ids_str)
                        )
                        cluster_id += 1
                        saved_cluster_count += 1
            
            self.conn.commit()
            
            print(f"[클러스터링 완료] 총 {len(all_concepts)}개 개념, {saved_cluster_count}개 클러스터")
            
        except Exception as e:
            raise e
    

    
    def get_clusters(self, min_size: int = 5, concept: Optional[str] = None, debug: bool = False) -> List[Dict[str, Any]]:
        """클러스터 반환.
        
        저장된 클러스터를 읽어서 반환합니다.
        클러스터 생성은 save_concept()에서 3개 단위로 자동 실행됩니다.
        
        Args:
            min_size: 최소 클러스터 크기
            concept: 특정 개념이 포함된 클러스터만 필터링 (None이면 모든 클러스터)
            debug: 디버그 모드
            
        Returns:
            클러스터 리스트 (각 개념의 noun_phrase_summary 정보 포함)
        """
        # 저장된 클러스터만 읽기 (생성하지 않음)
        cursor = self.conn.cursor()
        cursor.execute(
            "SELECT id, cluster_name, concept_ids FROM concept_clusters"
        )
        
        clusters = []
        for row in cursor.fetchall():
            concept_ids = row[2].split(",") if row[2] else []
            
            # min_size 체크
            if len(concept_ids) < min_size:
                if debug and concept and concept in concept_ids:
                    print(f"[디버깅] 클러스터 '{row[1]}'는 {len(concept_ids)}개로 min_size({min_size}) 미만이라 제외됨", flush=True)
                continue
            
            # 특정 개념이 포함된 클러스터만 필터링
            if concept is not None and concept not in concept_ids:
                if debug:
                    print(f"[디버깅] 클러스터 '{row[1]}'에 '{concept}'가 포함되지 않음 (포함된 개념: {', '.join(concept_ids[:5])}{'...' if len(concept_ids) > 5 else ''})", flush=True)
                continue
            
            if debug and concept:
                print(f"[디버깅] 클러스터 '{row[1]}'에 '{concept}' 포함됨 ({len(concept_ids)}개 개념)", flush=True)
            
            # 각 개념의 상세 정보 가져오기
            concept_details = []
            for concept_id in concept_ids:
                cursor.execute(
                    """SELECT concept, original_keyword, noun_phrase_summary, reason, description 
                    FROM new_concepts WHERE concept = ?""",
                    (concept_id,)
                )
                concept_row = cursor.fetchone()
                if concept_row:
                    concept_details.append({
                        "concept": concept_row[0],
                        "original_keyword": concept_row[1],
                        "noun_phrase_summary": concept_row[2],
                        "reason": concept_row[3],
                        "description": concept_row[4]
                    })
                else:
                    concept_details.append({
                        "concept": concept_id,
                        "original_keyword": None,
                        "noun_phrase_summary": None,
                        "reason": None,
                        "description": None
                    })
            
            clusters.append({
                "id": row[0],
                "name": row[1],
                "concepts": concept_ids,
                "concept_details": concept_details
            })
        
        return clusters

    def remove_cluster(self, cluster_id: int) -> None:
        """클러스터 제거.
        
        클러스터에 포함된 모든 개념을 new_concepts 테이블에서도 삭제합니다.
        
        Args:
            cluster_id: 클러스터 ID
        """
        cursor = self.conn.cursor()
        
        # 클러스터에 포함된 개념 ID 목록 가져오기
        cursor.execute("SELECT concept_ids FROM concept_clusters WHERE id = ?", (cluster_id,))
        row = cursor.fetchone()
        
        if row and row[0]:
            concept_ids = row[0].split(",")
            # 클러스터에 포함된 모든 개념을 new_concepts 테이블에서 삭제
            placeholders = ",".join("?" * len(concept_ids))
            cursor.execute(
                f"DELETE FROM new_concepts WHERE concept IN ({placeholders})",
                concept_ids
            )
        
        # 클러스터 삭제
        cursor.execute("DELETE FROM concept_clusters WHERE id = ?", (cluster_id,))
        self.conn.commit()

    def close(self) -> None:
        """DB 연결 종료."""
        self.conn.close()

