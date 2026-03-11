import argparse
import csv
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List


def load_env_file(env_path: Path) -> None:
    if not env_path.exists():
        return
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def parse_json_output(text: str) -> Dict[str, Any] | None:
    try:
        return json.loads(text)
    except Exception:
        pass

    if not text:
        return None

    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None

    snippet = text[start : end + 1]
    try:
        return json.loads(snippet)
    except Exception:
        return None


def load_items(csv_path: Path) -> List[Dict[str, str]]:
    with csv_path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    items = []
    for row in rows:
        title = (row.get("title") or "").strip()
        content = (row.get("content") or row.get("text") or "").strip()
        if not title and not content:
            continue
        items.append({"title": title, "content": content})
    return items


def sanitize_filename(value: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9._-]+", "_", value.strip())
    return cleaned or "news"


DEFAULT_PROMPTS = {
    "analyst": (
        "You are a senior ML engineer. Summarize the news item concisely for ML engineers. "
        "Extract the likely company or org. Choose a category from: Model Release, Research, Product, "
        "Safety, Infra, Funding, Policy, Other. Return JSON: summary, category, company, tags (list). "
        "No marketing language."
    ),
    "scorer": (
        "You are scoring importance for ML engineers on a 1-5 scale. "
        "Apply this hard rule: if the news is about non-ML-core productivity/office software "
        "(e.g., Excel add-ins) or does not directly affect model training, evaluation, serving, "
        "or ML engineering workflows, subtract 2 points from the score (floor at 1). "
        "Use this rubric:\n"
        "5: Everyone must know. Broad impact + urgent + actionable now + durable. Examples: major model updates/pricing/API changes; "
        "critical security vuln in widely used libs/runtimes; paradigm-shifting Transformer/GPT-level paper; big changes to ubiquitous tools (e.g., LangChain, Claude Code).\n"
        "4: Very meaningful but lacks certainty/urgency/breadth. Example: Veo 3 update (valuable trend), credible rumor of major vendor policy/pricing change.\n"
        "3: Nice-to-know background. Most SOTA papers; new benchmark comparisons.\n"
        "2: Minor practical impact; niche tools/services, speculative or hard-to-apply ideas.\n"
        "1: No value; stale/rehashed info, hype, low evidence.\n"
        "Return JSON: importance_score (1-5), rationale (1-2 sentences)."
    ),
    "editor": (
        "Decide if this should go into an ML engineer newsletter. "
        "Return JSON: newsletter_fit (bool), newsletter_edit (1-3 sentences), edit_notes (optional). "
        "If not fit, newsletter_edit should explain what would make it fit. "
        "IMPORTANT: If importance_score <= 3, set newsletter_fit to false and explain briefly why."
    ),
    "qa": (
        "Review the merged output for technical precision, contradictions, or missing key context. "
        "Return ONLY JSON with keys: title, summary, importance_score, category, newsletter_fit, "
        "newsletter_edit, rationale, tags, company. Be concise."
    ),
}

DEFAULT_NEWSLETTER_PROMPTS = {
    "draft": (
        "You are a senior ML engineer writing a weekly newsletter for ML engineers. "
        "Given selected high-value news items, produce a concise draft with: "
        "1) Title, 2) TL;DR bullets, 3) Main sections per item (2-4 sentences each), "
        "4) Closing note. Use a crisp, technical tone. Avoid marketing language."
    )
}


def load_prompts(path: Path | None) -> Dict[str, str]:
    prompts = DEFAULT_PROMPTS.copy()
    if path and path.exists():
        try:
            data = json.loads(path.read_text())
            if isinstance(data, dict):
                for key, value in data.items():
                    if isinstance(value, str) and value.strip():
                        prompts[key] = value.strip()
        except Exception:
            pass
    return prompts


def load_newsletter_prompts(path: Path | None) -> Dict[str, str]:
    prompts = DEFAULT_NEWSLETTER_PROMPTS.copy()
    if path and path.exists():
        try:
            data = json.loads(path.read_text())
            if isinstance(data, dict):
                for key, value in data.items():
                    if isinstance(value, str) and value.strip():
                        prompts[key] = value.strip()
        except Exception:
            pass
    return prompts


def build_agents(prompts: Dict[str, str]):
    try:
        from agents import Agent, Runner, OpenAIProvider
    except Exception as exc:
        raise RuntimeError(
            "Agents SDK is not available. Install the OpenAI Agents SDK package before running this script."
        ) from exc

    model_name = os.getenv("OPENAI_MODEL", "gpt-4.1")
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise ValueError("OPENAI_API_KEY is not set.")

    provider = OpenAIProvider(api_key=api_key)
    model = provider.get_model(model_name)

    analyst = Agent(
        name="NewsAnalyst",
        instructions=prompts.get("analyst", DEFAULT_PROMPTS["analyst"]),
        model=model,
    )

    scorer = Agent(
        name="ImportanceScorer",
        instructions=prompts.get("scorer", DEFAULT_PROMPTS["scorer"]),
        model=model,
    )

    editor = Agent(
        name="NewsletterEditor",
        instructions=prompts.get("editor", DEFAULT_PROMPTS["editor"]),
        model=model,
    )

    qa = Agent(
        name="QAReviewer",
        instructions=prompts.get("qa", DEFAULT_PROMPTS["qa"]),
        model=model,
    )

    return Agent, Runner, analyst, scorer, editor, qa


