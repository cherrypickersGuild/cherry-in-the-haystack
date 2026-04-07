#!/usr/bin/env python3
"""Commit staged ontology assignments to GraphDB and New Concept DB."""

import json
import sys
import argparse
import csv
import sqlite3
import shutil
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

sys.path.insert(0, str(Path(__file__).parent.parent))

from storage.graph_query_engine import GraphQueryEngine
from storage.vector_store import VectorStore
from storage.new_concept_manager import NewConceptManager
from pipeline.ontology_updater import OntologyUpdater


def normalize_concept_id(concept_id: str) -> str:
    """Concept ID에서 띄어쓰기 제거."""
    return concept_id.replace(" ", "")


def load_tsv(tsv_path: str) -> List[Dict[str, str]]:
    """TSV 파일 로드 (concept_id, parent_concept 컬럼 필수)."""
    concepts = []
    
    with open(tsv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f, delimiter='\t')
        for row_num, row in enumerate(reader, 2):
            concept_id = row.get("concept_id", "").strip()
            parent_concept = row.get("parent_concept", "").strip()
            
            if not concept_id or not parent_concept:
                print(f"[경고] Line {row_num}: concept_id 또는 parent_concept 누락, 건너뜀")
                continue
            
            concepts.append({
                "concept_id": normalize_concept_id(concept_id),
                "parent_concept": normalize_concept_id(parent_concept)
            })
    
    return concepts


