import os
import requests
from typing import Optional


class AgentAPIClient:
    BASE_URL = "https://api.solteti.site"

    def __init__(self, api_key: str):
        self.session = requests.Session()
        self.session.headers.update({
            "X-Api-Key": api_key,
            "Content-Type": "application/json",
        })

    def insert_article(self, page: dict) -> dict:
        """
        POST /api/agent/insert-article
        기사 삽입. URL 중복이면 기존 ID 반환.

        Args:
            page: RSS 피드에서 파싱한 기사 딕셔너리

        Returns:
            {"id": str, "created": bool}
        """
        payload = {
            "title": page["title"],
            "url": page["url"],
            "source_name": page.get("author", "unknown"),
            "content_raw": page.get("article_raw", ""),
            "published_at": page["published_at"],
        }
        response = self.session.post(
            f"{self.BASE_URL}/api/agent/insert-article",
            json=payload,
        )
        print("response:", response.text) 
        response.raise_for_status()
        return response.json()

    def ask_evaluation(self, type: str, version_tags: str) -> dict:
        """
        GET /api/agent/ask-evaluation
        평가 패키지 요청. prompts + catalog + items 반환.

        Args:
            type: "ARTICLE_AI" 또는 "NEWSLETTER"
            version_tags: 단일("A") 또는 쉼표 구분 복수("A,B")

        Returns:
            {"prompts": {...}, "catalog": {...}, "items": [...]}
        """
        response = self.session.get(
            f"{self.BASE_URL}/api/agent/ask-evaluation",
            params={"type": type, "version_tags": version_tags},
        )
        response.raise_for_status()
        return response.json()

    def finish_evaluation(self, results: list[dict]) -> dict:
        """
        POST /api/agent/finish-evaluation
        평가 결과 일괄 저장.

        Args:
            results: [
                {
                    "idempotency_key": str,   # ask-evaluation items에서 받은 값 그대로
                    "version": str,           # 현재 "0.3"
                    "representative_entity": {
                        "id": str,            # catalog에서 받은 entity id (필수)
                        "page": str,
                        "category_id": str,
                        "category_name": str,
                        "name": str,
                    },
                    "ai_summary": str,
                    "ai_score": int,          # 1-5
                    "side_category_code": str | None,
                    "ai_classification_json": {...},
                    "ai_tags_json": [...],
                    "ai_snippets_json": {...},
                    "ai_evidence_json": {...},           # optional
                    "ai_structured_extraction_json": {...}, # optional
                }
            ]

        Returns:
            {"saved": int, "skipped": int}
        """
        response = self.session.post(
            f"{self.BASE_URL}/api/agent/finish-evaluation",
            json={"results": results},
        )
        response.raise_for_status()
        return response.json()