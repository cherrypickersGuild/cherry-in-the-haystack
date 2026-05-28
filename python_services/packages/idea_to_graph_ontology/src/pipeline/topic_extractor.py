"""Step 2: Extract sub-topics from paragraph chunks via DeepSeek.

Each paragraph → 1-3 concrete technical sub-topics suitable as ontology nodes.
"""

from pydantic import BaseModel, Field

from langchain_core.messages import SystemMessage, HumanMessage

from packages.ontology.src.model import get_llm


class SubTopic(BaseModel):
    concept_id: str = Field(..., description="CamelCase concept ID (e.g. QueryExpansion)")
    label: str = Field(..., description="Human-readable label (e.g. Query Expansion)")
    type: str = Field(..., description="'class' for broad categories, 'instance' for specific techniques")
    description: str = Field(..., description="Korean description, 3-5 sentences covering definition, mechanism, use cases")
    keywords: list[str] = Field(default_factory=list, description="Alternative names or synonyms")


class SubTopicExtractionResult(BaseModel):
    sub_topics: list[SubTopic] = Field(..., description="1-3 extracted sub-topics", max_length=3)


_SYSTEM_PROMPT = """You are an LLM/AI ontology expert. Your task is to extract concrete, technical sub-topics from a paragraph of text.

Each sub-topic must be a specific concept that could exist as an independent node in a knowledge graph ontology. Do NOT extract document-structure words (Overview, Introduction, Guide, etc.) or generic expressions.

**type field rules:**
- "class": broad categories that can contain sub-concepts (e.g. InformationRetrieval, ModelTraining, VectorDatabase)
- "instance": specific techniques, algorithms, or implementations (e.g. QueryExpansion, LoRA, HNSW)

**concept_id rules:**
- CamelCase, no spaces (e.g. QueryExpansion, not "query expansion" or "Query Expansion")
- Use standard academic/industry names when they exist

**description rules (Korean, 3-5 sentences):**
1. Core definition (what is it?)
2. Key characteristics or mechanism (how does it work?)
3. Representative use cases (where is it used?)
4. Include diverse keywords naturally for better vector search

**Extraction criteria:**
- Only concepts actually mentioned or clearly implied in the paragraph
- Prioritize concrete technical terms over abstract descriptions
- If the paragraph only describes one concept, return just that one (not filler)"""


class TopicExtractor:
    def __init__(self, debug: bool = False) -> None:
        self.debug = debug
        llm = get_llm()
        self.structured_llm = llm.with_structured_output(SubTopicExtractionResult)

    def extract(self, chunk_text: str, section_title: str = "", original_concept: str = "") -> list[SubTopic]:
        section_info = f"\nSection: {section_title}" if section_title else ""
        concept_info = f"\nDocument-level topic: {original_concept}" if original_concept else ""

        user_prompt = f"""Extract 1-3 concrete technical sub-topics from this paragraph.

{section_info}{concept_info}

Paragraph text:
{chunk_text[:1500]}

Return only concepts that are actual technical terms suitable for a knowledge graph ontology."""

        messages = [
            SystemMessage(content=_SYSTEM_PROMPT),
            HumanMessage(content=user_prompt),
        ]

        try:
            result = self.structured_llm.invoke(messages)
            if self.debug:
                for st in result.sub_topics:
                    print(f"  [{st.type}] {st.concept_id} — {st.label}")
            return result.sub_topics
        except Exception as e:
            if self.debug:
                print(f"  ✗ extraction failed: {e}")
            return []
