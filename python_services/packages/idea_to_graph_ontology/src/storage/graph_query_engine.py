"""SPARQL query engine for graph database."""

from enum import Enum
from typing import Dict, Any, List
from SPARQLWrapper import SPARQLWrapper, JSON
import requests
from urllib.parse import urlencode


class NodeFilter(Enum):
    """get_related_nodes 결과 필터 타입."""
    ALL = "all"
    ONLY_CLASS = "only_class"
    ONLY_INSTANCE = "only_instance"


class GraphQueryEngine:
    """SPARQL 쿼리 엔진."""

    def __init__(self, endpoint_url: str) -> None:
        """GraphDB 엔드포인트 URL로 초기화.
        
        Args:
            endpoint_url: GraphDB SPARQL 엔드포인트 URL
        """
        self.endpoint_url = endpoint_url
        self.sparql = SPARQLWrapper(endpoint_url)
        self.sparql.setReturnFormat(JSON)

    def query(self, sparql_query: str) -> List[Dict[str, Any]]:
        """SPARQL 쿼리 실행.
        
        Args:
            sparql_query: 실행할 SPARQL 쿼리 문자열
            
        Returns:
            쿼리 결과 리스트
        """
        # SPARQLWrapper 사용 (log.txt에서 성공한 방식)
        self.sparql.setQuery(sparql_query)
        results = self.sparql.query().convert()
        
        if "results" in results and "bindings" in results["results"]:
            return results["results"]["bindings"]
        return []

    def update(self, sparql_update: str) -> None:
        """SPARQL UPDATE 실행.
        
        Args:
            sparql_update: 실행할 SPARQL UPDATE 문자열
        """
        update_endpoint = self.endpoint_url.rstrip('/') + "/statements"
        headers = {"Content-Type": "application/sparql-update"}
        
        response = requests.post(
            update_endpoint,
            data=sparql_update,
            headers=headers,
            timeout=30
        )
        
        if response.status_code not in (200, 204):
            raise Exception(
                f"SPARQL UPDATE 실패 (HTTP {response.status_code}): {response.text}\n"
                f"엔드포인트: {update_endpoint}\n"
                f"쿼리 길이: {len(sparql_update)} 문자"
            )

    def add_triple(
        self, 
        subject: str, 
        predicate: str, 
        obj: str,
        is_literal: bool = False
    ) -> None:
        """Triple을 그래프 DB에 추가.
        
        Args:
            subject: 주어 (URI 형식)
            predicate: 서술어 (URI 형식)
            obj: 목적어 (URI 또는 리터럴)
            is_literal: obj가 리터럴인지 여부
        """
        if is_literal:
            obj_str = f'"{obj}"'
        else:
            obj_str = f"<{obj}>"
        
        query = f"""
        PREFIX llm: <http://example.org/llm-ontology#>
        INSERT DATA {{
            <{subject}> <{predicate}> {obj_str} .
        }}
        """
        self.update(query)

    def _escape_sparql_string(self, text: str) -> str:
        """SPARQL 문자열에서 특수 문자 이스케이프."""
        if not text:
            return ""
        # 따옴표와 백슬래시 이스케이프
        escaped = text.replace("\\", "\\\\").replace('"', '\\"')
        # 줄바꿈 처리
        escaped = escaped.replace("\n", "\\n").replace("\r", "\\r")
        return escaped
    
    def add_concept(
        self,
        concept_id: str,
        label: str,
        parent: str,
        description: str
    ) -> None:
        """새 개념을 그래프 DB에 추가.
        
        Args:
            concept_id: 개념 ID
            label: 개념 레이블
            parent: 부모 개념 ID
            description: 개념 설명
        """
        # 특수 문자 이스케이프
        escaped_label = self._escape_sparql_string(label)
        escaped_description = self._escape_sparql_string(description)
        
        query = f"""
        PREFIX llm: <http://example.org/llm-ontology#>
        PREFIX owl: <http://www.w3.org/2002/07/owl#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        
        INSERT DATA {{
            llm:{concept_id} a owl:Class ;
                rdfs:label "{escaped_label}"@en ;
                rdfs:subClassOf llm:{parent} ;
                llm:description "{escaped_description}" .
        }}
        """
        self.update(query)

    def concept_exists(self, concept_id: str) -> bool:
        """개념이 GraphDB에 존재하는지 확인.
        
        Args:
            concept_id: 개념 ID (llm: 프리픽스 포함 여부와 관계없이 처리)
            
        Returns:
            존재 여부
        """
        # concept_id에서 llm: 프리픽스 제거 (이미 있으면 제거, 없으면 그대로 사용)
        if concept_id.startswith("llm:"):
            concept_id = concept_id[4:]
        
        # SELECT 쿼리로 직접 확인 (ASK 쿼리는 GraphDB에서 문제가 있을 수 있음)
        select_query = f"""
        PREFIX llm: <http://example.org/llm-ontology#>
        PREFIX owl: <http://www.w3.org/2002/07/owl#>
        
        SELECT ?s WHERE {{
            llm:{concept_id} a owl:Class .
        }}
        LIMIT 1
        """
        try:
            results = self.query(select_query)
            return len(results) > 0
        except Exception:
            return False

    def update_description(self, concept_id: str, description: str) -> None:
        """개념의 description 업데이트.
        
        Args:
            concept_id: 개념 ID
            description: 새 설명
        """
        escaped_description = self._escape_sparql_string(description)
        
        query = f"""
        PREFIX llm: <http://example.org/llm-ontology#>
        
        DELETE {{
            llm:{concept_id} llm:description ?old .
        }}
        INSERT {{
            llm:{concept_id} llm:description "{escaped_description}" .
        }}
        WHERE {{
            OPTIONAL {{ llm:{concept_id} llm:description ?old . }}
        }}
        """
        self.update(query)

    def add_relation(
        self, 
        concept1: str, 
        concept2: str,
        weight: float = 1.0
    ) -> None:
        """두 개념 간 관계 추가 (양방향).
        
        Args:
            concept1: 첫 번째 개념 ID
            concept2: 두 번째 개념 ID
            weight: 관계 가중치
        """
        query = f"""
        PREFIX llm: <http://example.org/llm-ontology#>
        
        INSERT DATA {{
            llm:{concept1} llm:related llm:{concept2} .
            llm:{concept2} llm:related llm:{concept1} .
        }}
        """
        self.update(query)

    def update_relation_weight(
        self, 
        subject: str, 
        predicate: str, 
        obj: str, 
        weight: float
    ) -> None:
        """Relation의 weight를 업데이트.
        
        Args:
            subject: 주어
            predicate: 서술어
            obj: 목적어
            weight: 업데이트할 weight 값
        """
        query = f"""
        PREFIX llm: <http://example.org/llm-ontology#>
        
        DELETE {{
            llm:{subject} llm:{predicate} llm:{obj} .
        }}
        INSERT {{
            llm:{subject} llm:{predicate} llm:{obj} .
        }}
        WHERE {{
            llm:{subject} llm:{predicate} llm:{obj} .
        }}
        """
        self.update(query)

    def get_related_nodes(
        self,
        label_or_id: str,
        filter_type: NodeFilter = NodeFilter.ALL,
        top_k: int = 10
    ) -> List[Dict[str, Any]]:
        """특정 컨셉/인스턴스와 관련된 노드들을 가져옴.
        
        Args:
            label_or_id: 검색할 노드의 label 또는 ID
            filter_type: 결과 필터 (ALL, ONLY_CLASS, ONLY_INSTANCE)
            top_k: 반환할 최대 노드 수 (기본값: 10)
            
        Returns:
            관련 노드 리스트 [{id, label, description, weight, node_type}]
            가중치가 있는 경우 가중치 내림차순 정렬
        """
        escaped_label = self._escape_sparql_string(label_or_id)
        
        query = f"""
        PREFIX llm: <http://example.org/llm-ontology#>
        PREFIX owl: <http://www.w3.org/2002/07/owl#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        
        SELECT DISTINCT ?related ?relatedLabel ?relatedDesc ?nodeType ?relation ?weight WHERE {{
            # 입력 노드 찾기 (label 또는 ID로)
            {{
                ?node rdfs:label ?inputLabel .
                FILTER(CONTAINS(LCASE(STR(?inputLabel)), LCASE("{escaped_label}")))
            }} UNION {{
                BIND(llm:{label_or_id.replace(" ", "")} AS ?node)
                ?node ?anyPred ?anyObj .
            }}
            
            # 관련 노드 찾기
            {{
                # Class 간 ClassRelation (source -> target)
                ?rel a llm:ClassRelation ;
                     llm:source ?node ;
                     llm:target ?related ;
                     llm:cooccurrenceCount ?weight .
                BIND("ClassRelation" AS ?relation)
            }} UNION {{
                # Class 간 ClassRelation (target -> source)
                ?rel a llm:ClassRelation ;
                     llm:target ?node ;
                     llm:source ?related ;
                     llm:cooccurrenceCount ?weight .
                BIND("ClassRelation" AS ?relation)
            }} UNION {{
                # subClassOf 관계
                ?node rdfs:subClassOf ?related .
                ?related a owl:Class .
                BIND("subClassOf" AS ?relation)
                BIND(0 AS ?weight)
            }} UNION {{
                # subClassOf 역방향 (자식 클래스)
                ?related rdfs:subClassOf ?node .
                ?related a owl:Class .
                BIND("hasSubClass" AS ?relation)
                BIND(0 AS ?weight)
            }} UNION {{
                # Instance 간 relatedInstance
                ?node llm:relatedInstance ?related .
                BIND("relatedInstance" AS ?relation)
                BIND(1 AS ?weight)
            }} UNION {{
                # Instance -> Class (instanceOf)
                ?node llm:instanceOf ?related .
                BIND("instanceOf" AS ?relation)
                BIND(0 AS ?weight)
            }} UNION {{
                # Class -> Instance (hasInstance 역방향)
                ?related llm:instanceOf ?node .
                BIND("hasInstance" AS ?relation)
                BIND(0 AS ?weight)
            }}
            
            # 관련 노드의 label, description, 타입 가져오기
            OPTIONAL {{ ?related rdfs:label ?relatedLabel . }}
            OPTIONAL {{ ?related llm:description ?relatedDesc . }}
            
            # 노드 타입 결정
            OPTIONAL {{
                ?related a owl:Class .
                BIND("class" AS ?classType)
            }}
            OPTIONAL {{
                ?related a llm:ConceptInstance .
                BIND("instance" AS ?instanceType)
            }}
            BIND(COALESCE(?instanceType, ?classType, "unknown") AS ?nodeType)
            
            # 자기 자신 제외
            FILTER(?related != ?node)
        }}
        ORDER BY DESC(?weight) ?nodeType ?relatedLabel
        """
        
        results = self.query(query)
        
        nodes = []
        seen = set()
        
        for row in results:
            related_uri = row.get("related", {}).get("value", "")
            related_id = related_uri.split("#")[-1] if "#" in related_uri else related_uri.split("/")[-1]
            
            if related_id in seen:
                continue
            seen.add(related_id)
            
            node_type = row.get("nodeType", {}).get("value", "unknown")
            
            if filter_type == NodeFilter.ONLY_CLASS and node_type != "class":
                continue
            if filter_type == NodeFilter.ONLY_INSTANCE and node_type != "instance":
                continue
            
            weight_val = row.get("weight", {}).get("value")
            weight = int(weight_val) if weight_val else 0
            
            nodes.append({
                "id": related_id,
                "label": row.get("relatedLabel", {}).get("value", related_id),
                "description": row.get("relatedDesc", {}).get("value", ""),
                "weight": weight,
                "node_type": node_type
            })
            
            if len(nodes) >= top_k:
                break
        
        return nodes

    def get_overlap_concept_instances(
        self,
        label_or_id: str,
        top_k: int = 10
    ) -> List[Dict[str, Any]]:
        """특정 인스턴스와 클래스가 가장 많이 중복되는 인스턴스들을 가져옴.
        
        Args:
            label_or_id: 검색할 인스턴스의 label 또는 ID
            top_k: 반환할 최대 인스턴스 수
            
        Returns:
            중복 클래스가 많은 순으로 정렬된 인스턴스 리스트
            [{id, label, description, overlap_count}]
        """
        escaped_label = self._escape_sparql_string(label_or_id)
        
        query = f"""
        PREFIX llm: <http://example.org/llm-ontology#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        
        SELECT ?otherInst ?otherLabel 
               (SAMPLE(?otherDesc) AS ?description)
               (COUNT(DISTINCT ?sharedClass) AS ?overlapCount)
        WHERE {{
            # 입력 인스턴스 찾기 (label 또는 ID로)
            {{
                ?sourceInst a llm:ConceptInstance ;
                            rdfs:label ?srcLabel .
                FILTER(CONTAINS(LCASE(STR(?srcLabel)), LCASE("{escaped_label}")))
            }} UNION {{
                BIND(llm:{label_or_id.replace(" ", "")} AS ?sourceInst)
                ?sourceInst a llm:ConceptInstance .
            }}
            
            # 입력 인스턴스의 클래스들
            ?sourceInst llm:instanceOf ?sharedClass .
            
            # 같은 클래스를 공유하는 다른 인스턴스
            ?otherInst a llm:ConceptInstance ;
                       llm:instanceOf ?sharedClass .
            FILTER(?otherInst != ?sourceInst)
            
            # 다른 인스턴스의 label과 description
            OPTIONAL {{ ?otherInst rdfs:label ?otherLabel . }}
            OPTIONAL {{ ?otherInst llm:description ?otherDesc . }}
        }}
        GROUP BY ?otherInst ?otherLabel
        ORDER BY DESC(?overlapCount)
        LIMIT {top_k}
        """
        
        results = self.query(query)
        
        instances = []
        for row in results:
            inst_uri = row.get("otherInst", {}).get("value", "")
            inst_id = inst_uri.split("#")[-1] if "#" in inst_uri else inst_uri.split("/")[-1]
            
            overlap_count = int(row.get("overlapCount", {}).get("value", 0))
            
            instances.append({
                "id": inst_id,
                "label": row.get("otherLabel", {}).get("value", inst_id),
                "description": row.get("description", {}).get("value", ""),
                "overlap_count": overlap_count
            })
        
        return instances

