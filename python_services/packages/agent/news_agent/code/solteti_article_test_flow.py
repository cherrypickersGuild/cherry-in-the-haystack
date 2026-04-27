from __future__ import annotations

import argparse
import json
import os
import sys
import time
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
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


def load_rss_pull_payloads(path: Path, limit: int) -> list[dict[str, Any]]:
    if not path.exists():
        raise FileNotFoundError(f"RSS pull file not found: {path}")
    items = json.loads(path.read_text())
    if not isinstance(items, list):
        raise ValueError("RSS pull file must contain a JSON array")
    payloads: list[dict[str, Any]] = []
    for item in items[: max(limit, 0)]:
        if not isinstance(item, dict):
            continue
        payloads.append(
            {
                "title": item.get("title", ""),
                "url": item.get("url", ""),
                "source_name": item.get("source_name", ""),
                "content_raw": item.get("content_raw") or item.get("content") or "",
                "published_at": item.get("published_at"),
                "source_type": item.get("source_type", "RSS"),
            }
        )
    return payloads


def append_url_suffix(url: str, suffix: str) -> str:
    if not suffix:
        return url
    parsed = urlsplit(url)
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    query["flow_run"] = suffix
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, urlencode(query), parsed.fragment))


def dump_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2))


def payload_signature(payload: dict[str, Any]) -> tuple[str, str]:
    return (
        str(payload.get("url") or "").strip(),
        str(payload.get("title") or "").strip(),
    )


def response_identifiers(response: dict[str, Any]) -> set[str]:
    identifiers: set[str] = set()
    if not isinstance(response, dict):
        return identifiers
    for key in ["idempotency_key", "user_article_state_id", "article_id", "id"]:
        value = str(response.get(key) or "").strip()
        if value:
            identifiers.add(value)
            if key == "user_article_state_id":
                identifiers.add(f"uas:{value.lower()}")
    return identifiers


