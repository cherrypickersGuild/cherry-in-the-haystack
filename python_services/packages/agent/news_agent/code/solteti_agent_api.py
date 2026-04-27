from __future__ import annotations

import json
import os
from typing import Any, Dict, List
from urllib.parse import urlencode
from urllib.request import Request, urlopen


DEFAULT_BASE_URL = "https://api.solteti.site"


def get_agent_api_base_url() -> str:
    return (os.getenv("SOLTETI_AGENT_API_BASE_URL") or DEFAULT_BASE_URL).rstrip("/")


def get_agent_api_key() -> str:
    api_key = (os.getenv("AGENT_API_KEY") or "").strip()
    if not api_key:
        raise ValueError("AGENT_API_KEY is not set.")
    return api_key


def request_json(
    method: str,
    path: str,
    *,
    query: Dict[str, Any] | None = None,
    body: Dict[str, Any] | None = None,
    timeout: int = 120,
) -> Dict[str, Any]:
    base_url = get_agent_api_base_url()
    api_key = get_agent_api_key()
    url = f"{base_url}{path}"
    if query:
        query_string = urlencode({key: value for key, value in query.items() if value is not None})
        if query_string:
            url = f"{url}?{query_string}"
    data = None
    headers = {
        "X-Api-Key": api_key,
        "Accept": "application/json",
    }
    if body is not None:
        data = json.dumps(body, ensure_ascii=True).encode("utf-8")
        headers["Content-Type"] = "application/json"
    request = Request(url, data=data, headers=headers, method=method.upper())
    with urlopen(request, timeout=timeout) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        payload = response.read().decode(charset)
    parsed = json.loads(payload)
    if not isinstance(parsed, dict):
        raise ValueError(f"Expected object response from {url}")
    return parsed


def insert_article(payload: Dict[str, Any]) -> Dict[str, Any]:
    return request_json("POST", "/api/agent/insert-article", body=payload)


def ask_evaluation(*, type_: str, version_tags: str) -> Dict[str, Any]:
    return request_json(
        "GET",
        "/api/agent/ask-evaluation",
        query={
            "type": type_,
            "version_tags": version_tags,
        },
    )


def finish_evaluation(results: List[Dict[str, Any]]) -> Dict[str, Any]:
    return request_json(
        "POST",
        "/api/agent/finish-evaluation",
        body={"results": results},
    )


def flatten_catalog_entities(catalog: Dict[str, Any]) -> List[Dict[str, Any]]:
    flattened: List[Dict[str, Any]] = []
    pages = catalog.get("pages") if isinstance(catalog, dict) else []
    if not isinstance(pages, list):
        return flattened
    for page_item in pages:
        if not isinstance(page_item, dict):
            continue
        page = str(page_item.get("page") or "").strip()
        categories = page_item.get("categories")
        if not isinstance(categories, list):
            continue
        for category_item in categories:
            if not isinstance(category_item, dict):
                continue
            category_id = str(category_item.get("id") or "").strip()
            category_name = str(category_item.get("name") or "").strip()
            entities = category_item.get("entities")
            if not isinstance(entities, list):
                continue
            for entity in entities:
                if not isinstance(entity, dict):
                    continue
                entity_id = str(entity.get("id") or "").strip()
                entity_name = str(entity.get("name") or "").strip()
                if not (entity_id and entity_name and page and category_id and category_name):
                    continue
                flattened.append(
                    {
                        "id": entity_id,
                        "page": page,
                        "category_id": category_id,
                        "category_name": category_name,
                        "name": entity_name,
                    }
                )
    return flattened


def flatten_side_categories(catalog: Dict[str, Any]) -> List[Dict[str, Any]]:
    flattened: List[Dict[str, Any]] = []
    side_categories = catalog.get("side_categories") if isinstance(catalog, dict) else []
    if not isinstance(side_categories, list):
        return flattened
    for item in side_categories:
        if not isinstance(item, dict):
            continue
        code = str(item.get("code") or "").strip()
        name = str(item.get("name") or "").strip()
        if not code:
            continue
        flattened.append(
            {
                "id": str(item.get("id") or "").strip() or None,
                "code": code,
                "name": name,
            }
        )
    return flattened


def build_article_input_from_package(
    item: Dict[str, Any],
    catalog: Dict[str, Any],
    prompts: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    article = item.get("article") if isinstance(item.get("article"), dict) else {}
    idempotency_key = str(item.get("idempotency_key") or "").strip()
    user_article_state_id = idempotency_key[4:] if idempotency_key.lower().startswith("uas:") else idempotency_key
    version_id = None
    version_tag = None
    if isinstance(prompts, dict):
        versions = prompts.get("versions")
        if isinstance(versions, list) and versions:
            first = versions[0]
            if isinstance(first, dict):
                version_id = first.get("version_id")
                version_tag = first.get("version_tag")

    return {
        "user_article_state_id": user_article_state_id,
        "version": "0.3",
        "article": {
            "title": article.get("title", ""),
            "url": article.get("url", ""),
            "content_raw": article.get("content_raw") or article.get("content") or "",
            "published_at": article.get("published_at"),
            "summary": article.get("summary", ""),
            "author": article.get("author", ""),
            "language": article.get("language", ""),
            "source_name": article.get("source_name", ""),
            "source_type": article.get("source_type", ""),
        },
        "allowed_entities": flatten_catalog_entities(catalog),
        "allowed_side_categories": flatten_side_categories(catalog),
        "meta": {
            "prompt_template_version_id": version_id,
            "version_tag": version_tag,
        },
    }
