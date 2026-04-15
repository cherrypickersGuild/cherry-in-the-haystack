from dotenv import load_dotenv
import os
import sys

load_dotenv(os.path.join(os.path.dirname(__file__), "../api.env"))

from agent_communication_api import AgentAPIClient

api_key = os.environ["AGENT_API_KEY"]
client = AgentAPIClient(api_key=api_key)

# 1. 기사 삽입 테스트
print("=== 1. insert_article ===")
insert_result = client.insert_article({
    "title": "LangChain v0.3 Adds Multi-Modal RAG Pipeline",
    "url": "https://blog.langchain.dev/langchain-v03-multi-modal-rag",
    "article_raw": "LangChain v0.3 introduces a multi-modal RAG pipeline...",
    "published_at": "2026-04-12T14:00:00Z",
})
print(insert_result)

# 2. 평가 패키지 요청 테스트
print("\n=== 2. ask_evaluation ===")
evaluation_package = client.ask_evaluation(type="ARTICLE_AI", version_tags="A")
print(f"prompts: {evaluation_package['prompts']['template_name']}")
print(f"items 수: {len(evaluation_package['items'])}")

# 3. 평가 결과 저장 테스트
print("\n=== 3. finish_evaluation ===")
# ask_evaluation에서 받은 첫 번째 item으로 더미 결과 생성
if evaluation_package["items"]:
    item = evaluation_package["items"][0]
    first_entity = evaluation_package["catalog"]["pages"][0]["categories"][0]["entities"][0]
    first_category = evaluation_package["catalog"]["pages"][0]["categories"][0]
    first_page = evaluation_package["catalog"]["pages"][0]

    save_result = client.finish_evaluation(results=[{
        "idempotency_key": item["idempotency_key"],
        "version": "0.3",
        "representative_entity": {
            "id": first_entity["id"],
            "page": first_page["page"],
            "category_id": first_category["id"],
            "category_name": first_category["name"],
            "name": first_entity["name"],
        },
        "ai_summary": "테스트 요약입니다.",
        "ai_score": 3,
        "side_category_code": None,
        "ai_classification_json": {
            "final_path": {
                "page": first_page["page"],
                "category_name": first_category["name"],
                "entity_name": first_entity["name"],
            },
            "candidates": [],
            "decision_reason": "test",
        },
        "ai_tags_json": [{"kind": "TAG", "value": "test"}],
        "ai_snippets_json": {
            "why_it_matters": "테스트",
            "key_points": ["테스트 포인트"],
            "risk_notes": [],
        },
    }])
    print(save_result)
else:
    print("평가 대기 중인 items 없음")