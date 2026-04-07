#!/usr/bin/env python3
"""JSONL 파일에서 온톨로지 관계를 추출하여 GraphDB에 추가하는 스크립트.

기능:
1. 클래스 간 related 관계: 같은 chunk에서 co-occurrence한 matched_concept_ids 쌍
2. Instance 생성 및 instance_of 관계: concept 필드를 instance로 생성
3. Instance 간 related 관계: 같은 section_id에서 언급된 instance 연결
"""

import argparse
import hashlib
import json
import sys
from collections import defaultdict
from datetime import datetime
from itertools import combinations
from pathlib import Path
from typing import Dict, List, Set, Tuple

from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).parent.parent))

from storage.graph_query_engine import GraphQueryEngine


LLM_PREFIX = "http://example.org/llm-ontology#"


def sanitize_id(concept_id: str) -> str:
    """SPARQL URI에서 사용 가능하도록 ID를 CamelCase로 변환.
    
    예: 'Training pipeline' -> 'TrainingPipeline'
        'Production-ready ML system' -> 'ProductionReadyMLSystem'
        'CPU bound' -> 'CPUBound'
    """
    words = concept_id.replace("-", " ").split()
    return "".join(word[0].upper() + word[1:] if word else "" for word in words)


def generate_instance_id(text: str) -> str:
    """concept 텍스트의 해시값으로 instance ID 생성."""
    hash_value = hashlib.md5(text.encode('utf-8')).hexdigest()[:8]
    return f"inst_{hash_value}"


def load_jsonl(file_path: Path) -> List[Dict]:
    """JSONL 파일 로드."""
    chunks = []
    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line:
                chunks.append(json.loads(line))
    return chunks


def load_existing_classes(engine: GraphQueryEngine) -> Set[str]:
    """온톨로지에 존재하는 모든 클래스 ID 로드."""
    query = """
    PREFIX llm: <http://example.org/llm-ontology#>
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    
    SELECT ?concept WHERE {
        ?concept a owl:Class .
        FILTER(STRSTARTS(STR(?concept), STR(llm:)))
    }
    """
    results = engine.query(query)
    
    classes = set()
    for row in results:
        uri = row.get("concept", {}).get("value", "")
        concept_id = uri.split("#")[-1] if "#" in uri else uri.split("/")[-1]
        classes.add(concept_id)
    
    return classes


def filter_valid_classes(
    concept_ids: List[str],
    existing_classes: Set[str],
    warned_classes: Set[str]
) -> List[str]:
    """존재하는 클래스만 필터링하고, 없는 클래스는 경고 출력."""
    valid = []
    for cid in concept_ids:
        sanitized = sanitize_id(cid)
        if sanitized in existing_classes:
            valid.append(sanitized)
        elif sanitized not in warned_classes:
            print(f"  [경고] 온톨로지에 없는 클래스 스킵: {cid}")
            warned_classes.add(sanitized)
    return valid


def count_class_cooccurrence(
    chunks: List[Dict],
    existing_classes: Set[str],
    warned_classes: Set[str]
) -> Dict[Tuple[str, str], int]:
    """클래스 쌍별 co-occurrence 카운트 (양방향)."""
    cooccurrence = defaultdict(int)
    
    for chunk in chunks:
        concept_ids = chunk.get("matched_concept_ids", [])
        if len(concept_ids) < 2:
            continue
        
        valid_ids = filter_valid_classes(concept_ids, existing_classes, warned_classes)
        if len(valid_ids) < 2:
            continue
        
        for c1, c2 in combinations(valid_ids, 2):
            cooccurrence[(c1, c2)] += 1
            cooccurrence[(c2, c1)] += 1
    
    return dict(cooccurrence)


