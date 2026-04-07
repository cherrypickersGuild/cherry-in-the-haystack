#!/usr/bin/env python3
"""graph_query_engine의 get_related_nodes, get_overlap_concept_instances 테스트."""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from storage.graph_query_engine import GraphQueryEngine, NodeFilter


def test_get_related_nodes(engine: GraphQueryEngine):
    """get_related_nodes 테스트."""
    print("\n" + "=" * 60)
    print("테스트: get_related_nodes")
    print("=" * 60)
    
    test_concepts = ["RAG", "Finetuning", "LLMTwin"]
    
    for concept in test_concepts:
        print(f"\n[{concept}] 관련 노드 조회 (top_k=5):")
        print("-" * 40)
        
        results = engine.get_related_nodes(concept, NodeFilter.ALL, top_k=5)
        
        if not results:
            print("  결과 없음")
            continue
        
        for i, node in enumerate(results, 1):
            print(f"  {i}. id: {node['id']}")
            print(f"     label: {node['label']}")
            print(f"     description: {node['description'][:50]}..." if node['description'] else "     description: (없음)")
            print(f"     weight: {node['weight']}")
            print(f"     node_type: {node['node_type']}")
            print()


def test_get_overlap_concept_instances(engine: GraphQueryEngine):
    """get_overlap_concept_instances 테스트."""
    print("\n" + "=" * 60)
    print("테스트: get_overlap_concept_instances")
    print("=" * 60)
    
    query = """
    PREFIX llm: <http://example.org/llm-ontology#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    
    SELECT ?inst ?label WHERE {
        ?inst a llm:ConceptInstance .
        OPTIONAL { ?inst rdfs:label ?label . }
    }
    LIMIT 5
    """
    instances = engine.query(query)
    
    if not instances:
        print("\n인스턴스가 없습니다. add_relations.py를 먼저 실행해주세요.")
        return
    
    for inst_row in instances[:3]:
        inst_uri = inst_row.get("inst", {}).get("value", "")
        inst_id = inst_uri.split("#")[-1] if "#" in inst_uri else inst_uri.split("/")[-1]
        inst_label = inst_row.get("label", {}).get("value", inst_id)
        
        print(f"\n[{inst_label[:50]}...] 중복 인스턴스 조회:")
        print("-" * 40)
        
        results = engine.get_overlap_concept_instances(inst_id, top_k=5)
        
        if not results:
            print("  결과 없음")
            continue
        
        for i, node in enumerate(results, 1):
            print(f"  {i}. id: {node['id']}")
            print(f"     label: {node['label'][:50]}..." if len(node['label']) > 50 else f"     label: {node['label']}")
            print(f"     description: {node['description'][:50]}..." if node['description'] else "     description: (없음)")
            print(f"     overlap_count: {node['overlap_count']}")
            print()


def main():
    endpoint = "http://localhost:7200/repositories/llm-ontology"
    print(f"GraphDB 엔드포인트: {endpoint}")
    
    engine = GraphQueryEngine(endpoint)
    
    try:
        test_query = "SELECT (COUNT(*) AS ?count) WHERE { ?s ?p ?o }"
        result = engine.query(test_query)
        count = result[0].get("count", {}).get("value", 0) if result else 0
        print(f"GraphDB 연결 성공 (총 {count}개 트리플)")
    except Exception as e:
        print(f"GraphDB 연결 실패: {e}")
        return
    
    test_get_related_nodes(engine)
    test_get_overlap_concept_instances(engine)
    
    print("\n" + "=" * 60)
    print("테스트 완료")
    print("=" * 60)


if __name__ == "__main__":
    main()

