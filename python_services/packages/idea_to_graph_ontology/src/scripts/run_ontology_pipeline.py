#!/usr/bin/env python3
"""Unified ontology pipeline: JSONL → sub-topics → cluster → GraphDB → TOC.

Usage:
    python run_ontology_pipeline.py \\
        --input concepts.jsonl \\
        --task-name my_book \\
        --source "AI Engineering" \\
        --graph-endpoint http://localhost:7200/repositories/llm-ontology
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional

sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent.parent))  # python_services/

from packages.ontology.src.storage.graph_query_engine import GraphQueryEngine
from packages.ontology.src.storage.vector_store import VectorStore
from packages.ontology.src.pipeline.ontology_graph_manager import OntologyGraphManager
from packages.ontology.src.pipeline.ontology_updater import OntologyUpdater
from packages.ontology.src.pipeline.topic_extractor import TopicExtractor
from packages.ontology.src.pipeline.topic_clusterer import TopicClusterer
from packages.ontology.src.pipeline.graph_storer import GraphStorer
from packages.ontology.src.pipeline.toc_generator import generate_toc, format_toc, get_flat_toc


def load_jsonl(file_path: str) -> list[dict]:
    concepts = []
    with open(file_path, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
                required = ["concept", "section_id", "section_title", "chunk_text"]
                if all(k in data for k in required):
                    concepts.append(data)
                else:
                    print(f"  [skip] line {line_num}: missing required fields")
            except json.JSONDecodeError:
                print(f"  [skip] line {line_num}: invalid JSON")
    return concepts


def main():
    parser = argparse.ArgumentParser(description="Run the unified ontology pipeline")
    parser.add_argument("--input", required=True, help="Input JSONL file path")
    parser.add_argument("--task-name", required=True, help="Task name for tracking")
    parser.add_argument("--source", default="", help="Source identifier (book title/ID)")
    parser.add_argument(
        "--graph-endpoint",
        default="http://localhost:7200/repositories/llm-ontology",
        help="GraphDB SPARQL endpoint URL",
    )
    parser.add_argument("--vector-db", default=None, help="Vector DB path (ChromaDB)")
    parser.add_argument("--log-dir", default=None, help="Layer 2 log output directory")
    parser.add_argument("--toc-only", action="store_true", help="Only generate TOC from existing graph")
    parser.add_argument("--debug", action="store_true", help="Enable debug mode")

    args = parser.parse_args()

    project_root = Path(__file__).parent.parent.parent
    vector_db_path = args.vector_db or str(project_root / "db" / "real" / "vector_store")
    log_dir = args.log_dir or str(project_root / "db" / "pipeline_logs")

    print(f"\n{'='*60}")
    print(f"Ontology Pipeline — {args.task_name}")
    print(f"{'='*60}\n")

    # ── TOC-only mode ──
    if args.toc_only:
        print("TOC-only mode: reading existing graph...")
        graph_engine = GraphQueryEngine(args.graph_endpoint)
        vector_store = VectorStore(vector_db_path)
        graph_manager = OntologyGraphManager(graph_engine, vector_store, root_concept="LLMConcept", debug=args.debug)
        toc = generate_toc(graph_manager)
        print(f"\n{format_toc(toc)}")
        print(f"\nTotal nodes: {len(get_flat_toc(toc))}")
        return

    # ── Full pipeline ──
    input_path = Path(args.input)
    if not input_path.exists():
        print(f"Error: input file not found: {args.input}")
        sys.exit(1)

    print(f"[Init] Loading JSONL: {args.input}")
    concepts = load_jsonl(str(input_path))
    print(f"  {len(concepts)} entries loaded\n")

    if not concepts:
        print("No entries to process.")
        return

    print(f"[Init] Connecting to GraphDB: {args.graph_endpoint}")
    graph_engine = GraphQueryEngine(args.graph_endpoint)

    print(f"[Init] Loading VectorStore: {vector_db_path}")
    vector_store = VectorStore(vector_db_path)

    print(f"[Init] Building ontology graph from GraphDB...")
    graph_manager = OntologyGraphManager(
        graph_engine=graph_engine,
        vector_store=vector_store,
        root_concept="LLMConcept",
        debug=args.debug,
    )
    print(f"  {len(graph_manager.real_graph.nodes())} nodes, {len(graph_manager.real_graph.edges())} edges")

    ontology_updater = OntologyUpdater(
        graph_engine=graph_engine,
        vector_store=vector_store,
        graph_manager=graph_manager,
    )

    # ── Step 2: Extract sub-topics ──
    print(f"\n{'='*60}")
    print(f"Step 2: Extracting sub-topics from {len(concepts)} chunks...")
    print(f"{'='*60}")

    extractor = TopicExtractor(debug=args.debug)
    all_sub_topics: list[dict] = []

    for idx, entry in enumerate(concepts, 1):
        chunk_text = entry.get("chunk_text", "")
        section_title = entry.get("section_title", "")
        original_concept = entry.get("concept", "")

        if args.debug:
            print(f"\n[{idx}/{len(concepts)}] {original_concept[:80]}")

        sub_topics = extractor.extract(
            chunk_text=chunk_text,
            section_title=section_title,
            original_concept=original_concept,
        )

        for st in sub_topics:
            all_sub_topics.append(st if isinstance(st, dict) else st.model_dump())

        if idx % 20 == 0 and not args.debug:
            print(f"  [{idx}/{len(concepts)}] {len(all_sub_topics)} sub-topics extracted so far")

    print(f"\n  Total sub-topics extracted: {len(all_sub_topics)}")

    # ── Step 3: Cluster sub-topics ──
    print(f"\n{'='*60}")
    print(f"Step 3: Clustering {len(all_sub_topics)} sub-topics...")
    print(f"{'='*60}")

    clusterer = TopicClusterer(debug=args.debug)
    clustered = clusterer.cluster(all_sub_topics, source=args.source or args.task_name)

    print(f"  Clustered into {len(clustered)} unique topics")

    # ── Step 4: Store in GraphDB ──
    print(f"\n{'='*60}")
    print(f"Step 4: Storing {len(clustered)} topics in GraphDB...")
    print(f"{'='*60}")

    storer = GraphStorer(
        graph_engine=graph_engine,
        vector_store=vector_store,
        graph_manager=graph_manager,
        ontology_updater=ontology_updater,
        debug=args.debug,
    )

    result = storer.store(
        clustered_topics=clustered,
        source=args.source or args.task_name,
        log_dir=log_dir,
    )

    print(f"\n  Added:   {len(result['added'])}")
    print(f"  Duplicates (exact): {len(result['skipped_duplicate'])}")
    print(f"  Duplicates (near):  {len(result['skipped_near_duplicate'])}")
    if result.get("layer2_log_path"):
        print(f"  Layer2 log: {result['layer2_log_path']}")

    # ── Step 5: Generate TOC ──
    print(f"\n{'='*60}")
    print(f"Step 5: Generating hierarchical TOC")
    print(f"{'='*60}")

    # Reload graph to include newly added nodes
    graph_manager = OntologyGraphManager(
        graph_engine=graph_engine,
        vector_store=vector_store,
        root_concept="LLMConcept",
        debug=False,
    )

    toc = generate_toc(graph_manager)
    flat = get_flat_toc(toc)

    print(f"\n{format_toc(toc)}")
    print(f"\n{'='*60}")
    print(f"Summary")
    print(f"{'='*60}")
    print(f"  대 (depth 1):   {sum(1 for n in flat if n['level'] == '대')}")
    print(f"  중 (depth 2-3): {sum(1 for n in flat if n['level'] == '중')}")
    print(f"  소 (depth 4+):  {sum(1 for n in flat if n['level'] == '소')}")
    print(f"  Total:          {len(flat)} nodes")
    print(f"\n  Layer 2 log: {log_dir}")
    print()

    # ── Show newly added concepts ──
    if result["added"]:
        print(f"Newly added concepts:")
        for c in result["added"]:
            print(f"  [{c['type']}] {c['concept_id']} → parent: {c['parent']}")


if __name__ == "__main__":
    main()