def create_instances(
    chunks: List[Dict],
    existing_classes: Set[str],
    warned_classes: Set[str]
) -> List[Dict]:
    """각 chunk의 concept을 instance로 변환."""
    instances = []
    seen_ids = set()
    
    for chunk in chunks:
        concept_text = chunk.get("concept", "")
        if not concept_text:
            continue
        
        instance_id = generate_instance_id(concept_text)
        if instance_id in seen_ids:
            continue
        
        seen_ids.add(instance_id)
        raw_classes = chunk.get("matched_concept_ids", [])
        valid_classes = filter_valid_classes(raw_classes, existing_classes, warned_classes)
        
        if not valid_classes:
            continue
        
        instances.append({
            "id": instance_id,
            "label": concept_text,
            "classes": valid_classes,
            "section_id": chunk.get("section_id")
        })
    
    return instances


def group_instances_by_section(instances: List[Dict]) -> Dict[float, List[str]]:
    """section_id별로 instance ID 그룹화."""
    section_groups = defaultdict(list)
    
    for inst in instances:
        section_id = inst.get("section_id")
        if section_id is not None:
            section_groups[section_id].append(inst["id"])
    
    return dict(section_groups)


def collect_instance_relations(section_groups: Dict[float, List[str]]) -> List[Tuple[str, str]]:
    """같은 section의 instance 간 related 관계 수집 (양방향)."""
    relations = []
    
    for section_id, instance_ids in section_groups.items():
        if len(instance_ids) < 2:
            continue
        
        for i1, i2 in combinations(instance_ids, 2):
            relations.append((i1, i2))
            relations.append((i2, i1))
    
    return relations


def ensure_schema_exists(engine: GraphQueryEngine) -> None:
    """ConceptInstance, ClassRelation 등 스키마가 없으면 생성."""
    schema_query = f"""
    PREFIX llm: <{LLM_PREFIX}>
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    
    INSERT DATA {{
        llm:ConceptInstance a owl:Class ;
            rdfs:label "ConceptInstance"@en ;
            rdfs:comment "문서에서 추출된 개념 인스턴스"@ko ;
            rdfs:subClassOf llm:Thing .
        
        llm:ClassRelation a owl:Class ;
            rdfs:label "ClassRelation"@en ;
            rdfs:comment "클래스 간 co-occurrence 관계"@ko ;
            rdfs:subClassOf llm:Thing .
        
        llm:instanceOf a owl:ObjectProperty ;
            rdfs:label "instanceOf"@en ;
            rdfs:domain llm:ConceptInstance ;
            rdfs:range owl:Class .
        
        llm:relatedInstance a owl:ObjectProperty ;
            rdfs:label "relatedInstance"@en ;
            rdfs:domain llm:ConceptInstance ;
            rdfs:range llm:ConceptInstance .
        
        llm:source a owl:ObjectProperty ;
            rdfs:label "source"@en ;
            rdfs:domain llm:ClassRelation ;
            rdfs:range owl:Class .
        
        llm:target a owl:ObjectProperty ;
            rdfs:label "target"@en ;
            rdfs:domain llm:ClassRelation ;
            rdfs:range owl:Class .
        
        llm:cooccurrenceCount a owl:DatatypeProperty ;
            rdfs:label "cooccurrenceCount"@en ;
            rdfs:domain llm:ClassRelation .
        
        llm:fromSection a owl:DatatypeProperty ;
            rdfs:label "fromSection"@en ;
            rdfs:domain llm:ConceptInstance .
    }}
    """
    try:
        engine.update(schema_query)
    except Exception:
        pass


