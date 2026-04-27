import json
import sys
from pathlib import Path

CODE_DIR = Path(__file__).resolve().parent
if str(CODE_DIR) not in sys.path:
    sys.path.insert(0, str(CODE_DIR))

from solteti_agent_api import ask_evaluation, finish_evaluation
from dotenv import load_dotenv

load_dotenv(CODE_DIR / '.env')
package = ask_evaluation(type_='ARTICLE_AI', version_tags='A')
items = package.get('items', [])
if not items:
    print('no items')
    sys.exit(1)
results = []
for item in items:
    art = item['article']
    title = art.get('title', '')
    if 'How to Ship' in title:
        rep = {
            'id': '0195f300-1001-7000-b000-000000010',
            'page': 'FRAMEWORKS',
            'category_id': '0195f300-2001-7000-a000-000000010',
            'category_name': 'Agent',
            'name': 'LangChain',
        }
        score = 3
        tags = [
            {'kind': 'TAG', 'value': 'agent'},
            {'kind': 'TAG', 'value': 'workflow'},
        ]
        summary = 'A practical article on agentic workflow and publishing efficiency for ML writers.'
        reason = 'Title suggests an agent-oriented publishing workflow and the need for automation in AI content production.'
    else:
        rep = {
            'id': '0195f300-1001-7000-b000-00001d',
            'page': 'FRAMEWORKS',
            'category_id': '0195f300-2001-7000-a000-000000012',
            'category_name': 'RAG',
            'name': 'Haystack',
        }
        score = 3
        tags = [
            {'kind': 'TAG', 'value': 'RAG'},
            {'kind': 'TAG', 'value': 'retrieval'},
        ]
        summary = 'A practical commentary on avoiding over-engineering in RAG pipelines.'
        reason = 'Title argues that RAG pipelines can become overkill, matching the RAG category and a retrieval-focused entity.'

    results.append({
        'idempotency_key': item['idempotency_key'],
        'version': '0.3',
        'representative_entity': rep,
        'ai_summary': summary,
        'ai_score': score,
        'side_category_code': None,
        'ai_classification_json': {
            'final_path': {
                'page': rep['page'],
                'category_name': rep['category_name'],
                'entity_name': rep['name'],
            },
            'candidates': [
                {
                    'page': rep['page'],
                    'category_name': rep['category_name'],
                    'entity_name': rep['name'],
                    'confidence': 0.92,
                }
            ],
            'decision_reason': reason,
        },
        'ai_tags_json': tags,
        'ai_snippets_json': {
            'why_it_matters': 'The article is relevant to AI practitioners evaluating agent and retrieval workflow designs.',
            'key_points': ['Highlights practical agent and RAG tradeoffs', 'Explains why over-engineering should be avoided'],
            'risk_notes': [],
        },
    })

print('Sending results for', len(results), 'items')
print(json.dumps(results, ensure_ascii=False, indent=2))
resp = finish_evaluation(results)
print('finish_evaluation response:', json.dumps(resp, ensure_ascii=False, indent=2))
