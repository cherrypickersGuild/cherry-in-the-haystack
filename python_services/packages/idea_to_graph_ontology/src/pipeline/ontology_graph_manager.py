"""Ontology graph manager using NetworkX for hierarchical structure."""

import networkx as nx
from typing import Dict, List, Optional, Set, Tuple
from storage.graph_query_engine import GraphQueryEngine
from storage.vector_store import VectorStore


class OntologyGraphManager:
    """온톨로지 그래프 관리 (NetworkX 기반).
    
    GraphDB의 subclassof 관계를 NetworkX 그래프로 로드하고 관리합니다.
    임시 업데이트를 지원하여 최종 확인 후 실제 DB에 반영할 수 있습니다.
    """
    
    def __init__(
        self,
        graph_engine: GraphQueryEngine,
        vector_store: VectorStore,
        root_concept: str = "Thing",
        debug: bool = False
    ) -> None:
        """OntologyGraphManager 초기화.
        
        Args:
            graph_engine: GraphQueryEngine 인스턴스
            vector_store: VectorStore 인스턴스
            root_concept: 루트 개념 ID (기본값: "Thing")
            debug: 디버깅 모드 활성화 여부
        """
        self.graph_engine = graph_engine
        self.vector_store = vector_store
        self.root_concept = root_concept
        self.debug = debug
        
        # 실제 그래프 (GraphDB에서 로드)
        self.real_graph = nx.DiGraph()
        
        # 스테이징 그래프 (임시 업데이트용)
        self.staging_graph = nx.DiGraph()
        
        # 스테이징된 개념들 (임시로 추가된 개념)
        self.staging_concepts: Set[str] = set()
        
        # 초기화: 실제 그래프 로드
        self._load_real_graph()
    
    def _load_real_graph(self) -> None:
        """GraphDB에서 subclassof 관계를 로드하여 NetworkX 그래프 생성."""
        try:
            # SPARQL 쿼리: 직접 저장된 subclassof 관계만 가져오기 (추론 제외)
            # FROM 절을 사용하여 명시적으로 저장된 트리플만 가져옴
            # 또는 NOT EXISTS를 사용하여 직접 관계만 필터링
            query = """
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX llm: <http://example.org/llm-ontology#>
            PREFIX owl: <http://www.w3.org/2002/07/owl#>
            
            SELECT ?child ?parent
            WHERE {
                ?child rdfs:subClassOf ?parent .
                ?child a owl:Class .
                ?parent a owl:Class .
                # 중간 노드를 거치지 않는 직접 관계만 선택
                # 즉, 다른 노드를 거쳐서 도달할 수 없는 관계만 선택
                FILTER NOT EXISTS {
                    ?child rdfs:subClassOf ?intermediate .
                    ?intermediate rdfs:subClassOf ?parent .
                    FILTER (?intermediate != ?child && ?intermediate != ?parent)
                }
            }
            """
            
            results = self.graph_engine.query(query)
            
            # 그래프 초기화
            self.real_graph.clear()
            
            # 루트 노드 추가
            self.real_graph.add_node(self.root_concept)
            
            print(f"[그래프 로드] SPARQL 쿼리 결과: {len(results)}개 관계 발견", flush=True)
            
            # 모든 엣지를 먼저 수집
            all_edges = []
            for row in results:
                child_raw = row.get("child", {}).get("value", "")
                parent_raw = row.get("parent", {}).get("value", "")
                
                # URI에서 개념 ID 추출
                if "#" in child_raw:
                    child = child_raw.split("#")[-1]
                elif "/" in child_raw:
                    child = child_raw.split("/")[-1]
                else:
                    child = child_raw
                
                if "#" in parent_raw:
                    parent = parent_raw.split("#")[-1]
                elif "/" in parent_raw:
                    parent = parent_raw.split("/")[-1]
                else:
                    parent = parent_raw
                
                if child and parent and child != parent:
                    all_edges.append((parent, child))
            
            # 중복 엣지 제거 및 직접 부모만 유지
            # 임시 그래프를 만들어서 직접 부모 찾기
            temp_graph = nx.DiGraph()
            for parent, child in all_edges:
                temp_graph.add_edge(parent, child)
            
            # 각 자식 노드에 대해 직접 부모만 찾기
            direct_edges = []
            child_to_parents = {}
            for parent, child in all_edges:
                if child not in child_to_parents:
                    child_to_parents[child] = []
                child_to_parents[child].append(parent)
            
            for child, parents in child_to_parents.items():
                if len(parents) == 1:
                    # 부모가 하나면 그게 직접 부모
                    direct_edges.append((parents[0], child))
                else:
                    # 부모가 여러 개면, 가장 가까운 부모(경로 길이가 가장 짧은 부모)만 직접 부모
                    min_path_length = float('inf')
                    direct_parent = None
                    
                    for parent in parents:
                        try:
                            # 루트에서 부모까지의 경로 길이 계산
                            if temp_graph.has_node(self.root_concept) and temp_graph.has_node(parent):
                                if nx.has_path(temp_graph, self.root_concept, parent):
                                    path = nx.shortest_path(temp_graph, self.root_concept, parent)
                                    path_length = len(path)
                                    if path_length < min_path_length:
                                        min_path_length = path_length
                                        direct_parent = parent
                                else:
                                    # 루트에서 도달 불가능하면 직접 부모로 간주
                                    if min_path_length == float('inf'):
                                        direct_parent = parent
                        except Exception:
                            # 경로 계산 실패 시 첫 번째 부모 사용
                            if direct_parent is None:
                                direct_parent = parent
                    
                    if direct_parent:
                        direct_edges.append((direct_parent, child))
            
            # 직접 엣지만 그래프에 추가
            edge_count = 0
            for parent, child in direct_edges:
                if child not in self.real_graph:
                    self.real_graph.add_node(child)
                if parent not in self.real_graph:
                    self.real_graph.add_node(parent)
                
                self.real_graph.add_edge(parent, child)  # parent -> child 방향
                edge_count += 1
            
            print(f"[그래프 로드] 추가된 엣지 수: {edge_count} (중복 제거 후)", flush=True)
            print(f"[그래프 로드] 최종 노드 수: {len(self.real_graph.nodes())}", flush=True)
            print(f"[그래프 로드] 최종 엣지 수: {len(self.real_graph.edges())}", flush=True)
            
            # 스테이징 그래프를 실제 그래프로 초기화
            self.staging_graph = self.real_graph.copy()
            self.staging_concepts.clear()
            
            # 디버깅 모드에서만 그래프 구조 검증 및 트리 시각화
            if self.debug:
                self._validate_and_visualize_graph()
            
        except Exception as e:
            print(f"[경고] 그래프 로드 실패: {e}", flush=True)
            import traceback
            traceback.print_exc()
            # 빈 그래프로 시작
            self.real_graph.add_node(self.root_concept)
            self.staging_graph = self.real_graph.copy()
    
    def _validate_and_visualize_graph(self) -> None:
        """그래프 구조 검증 및 트리 시각화."""
        print(f"\n[그래프 구조 검증]", flush=True)
        
        # 연결되지 않은 노드 확인
        isolated_nodes = list(nx.isolates(self.staging_graph))
        if isolated_nodes:
            print(f"  경고: 연결되지 않은 노드 {len(isolated_nodes)}개: {isolated_nodes[:5]}...", flush=True)
        
        # 순환 참조 확인
        try:
            cycles = list(nx.simple_cycles(self.staging_graph))
            if cycles:
                print(f"  경고: 순환 참조 발견 {len(cycles)}개", flush=True)
                for cycle in cycles[:3]:
                    print(f"    {' → '.join(cycle)} → {cycle[0]}", flush=True)
        except Exception:
            pass
        
        # 루트에서 도달 가능한 노드 수
        if self.root_concept in self.staging_graph:
            reachable = nx.descendants(self.staging_graph, self.root_concept)
            print(f"  루트에서 도달 가능한 노드: {len(reachable)}개", flush=True)
        
        # 트리 구조 시각화 (최대 깊이 3, 최대 자식 10개)
        print(f"\n[그래프 트리 구조]", flush=True)
        tree_viz = self._visualize_tree(max_depth=3, max_children=10)
        print(tree_viz, flush=True)
    
    def _visualize_tree(self, max_depth: int = 3, max_children: int = 10) -> str:
        """전체 그래프를 트리 구조로 시각화.
        
        Args:
            max_depth: 최대 깊이
            max_children: 각 노드당 최대 자식 수
            
        Returns:
            시각화된 트리 문자열
        """
        if self.root_concept not in self.staging_graph:
            return "  (그래프가 비어있음)"
        
        lines = []
        
        def _print_tree(node: str, prefix: str = "", is_last: bool = True, depth: int = 0):
            if depth > max_depth:
                return
            
            # 현재 노드 출력
            connector = "└── " if is_last else "├── "
            lines.append(f"{prefix}{connector}{node}")
            
            # 자식 노드 가져오기
            children = list(self.staging_graph.successors(node))
            if not children:
                return
            
            # 최대 자식 수 제한
            children_to_show = sorted(children)[:max_children]
            has_more = len(children) > max_children
            
            # 자식 노드 출력
            for idx, child in enumerate(children_to_show):
                is_last_child = (idx == len(children_to_show) - 1) and not has_more
                extension = "    " if is_last else "│   "
                child_prefix = prefix + extension
                _print_tree(child, child_prefix, is_last_child, depth + 1)
            
            # 더 많은 자식이 있음을 표시
            if has_more:
                extension = "    " if is_last else "│   "
                lines.append(f"{prefix}{extension}... ({len(children) - max_children}개 더)")
        
        _print_tree(self.root_concept)
        return "\n".join(lines)
    
    def get_root_children(self) -> List[str]:
        """루트 개념 바로 아래 자식 개념들 반환.
        
        Returns:
            루트의 직접 자식 개념 리스트
        """
        if self.root_concept not in self.staging_graph:
            return []
        
        children = list(self.staging_graph.successors(self.root_concept))
        return sorted(children)
    
    def get_subtree(self, root_node: str, max_depth: int = 3) -> nx.DiGraph:
        """특정 노드를 루트로 하는 서브트리 반환.
        
        Args:
            root_node: 서브트리의 루트 노드
            max_depth: 최대 깊이
            
        Returns:
            서브트리 그래프
        """
        if root_node not in self.staging_graph:
            return nx.DiGraph()
        
        # BFS로 서브트리 추출
        subtree = nx.DiGraph()
        visited = set()
        queue = [(root_node, 0)]
        
        while queue:
            node, depth = queue.pop(0)
            
            if depth > max_depth or node in visited:
                continue
            
            visited.add(node)
            subtree.add_node(node)
            
            if depth < max_depth:
                for child in self.staging_graph.successors(node):
                    if child not in visited:
                        subtree.add_edge(node, child)
                        queue.append((child, depth + 1))
        
        return subtree
    
    def get_path_to_root(self, node: str) -> List[str]:
        """노드에서 루트까지의 경로 반환.
        
        staging_graph를 먼저 확인하고, 없으면 real_graph를 확인합니다.
        NetworkX의 all_simple_paths를 사용하여 모든 경로를 찾고 가장 긴 경로를 선택합니다.
        (계층 구조에서 가장 깊은 경로가 올바른 경로)
        
        Args:
            node: 시작 노드
            
        Returns:
            루트까지의 경로 (노드 리스트)
        """
        # staging_graph에 있으면 staging_graph 사용
        if node in self.staging_graph:
            graph = self.staging_graph
        # real_graph에 있으면 real_graph 사용
        elif node in self.real_graph:
            graph = self.real_graph
        else:
            return []
        
        # NetworkX 내장 함수로 모든 단순 경로 찾기
        try:
            if not nx.has_path(graph, self.root_concept, node):
                return []
            
            # 모든 단순 경로 찾기
            all_paths = list(nx.all_simple_paths(graph, self.root_concept, node))
            
            if not all_paths:
                return []
            
            # 가장 긴 경로 선택 (계층 구조에서 가장 깊은 경로가 올바른 경로)
            longest_path = max(all_paths, key=len)
            return longest_path
            
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            return []
    
    def stage_add_concept(
        self,
        concept_id: str,
        parent_id: str,
        label: str = None,
        description: str = None
    ) -> None:
        """임시로 개념 추가 (스테이징).
        
        Args:
            concept_id: 개념 ID
            parent_id: 부모 개념 ID
            label: 개념 레이블
            description: 개념 설명
        """
        # 개념이 없으면 추가
        if concept_id not in self.staging_graph:
            self.staging_graph.add_node(concept_id)
        
        # 부모가 없으면 루트에 연결
        if parent_id not in self.staging_graph:
            parent_id = self.root_concept
        
        # 엣지 추가
        self.staging_graph.add_edge(parent_id, concept_id)
        
        # 스테이징된 개념으로 표시
        self.staging_concepts.add(concept_id)
    
    def stage_remove_concept(self, concept_id: str) -> None:
        """임시로 개념 제거 (스테이징).
        
        Args:
            concept_id: 개념 ID
        """
        if concept_id in self.staging_graph:
            self.staging_graph.remove_node(concept_id)
            self.staging_concepts.discard(concept_id)
    
    def commit_staging(self) -> None:
        """스테이징된 변경사항을 실제 그래프에 반영."""
        self.real_graph = self.staging_graph.copy()
        self.staging_concepts.clear()
    
    def rollback_staging(self) -> None:
        """스테이징된 변경사항을 취소."""
        self.staging_graph = self.real_graph.copy()
        self.staging_concepts.clear()
    
    def get_staging_changes(self) -> Dict[str, List[str]]:
        """스테이징된 변경사항 반환.
        
        Returns:
            추가된 개념과 제거된 개념 딕셔너리
        """
        added = list(self.staging_concepts)
        removed = []
        
        # 실제 그래프에는 있지만 스테이징 그래프에는 없는 노드 찾기
        for node in self.real_graph.nodes():
            if node not in self.staging_graph:
                removed.append(node)
        
        return {
            "added": added,
            "removed": removed
        }
    
    def visualize_subtree(self, root_node: str, max_depth: int = 3) -> str:
        """서브트리를 텍스트로 시각화.
        
        Args:
            root_node: 루트 노드
            max_depth: 최대 깊이
            
        Returns:
            시각화된 트리 문자열
        """
        subtree = self.get_subtree(root_node, max_depth)
        
        if not subtree.nodes():
            return f"[{root_node}] (노드 없음)"
        
        lines = []
        
        def _print_tree(node: str, prefix: str = "", is_last: bool = True):
            lines.append(f"{prefix}{'└── ' if is_last else '├── '}{node}")
            
            children = list(subtree.successors(node))
            for idx, child in enumerate(children):
                is_last_child = idx == len(children) - 1
                child_prefix = prefix + ("    " if is_last else "│   ")
                _print_tree(child, child_prefix, is_last_child)
        
        _print_tree(root_node)
        
        return "\n".join(lines)
    
    def find_similar_concepts_in_graph(
        self,
        query_text: str,
        k: int = 5
    ) -> List[Dict[str, any]]:
        """Vector DB에서 유사한 개념을 찾고 그래프에서의 위치 반환.
        
        Args:
            query_text: 검색 쿼리 텍스트
            k: 반환할 개념 수
            
        Returns:
            유사 개념 리스트 (concept_id, similarity, path_to_root 포함)
        """
        # Vector DB에서 유사 개념 검색
        similar = self.vector_store.find_similar(query_text, k=k)
        
        # 각 개념의 루트까지 경로 추가
        enriched = []
        for concept in similar:
            concept_id = concept.get("concept_id", "")
            # staging_graph 또는 real_graph에 있으면 경로 가져오기
            if concept_id in self.staging_graph or concept_id in self.real_graph:
                path = self.get_path_to_root(concept_id)
                concept["path_to_root"] = path
                concept["depth"] = len(path) - 1
            else:
                concept["path_to_root"] = []
                concept["depth"] = -1
            
            enriched.append(concept)
        
        return enriched