def create_backup_dir(project_root: Path) -> Path:
    """백업 디렉토리 생성."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = project_root / "db" / "relations_backup" / timestamp
    backup_dir.mkdir(parents=True, exist_ok=True)
    return backup_dir


def save_backup(
    backup_dir: Path,
    class_relations: Dict[Tuple[str, str], int],
    instances: List[Dict],
    instance_relations: List[Tuple[str, str]],
    input_file: str
) -> None:
    """백업 파일 저장."""
    added_relations = {
        "class_relations": [
            {"source": src, "target": tgt, "count": cnt}
            for (src, tgt), cnt in class_relations.items()
        ],
        "instances": instances,
        "instance_relations": [
            {"source": src, "target": tgt}
            for src, tgt in instance_relations
        ]
    }
    
    with open(backup_dir / "added_relations.json", 'w', encoding='utf-8') as f:
        json.dump(added_relations, f, ensure_ascii=False, indent=2)
    
    metadata = {
        "input_file": input_file,
        "created_at": datetime.now().isoformat(),
        "class_relation_count": len(class_relations),
        "instance_count": len(instances),
        "instance_relation_count": len(instance_relations)
    }
    
    with open(backup_dir / "metadata.json", 'w', encoding='utf-8') as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)


def add_class_relations(
    engine: GraphQueryEngine,
    cooccurrence: Dict[Tuple[str, str], int],
    dry_run: bool = False
) -> int:
    """클래스 간 co-occurrence 관계를 GraphDB에 추가."""
    count = 0
    items = list(cooccurrence.items())
    
    for (source, target), cooc_count in tqdm(items, desc="    클래스 관계", disable=dry_run):
        relation_id = f"ClassRelation_{source}_{target}"
        
        query = f"""
        PREFIX llm: <{LLM_PREFIX}>
        PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
        
        INSERT DATA {{
            llm:{relation_id} a llm:ClassRelation ;
                llm:source llm:{source} ;
                llm:target llm:{target} ;
                llm:cooccurrenceCount "{cooc_count}"^^xsd:integer .
        }}
        """
        
        if dry_run:
            print(f"  [DRY-RUN] ClassRelation: {source} -> {target} (count: {cooc_count})")
        else:
            try:
                engine.update(query)
                count += 1
            except Exception as e:
                tqdm.write(f"  [오류] ClassRelation 추가 실패 ({source} -> {target}): {e}")
    
    return count


def add_instances(
    engine: GraphQueryEngine,
    instances: List[Dict],
    dry_run: bool = False
) -> int:
    """Instance 및 instance_of 관계를 GraphDB에 추가."""
    count = 0
    
    for inst in tqdm(instances, desc="    Instance", disable=dry_run):
        instance_id = inst["id"]
        label = engine._escape_sparql_string(inst["label"])
        section_id = inst.get("section_id", 0)
        classes = inst.get("classes", [])
        
        instance_of_triples = "\n".join([
            f"        llm:instanceOf llm:{cls} ;"
            for cls in classes
        ])
        
        query = f"""
        PREFIX llm: <{LLM_PREFIX}>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
        
        INSERT DATA {{
            llm:{instance_id} a llm:ConceptInstance ;
                rdfs:label "{label}"@en ;
{instance_of_triples}
                llm:fromSection "{section_id}"^^xsd:float .
        }}
        """
        
        if dry_run:
            print(f"  [DRY-RUN] Instance: {instance_id} -> {classes}")
        else:
            try:
                engine.update(query)
                count += 1
            except Exception as e:
                tqdm.write(f"  [오류] Instance 추가 실패 ({instance_id}): {e}")
    
    return count


def add_instance_relations(
    engine: GraphQueryEngine,
    relations: List[Tuple[str, str]],
    dry_run: bool = False
) -> int:
    """Instance 간 related 관계를 GraphDB에 추가."""
    count = 0
    
    for source, target in tqdm(relations, desc="    Instance 관계", disable=dry_run):
        query = f"""
        PREFIX llm: <{LLM_PREFIX}>
        
        INSERT DATA {{
            llm:{source} llm:relatedInstance llm:{target} .
        }}
        """
        
        if dry_run:
            print(f"  [DRY-RUN] InstanceRelation: {source} -> {target}")
        else:
            try:
                engine.update(query)
                count += 1
            except Exception as e:
                tqdm.write(f"  [오류] InstanceRelation 추가 실패 ({source} -> {target}): {e}")
    
    return count


def list_backups(project_root: Path) -> List[Path]:
    """사용 가능한 백업 목록 반환."""
    backup_dir = project_root / "db" / "relations_backup"
    if not backup_dir.exists():
        return []
    
    backups = sorted(backup_dir.iterdir(), reverse=True)
    return [b for b in backups if b.is_dir()]


def rollback_relations(engine: GraphQueryEngine, backup_path: Path) -> None:
    """백업 기반으로 추가된 관계 삭제."""
    added_relations_file = backup_path / "added_relations.json"
    if not added_relations_file.exists():
        print(f"백업 파일을 찾을 수 없습니다: {added_relations_file}")
        return
    
    with open(added_relations_file, 'r', encoding='utf-8') as f:
        added_relations = json.load(f)
    
    print("\n1. Instance 간 관계 삭제 중...")
    instance_relations = added_relations.get("instance_relations", [])
    for rel in instance_relations:
        source = rel["source"]
        target = rel["target"]
        query = f"""
        PREFIX llm: <{LLM_PREFIX}>
        
        DELETE WHERE {{
            llm:{source} llm:relatedInstance llm:{target} .
        }}
        """
        try:
            engine.update(query)
        except Exception as e:
            print(f"  [경고] 삭제 실패 ({source} -> {target}): {e}")
    print(f"  {len(instance_relations)}개 삭제 완료")
    
    print("\n2. Instance 삭제 중...")
    instances = added_relations.get("instances", [])
    for inst in instances:
        instance_id = inst["id"]
        query = f"""
        PREFIX llm: <{LLM_PREFIX}>
        
        DELETE WHERE {{
            llm:{instance_id} ?p ?o .
        }}
        """
        try:
            engine.update(query)
        except Exception as e:
            print(f"  [경고] 삭제 실패 ({instance_id}): {e}")
    print(f"  {len(instances)}개 삭제 완료")
    
    print("\n3. 클래스 관계 삭제 중...")
    class_relations = added_relations.get("class_relations", [])
    for rel in class_relations:
        source = rel["source"]
        target = rel["target"]
        relation_id = f"ClassRelation_{source}_{target}"
        query = f"""
        PREFIX llm: <{LLM_PREFIX}>
        
        DELETE WHERE {{
            llm:{relation_id} ?p ?o .
        }}
        """
        try:
            engine.update(query)
        except Exception as e:
            print(f"  [경고] 삭제 실패 ({relation_id}): {e}")
    print(f"  {len(class_relations)}개 삭제 완료")


def main():
    parser = argparse.ArgumentParser(
        description="JSONL 파일에서 온톨로지 관계를 추출하여 GraphDB에 추가"
    )
    parser.add_argument("--input", "-i", help="입력 JSONL 파일 경로")
    parser.add_argument(
        "--endpoint",
        default="http://localhost:7200/repositories/llm-ontology",
        help="GraphDB SPARQL 엔드포인트 URL"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="실제 DB 수정 없이 결과만 출력"
    )
    parser.add_argument(
        "--rollback",
        nargs="?",
        const="latest",
        help="지정된 백업으로 롤백 (timestamp 또는 'latest')"
    )
    parser.add_argument(
        "--list-backups",
        action="store_true",
        help="사용 가능한 백업 목록 출력"
    )
    
    args = parser.parse_args()
    
    project_root = Path(__file__).parent.parent.parent
    
    if args.list_backups:
        backups = list_backups(project_root)
        if not backups:
            print("사용 가능한 백업이 없습니다.")
        else:
            print("사용 가능한 백업:")
            for b in backups:
                metadata_file = b / "metadata.json"
                if metadata_file.exists():
                    with open(metadata_file, 'r', encoding='utf-8') as f:
                        meta = json.load(f)
                    print(f"  - {b.name}")
                    print(f"      입력 파일: {meta.get('input_file', 'N/A')}")
                    print(f"      생성 시간: {meta.get('created_at', 'N/A')}")
                    print(f"      관계 수: 클래스={meta.get('class_relation_count', 0)}, "
                          f"인스턴스={meta.get('instance_count', 0)}, "
                          f"인스턴스관계={meta.get('instance_relation_count', 0)}")
                else:
                    print(f"  - {b.name} (메타데이터 없음)")
        return
    
    engine = GraphQueryEngine(args.endpoint)
    
    if args.rollback:
        backups = list_backups(project_root)
        if not backups:
            print("사용 가능한 백업이 없습니다.")
            sys.exit(1)
        
        if args.rollback == "latest":
            backup_path = backups[0]
        else:
            backup_path = project_root / "db" / "relations_backup" / args.rollback
            if not backup_path.exists():
                print(f"백업을 찾을 수 없습니다: {args.rollback}")
                sys.exit(1)
        
        print(f"\n{'='*60}")
        print(f"Relations Rollback")
        print(f"{'='*60}")
        print(f"백업: {backup_path.name}")
        
        confirm = input("\n정말 롤백하시겠습니까? (yes/no): ")
        if confirm.lower() != "yes":
            print("취소됨")
            sys.exit(0)
        
        rollback_relations(engine, backup_path)
        
        print(f"\n{'='*60}")
        print(f"롤백 완료: {backup_path.name}")
        print(f"{'='*60}")
        return
    
    if not args.input:
        parser.print_help()
        print("\n오류: --input 옵션이 필요합니다.")
        sys.exit(1)
    
    input_path = Path(args.input)
    if not input_path.exists():
        print(f"파일을 찾을 수 없습니다: {input_path}")
        sys.exit(1)
    
    print(f"\n{'='*60}")
    print(f"Add Relations to GraphDB")
    print(f"{'='*60}")
    print(f"입력 파일: {input_path}")
    print(f"엔드포인트: {args.endpoint}")
    print(f"Dry-run: {args.dry_run}")
    
    if not args.dry_run:
        print("\n1. 스키마 초기화 중...")
        ensure_schema_exists(engine)
        print("  ConceptInstance, ClassRelation 스키마 확인됨")
    
    print("\n2. 온톨로지 클래스 로드 중...")
    existing_classes = load_existing_classes(engine)
    print(f"  {len(existing_classes)}개 클래스 로드됨")
    
    print("\n3. JSONL 파일 로드 중...")
    chunks = load_jsonl(input_path)
    print(f"  {len(chunks)}개 chunk 로드됨")
    
    print("\n4. 관계 데이터 집계 중...")
    warned_classes: Set[str] = set()
    
    cooccurrence = count_class_cooccurrence(chunks, existing_classes, warned_classes)
    print(f"  클래스 co-occurrence: {len(cooccurrence)}개 쌍")
    
    instances = create_instances(chunks, existing_classes, warned_classes)
    print(f"  Instance: {len(instances)}개")
    
    section_groups = group_instances_by_section(instances)
    instance_relations = collect_instance_relations(section_groups)
    print(f"  Instance 관계: {len(instance_relations)}개")
    
    if not args.dry_run:
        print("\n5. 백업 생성 중...")
        backup_dir = create_backup_dir(project_root)
        save_backup(
            backup_dir,
            cooccurrence,
            instances,
            instance_relations,
            str(input_path)
        )
        print(f"  백업 저장됨: {backup_dir}")
    
    print("\n6. GraphDB에 관계 추가 중...")
    
    print("  6.1 클래스 관계 추가...")
    class_count = add_class_relations(engine, cooccurrence, args.dry_run)
    if not args.dry_run:
        print(f"      {class_count}개 추가됨")
    
    print("  6.2 Instance 추가...")
    inst_count = add_instances(engine, instances, args.dry_run)
    if not args.dry_run:
        print(f"      {inst_count}개 추가됨")
    
    print("  6.3 Instance 관계 추가...")
    inst_rel_count = add_instance_relations(engine, instance_relations, args.dry_run)
    if not args.dry_run:
        print(f"      {inst_rel_count}개 추가됨")
    
    print(f"\n{'='*60}")
    if args.dry_run:
        print("DRY-RUN 완료 (실제 변경 없음)")
    else:
        print("완료!")
        print(f"  - 클래스 관계: {class_count}개")
        print(f"  - Instance: {inst_count}개")
        print(f"  - Instance 관계: {inst_rel_count}개")
        print(f"  - 백업: {backup_dir.name}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()

