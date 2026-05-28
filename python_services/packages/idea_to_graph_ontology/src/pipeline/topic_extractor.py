"""Step 2: Extract sub-topics from paragraph chunks via DeepSeek.

Each paragraph → 1-3 concrete technical sub-topics suitable as ontology nodes.
Uses JSON-mode prompting (DeepSeek-compatible, no with_structured_output needed).
"""

from langchain_core.messages import SystemMessage, HumanMessage

from packages.ontology.src.model import get_llm, parse_json_response


_SYSTEM_PROMPT = """You are an LLM/AI ontology expert. Extract concrete, technical sub-topics from a paragraph.

Return ONLY valid JSON (no markdown, no extra text):
{"sub_topics": [{"concept_id": "CamelCase", "label": "Human Readable", "type": "instance", "description": "Korean description 3-5 sentences", "keywords": ["alt1", "alt2"]}]}

Rules:
- concept_id: CamelCase, no spaces (e.g. QueryExpansion)
- type: "class" for broad categories, "instance" for specific techniques
- description: Korean, 3-5 sentences (definition, mechanism, use cases)
- keywords: alternative names/synonyms
- Only concepts actually mentioned in the paragraph
- 1-3 sub-topics max; one is fine if the paragraph is focused"""


class TopicExtractor:
    def __init__(self, debug: bool = False) -> None:
        self.debug = debug
        self.llm = get_llm()

    def extract(self, chunk_text: str, section_title: str = "", original_concept: str = "") -> list[dict]:
        section_info = f"\nSection: {section_title}" if section_title else ""
        concept_info = f"\nDocument-level topic: {original_concept}" if original_concept else ""

        response = self.llm.invoke([
            SystemMessage(content=_SYSTEM_PROMPT),
            HumanMessage(content=f"""Extract 1-3 concrete technical sub-topics from this paragraph.
{section_info}{concept_info}

Paragraph text:
{chunk_text[:1500]}"""),
        ])

        try:
            data = parse_json_response(response.content)
            sub_topics = data.get("sub_topics", [])
            if self.debug:
                for st in sub_topics:
                    print(f"  [{st.get('type', '?')}] {st.get('concept_id', '?')} — {st.get('label', '?')}")
            return sub_topics
        except Exception as e:
            if self.debug:
                print(f"  ✗ extraction failed: {e}")
            return []
