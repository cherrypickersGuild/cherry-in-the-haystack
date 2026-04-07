import os
import re
import time
import copy
import traceback
from operator import itemgetter
from datetime import datetime
from typing import Dict, List, Optional
from abc import ABC, abstractmethod

from pydantic import BaseModel, ConfigDict, Field

from notion import NotionAgent
from llm_agent import LLMAgentSummary
import utils
from ops_base import OperatorBase
from db_cli import DBClient
from ops_milvus import OperatorMilvus
from ops_notion import OperatorNotion

import requests
from bs4 import BeautifulSoup, Tag

ALL_SECTION_TITLE_PREFIXES = [
    "PROMPT STATION",
    "FRIDAY FUN",
    "IN THE KNOW",
    "FROM THE FRONTIER",
    "TODAY IN AI",
    "PRODUCTIVITY",
    "PRESENTED BY",
    "THE AI ACADEMY",
    "GROW WITH US",
    "SPONSORED BY",
]
TO_PARSE_SECTION_TITLES = [
    "IN THE KNOW",
    "FROM THE FRONTIER",
    "TODAY IN AI",
    "PRODUCTIVITY",
    "THE AI ACADEMY",
]


class BlogSubItem(BaseModel):
    """Model for a sub-item within a section (e.g., numbered items in TODAY IN AI)"""

    index: int = Field(..., description="Index of the sub-item (1, 2, 3, ...)")
    content: str = Field(..., description="Content of the sub-item")


class BlogSectionInfo(BaseModel):
    """Model for a section info"""

    model_config = ConfigDict(arbitrary_types_allowed=True)

    tags: List[Tag] = Field(..., description="Tags of the section")
    section_subtitle: str = Field(..., description="Subtitle of the section")


class BlogSection(BaseModel):
    """Model for a single blog section"""

    section_title: str = Field(
        ..., description="Title of the section (e.g., 'IN THE KNOW')"
    )
    section_subtitle: str = Field(..., description="Subtitle of the section")
    content: str = Field(..., description="Full content of the section")
    sub_items: List[BlogSubItem] = Field(
        default_factory=list,
        description="Optional sub-items (for sections with numbered lists)",
    )


class BlogPost(BaseModel):
    """Model for a parsed blog post with multiple sections"""

    post_title: str = Field(..., description="Main title of the blog post")
    post_url: str = Field(..., description="URL of the blog post")
    published: str = Field(..., description="ISO format publication date")
    published_key: str = Field(..., description="YYYY-MM-DD format date for grouping")
    sections: List[BlogSection] = Field(
        default_factory=list, description="List of sections in the post"
    )


def get_text_with_links(element: Tag, separator: str = "\n") -> str:
    """
    Extract text from HTML element, converting links to markdown format

    @param element: BeautifulSoup Tag element
    @param separator: String to join text segments (default: newline)
    @return: Text with markdown-formatted links [text](url)
    """
    parts = []

    # Process all direct children and their descendants
    for child in element.children:
        if isinstance(child, str):
            # Direct text node
            text = child.strip()
            if text:
                parts.append(text)
        elif hasattr(child, "name"):
            # Element node - recursively process
            part_text = _process_element_for_markdown(child)
            if part_text:
                parts.append(part_text)

    return separator.join(parts)


def _process_element_for_markdown(element: Tag) -> str:
    """
    Recursively process element and convert to markdown

    @param element: BeautifulSoup Tag element
    @return: Text with markdown-formatted links
    """
    # Skip style and script tags
    if element.name in ["style", "script"]:
        return ""

    if element.name == "a":
        # Link element - convert to markdown
        text = element.get_text(strip=True)
        href = element.get("href", "")
        if text and href:
            return f"[{text}]({href})"
        else:
            return text
    else:
        # Other element - recursively process children
        parts = []
        for child in element.children:
            if isinstance(child, str):
                text = child.strip()
                if text:
                    parts.append(text)
            elif hasattr(child, "name"):
                child_text = _process_element_for_markdown(child)
                if child_text:
                    parts.append(child_text)
        return " ".join(parts)


