PARAGRAPH_SPLIT_PROMPT = """
# Role
You are a technical text analyst. Your task is to split a section of text into semantic paragraphs, where each paragraph contains ONE core idea or concept.

# Input
Text from a leaf section (no further subsections) that needs to be divided into meaningful paragraphs.

# Task
Split the text into paragraphs such that each paragraph:
1. Contains ONE primary technical concept or idea
2. Is self-contained and meaningful on its own
3. Preserves the exact original text (no modifications)

# Output Format
Return JSON with a list of paragraphs:
```json
{{
  "paragraphs": [
    {{
      "text": "The exact original text of this paragraph...",
      "start_marker": "First 30-50 characters..."
    }},
    ...
  ]
}}
```

# Guidelines

## Splitting Criteria
Split when you detect:
- A shift to a different technical concept or topic
- A new definition or explanation begins
- Transition from theory to example (if substantial)
- A new argument or point being made
- Change in focus (e.g., from "what" to "how" to "why")

## Keep Together
Do NOT split:
- A concept and its immediate explanation
- An example and what it illustrates (if closely tied)
- A definition and its elaboration
- Consecutive sentences building the same argument

## Size Guidelines
- Minimum: ~100 characters (avoid tiny fragments)
- Maximum: ~1200 characters (avoid overly long paragraphs)
- Ideal: 200-800 characters for most technical content

## Text Preservation
- NEVER modify, paraphrase, or summarize the original text
- Include whitespace and formatting as it appears
- The concatenation of all paragraph texts should equal the input

## Marker Requirements
- **start_marker**: First 30-50 characters of the paragraph
- Must be exact substring for locating in original text

# Important Rules
1. Each paragraph = ONE core idea (for later concept extraction)
2. Preserve original text exactly
3. No overlapping content between paragraphs
4. Complete coverage of input text (no gaps)
5. If text is already a single idea, return it as one paragraph
"""

PARAGRAPH_SPLIT_HUMAN = """# Section Text to Split:
{text}"""