def build_newsletter_agent(prompt: str):
    try:
        from agents import Agent, Runner, OpenAIProvider
    except Exception as exc:
        raise RuntimeError(
            "Agents SDK is not available. Install the OpenAI Agents SDK package before running this script."
        ) from exc

    model_name = os.getenv("OPENAI_MODEL", "gpt-4.1")
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise ValueError("OPENAI_API_KEY is not set.")

    provider = OpenAIProvider(api_key=api_key)
    model = provider.get_model(model_name)

    agent = Agent(
        name="NewsletterDrafter",
        instructions=prompt,
        model=model,
    )
    return Runner, agent


def run_item(runner, analyst, scorer, editor, qa, title: str, content: str) -> Dict[str, Any]:
    base = f"Title: {title}\n\nContent:\n{content}\n"

    analyst_res = runner.run_sync(analyst, base)
    analyst_json = parse_json_output(analyst_res.final_output) or {}

    scorer_res = runner.run_sync(
        scorer,
        base + "\nAnalyst Output:\n" + json.dumps(analyst_json, ensure_ascii=True),
    )
    scorer_json = parse_json_output(scorer_res.final_output) or {}

    editor_res = runner.run_sync(
        editor,
        base + "\nAnalyst Output:\n" + json.dumps(analyst_json, ensure_ascii=True),
    )
    editor_json = parse_json_output(editor_res.final_output) or {}

    merged = {
        "title": title,
        "summary": analyst_json.get("summary", ""),
        "category": analyst_json.get("category", "Other"),
        "company": analyst_json.get("company", ""),
        "tags": analyst_json.get("tags", []),
        "importance_score": scorer_json.get("importance_score", 3),
        "rationale": scorer_json.get("rationale", ""),
        "newsletter_fit": editor_json.get("newsletter_fit", False),
        "newsletter_edit": editor_json.get("newsletter_edit", ""),
    }

    # Enforce policy: low-importance items should not be newsletter fit.
    try:
        importance_value = int(merged.get("importance_score", 3))
    except Exception:
        importance_value = 3
    if importance_value <= 3:
        merged["newsletter_fit"] = False
        if not merged.get("newsletter_edit"):
            merged["newsletter_edit"] = "Skip: importance score <= 3 for ML engineer audience."

    qa_res = runner.run_sync(qa, json.dumps(merged, ensure_ascii=True, indent=2))
    qa_json = parse_json_output(qa_res.final_output)
    if qa_json:
        return qa_json
    return merged


def run_pipeline(items: List[Dict[str, str]], output_dir: str, prompts: Dict[str, str]) -> Dict[str, Any]:
    Agent, Runner, analyst, scorer, editor, qa = build_agents(prompts)
    runner = Runner

    results = []
    for item in items:
        result = run_item(runner, analyst, scorer, editor, qa, item["title"], item["content"])
        results.append(result)

    output = {
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "count": len(results),
        "items": results,
    }

    output_dir_path = Path(output_dir)
    output_dir_path.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = output_dir_path / f"news_agent_output_{timestamp}.json"
    output_path.write_text(json.dumps(output, ensure_ascii=True, indent=2))

    print(json.dumps(output, ensure_ascii=True, indent=2))
    print(f"Wrote: {output_path}")
    return output


def run_newsletter_draft(
    selected_items: List[Dict[str, Any]],
    user_instructions: str,
    few_shots: str,
    brand_tone: str,
    prompt_overrides: Dict[str, str] | None = None,
) -> Dict[str, Any]:
    prompts = DEFAULT_NEWSLETTER_PROMPTS.copy()
    if prompt_overrides:
        for key, value in prompt_overrides.items():
            if isinstance(value, str) and value.strip():
                prompts[key] = value.strip()

    Runner, agent = build_newsletter_agent(prompts["draft"])
    runner = Runner

    input_payload = {
        "selected_items": selected_items,
        "user_instructions": user_instructions,
        "few_shots": few_shots,
        "brand_tone": brand_tone,
    }
    prompt = (
        "You will write a weekly newsletter draft. "
        "Use the following structured input:\n"
        f"{json.dumps(input_payload, ensure_ascii=True, indent=2)}\n\n"
        "Return JSON with keys: title, tldr (list), sections (list of {heading, body}), closing."
    )

    result = runner.run_sync(agent, prompt)
    draft_json = parse_json_output(result.final_output)
    if draft_json is None:
        draft_json = {
            "title": "",
            "tldr": [],
            "sections": [],
            "closing": "",
            "raw_output": result.final_output,
        }
    return draft_json


def main() -> int:
    parser = argparse.ArgumentParser(description="Run News Agent on CSV input.")
    parser.add_argument("--input", default="dev/apps/agent/news_agent/data/example_data.csv")
    parser.add_argument("--limit", type=int, default=0, help="Limit number of rows (0 = all).")
    parser.add_argument("--output_dir", default="dev/apps/agent/news_agent/outputs")
    parser.add_argument("--prompts", default="")
    args = parser.parse_args()

    env_path = Path(__file__).with_name(".env")
    load_env_file(env_path)

    items = load_items(Path(args.input))
    if args.limit and args.limit > 0:
        items = items[: args.limit]

    if not items:
        print("No items found.")
        return 1

    prompt_path = Path(args.prompts) if args.prompts else Path(os.getenv("NEWS_AGENT_PROMPTS_PATH", ""))
    if not args.prompts and not os.getenv("NEWS_AGENT_PROMPTS_PATH"):
        prompt_path = Path(__file__).with_name("prompts.json")
    prompts = load_prompts(prompt_path if str(prompt_path) else None)

    run_pipeline(items=items, output_dir=args.output_dir, prompts=prompts)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
