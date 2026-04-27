from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from solteti_agent_api import (
    ask_evaluation,
    build_article_input_from_package,
    finish_evaluation,
    insert_article,
)
from run_news_agent import (
    has_sufficient_article_body,
    load_article_assessment_prompts,
    load_env_file,
    run_article_assessment_debug,
)

DEFAULT_PAYLOAD_FILE = BASE_DIR.parent / "data" / "insert_article_test_payloads.json"
DEFAULT_OUTPUT_DIR = BASE_DIR.parent.parent.parent / "dev" / "apps" / "agent" / "news_agent" / "outputs"


def load_payloads(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        raise FileNotFoundError(f"Payload file not found: {path}")
    payloads = json.loads(path.read_text())
    if not isinstance(payloads, list):
        raise ValueError("Payload file must contain a JSON array")
    return payloads


def dump_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2))


def run_article_assessment_for_items(items: list[dict[str, Any]], catalog: dict[str, Any], prompts_meta: dict[str, Any], output_dir: Path) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    results: list[dict[str, Any]] = []
    runs: list[dict[str, Any]] = []

    prompt_overrides = load_article_assessment_prompts(BASE_DIR / "article_assessment_prompts.json")
    prompt_overrides.update({})

    for item in items:
        article = item.get("article") if isinstance(item.get("article"), dict) else {}
        if not has_sufficient_article_body(article):
            title = article.get("title") if isinstance(article.get("title"), str) else "<unknown>"
            item_key = str(item.get("idempotency_key") or item.get("id") or "<missing>")
            print(f"Skipping item {item_key}: insufficient article body for FR-2.1 assessment ({title})")
            runs.append(
                {
                    "idempotency_key": item_key,
                    "input_title": title,
                    "contract_validation": {
                        "skipped": "insufficient article body",
                        "content_length": len(str(article.get("content_raw") or article.get("content") or "")),
                        "summary_length": len(str(article.get("summary") or "")),
                    },
                }
            )
            continue

        article_input = build_article_input_from_package(item, catalog, prompts_meta)
        debug_output = run_article_assessment_debug(
            article_input=article_input,
            prompt_overrides=prompt_overrides,
            output_dir=str(output_dir),
        )
        results.append(debug_output["agent_json_raw"])
        runs.append(
            {
                "idempotency_key": debug_output["agent_json_raw"].get("idempotency_key"),
                "input_title": article_input.get("article", {}).get("title"),
                "contract_validation": debug_output.get("contract_validation", {}),
            }
        )
    return results, runs


def main() -> int:
    parser = argparse.ArgumentParser(description="Insert test articles and run Solteti article evaluation flow.")
    parser.add_argument("--payload-file", default=str(DEFAULT_PAYLOAD_FILE))
    parser.add_argument("--version-tags", default="A")
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    parser.add_argument("--submit-results", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    load_env_file(BASE_DIR / ".env")

    payload_file = Path(args.payload_file)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    payloads = load_payloads(payload_file)
    print(f"Loaded {len(payloads)} article payloads from {payload_file}")

    inserted: list[dict[str, Any]] = []
    for idx, payload in enumerate(payloads, start=1):
        print(f"[{idx}/{len(payloads)}] insert_article {payload.get('url')}")
        if args.dry_run:
            print(json.dumps(payload, ensure_ascii=False, indent=2))
            continue
        response = insert_article(payload)
        print("  ->", response)
        inserted.append(response)

    if args.dry_run:
        print("Dry run complete. No remote requests were sent.")
        return 0

    print("Calling ask_evaluation...")
    package = ask_evaluation(type_="ARTICLE_AI", version_tags=args.version_tags)
    print("ask_evaluation returned items=", len(package.get("items") or []))

    results, runs = run_article_assessment_for_items(
        items=package.get("items") or [],
        catalog=package.get("catalog") or {},
        prompts_meta=package.get("prompts") or {},
        output_dir=output_dir,
    )

    summary = {
        "inserted_count": len(inserted),
        "evaluation_items": len(results),
        "runs": runs,
    }
    summary_path = output_dir / "solteti_article_test_flow_summary.json"
    dump_json(summary_path, summary)
    print(f"Local assessment complete. Summary saved to {summary_path}")

    if args.submit_results and results:
        print("Submitting results to finish_evaluation...")
        finish_response = finish_evaluation(results)
        finish_path = output_dir / "solteti_article_test_flow_finish_response.json"
        dump_json(finish_path, finish_response)
        print(f"finish_evaluation response saved to {finish_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