def filter_package_items(
    items: list[dict[str, Any]],
    inserted_payloads: list[dict[str, Any]],
    inserted_responses: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    signatures = {payload_signature(payload) for payload in inserted_payloads}
    identifiers = set()
    for response in inserted_responses:
        identifiers.update(response_identifiers(response))

    filtered: list[dict[str, Any]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        article = item.get("article") if isinstance(item.get("article"), dict) else {}
        signature = (
            str(article.get("url") or "").strip(),
            str(article.get("title") or "").strip(),
        )
        idempotency_key = str(item.get("idempotency_key") or "").strip()
        item_id = str(item.get("id") or "").strip()
        if signature in signatures or idempotency_key in identifiers or item_id in identifiers:
            filtered.append(item)
    return filtered


def wait_for_matching_package_items(
    inserted_payloads: list[dict[str, Any]],
    inserted_responses: list[dict[str, Any]],
    version_tags: str,
    timeout_seconds: int = 20,
    poll_interval: int = 2,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    deadline = time.time() + timeout_seconds
    latest_package: dict[str, Any] = {}
    latest_selected: list[dict[str, Any]] = []
    while time.time() <= deadline:
        latest_package = ask_evaluation(type_="ARTICLE_AI", version_tags=version_tags)
        latest_selected = filter_package_items(latest_package.get("items") or [], inserted_payloads, inserted_responses)
        if latest_selected:
            return latest_package, latest_selected
        time.sleep(poll_interval)
    return latest_package, latest_selected


def build_direct_items_from_inserted(
    inserted_payloads: list[dict[str, Any]],
    inserted_responses: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    direct_items: list[dict[str, Any]] = []
    for payload, response in zip(inserted_payloads, inserted_responses):
        if not isinstance(payload, dict) or not isinstance(response, dict):
            continue
        state_id = str(response.get("user_article_state_id") or response.get("id") or "").strip()
        if not state_id:
            continue
        direct_items.append(
            {
                "idempotency_key": f"uas:{state_id.lower()}",
                "article": dict(payload),
            }
        )
    return direct_items


def remap_results_to_pending_keys(results: list[dict[str, Any]], version_tags: str) -> tuple[list[dict[str, Any]], dict[str, str]]:
    package = ask_evaluation(type_="ARTICLE_AI", version_tags=version_tags)
    pending_by_url: dict[str, str] = {}
    for item in package.get("items") or []:
        if not isinstance(item, dict):
            continue
        article = item.get("article") if isinstance(item.get("article"), dict) else {}
        article_url = str(article.get("url") or "").strip()
        idempotency_key = str(item.get("idempotency_key") or "").strip()
        if article_url and idempotency_key:
            pending_by_url[article_url] = idempotency_key

    remapped_results: list[dict[str, Any]] = []
    remapped_by_url: dict[str, str] = {}
    for result in results:
        if not isinstance(result, dict):
            continue
        evidence_items = ((result.get("ai_evidence_json") or {}).get("evidence_items") or []) if isinstance(result.get("ai_evidence_json"), dict) else []
        article_url = ""
        if evidence_items and isinstance(evidence_items[0], dict):
            article_url = str(evidence_items[0].get("url") or "").strip()
        pending_key = pending_by_url.get(article_url)
        if article_url and pending_key:
            updated = dict(result)
            updated["idempotency_key"] = pending_key
            remapped_results.append(updated)
            remapped_by_url[article_url] = pending_key
        else:
            remapped_results.append(result)
    return remapped_results, remapped_by_url


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
    parser.add_argument("--rss-pull-file", default="")
    parser.add_argument("--rss-limit", type=int, default=5)
    parser.add_argument("--url-suffix", default="")
    parser.add_argument("--version-tags", default="A")
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    parser.add_argument("--submit-results", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    load_env_file(BASE_DIR / ".env")

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    payload_source = ""
    if args.rss_pull_file:
        payload_file = Path(args.rss_pull_file)
        payloads = load_rss_pull_payloads(payload_file, args.rss_limit)
        payload_source = str(payload_file)
    else:
        payload_file = Path(args.payload_file)
        payloads = load_payloads(payload_file)
        payload_source = str(payload_file)
    print(f"Loaded {len(payloads)} article payloads from {payload_source}")

    if args.url_suffix:
        for payload in payloads:
            payload["url"] = append_url_suffix(str(payload.get("url") or ""), args.url_suffix)
        print(f"Applied flow_run URL suffix: {args.url_suffix}")

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
    package, selected_items = wait_for_matching_package_items(payloads, inserted, args.version_tags)
    package_items = package.get("items") or []
    print("ask_evaluation returned items=", len(package_items))
    print("selected inserted items=", len(selected_items))
    fallback_direct = False
    if not selected_items:
        selected_items = build_direct_items_from_inserted(payloads, inserted)
        fallback_direct = bool(selected_items)
        if fallback_direct:
            print("No matching pending items returned; falling back to direct evaluation of inserted article states.")

    results, runs = run_article_assessment_for_items(
        items=selected_items,
        catalog=package.get("catalog") or {},
        prompts_meta=package.get("prompts") or {},
        output_dir=output_dir,
    )

    summary = {
        "payload_source": payload_source,
        "inserted_count": len(inserted),
        "ask_evaluation_item_count": len(package_items),
        "selected_item_count": len(selected_items),
        "used_direct_insert_fallback": fallback_direct,
        "evaluation_items": len(results),
        "runs": runs,
    }
    summary_path = output_dir / "solteti_article_test_flow_summary.json"
    dump_json(summary_path, summary)
    print(f"Local assessment complete. Summary saved to {summary_path}")

    if args.submit_results and results:
        results_to_submit, remapped_by_url = remap_results_to_pending_keys(results, args.version_tags)
        print("Submitting results to finish_evaluation...")
        finish_response = finish_evaluation(results_to_submit)
        finish_path = output_dir / "solteti_article_test_flow_finish_response.json"
        dump_json(finish_path, finish_response)
        print(f"finish_evaluation response saved to {finish_path}")
        remap_path = output_dir / "solteti_article_test_flow_finish_remap.json"
        dump_json(remap_path, remapped_by_url)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
