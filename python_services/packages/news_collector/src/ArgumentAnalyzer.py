import json
import re
from collections import Counter
from litellm import completion, completion_cost

# -----------------------------
# Optional OpenAI import
# -----------------------------
try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    print("Warning: openai package not installed. Run: pip install openai")


class ArgumentAnalyzer:
    """
    Argument structure analyzer using LLM classification.
    Steps:
        - Split HTML into clean paragraphs
        - Extract main topics (noun-based heuristic)
        - Classify each paragraph using an LLM
        - Produce structured result
    """

    def __init__(self, api_key: str, model_name: str = "gpt-4o-mini"):
        self.api_key = api_key
        self.model_name = model_name

        if not OPENAI_AVAILABLE:
            print("Warning: openai package not installed. LLM classification will fail.")

    # -----------------------------
    #           PUBLIC API
    # -----------------------------
    def analyze(self, html_text: str) -> dict:
        """
        Full analysis pipeline.
        Returns:
            {
              "structure": { ... },
              "summary": { ... },
              "cost": "$0.00002"
            }
        """
        paragraphs = self._split_into_paragraphs(html_text)
        structure, cost = self._classify_paragraphs(paragraphs)
        main_topics = self._extract_main_topics(paragraphs)

        summary = self._build_summary(structure, paragraphs, main_topics)

        return {
            "structure": structure,
            "summary": summary,
            "cost": cost
        }

    # -----------------------------
    #       PARAGRAPH PARSING
    # -----------------------------
    def _split_into_paragraphs(self, text: str):
        """Extract <p>...</p> content and clean HTML entities."""
        text = re.sub(r'<!\[CDATA\[|\]\]>', '', text)
        paragraphs = re.findall(r'<p>(.*?)</p>', text, re.DOTALL)

        clean_paragraphs = []
        for para in paragraphs:
            clean_para = re.sub(r'<[^>]+>', '', para)
            clean_para = clean_para.replace('&#8217;', "'")
            clean_para = clean_para.replace('&#8220;', '"')
            clean_para = clean_para.replace('&#8221;', '"')
            clean_para = clean_para.replace('&quot;', '"')
            clean_para = clean_para.replace('&amp;', '&')
            clean_para = re.sub(r'\s+', ' ', clean_para).strip()

            if len(clean_para) > 30:
                clean_paragraphs.append(clean_para)

        return clean_paragraphs

    # -----------------------------
    #     TOPIC EXTRACTION
    # -----------------------------
    def _extract_nouns(self, text: str):
        """Tokenize alphabetic words."""
        words = re.findall(r'\b[a-zA-Z]+\b', text.lower())
        return [w for w in words if len(w) >= 3]

    def _extract_main_topics(self, paragraphs):
        """Frequency-based topic extraction."""
        all_text = " ".join(paragraphs)
        nouns = self._extract_nouns(all_text)

        stopwords = {
            'this', 'that', 'they', 'them', 'the', 'and', 'are', 'will',
            'been', 'have', 'with', 'from', 'would', 'could', 'should'
        }
        nouns = [n for n in nouns if n not in stopwords and len(n) > 3]

        noun_freq = Counter(nouns)
        main_topics = [word for word, freq in noun_freq.most_common(10)]
        return main_topics

    # -----------------------------
    #        LLM CLASSIFIER
    # -----------------------------
    def _classify_paragraphs(self, paragraphs):
        """Classify paragraphs through OpenAI / LiteLLM."""
        if not OPENAI_AVAILABLE:
            raise ImportError("openai package is required. Install with: pip install openai")

        system_prompt = self._build_system_prompt()
        user_prompt = self._build_user_prompt(paragraphs)

        try:
            response = completion(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.1,
                response_format={"type": "json_object"},
                api_key=self.api_key
            )

            cost = completion_cost(completion_response=response)
            cost = f"${float(cost):.10f}"

            result_text = response.choices[0].message.content
            result_json = json.loads(result_text)

            structure = self._empty_structure()

            for item in result_json.get("classifications", []):
                idx = item["paragraph_index"]
                cat = item["category"]

                if 0 <= idx < len(paragraphs) and cat in structure:
                    structure[cat].append(paragraphs[idx])

            return structure, cost

        except Exception as e:
            print(f"Error calling OpenAI API: {e}")
            raise

    # -----------------------------
    #       PROMPT BUILDERS
    # -----------------------------
    def _build_system_prompt(self):
        return """You are an expert at analyzing argumentative text structure. 
Your task is to classify paragraphs into specific categories based on their role in the argument.

Categories:
- background: Provides context, historical information, or describes the current situation
- opinion: Expresses the author's viewpoint, beliefs, or judgments (e.g., "I think", "should", "must")
- evidence: Provides facts, examples, data, or citations to support claims (e.g., "for example", "research shows")
- reasoning: Explains logical connections or implications (e.g., "therefore", "this means", "consequently")
- conclusion: Offers recommendations, solutions, or final thoughts (e.g., "we need to", "in conclusion")
- prediction: Makes forecasts about the future (e.g., "will", "in X years", "eventually")
- general: Content that doesn't clearly fit other categories

Return ONLY a valid JSON object with this structure:
{
  "classifications": [
    {"paragraph_index": 0, "category": "background"},
    {"paragraph_index": 1, "category": "opinion"},
    ...
  ]
}

Do not include any explanation, only the JSON object."""

    def _build_user_prompt(self, paragraphs):
        numbered = [f"[{i}] {p}" for i, p in enumerate(paragraphs)]
        return (
            "Classify the following paragraphs:\n\n" +
            "\n".join(numbered) +
            "\n\nReturn JSON only."
        )

    # -----------------------------
    #        HELPER UTILS
    # -----------------------------
    def _empty_structure(self):
        return {
            'background': [],
            'opinion': [],
            'evidence': [],
            'reasoning': [],
            'conclusion': [],
            'prediction': [],
            'general': []
        }

    def _build_summary(self, structure, paragraphs, main_topics):
        return {
            "total_paragraphs": len(paragraphs),
            "background_count": len(structure["background"]),
            "opinion_count": len(structure["opinion"]),
            "evidence_count": len(structure["evidence"]),
            "reasoning_count": len(structure["reasoning"]),
            "conclusion_count": len(structure["conclusion"]),
            "prediction_count": len(structure["prediction"]),
            "general_count": len(structure["general"]),
            "main_topics": main_topics[:5]
        }