class SectionParser(ABC):
    """Abstract base class for section-specific parsers"""

    @abstractmethod
    def parse(
        self,
        soup: BeautifulSoup,
        section_title: str,
        section_subtitle: str,
        content_divs: List[Tag],
    ) -> BlogSection:
        """
        Parse content divs for a specific section

        @param soup: BeautifulSoup object of the entire page
        @param section_title: Title of the section
        @param content_divs: List of content div tags for this section
        @return: BlogSection with parsed content
        """
        pass


class DefaultSectionParser(SectionParser):
    """Default parser for sections without special handling"""

    def parse(
        self,
        soup: BeautifulSoup,
        section_title: str,
        section_subtitle: str,
        content_divs: List[Tag],
    ) -> BlogSection:
        """
        Parse content using default logic

        Uses get_text_with_links to preserve links as markdown [text](url)
        """
        # Use get_text_with_links to preserve links as markdown
        content = "\n\n".join(
            [get_text_with_links(div, separator="\n") for div in content_divs]
        )

        # Remove section title if it appears at the beginning
        lines = content.split("\n")
        cleaned_lines = []

        for line in lines:
            stripped = line.strip()
            # Skip section title line
            if stripped.upper() == section_title.upper():
                continue
            # Skip empty lines at the start
            if not stripped and not cleaned_lines:
                continue
            cleaned_lines.append(stripped)

        cleaned_content = "\n".join(cleaned_lines)

        return BlogSection(
            section_title=section_title,
            section_subtitle=section_subtitle,
            content=cleaned_content,
            sub_items=[],
        )


class TodayInAIParser(SectionParser):
    """Specialized parser for TODAY IN AI section that extracts numbered items"""

    def parse(
        self,
        soup: BeautifulSoup,
        section_title: str,
        section_subtitle: str,
        content_divs: List[Tag],
    ) -> BlogSection:
        """Parse TODAY IN AI section and extract numbered items"""
        # Get full text from all content divs with markdown links
        full_text = "\n\n".join(
            [get_text_with_links(div, separator="\n") for div in content_divs]
        )

        # Remove image captions (text starting with "Click to see" or "Source:")
        # These are typically on the first line before numbered items
        lines = full_text.split("\n")
        cleaned_lines = []

        for line in lines:
            line_stripped = line.strip()
            # Skip image caption lines
            if (
                line_stripped.startswith("Click to ")
                or line_stripped.startswith("Source:")
                or (len(line_stripped) < 100 and "Source:" in line_stripped)
            ):
                continue
            cleaned_lines.append(line)

        cleaned_text = "\n".join(cleaned_lines)

        # Extract numbered items (1. 2. 3. etc.)
        numbered_pattern = re.compile(
            r"^(\d+)\.\s+(.+?)(?=^\d+\.\s+|\Z)", re.MULTILINE | re.DOTALL
        )
        matches = numbered_pattern.findall(cleaned_text)

        sub_items = []
        for index_str, content in matches:
            index = int(index_str)
            # Clean up the content (normalize whitespace but preserve markdown links)
            cleaned_content = re.sub(r"\s+", " ", content.strip())
            sub_items.append(BlogSubItem(index=index, content=cleaned_content))

        return BlogSection(
            section_title=section_title,
            section_subtitle=section_subtitle,
            content=cleaned_text,
            sub_items=sub_items,
        )


