# KaaS Dashboard › Prompt Templates

Admin tab to manage prompt templates used by Cherry's article-evaluation pipeline (the AI that scores and tags every crawled article).

## Layout
Three sections:
- **Left** — templates list (active one highlighted)
- **Middle** — Versions list for the selected template
- **Right** — Editor / Preview tabs for the currently selected version

## Versions — what do `A`, `B`, `C`... mean?
Each template can have **multiple versions** of its prompt. Versions are labeled automatically in creation order:
- The first version is **A**, the second is **B**, then C, D, ... Z, AA, AB, ... (see `versionTag(n)` in `prompt-template.service.ts`)
- Version tag is shown as a square pill on each version card (left-side small button)
- **Only one version is Active at a time** — the Active one is what the pipeline uses when evaluating new articles. A green `✓ Active` badge marks it.
- Clicking a non-active version's pill activates it (the previous active one becomes inactive). This is an A/B switch — no multi-active.

Use case: you want to experiment with a new prompt. Create version B, compare to A in the Editor tab, then activate B when satisfied. A is preserved and can be re-activated later.

## Editor tab (right panel)
Shows the selected version's:
- `prompt_text` — the full prompt sent to the LLM for each article
- `tone_text` — direction for tone (e.g. "Summarize technically; reader is an ML engineer")
- `few_shot_examples` — JSON examples of input → output
- `change_note` — short note on what changed in this version

## Preview tab
Renders the prompt against an example article so you can sanity-check formatting before activating.

## Common tasks
| Task | Steps |
|---|---|
| Switch active version | Versions list → click the pill of any non-active version (e.g. `B`) → confirms activation |
| Edit a version | Select template → select version → Editor → make changes → Save |
| Create a new version | Versions panel → "+ New version" — starts as a copy of the current active version, gets the next letter (e.g. C) |
| Delete a version | Hover the version card → trash button → confirm (cannot delete the Active version) |
| Preview | Right panel → Preview tab |

## Default template
Code: `article_ai_default`. Generates `ai_summary`, `ai_score` (1-5), `ai_classification_json` (page + category), `ai_tags_json` (entity tags). All article evaluations in `content.user_article_ai_state` go through this template's Active version.

## Notes
- Only one version per template is active at a time
- Activating a new version does **not** re-evaluate past articles — only new ones going through the pipeline
- `few_shot_examples` is JSON. Bad JSON breaks the pipeline — always validate before saving
