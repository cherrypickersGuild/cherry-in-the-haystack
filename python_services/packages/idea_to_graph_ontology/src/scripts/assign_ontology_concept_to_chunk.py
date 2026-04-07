#!/usr/bin/env python3
"""Assign ontology concepts to chunks with staging and checkpoint support."""

import json
import sys
import argparse
import shutil
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent))

if sys.stdout.isatty() is False:
    sys.stdout.reconfigure(line_buffering=True)

from storage.graph_query_engine import GraphQueryEngine
from storage.vector_store import VectorStore
from storage.new_concept_manager import NewConceptManager
from pipeline.concept_matcher import ConceptMatcher
from pipeline.ontology_updater import OntologyUpdater
from pipeline.document_ontology_mapper import DocumentOntologyMapper
from pipeline.ontology_graph_manager import OntologyGraphManager
from pipeline.staging_manager import StagingManager

from pipeline.rematch import rematch_all


def load_jsonl(file_path: str) -> List[Dict[str, Any]]:
    """JSONL 파일 로드."""
    concepts = []
    
    with open(file_path, 'r', encoding='utf-8') as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            
            try:
                data = json.loads(line)
                
                required_fields = ["concept", "section_id", "section_title", "chunk_text"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    print(f"Warning: Line {line_num} missing required fields: {missing_fields}, skipping")
                    continue
                
                concepts.append(data)
            
            except json.JSONDecodeError as e:
                print(f"Warning: Line {line_num} invalid JSON: {e}")
                continue
    
    return concepts


def find_latest_task_id(task_name: str, base_dir: Path) -> Optional[str]:
    """가장 최신 task_id 찾기."""
    stage_dir = base_dir / "db" / "stage"
    if not stage_dir.exists():
        return None
    
    matching_dirs = [
        d for d in stage_dir.iterdir()
        if d.is_dir() and d.name.startswith(f"{task_name}_")
    ]
    
    if not matching_dirs:
        return None
    
    matching_dirs.sort(key=lambda x: x.name, reverse=True)
    return matching_dirs[0].name


def load_checkpoint(checkpoint_dir: Path) -> Optional[Dict[str, Any]]:
    """가장 최신 체크포인트 로드."""
    if not checkpoint_dir.exists():
        return None
    
    checkpoint_files = list(checkpoint_dir.glob("checkpoint_*.json"))
    if not checkpoint_files:
        return None
    
    checkpoint_files.sort(key=lambda x: x.name, reverse=True)
    latest_checkpoint = checkpoint_files[0]
    
    with open(latest_checkpoint, 'r', encoding='utf-8') as f:
        checkpoint_data = json.load(f)
    
    checkpoint_db = latest_checkpoint.with_suffix('.db')
    if checkpoint_db.exists():
        checkpoint_data['db_path'] = str(checkpoint_db)
    
    return checkpoint_data


def save_checkpoint(
    checkpoint_dir: Path,
    processed_index: int,
    results: List[Dict[str, Any]],
    staging_concepts: List[Dict[str, Any]],
    stage_db_path: str
) -> None:
    """체크포인트 저장."""
    checkpoint_dir.mkdir(parents=True, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    checkpoint_file = checkpoint_dir / f"checkpoint_{timestamp}.json"
    checkpoint_db = checkpoint_dir / f"checkpoint_{timestamp}.db"
    
    checkpoint_data = {
        "processed_index": processed_index,
        "results": results,
        "staging_concepts": staging_concepts,
        "checkpoint_timestamp": datetime.now().isoformat(),
        "total_concepts": len(results)
    }
    
    with open(checkpoint_file, 'w', encoding='utf-8') as f:
        json.dump(checkpoint_data, f, ensure_ascii=False, indent=2)
    
    if Path(stage_db_path).exists():
        shutil.copy2(stage_db_path, checkpoint_db)
    
    print(f"\n✓ 체크포인트 저장: {checkpoint_file.name} (처리된 개념: {processed_index}개)", flush=True)


def process_jsonl(
    input_file: str,
    task_name: str,
    graph_endpoint: str,
    project_root: Path,
    resume: bool = False,
    debug: bool = False
) -> None:
    """JSONL 입력을 처리하여 개념 매핑 및 스테이징."""
    
    print(f"\n{'='*60}")
    print(f"Ontology Mapping 시작")
    print(f"{'='*60}\n")
    
    print(f"입력 파일: {input_file}")
    print(f"작업 이름: {task_name}")
    
    concepts = load_jsonl(input_file)
    print(f"로드된 개념 수: {len(concepts)}\n")
    
    if not concepts:
        print("처리할 개념이 없습니다.")
        return
    
    task_id = None
    checkpoint_data = None
    start_index = 0
    
    if resume:
        task_id = find_latest_task_id(task_name, project_root)
        if not task_id:
            print(f"경고: '{task_name}'으로 시작하는 task를 찾을 수 없습니다. 새로 시작합니다.")
            resume = False
    
    if not task_id:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        task_id = f"{task_name}_{timestamp}"
    
    print(f"Task ID: {task_id}")
    
    if resume and task_id:
        checkpoint_dir = project_root / "db" / "stage" / task_id / "staged_result" / "checkpoints"
        checkpoint_data = load_checkpoint(checkpoint_dir)
        
        if checkpoint_data:
            start_index = checkpoint_data.get("processed_index", 0)
            print(f"체크포인트 로드: {start_index}개 개념까지 처리됨")
            
            if checkpoint_data.get("db_path"):
                stage_db_dir = project_root / "db" / "stage" / task_id
                stage_db_dir.mkdir(parents=True, exist_ok=True)
                stage_db_path = stage_db_dir / "new_concepts.db"
                shutil.copy2(checkpoint_data["db_path"], stage_db_path)
                print(f"Stage DB 복원: {stage_db_path}")
        else:
            print("체크포인트를 찾을 수 없습니다. 처음부터 시작합니다.")
            resume = False
    
    stage_db_dir = project_root / "db" / "stage" / task_id
    stage_db_dir.mkdir(parents=True, exist_ok=True)
    
    stage_db_path = str(stage_db_dir / "new_concepts.db")
    stage_vector_db_path = str(stage_db_dir / "vector_store")
    real_new_concept_db_path = str(project_root / "db" / "real" / "new_concepts.db")
    real_vector_db_path = str(project_root / "db" / "real" / "vector_store")
    
    if not resume:
        if Path(stage_db_path).exists():
            Path(stage_db_path).unlink()
        if Path(stage_vector_db_path).exists():
            shutil.rmtree(stage_vector_db_path)
        
        if Path(real_vector_db_path).exists():
            print(f"Real Vector DB를 Stage 디렉토리로 복사 중...")
            shutil.copytree(real_vector_db_path, stage_vector_db_path)
            print(f"  복사 완료: {stage_vector_db_path}")
        else:
            print(f"경고: Real Vector DB가 없습니다: {real_vector_db_path}")
            Path(stage_vector_db_path).mkdir(parents=True, exist_ok=True)
    
    print(f"Stage DB 경로: {stage_db_path}")
    print(f"Stage Vector DB 경로: {stage_vector_db_path} (real DB 복사본)")
    print()
    
    print("컴포넌트 초기화 중...")
    graph_engine = GraphQueryEngine(graph_endpoint)
    vector_store = VectorStore(stage_vector_db_path)
    print(f"VectorStore 초기화 완료")
    print(f"  - DB 경로: {vector_store.db_path}")
    print(f"  - 컬렉션 이름: {vector_store.collection_name}")
    try:
        collections = vector_store.client.list_collections()
        print(f"  - 사용 가능한 컬렉션: {[c.name for c in collections]}")
    except Exception as e:
        print(f"  - 컬렉션 목록 조회 실패: {e}")
    print(f"  - ChromaDB 총 개념 수: {vector_store.count()}")
    
    concept_matcher = ConceptMatcher(vector_store)
    new_concept_manager = NewConceptManager(
        stage_db_path,
        vector_store=vector_store,
        mode="stage",
        task_id=task_id,
        real_new_concept_db_path=real_new_concept_db_path
    )
    
    graph_manager = OntologyGraphManager(
        graph_engine=graph_engine,
        vector_store=vector_store,
        root_concept="LLMConcept",
        debug=debug
    )
    print(f"그래프 로드 완료: {len(graph_manager.real_graph.nodes())}개 노드, {len(graph_manager.real_graph.edges())}개 엣지")
    
    staging_manager = StagingManager(
        graph_manager=graph_manager,
        graph_engine=graph_engine,
        vector_store=vector_store,
        db_path=stage_vector_db_path
    )
    
    ontology_updater = OntologyUpdater(
        graph_engine=graph_engine,
        vector_store=vector_store,
        graph_manager=graph_manager,
        staging_manager=staging_manager
    )
    
    mapper = DocumentOntologyMapper(
        graph_engine=graph_engine,
        vector_store=vector_store,
        concept_matcher=concept_matcher,
        new_concept_manager=new_concept_manager,
        ontology_updater=ontology_updater,
        debug=debug
    )
    
    print("초기화 완료\n")
    
    if resume and checkpoint_data:
        results = checkpoint_data.get("results", [])
        staging_concepts = checkpoint_data.get("staging_concepts", [])
        staging_manager.staged_concepts = staging_concepts
        print(f"체크포인트에서 {len(results)}개 결과 복원")
    else:
        results = []
    
    print(f"{'='*60}")
    print(f"개념 매핑 시작 ({len(concepts)}개, {start_index}번부터)")
    print(f"{'='*60}\n")
    
    checkpoint_interval = 10
    checkpoint_dir = project_root / "db" / "stage" / task_id / "staged_result" / "checkpoints"
    
    for idx, concept_data in enumerate(concepts[start_index:], start=start_index + 1):
        concept = concept_data["concept"]
        chunk_text = concept_data["chunk_text"]
        section_id = concept_data["section_id"]
        section_title = concept_data["section_title"]
        
        source = concept_data.get("source", f"section_{section_id}")
        metadata = {k: v for k, v in concept_data.items() 
                   if k not in ["concept", "chunk_text", "section_id", "section_title"]}
        
        print(f"[{idx}/{len(concepts)}] 처리 중: {concept}", flush=True)
        
        try:
            result = mapper.map_concept(
                concept=concept,
                chunk_text=chunk_text,
                source=source,
                section_title=section_title,
                metadata=metadata
            )
            
            matched_concept_ids = result.get("matched_concept_ids", [])
            result_entry = {
                "concept": concept,
                "section_id": section_id,
                "section_title": section_title,
                "source": source,
                "chunk_text": chunk_text,
                "matched_concept_ids": matched_concept_ids,
                "is_new": result.get("is_new", False)
            }
            
            if resume and idx <= start_index:
                if idx < len(results):
                    results[idx - 1] = result_entry
                else:
                    results.append(result_entry)
            else:
                results.append(result_entry)
            
            if matched_concept_ids:
                print(f"  ✓ 매칭됨: {', '.join(matched_concept_ids)}", flush=True)
            else:
                print(f"  • 신규 개념으로 저장됨", flush=True)
        
        except KeyboardInterrupt:
            print(f"\n\n사용자에 의해 중단되었습니다.", flush=True)
            print(f"체크포인트 저장 중...", flush=True)
            save_checkpoint(
                checkpoint_dir,
                idx - 1,
                results,
                staging_manager.staged_concepts,
                stage_db_path
            )
            raise
        
        except Exception as e:
            error_msg = str(e).lower()
            error_type = type(e).__name__
            
            is_critical_error = (
                "api" in error_msg or
                "openai" in error_msg or
                "rate limit" in error_msg or
                "authentication" in error_msg or
                "connection" in error_msg or
                "network" in error_msg or
                "timeout" in error_msg or
                "httpx" in error_type.lower() or
                "requests" in error_type.lower() or
                "urllib" in error_type.lower()
            )
            
            if is_critical_error:
                print(f"\n✗ 치명적 오류 발생: {e}", flush=True)
                print(f"오류 타입: {error_type}", flush=True)
                print(f"처리 중이던 개념: [{idx}/{len(concepts)}] {concept}", flush=True)
                print(f"\n체크포인트 저장 중...", flush=True)
                save_checkpoint(
                    checkpoint_dir,
                    idx - 1,
                    results,
                    staging_manager.staged_concepts,
                    stage_db_path
                )
                print(f"체크포인트 저장 완료. --resume 옵션으로 재개할 수 있습니다.", flush=True)
                raise
            
            print(f"  ✗ 오류 (건너뜀): {e}", flush=True)
            continue
        
        if idx % checkpoint_interval == 0:
            try:
                save_checkpoint(
                    checkpoint_dir,
                    idx,
                    results,
                    staging_manager.staged_concepts,
                    stage_db_path
                )
            except Exception as e:
                print(f"경고: 체크포인트 저장 실패 (계속 진행): {e}", flush=True)
    
    print(f"\n{'='*60}")
    print(f"스테이징된 변경사항 확인")
    print(f"{'='*60}\n")
    
    staging_manager.print_staging_summary()
    
    if staging_manager.staged_concepts:
        print(f"\n✓ 스테이징 JSON 파일 저장됨: {staging_manager.staging_file_path}")
    
    if staging_manager.staged_concepts:
        keyword_to_concept = {}
        for staged_concept in staging_manager.staged_concepts:
            concept_id = staged_concept.get("concept_id")
            original_keywords = staged_concept.get("original_keywords", [])
            if original_keywords:
                for keyword in original_keywords:
                    keyword_to_concept[keyword] = concept_id
        
        updated_count = 0
        for result in results:
            concept = result.get("concept")
            matched_concept_ids = result.get("matched_concept_ids", [])
            if concept in keyword_to_concept:
                concept_id = keyword_to_concept[concept]
                if concept_id not in matched_concept_ids:
                    matched_concept_ids.append(concept_id)
                    result["matched_concept_ids"] = matched_concept_ids[:3]
                    updated_count += 1
        
        if updated_count > 0:
            print(f"\n✓ 클러스터링으로 추가된 개념 매칭: {updated_count}개 업데이트됨")
    
    print(f"\n{'='*60}", flush=True)
    print(f"전체 항목 재매칭 시작", flush=True)
    print(f"{'='*60}\n", flush=True)
    
    try:
        rematched_count = rematch_all(
            results=results,
            concept_matcher=concept_matcher,
            vector_store=vector_store,
            graph_manager=graph_manager,
            include_staging=True,
            debug=debug
        )
        
        if rematched_count > 0:
            print(f"\n✓ 재매칭 완료: {rematched_count}개 항목 업데이트됨", flush=True)
    except KeyboardInterrupt:
        print(f"\n\n사용자에 의해 중단되었습니다.", flush=True)
        print(f"체크포인트 저장 중...", flush=True)
        save_checkpoint(
            checkpoint_dir,
            len(results),
            results,
            staging_manager.staged_concepts,
            stage_db_path
        )
        raise
    except Exception as e:
        error_msg = str(e).lower()
        error_type = type(e).__name__
        
        is_critical_error = (
            "api" in error_msg or
            "openai" in error_msg or
            "rate limit" in error_msg or
            "authentication" in error_msg or
            "connection" in error_msg or
            "network" in error_msg or
            "timeout" in error_msg or
            "httpx" in error_type.lower() or
            "requests" in error_type.lower() or
            "urllib" in error_type.lower()
        )
        
        if is_critical_error:
            print(f"\n✗ 치명적 오류 발생 (재매칭 중): {e}", flush=True)
            print(f"오류 타입: {error_type}", flush=True)
            print(f"\n체크포인트 저장 중...", flush=True)
            save_checkpoint(
                checkpoint_dir,
                len(results),
                results,
                staging_manager.staged_concepts,
                stage_db_path
            )
            print(f"체크포인트 저장 완료. --resume 옵션으로 재개할 수 있습니다.", flush=True)
            raise
        
        print(f"\n경고: 재매칭 중 오류 발생 (건너뜀): {e}", flush=True)
    
    output_dir = project_root / "db" / "stage" / task_id / "staged_result"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    output_jsonl = output_dir / "output_with_concepts.jsonl"
    with open(output_jsonl, 'w', encoding='utf-8') as f:
        for result in results:
            json.dump(result, f, ensure_ascii=False)
            f.write('\n')
    
    staging_concepts_file = output_dir / "staging_concepts.json"
    staging_data = {
        "staged_concepts": staging_manager.staged_concepts,
        "last_updated": datetime.now().isoformat()
    }
    with open(staging_concepts_file, 'w', encoding='utf-8') as f:
        json.dump(staging_data, f, ensure_ascii=False, indent=2)
    
    stage_db_copy = output_dir / "new_concepts.db"
    if Path(stage_db_path).exists():
        shutil.copy2(stage_db_path, stage_db_copy)
    
    print(f"\n{'='*60}")
    print(f"결과물 저장 완료")
    print(f"{'='*60}")
    print(f"출력 디렉토리: {output_dir}")
    print(f"  - output_with_concepts.jsonl: {len(results)}개")
    print(f"  - staging_concepts.json: {len(staging_manager.staged_concepts)}개")
    print(f"  - new_concepts_stage_{task_id}.db: 복사본 저장됨")


def main():
    """메인 함수."""
    parser = argparse.ArgumentParser(
        description="Assign ontology concepts to chunks with staging and checkpoint support"
    )
    parser.add_argument(
        "--task-name",
        required=True,
        help="Task name (will be used with timestamp to create task_id)"
    )
    parser.add_argument(
        "--input",
        required=True,
        help="Input JSONL file path"
    )
    parser.add_argument(
        "--graph-endpoint",
        default="http://localhost:7200/repositories/llm-ontology",
        help="Graph DB SPARQL endpoint"
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Resume from latest checkpoint"
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Enable debug mode"
    )
    
    args = parser.parse_args()
    
    project_root = Path(__file__).parent.parent.parent
    
    try:
        process_jsonl(
            input_file=args.input,
            task_name=args.task_name,
            graph_endpoint=args.graph_endpoint,
            project_root=project_root,
            resume=args.resume,
            debug=args.debug
        )
    except KeyboardInterrupt:
        print("\n\n중단되었습니다.")
        sys.exit(1)
    except Exception as e:
        print(f"\n오류 발생: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

