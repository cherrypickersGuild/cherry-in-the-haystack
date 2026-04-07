"""Common utilities for ontology package."""

from typing import Dict, List
from rdflib import Graph, Namespace, RDF, RDFS, Literal
from rdflib.term import URIRef


LLM = Namespace("http://example.org/llm-ontology#")
OWL = Namespace("http://www.w3.org/2002/07/owl#")


def load_ontology_graph(ttl_path: str) -> Graph:
    """TTL 파일을 RDF 그래프로 로드.
    
    Args:
        ttl_path: TTL 파일 경로
        
    Returns:
        RDF 그래프
    """
    graph = Graph()
    graph.parse(ttl_path, format="turtle")
    return graph


def load_all_concepts(ttl_path: str) -> List[Dict[str, str]]:
    """온톨로지에서 모든 개념 정보 추출.
    
    Args:
        ttl_path: TTL 파일 경로
        
    Returns:
        개념 정보 리스트 (concept_id, label, parent, description)
    """
    graph = load_ontology_graph(ttl_path)
    concepts = []
    
    for subject in graph.subjects(RDF.type, OWL.Class):
        concept_id = str(subject).replace(str(LLM), "")
        
        label_obj = graph.value(subject, RDFS.label)
        label = str(label_obj) if label_obj else concept_id
        
        parent_obj = graph.value(subject, RDFS.subClassOf)
        parent = str(parent_obj).replace(str(LLM), "") if parent_obj else None
        
        desc_obj = graph.value(subject, LLM.description)
        description = str(desc_obj) if desc_obj else ""
        
        concepts.append({
            "concept_id": concept_id,
            "label": label,
            "parent": parent,
            "description": description
        })
    
    return concepts


def update_ttl_descriptions(ttl_path: str, descriptions: Dict[str, str]) -> None:
    """TTL 파일의 개념 description 업데이트.
    
    Args:
        ttl_path: TTL 파일 경로
        descriptions: 개념 ID와 새 description의 딕셔너리
    """
    graph = load_ontology_graph(ttl_path)
    
    for concept_id, description in descriptions.items():
        subject = URIRef(str(LLM) + concept_id)
        
        if (subject, RDF.type, OWL.Class) in graph:
            graph.remove((subject, LLM.description, None))
            graph.add((subject, LLM.description, Literal(description)))
    
    graph.serialize(destination=ttl_path, format="turtle")


