#!/usr/bin/env python3
"""Rollback ontology to a previous backup."""

import json
import sys
import argparse
import shutil
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from storage.graph_query_engine import GraphQueryEngine


def list_backups(project_root: Path) -> list:
    """사용 가능한 백업 목록 반환."""
    backup_dir = project_root / "db" / "real.backup"
    if not backup_dir.exists():
        return []
    
    backups = sorted(backup_dir.iterdir(), reverse=True)
    return [b for b in backups if b.is_dir()]


def rollback(
    backup_path: Path,
    project_root: Path,
    graph_engine: GraphQueryEngine
) -> None:
    """백업에서 복원."""
    
    real_dir = project_root / "db" / "real"
    
    # 1. new_concepts.db 복원
    backup_db = backup_path / "new_concepts.db"
    if backup_db.exists():
        target_db = real_dir / "new_concepts.db"
        if target_db.exists():
            target_db.unlink()
        shutil.copy2(backup_db, target_db)
        print(f"  new_concepts.db 복원 완료")
    
    # 2. vector_store 복원
    backup_vector = backup_path / "vector_store"
    if backup_vector.exists():
        target_vector = real_dir / "vector_store"
        if target_vector.exists():
            shutil.rmtree(target_vector)
        shutil.copytree(backup_vector, target_vector)
        print(f"  vector_store 복원 완료")
    
    # 3. GraphDB 복원 (덤프에 있는 개념들만 남기고 나머지 삭제)
    graphdb_dump = backup_path / "graphdb_dump.json"
    if graphdb_dump.exists():
        with open(graphdb_dump, 'r', encoding='utf-8') as f:
            backup_concepts = json.load(f)
        
        backup_concept_ids = {c["concept_id"] for c in backup_concepts}
        
        current_query = """
        PREFIX llm: <http://example.org/llm-ontology#>
        PREFIX owl: <http://www.w3.org/2002/07/owl#>
        
        SELECT ?concept WHERE {
            ?concept a owl:Class .
            FILTER(STRSTARTS(STR(?concept), STR(llm:)))
        }
        """
        
        try:
            results = graph_engine.query(current_query)
            current_ids = set()
            for row in results:
                uri = row.get("concept", {}).get("value", "")
                concept_id = uri.split("#")[-1] if "#" in uri else uri.split("/")[-1]
                current_ids.add(concept_id)
            
            to_delete = current_ids - backup_concept_ids
            
            if to_delete:
                print(f"  GraphDB에서 {len(to_delete)}개 개념 삭제 중...")
                for concept_id in to_delete:
                    delete_query = f"""
                    PREFIX llm: <http://example.org/llm-ontology#>
                    
                    DELETE WHERE {{
                        llm:{concept_id} ?p ?o .
                    }}
                    """
                    try:
                        graph_engine.update(delete_query)
                    except Exception:
                        pass
                print(f"  GraphDB 롤백 완료 ({len(to_delete)}개 삭제)")
            else:
                print(f"  GraphDB: 삭제할 개념 없음")
                
        except Exception as e:
            print(f"  [경고] GraphDB 롤백 실패: {e}")


def main():
    parser = argparse.ArgumentParser(description="Rollback ontology to a backup")
    parser.add_argument("--backup", help="Backup folder name (timestamp)")
    parser.add_argument("--list", action="store_true", help="List available backups")
    parser.add_argument("--graph-endpoint", default="http://localhost:7200/repositories/llm-ontology")
    
    args = parser.parse_args()
    
    project_root = Path(__file__).parent.parent.parent
    
    if args.list:
        backups = list_backups(project_root)
        if not backups:
            print("사용 가능한 백업이 없습니다.")
        else:
            print("사용 가능한 백업:")
            for b in backups:
                print(f"  - {b.name}")
        return
    
    if not args.backup:
        backups = list_backups(project_root)
        if not backups:
            print("사용 가능한 백업이 없습니다.")
            sys.exit(1)
        
        print("가장 최근 백업으로 롤백합니다.")
        backup_path = backups[0]
    else:
        backup_path = project_root / "db" / "real.backup" / args.backup
        if not backup_path.exists():
            print(f"백업을 찾을 수 없습니다: {backup_path}")
            sys.exit(1)
    
    print(f"\n{'='*60}")
    print(f"Ontology Rollback")
    print(f"{'='*60}\n")
    print(f"백업: {backup_path.name}")
    
    confirm = input("\n정말 롤백하시겠습니까? (yes/no): ")
    if confirm.lower() != "yes":
        print("취소됨")
        sys.exit(0)
    
    print("\n롤백 중...")
    
    graph_engine = GraphQueryEngine(args.graph_endpoint)
    
    try:
        rollback(backup_path, project_root, graph_engine)
        print(f"\n{'='*60}")
        print(f"롤백 완료: {backup_path.name}")
        print(f"{'='*60}")
    except Exception as e:
        print(f"\n오류: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

