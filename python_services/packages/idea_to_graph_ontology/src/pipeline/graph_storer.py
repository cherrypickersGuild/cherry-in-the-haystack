"""Step 4: Store clustered topics in GraphDB with parent-child hierarchy.

- 4-1: Check existing nodes via SPARQL + vector search → skip duplicates
- 4-2: Store new nodes with single confirmed parent (class/instance structure)
- Layer 2: LLM decision log saved as JSON sidecar (not in DB)
"""

import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional

from packages.ontology.src.storage.graph_query_engine import GraphQueryEngine
from packages.ontology.src.storage.vector_store import VectorStore
from packages.ontology.src.pipeline.ontology_graph_manager import OntologyGraphManager
from packages.ontology.src.pipeline.ontology_updater import OntologyUpdater


class GraphStorer:
    def __init__(
        self,
        graph_engine: GraphQueryEngine,
        vector_store: VectorStore,
        graph_manager: OntologyGraphManager,
        ontology_updater: OntologyUpdater,
        debug: bool = False,
    ) -> None:
        self.graph_engine = graph_engine
        self.vector_store = vector_store
        self.graph_manager = graph_manager
        self.ontology_updater = ontology_updater
        self.debug = debug

    def store(
        self,
        clustered_topics: list[dict],
        source: str = "",
        log_dir: Optional[str] = None,
    ) -> dict:
        added: list[dict] = []
        skipped_duplicate: list[str] = []
        skipped_near_duplicate: list[dict] = []
        layer2_log: list[dict] = []

        if self.debug:
            print(f"\n[GraphStorer] Processing {len(clustered_topics)} topics")

        for topic in clustered_topics:
            concept_id = topic.get("canonical_id", "")
            label = topic.get("label", concept_id)
            description = topic.get("description", "")
            node_type = topic.get("type", "instance")
            keywords = topic.get("keywords", [])
            merged_from = topic.get("merged_from", [concept_id])

            if not concept_id:
                continue

            # 4-1a: Exact duplicate check (already in GraphDB)
            if self.graph_engine.concept_exists(concept_id):
                if self.debug:
                    print(f"  ⏭ {concept_id} — already exists in GraphDB")
                skipped_duplicate.append(concept_id)
                layer2_log.append({
                    "concept_id": concept_id,
                    "status": "duplicate",
                    "reason": "Already exists in GraphDB",
                })
                continue

            # 4-1b: Near-duplicate check (vector similarity)
            if self._is_near_duplicate(concept_id, description):
                if self.debug:
                    print(f"  ~ {concept_id} — near-duplicate, skipping")
                skipped_near_duplicate.append(topic)
                layer2_log.append({
                    "concept_id": concept_id,
                    "status": "near_duplicate",
                    "reason": "Vector similarity too high with existing concept",
                })
                continue

            # 4-2: Determine parent (single confirmed value)
            parent, parent_candidates, parent_reason = self._determine_parent(
                concept_id, description
            )

            if not parent:
                parent = "LLMConcept"

            # Add to GraphDB
            try:
                self.graph_engine.add_concept(
                    concept_id=concept_id,
                    label=label,
                    parent=parent,
                    description=description,
                    node_type=node_type,
                    keywords=keywords,
                    source=source,
                )
            except Exception as e:
                if self.debug:
                    print(f"  ✗ {concept_id} — GraphDB add failed: {e}")
                continue

            # Add to VectorStore
            self.vector_store.add_concept(
                concept_id=concept_id,
                description=description,
                label=label,
                parent=parent,
                staging=False,
            )

            # Update NetworkX graph
            self.graph_manager.stage_add_concept(
                concept_id=concept_id,
                parent_id=parent,
                label=label,
                description=description,
            )
            self.graph_manager.commit_staging()

            added.append({
                "concept_id": concept_id,
                "label": label,
                "type": node_type,
                "parent": parent,
                "source": source,
                "keywords": keywords,
            })

            layer2_log.append({
                "concept_id": concept_id,
                "status": "added",
                "parent": parent,
                "parent_candidates": parent_candidates,
                "parent_assignment_reason": parent_reason,
                "merged_from": merged_from,
            })

            if self.debug:
                print(f"  ✓ {concept_id} → {parent}")

        # Write Layer 2 log
        log_path = None
        if log_dir:
            log_path = self._write_layer2_log(layer2_log, log_dir, source)

        return {
            "added": added,
            "skipped_duplicate": skipped_duplicate,
            "skipped_near_duplicate": skipped_near_duplicate,
            "layer2_log_path": log_path,
        }

    def _is_near_duplicate(self, concept_id: str, description: str) -> bool:
        """Check if a very similar concept already exists via vector search."""
        if not description:
            return False

        try:
            results = self.vector_store.find_similar(
                description, k=3, include_staging=False
            )
            for r in results:
                distance = r.get("distance", 1.0)
                if distance is not None and distance < 0.15:
                    return True
        except Exception:
            pass

        return False

    def _determine_parent(
        self, concept_id: str, description: str
    ) -> tuple[Optional[str], list[dict], Optional[str]]:
        """Determine the best parent for a new concept.

        Returns (parent, candidates, reason). Falls back to "LLMConcept" if no parent found.
        """
        try:
            candidates, reason = self.ontology_updater._decide_parent_candidates(
                concept_id=concept_id,
                description=description,
                debug=self.debug,
            )
            # Filter out self-references
            candidates = [c for c in candidates if c["concept"] != concept_id]
            if candidates:
                parent = candidates[0]["concept"]
                return (parent, candidates, reason)
        except Exception as e:
            if self.debug:
                print(f"    parent decision failed: {e}")

        return (None, [], None)

    def _write_layer2_log(
        self, entries: list[dict], log_dir: str, source: str
    ) -> str:
        """Write Layer 2 LLM decision log as JSON sidecar."""
        Path(log_dir).mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"layer2_log_{timestamp}.json"
        filepath = str(Path(log_dir) / filename)

        log_data = {
            "pipeline_run_timestamp": datetime.now().isoformat(),
            "source": source,
            "total_entries": len(entries),
            "entries": entries,
        }

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(log_data, f, ensure_ascii=False, indent=2)

        return filepath