def load_staging_concepts(staging_file_path: str) -> Dict[str, Dict]:
    """staging_concepts.json에서 concept 정보 로드."""
    if not Path(staging_file_path).exists():
        return {}
    
    with open(staging_file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    return {
        normalize_concept_id(c.get("concept_id", "")): c
        for c in data.get("staged_concepts", [])
        if c.get("concept_id")
    }


def load_stage_db_concepts(stage_db_path: str) -> List[Dict]:
    """Stage new_concepts.db에서 개념 로드."""
    if not Path(stage_db_path).exists():
        return []
    
    concepts = []
    conn = sqlite3.connect(stage_db_path)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT concept, description, source, embedding, 
               original_keyword, noun_phrase_summary, reason 
        FROM new_concepts
    """)
    
    for row in cursor.fetchall():
        concepts.append({
            "concept": row[0],
            "description": row[1],
            "source": row[2],
            "embedding": row[3],
            "original_keyword": row[4],
            "noun_phrase_summary": row[5],
            "reason": row[6]
        })
    
    conn.close()
    return concepts


def merge_to_real_db(
    stage_db_paths: List[str],
    real_db_path: str,
    vector_store: VectorStore
) -> int:
    """Stage DB의 개념들을 Real DB로 병합 후 재클러스터링."""
    
    real_manager = NewConceptManager(
        real_db_path,
        vector_store=vector_store,
        mode="real"
    )
    
    existing = set()
    cursor = real_manager.conn.cursor()
    cursor.execute("SELECT concept FROM new_concepts")
    for row in cursor.fetchall():
        existing.add(row[0])
    
    new_count = 0
    for stage_db_path in stage_db_paths:
        stage_concepts = load_stage_db_concepts(stage_db_path)
        
        for concept in stage_concepts:
            if concept["concept"] in existing:
                continue
            
            real_manager.save_concept(
                concept=concept["concept"],
                description=concept.get("description", ""),
                source=concept.get("source", ""),
                original_keyword=concept.get("original_keyword"),
                noun_phrase_summary=concept.get("noun_phrase_summary"),
                reason=concept.get("reason")
            )
            existing.add(concept["concept"])
            new_count += 1
    
    if new_count > 0:
        real_manager._create_clusters()
    
    real_manager.close()
    return new_count


def create_backup(
    project_root: Path,
    real_db_path: str,
    vector_db_path: str,
    graph_engine: GraphQueryEngine
) -> str:
    """커밋 전 백업 생성."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = project_root / "db" / "real.backup" / timestamp
    backup_dir.mkdir(parents=True, exist_ok=True)
    
    # 1. Real new_concepts.db 백업
    if Path(real_db_path).exists():
        shutil.copy2(real_db_path, backup_dir / "new_concepts.db")
    
    # 2. Vector Store 백업
    if Path(vector_db_path).exists():
        shutil.copytree(vector_db_path, backup_dir / "vector_store")
    
    # 3. GraphDB 덤프
    query = """
    PREFIX llm: <http://example.org/llm-ontology#>
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    
    SELECT ?concept ?label ?parent ?description
    WHERE {
        ?concept a owl:Class .
        OPTIONAL { ?concept rdfs:label ?label . }
        OPTIONAL { ?concept rdfs:subClassOf ?parent . }
        OPTIONAL { ?concept llm:description ?description . }
    }
    """
    try:
        results = graph_engine.query(query)
        graphdb_dump = []
        for row in results:
            concept_uri = row.get("concept", {}).get("value", "")
            concept_id = concept_uri.split("#")[-1] if "#" in concept_uri else concept_uri.split("/")[-1]
            
            parent_uri = row.get("parent", {}).get("value", "")
            parent_id = parent_uri.split("#")[-1] if "#" in parent_uri else parent_uri.split("/")[-1]
            
            graphdb_dump.append({
                "concept_id": concept_id,
                "label": row.get("label", {}).get("value", ""),
                "parent": parent_id,
                "description": row.get("description", {}).get("value", "")
            })
        
        with open(backup_dir / "graphdb_dump.json", 'w', encoding='utf-8') as f:
            json.dump(graphdb_dump, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"  [경고] GraphDB 덤프 실패: {e}")
    
    return str(backup_dir)


def topological_sort(concepts: List[Dict[str, str]]) -> List[Dict[str, str]]:
    """의존성 순서대로 정렬 (parent가 먼저 추가되도록)."""
    concept_ids = {c["concept_id"] for c in concepts}
    concept_map = {c["concept_id"]: c for c in concepts}
    
    sorted_list = []
    added = set()
    
    def add_with_deps(concept_id: str):
        if concept_id in added or concept_id not in concept_map:
            return
        
        parent = concept_map[concept_id]["parent_concept"]
        if parent in concept_ids and parent not in added:
            add_with_deps(parent)
        
        sorted_list.append(concept_map[concept_id])
        added.add(concept_id)
    
    for concept in concepts:
        add_with_deps(concept["concept_id"])
    
    return sorted_list


def commit_to_graphdb(
    tsv_path: str,
    staging_json_path: str,
    graph_endpoint: str,
    vector_store: VectorStore,
    ontology_updater: OntologyUpdater,
    graph_engine: GraphQueryEngine
) -> int:
    """TSV에 확정된 개념들을 GraphDB에 커밋."""
    
    tsv_concepts = load_tsv(tsv_path)
    print(f"TSV에서 로드: {len(tsv_concepts)}개")
    
    staging_map = load_staging_concepts(staging_json_path)
    print(f"staging_concepts.json에서 로드: {len(staging_map)}개")
    
    tsv_concept_ids = {c["concept_id"] for c in tsv_concepts}
    sorted_concepts = topological_sort(tsv_concepts)
    
    success_count = 0
    skip_count = 0
    added_in_session = set()
    
    for idx, item in enumerate(sorted_concepts, 1):
        concept_id = item["concept_id"]
        parent_concept = item["parent_concept"]
        
        parent_exists = (
            graph_engine.concept_exists(parent_concept) or
            parent_concept in added_in_session
        )
        
        if not parent_exists:
            print(f"[{idx}] 건너뜀: {concept_id} (parent '{parent_concept}' 없음)")
            skip_count += 1
            continue
        
        staging_info = staging_map.get(concept_id, {})
        label = staging_info.get("label", concept_id)
        description = staging_info.get("description", "")
        
        if not description:
            description = ontology_updater.generate_description(
                concept_id=concept_id,
                label=label,
                parent=parent_concept
            )
        
        print(f"[{idx}/{len(sorted_concepts)}] {concept_id} -> {parent_concept}")
        
        graph_engine.add_concept(
            concept_id=concept_id,
            label=label,
            parent=parent_concept,
            description=description
        )
        
        vector_store.add_concept(
            concept_id=concept_id,
            description=description,
            label=label,
            parent=parent_concept,
            staging=False
        )
        
        added_in_session.add(concept_id)
        success_count += 1
    
    if skip_count > 0:
        print(f"  (건너뜀: {skip_count}개)")
    
    return success_count


def main():
    parser = argparse.ArgumentParser(
        description="Commit staged ontology to GraphDB and New Concept DB"
    )
    parser.add_argument("--tsv", required=True, help="TSV file with concept_id, parent_concept")
    parser.add_argument("--staging-json", required=True, help="staging_concepts.json path")
    parser.add_argument("--stage-db", action="append", required=True, help="Stage new_concepts.db paths")
    parser.add_argument("--graph-endpoint", default="http://localhost:7200/repositories/llm-ontology")
    parser.add_argument("--vector-db", default=None, help="Vector DB path")
    parser.add_argument("--new-concept-db-real", default=None, help="Real new_concepts.db path")
    
    args = parser.parse_args()
    
    project_root = Path(__file__).parent.parent.parent
    vector_db_path = args.vector_db or str(project_root / "db" / "real" / "vector_store")
    real_db_path = args.new_concept_db_real or str(project_root / "db" / "real" / "new_concepts.db")
    
    print(f"\n{'='*60}")
    print(f"Ontology Commit")
    print(f"{'='*60}\n")
    
    graph_engine = GraphQueryEngine(args.graph_endpoint)
    vector_store = VectorStore(vector_db_path)
    ontology_updater = OntologyUpdater(graph_engine=graph_engine, vector_store=vector_store)
    
    try:
        print("[0/3] 백업 생성...")
        backup_path = create_backup(
            project_root=project_root,
            real_db_path=real_db_path,
            vector_db_path=vector_db_path,
            graph_engine=graph_engine
        )
        print(f"백업 완료: {backup_path}\n")
        
        print("[1/3] GraphDB 업데이트...")
        graph_count = commit_to_graphdb(
            tsv_path=args.tsv,
            staging_json_path=args.staging_json,
            graph_endpoint=args.graph_endpoint,
            vector_store=vector_store,
            ontology_updater=ontology_updater,
            graph_engine=graph_engine
        )
        print(f"GraphDB: {graph_count}개 추가됨\n")
        
        print("[2/3] New Concept DB 병합 및 재클러스터링...")
        merge_count = merge_to_real_db(
            stage_db_paths=args.stage_db,
            real_db_path=real_db_path,
            vector_store=vector_store
        )
        print(f"New Concept DB: {merge_count}개 병합됨\n")
        
        print(f"{'='*60}")
        print(f"완료")
        print(f"  - 백업: {backup_path}")
        print(f"  - GraphDB: {graph_count}개 추가")
        print(f"  - New Concept DB: {merge_count}개 병합")
        print(f"{'='*60}")
        
    except KeyboardInterrupt:
        print("\n중단됨")
        sys.exit(1)
    except Exception as e:
        print(f"\n오류: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()