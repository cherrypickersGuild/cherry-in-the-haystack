# News Agent

`news_agent` runs article assessment and newsletter drafting flows around the Solteti article pipeline.

## What It Does

- Reads article assessment input from JSON or Solteti-backed fetches.
- Runs multi-stage classification and QA logic.
- Produces contract-validated article assessment payloads.
- Can build DB previews for newsletter candidate selection.
- Can generate newsletter draft outputs from DB-selected articles.

## Main Files

- `code/run_news_agent.py`: main CLI entrypoint
- `code/article_assessment_contract.py`: output contract validation
- `code/solteti_agent_api.py`: Solteti API integration

Useful but not required for the current PR:

- `code/run_news_agent_claude.py`
- `code/test_contract_and_input.py`
- `code/categori_eval/`

## Environment

The CLI loads `python_services/packages/agent/news_agent/code/.env` automatically if present.

Keep API keys and DB credentials there. The exact keys depend on which mode you run:

- article assessment
- Solteti-backed article assessment
- newsletter drafting from DB

## Core Run Modes

### 1. Article Assessment From JSON

```bash
python3 python_services/packages/agent/news_agent/code/run_news_agent.py \
  --article-assessment-input /path/to/input.json \
  --output_dir /tmp/news_agent_outputs
```

Optional prompt override:

```bash
python3 python_services/packages/agent/news_agent/code/run_news_agent.py \
  --article-assessment-input /path/to/input.json \
  --prompts python_services/packages/agent/news_agent/code/article_assessment_prompts.json \
  --output_dir /tmp/news_agent_outputs
```

### 2. Article Assessment From Solteti

```bash
python3 python_services/packages/agent/news_agent/code/run_news_agent.py \
  --solteti-article-ai \
  --version-tags A \
  --output_dir /tmp/news_agent_outputs
```

If needed, submit results downstream:

```bash
python3 python_services/packages/agent/news_agent/code/run_news_agent.py \
  --solteti-article-ai \
  --submit-results \
  --output_dir /tmp/news_agent_outputs
```

### 3. DB Preview For Newsletter Selection

```bash
python3 python_services/packages/agent/news_agent/code/run_news_agent.py \
  --db-preview \
  --week-start 2026-05-19 \
  --week-end 2026-05-25 \
  --min-score 4 \
  --limit 20
```

You can also pin specific article IDs:

```bash
python3 python_services/packages/agent/news_agent/code/run_news_agent.py \
  --db-preview \
  --selected-ids 123,456,789
```

### 4. Newsletter Draft From DB

```bash
python3 python_services/packages/agent/news_agent/code/run_news_agent.py \
  --newsletter-draft-db \
  --week-start 2026-05-19 \
  --week-end 2026-05-25 \
  --min-score 4 \
  --limit 10 \
  --output_dir /tmp/newsletter_outputs
```

Optional controls:

- `--user-instructions`
- `--few-shots`
- `--brand-tone`
- `--editorial-angle`
- `--audience-mode`
- `--strictness-mode`
- `--compare-mode`

## Contract Validation

The article assessment output is validated against `article_assessment_contract.py`.

Current contract checks include:

- `ai_classification_json` must be an object
- `final_path` must exist and include required keys
- `candidates` must be a list with confidence values between `0` and `1`
- `decision_reason` must be a non-empty string

## Key CLI Arguments

`run_news_agent.py` currently supports:

- `--input`
- `--limit`
- `--output_dir`
- `--prompts`
- `--article-assessment-input`
- `--solteti-article-ai`
- `--version-tags`
- `--submit-results`
- `--db-preview`
- `--selected-ids`
- `--week-start`
- `--week-end`
- `--min-score`
- `--newsletter-draft-db`
- `--user-instructions`
- `--few-shots`
- `--brand-tone`
- `--editorial-angle`
- `--audience-mode`
- `--strictness-mode`
- `--compare-mode`

## Notes

- There is already a `README-ko.md`; this `README.md` is the concise current-code reference.
- Large evaluation artifacts, dumps, and spreadsheets in this package are not required to run the main CLI.