class ProductivityParser(SectionParser):
    """Specialized parser for PRODUCTIVITY section that extracts tool entries"""

    def parse(
        self,
        soup: BeautifulSoup,
        section_title: str,
        section_subtitle: str,
        content_divs: List[Tag],
    ) -> BlogSection:
        """
        Parse PRODUCTIVITY section and extract individual tool entries

        Strategy: Merge multi-line tool entries, then split by colon
        - Tool entries span multiple lines: emoji line + name line + description line
        - More robust than emoji-only matching
        - Stops at PROMPT STATION or other section markers
        """
        # Get full text from all content divs with markdown links
        full_text = "\n\n".join(
            [get_text_with_links(div, separator="\n") for div in content_divs]
        )

        lines = full_text.split("\n")

        # First pass: collect relevant lines and merge multi-line entries
        merged_lines = []
        current_entry = []

        for line in lines:
            stripped = line.strip()

            # Skip empty lines
            if not stripped:
                continue

            # Skip section title line first (before checking section markers)
            if stripped.upper() == section_title.upper():
                continue

            # Stop at other section markers (but not the current section title)
            if any(
                stripped.upper().startswith(prefix.upper())
                for prefix in ALL_SECTION_TITLE_PREFIXES
            ):
                print(f"[ProductivityParser] Stopping at section marker: {stripped}")
                # Save current entry if exists
                if current_entry:
                    merged_lines.append(" ".join(current_entry))
                break

            # Skip header lines like "5 New & Trending AI Tools"
            if re.match(r"^\d+\s+(New|Trending|AI Tools)", stripped, re.IGNORECASE):
                continue
            if re.match(r"^(New & Trending|AI Tools)", stripped, re.IGNORECASE):
                continue

            # Skip footer lines like "* indicates a promoted tool"
            if re.match(r"^\*\s*indicates", stripped, re.IGNORECASE):
                continue

            # Skip emoji-only lines (these are part of tool entries)
            if re.fullmatch(
                r"[\U0001F300-\U0001F9FF\U0001F600-\U0001F64F\U0001F680-\U0001F6FF\U00002600-\U000027BF\U0001F900-\U0001F9FF\U0001F1E0-\U0001F1FF\uFE0F\u200D\s]+",
                stripped,
            ):
                continue

            # If line has colon, it's likely the description part
            if ":" in stripped:
                # Merge with accumulated parts
                current_entry.append(stripped)
                merged_lines.append(" ".join(current_entry))
                current_entry = []
            else:
                # This is likely a tool name, accumulate it
                current_entry.append(stripped)

        # Extract tool entries from merged lines
        sub_items = []
        for index, line in enumerate(merged_lines, start=1):
            # Split by first colon
            parts = line.split(":", 1)
            if len(parts) != 2:
                continue

            name_part = parts[0].strip()
            desc_part = parts[1].strip()

            # Create content as "Tool Name: Description"
            full_content = f"{name_part}: {desc_part}"

            sub_items.append(BlogSubItem(index=index, content=full_content))

        # Create cleaned content (join merged lines)
        cleaned_text = "\n".join(merged_lines)

        return BlogSection(
            section_title=section_title,
            section_subtitle=section_subtitle,
            content=cleaned_text,
            sub_items=sub_items,
        )


