"""
RSS Feed Configuration

This module defines all RSS feeds to be monitored by the news pulling system.
Using Python with TypedDict for type safety and IDE support.

To add a new feed:
1. Add feed name constant to FeedNames class
2. Add feed configuration to RSS_FEEDS list using the constant
3. Add prompt mapping in llm_prompts.py using the same constant
4. Set enabled=True to activate

Changes take effect on next DAG run.
"""

from typing import TypedDict, List, Dict
from notion_client import Client
from dotenv import load_dotenv
from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent
ENV_PATH = BASE_DIR / "token.env"

load_dotenv(ENV_PATH)

class FeedNames:
    """
    RSS Feed name constants

    Use these constants in both RSS_FEEDS and llm_prompts.py
    to prevent typos and maintain consistency.

    When adding a new feed:
    1. Add constant here
    2. Use it in RSS_FEEDS below
    3. Use it in llm_prompts.RSS_FEED_PROMPTS
    """
    REDDIT_ML = "Reddit MachineLearning Feed"
    NEWSLETTER_ELVIS = "AI Newsletter - elvis saravia"


class RSSFeed(TypedDict):
    """
    RSS Feed configuration structure

    Attributes:
        name: Display name for the RSS feed
        url: RSS feed URL
        enabled: Whether to fetch this feed (default: True)
        count: Number of articles to fetch per run (default: 3)
    """
    name: str
    url: str
    enabled: bool
    count: int


# RSS Feed List
# Add new feeds here following the RSSFeed structure
# IMPORTANT: Use FeedNames constants for the "name" field
# RSS_FEEDS: List[RSSFeed] = [
#     {
#         "name": FeedNames.REDDIT_ML,
#         "url": "https://www.reddit.com/r/machinelearningnews/.rss",
#         "enabled": True,
#         "count": 3,
#     },
#     {
#         "name": FeedNames.NEWSLETTER_ELVIS,
#         "url": "https://nlp.elvissaravia.com/feed",
#         "enabled": True,
#         "count": 3,
#     },
#     # Add more feeds here:
#     # {
#     #     "name": FeedNames.YOUR_FEED,  # Add constant to FeedNames first
#     #     "url": "https://example.com/feed.rss",
#     #     "enabled": True,
#     #     "count": 3,
#     # },
# ]

RSSFeed = Dict[str, object]

def fetch_rss_feeds_from_notion(database_id: str, notion_token: str) -> List[RSSFeed]:
    import requests

    results = []
    has_more = True
    start_cursor = None
    url = f"https://api.notion.com/v1/databases/{database_id}/query"
    headers = {
        "Authorization": f"Bearer {notion_token}",
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
    }

    while has_more:
        body = {"page_size": 100}
        if start_cursor:
            body["start_cursor"] = start_cursor

        response = requests.post(url, headers=headers, json=body)
        response.raise_for_status()
        data = response.json()

        for page in data["results"]:
            props = page.get("properties", {})

            name = ""
            name_prop = props.get("Website Name", {})
            if name_prop.get("type") == "title":
                title_arr = name_prop.get("title", [])
                if title_arr:
                    name = title_arr[0].get("plain_text", "")

            url_val = ""
            url_prop = props.get("Substack", {})
            if url_prop.get("type") == "url":
                url_val = url_prop.get("url", "") or ""

            if not name or not url_val:
                continue

            # /feed 없으면 추가
            normalized = url_val.rstrip("/").rstrip("?")
            if "/feed" not in normalized:
                normalized += "/feed"

            cherry_category = []
            cherry_category_prop = props.get("Cherry Category", {})
            if cherry_category_prop.get("type") == "multi_select":
                items = cherry_category_prop.get("multi_select", [])
                if items:
                    cherry_category = items[0].get("name", "")  # 첫 번째 값만

            results.append({
                "name": name,
                "url": normalized,
                "enabled": True,
                "count": 3,
                "cherry_category": cherry_category,
            })

        has_more = data.get("has_more", False)
        start_cursor = data.get("next_cursor")

    return results

def get_enabled_feeds() -> List[RSSFeed]:
    """
    Get list of enabled RSS feeds

    Returns:
        List of enabled RSS feeds
    """
    RSS_FEEDS = fetch_rss_feeds_from_notion(
        database_id="342f199edf7c80658798d3e58ee2270b",
        notion_token= os.environ["NOTION_TOKEN"]
    )

    # return [feed for feed in RSS_FEEDS if feed.get("enabled", True)]
    return RSS_FEEDS

print(get_enabled_feeds())

# def get_all_feeds() -> List[RSSFeed]:
#     """
#     Get all RSS feeds (including disabled ones)

#     Returns:
#         List of all RSS feeds
#     """
#     return RSS_FEEDS
