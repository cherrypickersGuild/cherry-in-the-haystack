# News Agent Design (Step 1)

## Goal
Review company news items and produce an ML-engineer-facing newsletter decision with:
- AI summary
- importance score
- category
- newsletter fit + edits
- rationale

## Input
CSV at `dev/apps/agent/news_agent/data/example_data.csv`
- Column 1: `title`
- Column 2: `content` (note: file header currently uses `text`; treat as content)

## Output (per item)
```json
{
  "title": "...",
  "summary": "...",
  "importance_score": 1,
  "category": "Model Release | Research | Product | Safety | Infra | Funding | Policy | Other",
  "newsletter_fit": true,
  "newsletter_edit": "...",
  "rationale": "...",
  "tags": ["..."],
  "company": "..."
}
```

## Multi-agent roles
1. **NewsAnalyst** (ML background)
- Reads title + content
- Produces ML-engineer-grade summary + initial category guess

2. **ImportanceScorer**
- Assigns score 1–5 with rubric below
- Considers breadth, urgency, actionability, durability

3. **NewsletterEditor**
- Decides fit (bool)
- Produces newsletter-ready edit if fit
- If not fit, suggests what would make it fit

4. **QAReviewer**
- Checks contradictions and missing points
- Ensures output is concise and technically precise

## Collaboration pattern
- Analyst -> Scorer -> Editor -> QA -> Final merge
- QA can request edits; final output is merged into a single JSON

## Constraints
- Keep outputs concise for ML engineers.
- No marketing fluff. Avoid speculation.
- Use explicit, technical language.

## Importance score rubric (1–5)
**5**: Everyone must know. Broad impact + urgent + actionable now + durable. Examples: major model updates/pricing/API changes; critical security vuln in widely used libs/runtimes; paradigm-shifting Transformer/GPT-level paper; big changes to ubiquitous tools (e.g., LangChain, Claude Code).  
**4**: Very meaningful but lacks certainty/urgency/breadth. Example: Veo 3 update (valuable trend), credible rumor of major vendor policy/pricing change.  
**3**: Nice-to-know background. Most SOTA papers; new benchmark comparisons.  
**2**: Minor practical impact; niche tools/services, speculative or hard-to-apply ideas.  
**1**: No value; stale/rehashed info, hype, low evidence.

## Run artifact
Step 1 only validates input schema.
