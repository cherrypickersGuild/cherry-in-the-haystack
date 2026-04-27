import sys
from pathlib import Path
CODE_DIR = Path(__file__).resolve().parent
if str(CODE_DIR) not in sys.path:
    sys.path.insert(0, str(CODE_DIR))
from solteti_agent_api import ask_evaluation
from dotenv import load_dotenv
load_dotenv(CODE_DIR / '.env')
package = ask_evaluation(type_='ARTICLE_AI', version_tags='A')
print('items', len(package.get('items') or []))
for i, item in enumerate(package.get('items') or []):
    article = item.get('article', {})
    print('--- item', i)
    print('idempotency_key', item.get('idempotency_key'))
    print('title', article.get('title'))
    print('url', article.get('url'))
    print('len content_raw', len(str(article.get('content_raw') or '')))
    print('len content', len(str(article.get('content') or '')))
    print('published_at', article.get('published_at'))
    print('source_name', article.get('source_name'))
    print('source_type', article.get('source_type'))
    print('summary present', bool(article.get('summary')))
