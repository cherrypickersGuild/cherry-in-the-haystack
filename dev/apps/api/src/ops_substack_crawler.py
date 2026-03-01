import os
import time
import requests
from datetime import datetime
from typing import List, Dict
from bs4 import BeautifulSoup

from ops_base import OperatorBase
import utils
import llm_prompts
from llm_agent import LLMAgentSummary
from db_cli import DBClient


class OperatorSubstackCrawler(OperatorBase):
    """
    Substack crawler operator.

    Substack newsletters expose RSS feeds (e.g. https://<newsletter>.substack.com/feed)
    but RSS often only provides summaries. This crawler fetches full post content
    by scraping the post URL when RSS summary is insufficient.

    Supports two modes:
    1. RSS-enhanced: Uses RSS feed but fetches full content from post URL
    2. Web scrape: Directly crawls Substack post pages for full content
    """

    def __init__(self):
        super().__init__()
        self.client = DBClient()
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
        }

    def pull(self, feed_configs: list = None):
        """
        Pull articles from Substack newsletters.

        @param feed_configs: list of feed config dicts with source_type='substack'
                            Each has: name, url, count, config (optional)
        """
        print("######################################################")
        print("# Pulling from Substack Sources")
        print("######################################################")

        if not feed_configs:
            print("[WARN] No Substack feed configs provided")
            return []

        all_articles = []

        for feed in feed_configs:
            name = feed["name"]
            url = feed["url"]
            count = feed.get("count", 3)
            config = feed.get("config", {}) or {}

            print(f"Pulling Substack: {name}, url: {url}, count: {count}")

            try:
                articles = self._pull_substack_feed(name, url, count, config)
                all_articles.extend(articles)
            except Exception as e:
                print(f"[ERROR] Failed to pull Substack {name}: {e}")

        print(f"Total pulled from Substack sources: {len(all_articles)}")
        return all_articles

    def _pull_substack_feed(self, name: str, feed_url: str, count: int, config: dict) -> List[Dict]:
        """Pull from a single Substack newsletter using RSS + full content fetch."""
        import feedparser

        articles = []

        # Ensure the URL is an RSS feed
        if not feed_url.endswith("/feed"):
            feed_url = feed_url.rstrip("/") + "/feed"

        try:
            response = requests.get(feed_url, headers=self.headers, timeout=15)
            response.raise_for_status()
            feed = feedparser.parse(response.content)
        except Exception as e:
            print(f"[ERROR] Failed to fetch Substack RSS feed {name}: {e}")
            return []

        print(f"[Substack] {name}: {len(feed.entries)} entries found")

        for i, entry in enumerate(feed.entries):
            if i >= count:
                break

            title = entry.get("title", "")
            link = entry.get("link", "")
            published = entry.get("published", "")
            published_parsed = entry.get("published_parsed")

            # Parse publish time
            created_time = datetime.now().isoformat()
            published_key = created_time[:10]
            if published_parsed:
                from time import mktime
                dt = datetime.fromtimestamp(mktime(published_parsed))
                created_time = dt.isoformat()
                published_key = dt.strftime("%Y-%m-%d")

            # Generate hash key
            hash_key = f"substack_{name}_{title}_{published_key}".encode('utf-8')
            article_id = utils.hashcode_md5(hash_key)

            # Get RSS summary
            rss_summary = entry.get("summary", "")

            # Try to fetch full content from the post page
            full_content = ""
            if link:
                full_content = self._fetch_post_content(link)

            # Use the best available content
            content = full_content if full_content else rss_summary

            # Extract author
            author = ""
            if entry.get("authors"):
                author = entry["authors"][0].get("name", "")
            elif entry.get("author"):
                author = entry["author"]

            article = {
                "id": article_id,
                "source": "Substack",
                "list_name": name,
                "title": title,
                "url": link,
                "created_time": created_time,
                "summary": rss_summary,
                "content": content,
                "tags": [],
                "published": published,
                "published_key": published_key,
                "author": author,
            }

            articles.append(article)
            print(f"  -> [{i+1}/{count}] {title} (content: {len(content)} chars)")

            # Rate limiting
            time.sleep(0.5)

        return articles

    def _fetch_post_content(self, url: str) -> str:
        """Fetch full content from a Substack post URL."""
        try:
            response = requests.get(url, headers=self.headers, timeout=15)
            response.raise_for_status()

            soup = BeautifulSoup(response.text, 'html.parser')

            # Substack posts typically have content in .body or article
            content_div = (
                soup.find('div', class_='body')
                or soup.find('div', class_='post-content')
                or soup.find('article')
                or soup.find('div', class_='available-content')
            )

            if content_div:
                # Remove script/style tags
                for tag in content_div.find_all(['script', 'style', 'nav', 'footer']):
                    tag.decompose()

                text = content_div.get_text(separator='\n', strip=True)
                # Clean up excessive whitespace
                lines = [line.strip() for line in text.split('\n') if line.strip()]
                return '\n'.join(lines)

            return ""

        except Exception as e:
            print(f"[WARN] Failed to fetch Substack post content: {url}, error: {e}")
            return ""

    def dedup(self, extractedPages, target="inbox"):
        print("#####################################################")
        print("# Dedup Substack Pages")
        print("#####################################################")
        deduped_pages = []

        if isinstance(extractedPages, dict):
            iterator = extractedPages.values()
        else:
            iterator = extractedPages

        for page in iterator:
            page_id = page["id"]
            title = page["title"]
            list_name = page.get("list_name", "Substack")

            if not self.client.get_notion_toread_item_id("substack", list_name, page_id):
                deduped_pages.append(page)
            else:
                print(f" - Duplicate found, skipping: {title}")

        print(f"Deduped pages count: {len(deduped_pages)}")
        return deduped_pages

    def summarize(self, pages):
        """Summarize Substack articles using LLM."""
        print("######################################################")
        print("# Summarize Substack Articles")
        print("######################################################")

        llm_agent = LLMAgentSummary()
        prompt_tpl = llm_prompts.LLM_PROMPT_API_SUMMARY
        llm_agent.init_prompt(combine_prompt=prompt_tpl)
        llm_agent.init_llm()

        for page in pages:
            title = page["title"]
            page_id = page["id"]
            list_name = page.get("list_name", "Substack")

            print(f"Summarizing: {title}")

            # Check cache
            cached = self.client.get_notion_summary_item_id("substack", list_name, page_id)
            if cached:
                print(f"Cache hit for summary: {title}")
                page["__summary"] = utils.bytes2str(cached)
                continue

            content = page.get("content", "") or page.get("summary", "")
            if not content:
                print(f"[WARN] No content for: {title}")
                continue

            try:
                summary = llm_agent.run(content)
                self.client.set_notion_summary_item_id(
                    "substack", list_name, page_id, summary,
                    expired_time=60*60*24*14)  # 14 days
                page["__summary"] = summary
            except Exception as e:
                print(f"[ERROR] LLM Summary failed for {title}: {e}")

        return pages

    def score(self, data, **kwargs):
        # Pass-through for now (can integrate Milvus scoring later)
        return data

    def push(self, pages, targets, topk=3):
        """Push to Notion (and PostgreSQL via pipeline)."""
        print("#####################################################")
        print("# Push Substack Data")
        print("#####################################################")

        from notion import NotionAgent
        import traceback

        stat = {"total": 0, "error": 0}

        for target in targets:
            print(f"Pushing data to target: {target} ...")

            if target == "notion":
                notion_api_key = os.getenv("NOTION_TOKEN")
                notion_agent = NotionAgent(notion_api_key)

                database_id = os.getenv("NOTION_DATABASE_ID", "2a6f199edf7c809eac47c77106b34c38")
                print(f"Target Database ID: {database_id}")

                for page in pages:
                    stat["total"] += 1
                    try:
                        page_id = page["id"]
                        list_name = page.get("list_name", "Substack")
                        title = page["title"]

                        print(f"Pushing page: {title}")

                        tags = page.get("tags", [])
                        topics_topk = [str(t) for t in tags][:3]

                        notion_agent.createDatabaseItem_ToRead_RSS(
                            database_id,
                            page,
                            topics_topk,
                            []
                        )

                        self.client.set_notion_toread_item_id("substack", list_name, page_id)

                    except Exception as e:
                        print(f"[ERROR] Push failed for {title}: {e}")
                        stat["error"] += 1
                        traceback.print_exc()

        return stat
