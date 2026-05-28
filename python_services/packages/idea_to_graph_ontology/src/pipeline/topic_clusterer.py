"""Step 3: Cluster similar sub-topics via DeepSeek (1st refinement).

Groups semantically identical or similar sub-topics and picks a canonical
representation for each group, merging keywords and descriptions.
Uses JSON-mode prompting (DeepSeek-compatible).
"""

from langchain_core.messages import SystemMessage, HumanMessage

from packages.ontology.src.model import get_llm, parse_json_response


_BATCH_SIZE = 30

_SYSTEM_PROMPT = """You are an ontology curator. Group similar sub-topics and merge duplicates.

Return ONLY valid JSON (no markdown, no extra text):
{"clusters": [{"canonical_id": "CamelCase", "label": "Human Label", "type": "instance", "description": "Korean 3-5 sentences covering all merged concepts", "keywords": ["k1", "k2"], "merged_from": ["orig_id1", "orig_id2"]}]}

Rules:
1. Merge synonyms, acronyms, different phrasings of the SAME concept.
2. Keep DISTINCT concepts separate.
3. canonical_id: most standard/academic CamelCase name.
4. Merge keywords from all members (deduplicate).
5. description: combined Korean description covering all merged members.
6. If any member is "instance", the group type is "instance".
7. Every input sub-topic must appear in exactly one cluster's merged_from list.

DO NOT merge: distinct techniques (e.g. LoRA and QLoRA), or category vs. specific technique."""


class TopicClusterer:
    def __init__(self, debug: bool = False) -> None:
        self.debug = debug
        self.llm = get_llm()

    def cluster(self, sub_topics: list[dict], source: str = "") -> list[dict]:
        if not sub_topics:
            return []

        if self.debug:
            print(f"\n[Clusterer] {len(sub_topics)} sub-topics to cluster")

        if len(sub_topics) <= _BATCH_SIZE:
            clusters = self._cluster_batch(sub_topics)
        else:
            clusters = []
            for i in range(0, len(sub_topics), _BATCH_SIZE):
                batch = sub_topics[i : i + _BATCH_SIZE]
                clusters.extend(self._cluster_batch(batch))
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

        try:
            response = self.llm.invoke([
                SystemMessage(content=_SYSTEM_PROMPT),
                HumanMessage(content=f"Group these sub-topics by semantic similarity:\n\n{items_text}"),
            ])
            data = parse_json_response(response.content)
            return data.get("clusters", [])
        except Exception as e:
            if self.debug:
                print(f"  ✗ clustering failed: {e}")
            return self._passthrough(items)

    def _passthrough(self, items: list[dict]) -> list[dict]:
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
