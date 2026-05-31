PROMPT_NAME = "CRAWLER_ANALYSIS"
PROMPT_VERSION = "1.1.0"

# Instruct browser-use to navigate the target page and return a structured JSON
# object encoding all selectors and crawl4ai execution hints needed by /crawler/generate.
#
# The prompt is versioned (PROMPT_VERSION) so that any change here results in a new
# core.prompt_template_version row and the analysis record tracks which prompt produced it.
CRAWLER_ANALYSIS_PROMPT = """\
Navigate to {url} and thoroughly analyze the page structure for automated web crawling.

Return ONLY a valid JSON object — no markdown fences, no explanation, no preamble.
The JSON must contain exactly these fields:

{{
  "content_selector": "<CSS selector for each individual repeating article/post element in the list>",
  "title_selector":   "<CSS selector targeting individual article title elements>",
  "date_selector":    "<CSS selector targeting publication date elements>",
  "author_selector":  "<CSS selector targeting author name elements>",
  "url_selector":     "<CSS selector targeting the article link <a> elements>",
  "body_selector":    "<CSS selector targeting the article body/summary text within each item>",
  "pagination_type":  "<one of: none | click | scroll>",
  "dynamic_load":     <true if content loads asynchronously after DOM ready, else false>,
  "notes":            "<brief description of the page structure, notable quirks, or empty string>",
  "wait_for":         "<CSS or JS wait condition string, or null>",
  "js_code":          "<JS snippet string to execute post-load, or null>",
  "magic_mode":       <true if bot-detection is suspected, else false>
}}

Field guidance:

content_selector
  The CSS selector for each individual repeating article or post element (the repeated item,
  not the outer list wrapper). Used as crawl4ai's baseSelector.
  Example: ".post-list .post", "ul.articles li", "div[data-feed] article"

body_selector
  The CSS selector for the article body or summary text element, evaluated relative to each
  content_selector element. Use a child/descendant selector that targets only the text
  content, not the entire item.
  Example: ".post-body", "p.summary", ".article-excerpt"

pagination_type
  "none"   — single page, all content visible without interaction
  "click"  — a "Load more" or numbered pagination button must be clicked
  "scroll" — infinite scroll; new content appears as the user scrolls down

dynamic_load
  Set to true when articles are injected into the DOM via JavaScript after the initial
  HTML response (e.g., React/Vue rendered feeds, lazy-loaded content).

wait_for
  Only set when dynamic_load is true.
  Use a CSS selector string if waiting for a specific element to appear:
    "css:.article-card"
  Use a JS expression string if a custom condition is needed:
    "js:()=>document.querySelectorAll('.post').length > 0"
  Set to null when not needed.

js_code
  Only set when pagination_type is "scroll" or a JS interaction is required before
  content appears. Provide a self-contained JS snippet:
    "window.scrollTo(0, document.body.scrollHeight)"
  Set to null when not needed.

magic_mode
  Set to true if you observe any of: HTTP 403 response, empty page body, a Cloudflare
  challenge page, DataDome overlay, or any other anti-bot gate.
  When true, crawl4ai will activate stealth mode for this source.
"""
