"""
API Crawler Configuration
"""

# Hacker News API
HACKERNEWS_API = "https://hacker-news.firebaseio.com/v0"
# Dev.to API
DEVTO_API = "https://dev.to/api/articles"

# Keywords/Tags for filtering
KEYWORDS_CONFIG = {
    "HackerNews": ["AI agent", "MCP", "LLM", "Claude", "OpenAI", "Gemini", "Model Context Protocol"],
    "DevTo": ["ai", "agents", "llm", "machinelearning", "mcp", "business", "use-case"]
}

# Category Keywords for tagging/classification (if needed)
CATEGORY_KEYWORDS = {
    "Agent": ["agent", "autonomous", "agentic", "multi-agent"],
    "MCP": ["mcp", "model context protocol", "context protocol"],
    "Prompt": ["prompt", "prompting", "prompt engineering"],
    "Business": ["business case", "roi", "revenue", "monetization"],
    "Use Case": ["use case", "application", "implementation", "tutorial"],
}
