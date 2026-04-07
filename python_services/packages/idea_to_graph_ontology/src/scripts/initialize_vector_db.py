#!/usr/bin/env python3
"""온톨로지 개념들에 대한 description을 생성하고 Vector DB를 초기화하는 스크립트."""

import os
import sys
from pathlib import Path

project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root / "src"))

from utils import load_all_concepts, update_ttl_descriptions
from storage.vector_store import VectorStore
from storage.graph_query_engine import GraphQueryEngine
from pipeline.ontology_updater import OntologyUpdater
from langchain_openai import ChatOpenAI


def main():
    ttl_path = project_root / "data" / "llm_ontology.ttl"
    vector_db_path = project_root / "db" / "real" / "vector_store"
    
    print("=== 온톨로지 개념 description 생성 및 Vector DB 초기화 ===\n")
    
    print(f"1. TTL 파일 로드: {ttl_path}")
    concepts = load_all_concepts(str(ttl_path))
    print(f"   총 {len(concepts)}개 개념 발견\n")
    
    empty_desc_concepts = [c for c in concepts if not c["description"]]
    print(f"2. Description이 비어있는 개념: {len(empty_desc_concepts)}개")
    
    if empty_desc_concepts:
        print("\n3. LLM으로 description 생성 중...")
        
        model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        llm = ChatOpenAI(model=model, temperature=0)
        graph_engine = GraphQueryEngine("http://localhost:7200/repositories/llm-ontology")
        vector_store = VectorStore(str(vector_db_path))
        
        updater = OntologyUpdater(
            graph_engine=graph_engine,
            vector_store=vector_store,
            llm=llm
        )
        
        descriptions = {}
        total = len(empty_desc_concepts)
        
        for idx, concept in enumerate(empty_desc_concepts, 1):
            print(f"   [{idx}/{total}] {concept['label']}...", end=" ")
            
            description = updater.generate_description(
                concept_id=concept["concept_id"],
                label=concept["label"],
                parent=concept.get("parent")
            )
            
            descriptions[concept["concept_id"]] = description
            print("완료")
        
        print(f"\n4. TTL 파일에 description 업데이트 중...")
        update_ttl_descriptions(str(ttl_path), descriptions)
        print("   완료\n")
        
        print("5. 업데이트된 개념 목록 다시 로드...")
        concepts = load_all_concepts(str(ttl_path))
    else:
        print("   모든 개념에 description이 있습니다.\n")
    
    print("\n6. Vector DB 초기화 중...")
    vector_store = VectorStore(str(vector_db_path))
    vector_store.initialize(concepts)
    
    count = vector_store.count()
    print(f"   완료! {count}개 개념이 Vector DB에 저장되었습니다.\n")
    
    print("=== 초기화 완료 ===")
    print(f"\nVector DB 경로: {vector_db_path}")
    print("\n이제 유사 개념 검색을 사용할 수 있습니다:")
    print("  from ontology import VectorStore")
    print(f"  store = VectorStore('{vector_db_path}')")
    print("  results = store.find_similar('attention mechanism', k=5)")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n중단되었습니다.")
        sys.exit(1)
    except Exception as e:
        print(f"\n오류 발생: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

