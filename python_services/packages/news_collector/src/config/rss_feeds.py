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

from typing import TypedDict, List


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
RSS_FEEDS: List[RSSFeed] = [
    {
        "name": FeedNames.REDDIT_ML,
        "url": "https://www.reddit.com/r/machinelearningnews/.rss",
        "enabled": True,
        "count": 3,
    },
    {
        "name": FeedNames.NEWSLETTER_ELVIS,
        "url": "https://nlp.elvissaravia.com/feed",
        "enabled": True,
        "count": 3,
    },
    # Add more feeds here:
    # {
    #     "name": FeedNames.YOUR_FEED,  # Add constant to FeedNames first
    #     "url": "https://example.com/feed.rss",
    #     "enabled": True,
    #     "count": 3,
    # },
]


def get_enabled_feeds() -> List[RSSFeed]:
    """
    Get list of enabled RSS feeds

    Returns:
        List of enabled RSS feeds
    """
    return [feed for feed in RSS_FEEDS if feed.get("enabled", True)]


def get_all_feeds() -> List[RSSFeed]:
    """
    Get all RSS feeds (including disabled ones)

    Returns:
        List of all RSS feeds
    """
    return RSS_FEEDS