class OperatorCrawlBlogSuperhuman(OperatorBase):
    """
    An Operator to crawl Zain Kahn's blog posts.
    - URL: https://www.superhuman.ai/
    - pulling data from source
    - save to local json
    - restore from local json
    - dedup
    - summarization
    - ranking
    - publish
    """

    def __init__(self):
        super().__init__()

        # Parser registry: maps section titles to their specialized parsers
        self.section_parsers: Dict[str, SectionParser] = {
            "TODAY IN AI": TodayInAIParser(),
            "PRODUCTIVITY": ProductivityParser(),
        }

        # Default parser for sections without specialized handling
        self.default_parser = DefaultSectionParser()

    def _get_parser_for_section(self, section_title: str) -> SectionParser:
        """Get the appropriate parser for a section, or default if not found"""
        return self.section_parsers.get(section_title, self.default_parser)

    def _fetch_html(self, url):
        """
        Fetch HTML from URL and parse it with BeautifulSoup

        @param url: URL to fetch
        @return: BeautifulSoup object
        """
        print(f"[fetch_html] Fetching URL: {url}")

        try:
            # Set headers to mimic a browser request
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            }

            response = requests.get(url, headers=headers, timeout=30)
            response.raise_for_status()  # Raise an exception for bad status codes

            # Parse HTML with BeautifulSoup
            soup = BeautifulSoup(response.content, "html.parser")

            print(f"[fetch_html] Successfully fetched and parsed HTML")
            print(
                f"[fetch_html] HTML title: {soup.title.string if soup.title else 'No title'}"
            )
            print(f"[fetch_html] HTML length: {len(response.content)} bytes")

            return soup

        except requests.exceptions.RequestException as e:
            print(f"[ERROR] Failed to fetch URL: {url}, error: {e}")
            return None

    def _extract_section_content_divs(
        self, soup, section_title
    ) -> Optional[BlogSectionInfo]:
        """
        Extract content divs from a specific section (like "IN THE KNOW") using DOM structure

        @param soup: BeautifulSoup object
        @param section_title: Section title to find (e.g., "IN THE KNOW")
        @return: List of content div tags or None
        """
        print(f"[extract_section_content_divs] Extracting: {section_title}")

        # Strategy 1: Find h5 tag directly with exact match
        h5_tag = None
        all_h5 = soup.find_all("h5")
        for h5 in all_h5:
            if h5.get_text(strip=True).upper() == section_title.upper():
                h5_tag = h5
                break

        # Strategy 2: Fallback to regex search within h5 tags
        if not h5_tag:
            for h5 in all_h5:
                if re.search(section_title, h5.get_text(strip=True), re.IGNORECASE):
                    h5_tag = h5
                    break

        # Strategy 3: Original method - find by string and traverse up
        if not h5_tag:
            search_result = soup.find(string=re.compile(section_title, re.IGNORECASE))
            if search_result:
                h5_tag = search_result.find_parent("h5")

        if not h5_tag:
            print(f"[extract_section_content_divs] Section '{section_title}' not found")
            return None

        # Navigate to h5.parent.parent (the container for this section's title)
        level1 = h5_tag.parent  # div wrapping h5
        level2 = level1.parent if level1 else None  # div wrapping that div

        if not level2:
            print(f"[extract_section_content_divs] Cannot reach h5.parent.parent")
            return None

        # Get all next siblings - content is in these siblings
        content_divs = []
        current = level2

        # First, check if level2 itself contains content after the h5 (for sections like PRODUCTIVITY)
        # where content is in the same div as the h5 title
        level2_text_after_h5 = []
        level2_h2_subtitles = []  # h2 태그 소제목 저장
        found_h5 = False
        for child in level2.descendants:
            if child == h5_tag:
                found_h5 = True
                continue
            if found_h5:
                # Find h2 subtitles
                if hasattr(child, "name") and child.name == "h2":
                    h2_text = child.get_text(strip=True)
                    if h2_text:
                        level2_h2_subtitles.append(h2_text)
                # Collect text nodes
                elif isinstance(child, str) and child.strip():
                    level2_text_after_h5.append(child.strip())

        print(
            f"[extract_section_content_divs] Found h2 subtitles: {level2_h2_subtitles}"
        )
        section_subtitle = (
            level2_h2_subtitles[0] if level2_h2_subtitles else "Superhuman Blog"
        )

        # If there's significant content in level2 after h5, include level2 itself
        combined_text = " ".join(level2_text_after_h5)
        if len(combined_text) > 50:  # Threshold for meaningful content
            print(
                f"[extract_section_content_divs] Found content in same div as h5 ({len(combined_text)} chars)"
            )
            content_divs.append(level2)

        # Then check next siblings
        while current:
            current = current.find_next_sibling()
            if not current or not hasattr(current, "name") or not current.name:
                break

            # Check if this sibling contains the next section (h5 tag)
            # If so, we've reached the end of current section
            next_h5 = current.find("h5")
            if next_h5:
                # Special case: if current sibling has content before the next h5,
                # we should still include it (happens when multiple sections share a container)
                # For now, just stop at next h5
                break

            # This is content for our section (store the Tag, not text)
            content_divs.append(current)

            # Usually 1-2 content divs per section
            if len(content_divs) >= 3:  # Increased from 2 to 3 to be safe
                break

        if content_divs:
            total_chars = sum(len(div.get_text(strip=True)) for div in content_divs)
            print(
                f"[extract_section_content_divs] Extracted {len(content_divs)} content divs, {total_chars} chars"
            )
            return BlogSectionInfo(
                tags=content_divs,
                section_subtitle=section_subtitle,
            )

        print(f"[extract_section_content_divs] No content found for '{section_title}'")
        return None

    def _parse_blog_post(self, url, sections_to_extract=None) -> Optional[BlogPost]:
        """
        Parse a blog post and extract content from specified sections using specialized parsers

        @param url: URL of the blog post
        @param sections_to_extract: List of section titles to extract (default: TO_PARSE_SECTION_TITLES)
        @return: BlogPost model with sections (including sub-items for applicable sections)
        """
        if sections_to_extract is None:
            sections_to_extract = TO_PARSE_SECTION_TITLES

        print(f"[parse_blog_post] Parsing: {url}")

        soup = self._fetch_html(url)
        if not soup:
            return None

        # Extract sections using appropriate parsers
        sections = []
        for section_title in sections_to_extract:
            section_info = self._extract_section_content_divs(soup, section_title)
            content_divs = section_info.tags
            section_subtitle = section_info.section_subtitle
            if content_divs:
                # Get the appropriate parser for this section
                parser = self._get_parser_for_section(section_title)

                # Parse the section using the specialized parser
                blog_section = parser.parse(
                    soup, section_title, section_subtitle, content_divs
                )
                sections.append(blog_section)

                # Log if sub-items were found
                if blog_section.sub_items:
                    print(
                        f"[parse_blog_post] Section '{section_title}' has {len(blog_section.sub_items)} sub-items"
                    )

        # Extract publication date
        created_at = soup.find(
            "span", string=re.compile(r"([A-Z]?[a-z]+)\s\d{2},\s\d{4}")
        ).get_text(strip=True)
        date_time = datetime.strptime(created_at, "%B %d, %Y")  # e.g. November 22, 2025
        published = date_time.isoformat()
        published_key = date_time.strftime(
            "%Y-%m-%d"
        )  # YYYY-MM-DD (same as ops_rss.py published_key)

        # Get post title
        post_title = soup.title.string if soup.title else "No title"

        return BlogPost(
            post_title=post_title,
            post_url=url,
            published=published,
            published_key=published_key,
            sections=sections,
        )

    def pull(self):
        """
        Pull Superhuman Blog Posts
        Each section within a post becomes a separate article
        Sections with sub-items (e.g., TODAY IN AI) are further split into individual articles per sub-item

        @return pages <id, page>
        """
        print("#####################################################")
        print("# Pulling Superhuman Blog Posts")
        print("#####################################################")

        base_url = "https://www.superhuman.ai"

        # 1. Get blog post links from main page
        main_page = self._fetch_html(base_url)

        # 2. Get content from latest blog posts
        post_links = main_page.find_all("a", href=re.compile(r"/p/"))
        valid_links = []
        for link in post_links:
            href = link.get("href", "")
            if href:
                valid_links.append(base_url + href)

        # 3. Get content from latest blog posts and create individual articles
        articles: List[dict] = []
        post_count = min(3, len(valid_links))

        for link in valid_links[:post_count]:
            blog_post = self._parse_blog_post(
                url=link, sections_to_extract=TO_PARSE_SECTION_TITLES
            )

            if not blog_post:
                print(f"[WARNING] Failed to parse blog post: {link}")
                continue

            # Process each section
            for section in blog_post.sections:
                # If section has sub-items, create individual articles for each sub-item
                if section.sub_items:
                    print(
                        f"[INFO] Section '{section.section_title}' (subtitle: {section.section_subtitle}) has {len(section.sub_items)} sub-items, creating individual articles"
                    )

                    for sub_item in section.sub_items:
                        # Create unique hash key including sub-item index
                        hash_key = f"Superhuman Blog_{blog_post.post_title}_{section.section_title}_#{sub_item.index}_{link}".encode(
                            "utf-8"
                        )

                        # Create title with sub-item index
                        article_title = f"{section.section_title} - {section.section_subtitle} #{sub_item.index}"

                        article = {
                            "id": utils.hashcode_md5(hash_key),
                            "source": "Superhuman Blog",
                            "list_name": "Superhuman Blog",
                            "post_title": blog_post.post_title,  # Original post title
                            "section_title": section.section_title,  # Section title
                            "sub_item_index": sub_item.index,  # Sub-item index
                            "title": article_title,  # Combined title with sub-item index
                            "url": link,
                            "created_time": blog_post.published,
                            "summary": sub_item.content,  # Sub-item content (will be summarized later)
                            "content": sub_item.content,  # Sub-item content only
                            "tags": [],  # TODO: currently no tags
                            "published": blog_post.published,
                            "published_key": blog_post.published_key,
                        }
                        articles.append(article)
                        print(f"[INFO] Created sub-item article: {article_title}")

                else:
                    # No sub-items: create article for the whole section
                    hash_key = f"Superhuman Blog_{blog_post.post_title}_{section.section_title}_{link}".encode(
                        "utf-8"
                    )
                    article_title = (
                        f"{section.section_title} - {section.section_subtitle}"
                    )

                    article = {
                        "id": utils.hashcode_md5(hash_key),
                        "source": "Superhuman Blog",
                        "list_name": "Superhuman Blog",
                        "post_title": blog_post.post_title,  # Original post title
                        "section_title": section.section_title,  # Section title
                        "title": article_title,  # Combined title for display
                        "url": link,
                        "created_time": blog_post.published,
                        "summary": section.content,  # Section content (will be summarized later)
                        "content": section.content,  # Section content
                        "tags": [],  # TODO: currently no tags
                        "published": blog_post.published,
                        "published_key": blog_post.published_key,
                    }
                    articles.append(article)
                    print(f"[INFO] Created article: {article_title}")

        pages: Dict[str, dict] = {}
        for article in articles:
            page_id = article["id"]
            pages[page_id] = article

        print(f"[INFO] Total articles created: {len(pages)}")
        return pages

    def dedup(self, extractedPages, target="inbox"):
        print("#####################################################")
        print("# Dedup CrawlBlogSuperhuman")
        print("#####################################################")
        print(f"Number of pages: {len(extractedPages)}")

        client = DBClient()
        deduped_pages = []

        for page_id, page in extractedPages.items():
            title = page["title"]
            list_name = page["list_name"]
            created_time = page["created_time"]

            print(
                f"Dedupping page, title: {title}, list_name: {list_name}, created_time: {created_time}, page_id: {page_id}"
            )

            if not client.get_notion_toread_item_id(
                "superhuman_blog", list_name, page_id
            ):
                deduped_pages.append(page)
                print(
                    f" - No duplicate Superhuman Blog article found, move to next. title: {title}, page_id: {page_id}"
                )

        return deduped_pages

    def filter(self, pages, **kwargs):
        print("#####################################################")
        print("# Filter CrawlBlogSuperhuman (After Scoring)")
        print("#####################################################")
        k = kwargs.setdefault("k", 3)
        min_score = kwargs.setdefault("min_score", 4)
        print(f"k: {k}, input size: {len(pages)}, min_score: {min_score}")

        # 1. filter all score >= min_score
        filtered1 = []
        for page in pages:
            relevant_score = page["__relevant_score"]

            if relevant_score < 0 or relevant_score >= min_score:
                filtered1.append(page)

        # 2. get top k
        tops = sorted(
            filtered1, key=lambda page: page["__relevant_score"], reverse=True
        )
        print(f"After sorting: {tops}")

        filtered2 = []
        for i in range(min(k, len(tops))):
            filtered2.append(tops[i])

        print(f"Filter output size: {len(filtered2)}")
        return filtered2

    def score(self, data, **kwargs):
        print("#####################################################")
        print("# Scoring CrawlBlogSuperhuman")
        print("#####################################################")
        start_date = kwargs.setdefault("start_date", "")
        max_distance = kwargs.setdefault("max_distance", 0.45)
        print(f"start_date: {start_date}, max_distance: {max_distance}")

        op_milvus = OperatorMilvus()
        client = DBClient()

        scored_list = []

        for page in data:
            try:
                title = page["title"]

                # Get a summary text (at most 1024 chars)
                score_text = (
                    f"{page['title']} - {page['list_name']} - {page['summary']}"
                )
                score_text = score_text[:1024]
                print(f"Scoring page: {title}, score_text: {score_text}")

                relevant_metas = op_milvus.get_relevant(
                    start_date,
                    score_text,
                    topk=2,
                    max_distance=max_distance,
                    db_client=client,
                )

                page_score = op_milvus.score(relevant_metas)

                scored_page = copy.deepcopy(page)
                scored_page["__relevant_score"] = page_score

                scored_list.append(scored_page)
                print(f"CrawlBlogSuperhuman article scored {page_score}")

            except Exception as e:
                print(f"[ERROR]: Score page failed, skip: {e}")
                traceback.print_exc()

        print(f"Scored_pages ({len(scored_list)}): {scored_list}")
        return scored_list

    def summarize(self, pages):
        print("#####################################################")
        print("# Summarize CrawlBlogSuperhuman Articles")
        print("#####################################################")
        SUMMARY_MAX_LENGTH = int(os.getenv("SUMMARY_MAX_LENGTH", 20000))
        print(f"Number of pages: {len(pages)}")
        print(f"Summary max length: {SUMMARY_MAX_LENGTH}")

        llm_agent = LLMAgentSummary()
        llm_agent.init_prompt()
        llm_agent.init_llm()

        client = DBClient()
        redis_key_expire_time = os.getenv("BOT_REDIS_KEY_EXPIRE_TIME", 604800)

        summarized_pages = []

        for page in pages:
            page_id = page["id"]
            title = page["title"]
            content = page["content"]
            list_name = page["list_name"]
            source_url = page["url"]
            print(f"Summarying page, title: {title}, list_name: {list_name}")
            # print(f"Page content ({len(content)} chars): {content}")

            st = time.time()

            llm_summary_resp = client.get_notion_summary_item_id(
                "superhuman_blog", list_name, page_id
            )

            if not llm_summary_resp:
                # Double check the content, if empty, load it from
                # the source url. For CrawlBlogSuperhuman, we will load content
                # from this entrypoint
                if not content:
                    # First, try to use CrawlBlogSuperhuman summary field if available
                    summary = page.get("summary", "")
                    if summary:
                        print(
                            "page content is empty, using CrawlBlogSuperhuman summary field"
                        )
                        content = summary
                    else:
                        print(
                            "page content is empty, fallback to load web page via WebBaseLoader"
                        )

                        try:
                            content = utils.load_web(source_url)
                            print(f"Page content ({len(content)} chars)")

                        except Exception as e:
                            print(
                                f"[ERROR] Exception occurred during utils.load_web(), source_url: {source_url}, {e}"
                            )

                        if not content:
                            print(
                                "[ERROR] Empty Web page loaded via WebBaseLoader, skip it"
                            )
                            continue

                content = content[:SUMMARY_MAX_LENGTH]
                summary = llm_agent.run(content)

                print(
                    f"Cache llm response for {redis_key_expire_time}s, page_id: {page_id}, summary: {summary}"
                )
                client.set_notion_summary_item_id(
                    "superhuman_blog",
                    list_name,
                    page_id,
                    summary,
                    expired_time=int(redis_key_expire_time),
                )

            else:
                print("Found llm summary from cache, decoding (utf-8) ...")
                summary = utils.bytes2str(llm_summary_resp)

            # assemble summary into page
            summarized_page = copy.deepcopy(page)
            summarized_page["__summary"] = summary

            print(
                f"Used {time.time() - st:.3f}s, Summarized page_id: {page_id}, summary: {summary}"
            )
            summarized_pages.append(summarized_page)

        return summarized_pages

    def _get_top_items(self, items: list, k):
        """
        items: [(name, score), ...]
        """
        tops = sorted(items, key=itemgetter(1), reverse=True)
        return tops[:k]

    def push(self, pages, targets, topk=3):
        print("#####################################################")
        print("# Push Crawl Blog Superhuman")
        print("#####################################################")
        print(f"Number of pages: {len(pages)}")
        print(f"Targets: {targets}")
        print(f"Top-K: {topk}")
        print(f"input data: {pages}")
        stat = {
            "total": 0,
            "error": 0,
        }

        for target in targets:
            print(f"Pushing data to target: {target} ...")

            if target == "notion":
                notion_api_key = os.getenv("NOTION_TOKEN")
                notion_agent = NotionAgent(notion_api_key)
                op_notion = OperatorNotion()

                # Get the latest toread database id from index db
                # db_index_id = op_notion.get_index_toread_dbid()

                # database_id = utils.get_notion_database_id_toread(
                #     notion_agent, db_index_id)
                database_id = "2a6f199edf7c809eac47c77106b34c38"

                print(f"Latest ToRead database id: {database_id}")

                if not database_id:
                    print("[ERROR] no index db pages found... skip")
                    break

                for page in pages:
                    stat["total"] += 1

                    try:
                        page_id = page["id"]
                        list_name = page["list_name"]
                        title = page["title"]
                        tags = page["tags"]

                        print(f"Pushing page, title: {title}")

                        topics_topk = [x["term"].replace(",", " ")[:20] for x in tags]
                        topics_topk = topics_topk[:topk]

                        categories_topk = []

                        # NOTE: using same structure as RSS (ops_rss.py)
                        notion_agent.createDatabaseItem_ToRead_RSS(
                            database_id, page, topics_topk, categories_topk
                        )

                        self.markVisited(
                            page_id, source="superhuman_blog", list_name=list_name
                        )

                    except Exception as e:
                        print(f"[ERROR]: Push to notion failed, skip: {e}")
                        stat["error"] += 1
                        traceback.print_exc()

            else:
                print(f"[ERROR]: Unknown target {target}, skip")

        return stat
