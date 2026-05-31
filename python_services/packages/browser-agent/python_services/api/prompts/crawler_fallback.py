FALLBACK_PROMPT_NAME = "crawler_fallback_v1"
FALLBACK_PROMPT_VERSION = "1.0"

CRAWLER_FALLBACK_PROMPT = """
Navigate to {url} and extract all visible article or post content from the page.
For each article, post, or item visible on the page, extract these fields:
- title: the article headline or title text
- body: the main body text content (extract as much as available)
- published_at: the publication date/time (ISO 8601 format if possible)
- author: the author name (empty string if not shown)
- url: the direct URL to the article (use the page URL if individual URLs are not shown)
- canonical_url: same as url if no separate canonical is shown
Return ONLY a JSON array with no other text:
[{"title": "...", "body": "...", "published_at": "...", "author": "...", "url": "...", "canonical_url": "..."}]
If no articles are found, return an empty array: []
""".strip()
