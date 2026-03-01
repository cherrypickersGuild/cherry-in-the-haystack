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
    ETHAN_MOLLICK = "Ethan Mollick (AI & Education)"
    DEV_TO = "Dev.to (Engineering)"
    
    # New Feeds
    LATENT_SPACE = "Latent Space (Swyx)"
    THE_SEQUENCE = "The Sequence"
    AHEAD_OF_AI = "Ahead of AI (Sebastian Raschka)"
    BENS_BITES = "Ben's Bites"
    MIT_TECH_REVIEW = "MIT Technology Review"
    HBR_AI = "Harvard Business Review (AI)"
    OPENAI_BLOG = "OpenAI Blog"
    GOOGLE_AI_BLOG = "Google AI Blog"
    ANTHROPIC_NEWS = "Anthropic News"


class FeedCategories:
    """
    Categories for grouping feeds as per user requirement
    1. Prompt, Agent, MCP (Practical/Examples)
    2. Business Cases (ROI, Industry)
    3. Big Tech News
    4. Insights (General)
    """
    PRACTICAL = "practical"  # Prompt, Code, MCP, Agent
    BUSINESS = "business"    # Business Cases, Use Cases
    BIG_TECH = "big_tech"    # Big Tech Companies
    INSIGHTS = "insights"    # General Insights


class RSSFeed(TypedDict):
    """
    RSS Feed configuration structure

    Attributes:
        name: Display name for the RSS feed
        url: RSS feed URL
        category: Category for grouping (default: INSIGHTS if not specified)
        enabled: Whether to fetch this feed (default: True)
        count: Number of articles to fetch per run (default: 3)
    """
    name: str
    url: str
    category: str
    enabled: bool
    count: int


# RSS Feed List
# Add new feeds here following the RSSFeed structure
# IMPORTANT: Use FeedNames constants for the "name" field
RSS_FEEDS: List[RSSFeed] = [

    {
        "name": FeedNames.REDDIT_ML,
        "url": "https://www.reddit.com/r/machinelearningnews/.rss",
        "category": FeedCategories.INSIGHTS,
        "enabled": True,
        "count": 3,
    },
    {
        "name": FeedNames.NEWSLETTER_ELVIS,
        "url": "https://nlp.elvissaravia.com/feed",
        "category": FeedCategories.INSIGHTS,
        "enabled": True,
        "count": 3,
    },
    {
        "name": FeedNames.ETHAN_MOLLICK,
        "url": "https://www.oneusefulthing.org/feed",
        "category": FeedCategories.BUSINESS,
        "enabled": True,
        "count": 3,
    },

    # --- Category 1: Practical (Prompt, Agent, MCP) ---
    {
        "name": FeedNames.LATENT_SPACE,
        "url": "https://latent.space/feed",
        "category": FeedCategories.PRACTICAL,
        "enabled": True,
        "count": 3,
    },
    {
        "name": FeedNames.AHEAD_OF_AI,
        "url": "https://magazine.sebastianraschka.com/feed",
        "category": FeedCategories.PRACTICAL,
        "enabled": True,
        "count": 3,
    },
    {
        "name": FeedNames.ANTHROPIC_NEWS,
        "url": "https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_anthropic_news.xml", # Community feed
        "category": FeedCategories.PRACTICAL, # MCP source
        "enabled": True,
        "count": 3,
    },
    {
        "name": FeedNames.DEV_TO,
        "url": "https://dev.to/feed/tag/ai", # specific AI tag feed
        "category": FeedCategories.PRACTICAL,
        "enabled": True,
        "count": 5,
    },

    # --- Category 2: Business Cases ---
    {
        "name": FeedNames.HBR_AI,
        "url": "http://feeds.hbr.org/harvardbusiness", # General HBR, might need filtering later
        "category": FeedCategories.BUSINESS,
        "enabled": True,
        "count": 3,
    },
    {
        "name": FeedNames.THE_SEQUENCE,
        "url": "https://thesequence.substack.com/feed",
        "category": FeedCategories.BUSINESS, # Good for summary/business
        "enabled": True,
        "count": 3,
    },

    # --- Category 3: Big Tech News ---
    {
        "name": FeedNames.OPENAI_BLOG,
        "url": "https://openai.com/blog/rss.xml",
        "category": FeedCategories.BIG_TECH,
        "enabled": True,
        "count": 3,
    },
    {
        "name": FeedNames.GOOGLE_AI_BLOG,
        "url": "http://googleaiblog.blogspot.com/atom.xml",
        "category": FeedCategories.BIG_TECH,
        "enabled": True,
        "count": 3,
    },

    # --- Category 4: Insights (General) ---
    {
        "name": FeedNames.MIT_TECH_REVIEW,
        "url": "https://www.technologyreview.com/feed/",
        "category": FeedCategories.INSIGHTS,
        "enabled": True,
        "count": 3,
    },
    {
        "name": FeedNames.BENS_BITES,
        "url": "https://www.bensbites.com/feed",
        "category": FeedCategories.INSIGHTS,
        "enabled": True,
        "count": 3,
    }
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
