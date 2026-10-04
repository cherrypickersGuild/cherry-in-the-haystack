PROMPT_NAME = "CRAWLER_ANALYSIS"
PROMPT_VERSION = "1.2.0"

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
  "url_selector":     "<CSS selector targeting the article link <a> element>",
  "body_selector":    "<CSS selector for body/summary text shown ON THE LISTING page, or empty string>",
  "body_on_detail":   <true if the full body is only on the linked detail page, not the listing>,
  "detail_body_selector": "<CSS selector for the main body element ON THE DETAIL page, or empty string>",
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

url_selector
  The CSS selector for the <a> link that leads to the full article. Evaluated relative to
  each content_selector element. If the repeating item element IS the <a> itself (i.e.
  content_selector already targets an anchor), set url_selector to the SAME selector as
  content_selector — the executor will read the href from the item element directly.

body_selector
  The CSS selector for body/summary text VISIBLE ON THE LISTING page, relative to each
  content_selector element. Many listing pages (card grids, link lists) only show a title
  and NO body here — in that case return an empty string "" and set body_on_detail=true.
  Example: ".post-body", "p.summary", ".article-excerpt"

body_on_detail + detail_body_selector
  Judge this from the LISTING page only — do NOT navigate away or open articles.
  - If each listing item already shows the full body/summary text → body_on_detail=false,
    fill body_selector, leave detail_body_selector "".
  - If the listing only shows titles/links (card grids, headline lists) and the real
    article text clearly lives on each item's own page → set body_on_detail=true and leave
    detail_body_selector "" (the crawler extracts the detail-page body automatically).
    Optionally, if you already know the CMS and a reliable body container selector, you may
    provide detail_body_selector, but it is NOT required.

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
