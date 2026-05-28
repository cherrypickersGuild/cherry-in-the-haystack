"""Step 3: Cluster similar sub-topics via DeepSeek (1st refinement).

Groups semantically identical or similar sub-topics and picks a canonical
representation for each group, merging keywords and descriptions.
"""

from pydantic import BaseModel, Field

from langchain_core.messages import SystemMessage, HumanMessage

from packages.ontology.src.model import get_llm


class ClusteredTopic(BaseModel):
    canonical_id: str = Field(..., description="Canonical CamelCase concept ID for the group")
    label: str = Field(..., description="Human-readable label")
    type: str = Field(..., description="'class' or 'instance'")
    description: str = Field(..., description="Merged Korean description covering all grouped concepts")
    keywords: list[str] = Field(..., description="Merged unique keywords from all grouped concepts")
    merged_from: list[str] = Field(..., description="Original concept_ids that were merged into this group")


class ClusterResult(BaseModel):
    clusters: list[ClusteredTopic] = Field(..., description="Clustered topics after deduplication")


_BATCH_SIZE = 30

_SYSTEM_PROMPT = """You are an ontology curator. Your task is to group similar sub-topics and merge duplicates.

**Rules:**
1. If two (or more) sub-topics refer to the SAME concept (synonyms, acronyms, different phrasing), merge them into ONE entry.
2. If sub-topics are DISTINCT concepts, keep them separate.
3. For each merged group, pick the most standard/academic name as canonical_id.
4. Merge keywords from all members (deduplicate).
5. Write a combined description that covers all merged members (Korean, 3-5 sentences).
6. Keep the most specific type: if any member is "instance", the group is "instance".

**Merge examples:**
- "LoRA" + "Low-Rank Adaptation" → canonical_id: "LoRA", label: "LoRA (Low-Rank Adaptation)"
- "RAG" + "Retrieval Augmented Generation" → canonical_id: "RAG"
- "VectorStore" + "VectorDatabase" → canonical_id: "VectorStore" (same concept, different names)

**Do NOT merge if:**
- Concepts are distinct techniques within the same category (e.g. "LoRA" and "QLoRA" are separate)
- One is a broad category and another is a specific technique (keep both)

Return only the deduplicated/merged clusters. Every input sub-topic must appear in exactly one cluster's merged_from list."""


class TopicClusterer:
    def __init__(self, debug: bool = False) -> None:
        self.debug = debug
        llm = get_llm()
        self.structured_llm = llm.with_structured_output(ClusterResult)

    def cluster(self, sub_topics: list[dict], source: str = "") -> list[dict]:
        if not sub_topics:
            return []

        if self.debug:
            print(f"\n[Clusterer] {len(sub_topics)} sub-topics to cluster")

        # For small sets, cluster in one call; for large sets, batch
        if len(sub_topics) <= _BATCH_SIZE:
            clusters = self._cluster_batch(sub_topics)
        else:
            clusters = []
            for i in range(0, len(sub_topics), _BATCH_SIZE):
                batch = sub_topics[i : i + _BATCH_SIZE]
                batch_clusters = self._cluster_batch(batch)
                clusters.extend(batch_clusters)
            # Cross-batch merge for large sets
            if len(clusters) > _BATCH_SIZE:
                clusters = self._cluster_batch(self._flatten_clusters(clusters))

        for c in clusters:
            c["source"] = source

        if self.debug:
            print(f"  → {len(clusters)} clusters after refinement")

        return clusters

    def _cluster_batch(self, items: list[dict]) -> list[dict]:
        items_text = "\n\n".join([
            f"{i+1}. concept_id: {item.get('concept_id', '')}\n"
            f"   label: {item.get('label', '')}\n"
            f"   type: {item.get('type', 'instance')}\n"
            f"   description: {item.get('description', '')[:300]}\n"
            f"   keywords: {', '.join(item.get('keywords', []))}"
            for i, item in enumerate(items)
        ])

        user_prompt = f"""Group these sub-topics by semantic similarity. Merge duplicates, keep distinct concepts separate.

Sub-topics:
{items_text}

Return the deduplicated clusters with canonical names, merged keywords, and combined descriptions."""

        messages = [
            SystemMessage(content=_SYSTEM_PROMPT),
            HumanMessage(content=user_prompt),
        ]

        try:
            result = self.structured_llm.invoke(messages)
            return [c.model_dump() for c in result.clusters]
        except Exception as e:
            if self.debug:
                print(f"  ✗ clustering failed: {e}")
            return self._passthrough(items)

    def _passthrough(self, items: list[dict]) -> list[dict]:
        """Fallback: return items as-is when clustering fails."""
        return [
            {
                "canonical_id": item.get("concept_id", ""),
                "label": item.get("label", ""),
                "type": item.get("type", "instance"),
                "description": item.get("description", ""),
                "keywords": item.get("keywords", []),
                "merged_from": [item.get("concept_id", "")],
            }
            for item in items
        ]

    def _flatten_clusters(self, clusters: list[dict]) -> list[dict]:
        """Convert clusters back to flat sub-topic format for re-clustering."""
        return [
            {
                "concept_id": c["canonical_id"],
                "label": c["label"],
                "type": c["type"],
                "description": c["description"],
                "keywords": c["keywords"],
            }
            for c in clusters
        ]
