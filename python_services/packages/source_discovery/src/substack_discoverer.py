"""
Substack-specific source discovery with checkpointing support.
"""
import os
import re
import json
import time
from pathlib import Path
from datetime import datetime
from typing import Optional
from dataclasses import dataclass, field, asdict
import httpx
from bs4 import BeautifulSoup
import feedparser
import yaml
from notion_client import Client as NotionClient
from dotenv import load_dotenv

# Load .env from project root
_env_path = Path(__file__).parent.parent.parent.parent.parent / ".env"
if _env_path.exists():
    load_dotenv(_env_path)

CHECKPOINT_FILE = Path(__file__).parent.parent / ".discovery_checkpoint.json"
@dataclass
class SubstackCandidate:
    """A discovered Substack newsletter candidate."""
    name: str
    substack_url: str
    rss_url: str
    description: str = ""
    author: str = ""
    subscriber_count: Optional[int] = None
    post_count: int = 0
    recent_posts: list[dict] = field(default_factory=list)
    topics: list[str] = field(default_factory=list)
    category: str = ""  # PRD "Newly Discovered" category mapping
    auto_score: float = 0.0
    priority: str = "medium"
    reason: str = ""
    metadata: dict = field(default_factory=dict)
    @property
    def domain(self) -> str:
        """Extract substack domain from URL."""
        # https://author.substack.com -> author
        match = re.search(r'https?://([^.]+)\.substack\.com', self.substack_url)
        if match:
            return match.group(1)
        return ""

    def to_dict(self) -> dict:
        """Convert to dictionary for checkpointing."""
        return {
            "name": self.name,
            "substack_url": self.substack_url,
            "rss_url": self.rss_url,
            "description": self.description,
            "author": self.author,
            "subscriber_count": self.subscriber_count,
            "post_count": self.post_count,
            "recent_posts": self.recent_posts,
            "topics": self.topics,
            "category": self.category,
            "auto_score": self.auto_score,
            "priority": self.priority,
            "reason": self.reason,
            "metadata": self.metadata
        }


class DiscoveryCheckpoint:
    """Manages checkpoint state for resumable discovery."""

    def __init__(self, checkpoint_path: Path = CHECKPOINT_FILE):
        self.checkpoint_path = checkpoint_path
        self.checked_urls: set[str] = set()  # URLs already fetched
        self.completed_topics: list[str] = []  # Topics fully processed
        self.staged_urls: set[str] = set()  # URLs staged to Notion
        self.last_run: Optional[str] = None
        self.current_topic: Optional[str] = None
        self.pending_candidates: list[dict] = []  # Candidates found but not staged

    def load(self) -> bool:
        """Load checkpoint from file. Returns True if checkpoint exists."""
        if not self.checkpoint_path.exists():
            return False

        try:
            with open(self.checkpoint_path, "r") as f:
                data = json.load(f)

            self.checked_urls = set(data.get("checked_urls", []))
            self.completed_topics = data.get("completed_topics", [])
            self.staged_urls = set(data.get("staged_urls", []))
            self.last_run = data.get("last_run")
            self.current_topic = data.get("current_topic")
            self.pending_candidates = data.get("pending_candidates", [])

            print(f"[Checkpoint] Loaded: {len(self.checked_urls)} URLs checked, "
                  f"{len(self.completed_topics)} topics completed")
            return True
        except Exception as e:
            print(f"[Checkpoint] Error loading: {e}")
            return False

    def save(self) -> None:
        """Save checkpoint to file."""
        data = {
            "checked_urls": list(self.checked_urls),
            "completed_topics": self.completed_topics,
            "staged_urls": list(self.staged_urls),
            "last_run": datetime.now().isoformat(),
            "current_topic": self.current_topic,
            "pending_candidates": self.pending_candidates
        }

        try:
            with open(self.checkpoint_path, "w") as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            print(f"[Checkpoint] Error saving: {e}")

    def mark_url_checked(self, url: str) -> None:
        """Mark a URL as checked."""
        self.checked_urls.add(self._normalize_url(url))
        self.save()

    def mark_topic_completed(self, topic: str) -> None:
        """Mark a topic as completed."""
        if topic not in self.completed_topics:
            self.completed_topics.append(topic)
        self.current_topic = None
        self.save()

    def mark_url_staged(self, url: str) -> None:
        """Mark a URL as staged to Notion."""
        self.staged_urls.add(self._normalize_url(url))
        self.save()

    def is_url_checked(self, url: str) -> bool:
        """Check if URL was already checked."""
        return self._normalize_url(url) in self.checked_urls

    def is_url_staged(self, url: str) -> bool:
        """Check if URL was already staged."""
        return self._normalize_url(url) in self.staged_urls

    def set_current_topic(self, topic: str) -> None:
        """Set the current topic being processed."""
        self.current_topic = topic
        self.save()

    def add_pending_candidate(self, candidate: SubstackCandidate) -> None:
        """Add a candidate to pending list."""
        self.pending_candidates.append(candidate.to_dict())
        self.save()

    def clear_pending_candidates(self) -> None:
        """Clear pending candidates after staging."""
        self.pending_candidates = []
        self.save()

    def _normalize_url(self, url: str) -> str:
        """Normalize URL for comparison."""
        url = url.lower().strip()
        url = url.replace("https://", "").replace("http://", "")
        url = url.rstrip("/")
        return url

    def reset(self) -> None:
        """Clear checkpoint and start fresh."""
        self.checked_urls.clear()
        self.completed_topics.clear()
        self.staged_urls.clear()
        self.current_topic = None
        self.pending_candidates = []
        if self.checkpoint_path.exists():
            self.checkpoint_path.unlink()
        print("[Checkpoint] Reset complete")


class SubstackDiscoverer:
    """
    Discovers Substack newsletters related to specific topics.
    Supports checkpointing for resumable discovery.
    """
    def __init__(
        self,
        notion_token: Optional[str] = None,
        candidates_db_id: Optional[str] = None,
        sources_db_id: Optional[str] = None,
        checkpoint_path: Optional[Path] = None,
        config_path: Optional[Path] = None,
    ):
        # Load config from YAML if not provided
        self.config_path = config_path or (Path(__file__).parent.parent / "config" / "discovery_profile.yaml")
        self._load_config()

        self.notion_token = notion_token or os.getenv("NOTION_API_KEY") or os.getenv("NOTION_TOKEN")
        self.candidates_db_id = candidates_db_id or self._config_notion.get("candidates_database_id")
        self.sources_db_id = sources_db_id or self._config_notion.get("sources_database_id")

        if not self.notion_token:
            print("[Substack] Warning: No Notion API key found")
        if not self.candidates_db_id:
            print("[Substack] Warning: No candidates database ID found")

        self.notion = NotionClient(auth=self.notion_token) if self.notion_token else None
        self.http_client = httpx.Client(timeout=30.0)
        self.existing_sources: set[str] = set()
        self.existing_candidates: set[str] = set()

        # Checkpoint support
        cp_path = checkpoint_path or CHECKPOINT_FILE
        self.checkpoint = DiscoveryCheckpoint(cp_path)

    def _load_config(self) -> None:
        """Load configuration from YAML file."""
        if not self.config_path.exists():
            return

        try:
            with open(self.config_path, "r", encoding="utf-8") as f:
                config = yaml.safe_load(f)
            self._config_notion = config.get("notion", {})
        except Exception as e:
            print(f"[Substack] Error loading config: {e}")
            self._config_notion = {}

    def load_existing_sources(self, sources_db_id: Optional[str] = None) -> None:
        """Load existing sources from Data Sources database to avoid duplicates."""
        db_id = sources_db_id or self.sources_db_id or os.getenv("NOTION_SOURCES_DB_ID")
        if not db_id:
            print("[Substack] No sources database ID provided, skipping source check")
            return

        try:
            # Query all pages in the database (handle pagination)
            has_more = True
            start_cursor = None
            count = 0

            while has_more:
                response = self.notion.data_sources.query(
                    data_source_id=db_id,
                    start_cursor=start_cursor,
                    page_size=100
                )

                for page in response.get("results", []):
                    url = self._extract_url_from_page(page)
                    if url:
                        self.existing_sources.add(self._normalize_url(url))
                        count += 1

                has_more = response.get("has_more", False)
                start_cursor = response.get("next_cursor")

            print(f"[Substack] Loaded {count} existing sources from Data Sources database")
        except Exception as e:
            print(f"[Substack] Error loading existing sources: {e}")

    def load_existing_candidates(self, candidates_db_id: Optional[str] = None) -> None:
        """Load existing candidates from Source Candidates database to avoid duplicates."""
        db_id = candidates_db_id or self.candidates_db_id or os.getenv("NOTION_CANDIDATES_DB_ID")
        if not db_id:
            print("[Substack] No candidates database ID provided, skipping candidate check")
            return

        try:
            # Query all pages in the database (handle pagination)
            has_more = True
            start_cursor = None
            count = 0

            while has_more:
                response = self.notion.data_sources.query(
                    data_source_id=db_id,
                    start_cursor=start_cursor,
                    page_size=100
                )

                for page in response.get("results", []):
                    url = self._extract_url_from_page(page)
                    if url:
                        self.existing_candidates.add(self._normalize_url(url))
                        count += 1

                has_more = response.get("has_more", False)
                start_cursor = response.get("next_cursor")

            print(f"[Substack] Loaded {count} existing candidates from Source Candidates database")
        except Exception as e:
            print(f"[Substack] Error loading existing candidates: {e}")

    def _extract_url_from_page(self, page: dict) -> Optional[str]:
        """Extract URL from a Notion page (handles different property names)."""
        props = page.get("properties", {})

        # Try common URL property names
        for prop_name in ["URL", "Url", "url", "Link", "link"]:
            if prop_name in props:
                prop = props[prop_name]
                if prop.get("type") == "url" and prop.get("url"):
                    return prop["url"]
                elif prop.get("type") == "rich_text":
                    texts = prop.get("rich_text", [])
                    if texts and texts[0].get("text", {}).get("content"):
                        return texts[0]["text"]["content"]

        return None

    def load_all_existing(self) -> None:
        """Load both existing sources and candidates for duplicate checking."""
        self.load_existing_sources()
        self.load_existing_candidates()
        total = len(self.existing_sources) + len(self.existing_candidates)
        print(f"[Substack] Total URLs loaded for duplicate checking: {total}")

    def load_topics_from_config(self, config_path: Optional[Path] = None) -> list[dict]:
        """Load topics from discovery_profile.yaml."""
        if config_path is None:
            config_path = Path(__file__).parent.parent / "config" / "discovery_profile.yaml"

        if not config_path.exists():
            print(f"[Substack] Config not found: {config_path}")
            return []

        with open(config_path, "r", encoding="utf-8") as f:
            config = yaml.safe_load(f)

        topics = config.get("topics", [])
        print(f"[Substack] Loaded {len(topics)} topics from config")
        return topics
    def _normalize_url(self, url: str) -> str:
        """Normalize URL for comparison."""
        url = url.lower().strip()
        url = url.replace("https://", "").replace("http://", "")
        url = url.rstrip("/")
        return url

    def _web_search_substack(self, query: str, max_results: int = 10) -> list[str]:
        """Search the web for Substack newsletters matching a query using DuckDuckGo."""
        results = []
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            "Accept": "text/html",
        }

        # Use DuckDuckGo HTML search (no API key needed)
        search_url = f"https://html.duckduckgo.com/html/?q={query}+substack+newsletter"
        try:
            response = self.http_client.get(search_url, headers=headers)
            if response.status_code == 200:
                soup = BeautifulSoup(response.text, "html.parser")
                # Find all result links
                for link in soup.select(".result__a")[:max_results * 2]:
                    href = link.get("href", "")
                    # DuckDuckGo uses redirect URLs like //duckduckgo.com/l/?uddg=...
                    if "uddg=" in href:
                        import urllib.parse
                        # Handle protocol-relative URLs
                        if href.startswith("//"):
                            href = "https:" + href
                        parsed = urllib.parse.urlparse(href)
                        params = urllib.parse.parse_qs(parsed.query)
                        if "uddg" in params:
                            actual_url = params["uddg"][0]
                            # Check if it's a Substack newsletter URL (not topic pages)
                            if "substack.com" in actual_url:
                                # Skip topic pages and profile pages
                                if "/topics/" in actual_url or "/@" in actual_url:
                                    continue
                                # Normalize to the main substack URL
                                match = re.search(r'https://([a-zA-Z0-9-]+)\.substack\.com', actual_url)
                                if match:
                                    subdomain = match.group(1)
                                    # Skip generic domains
                                    if subdomain not in ["www", "substack", "m", "api"]:
                                        full_url = f"https://{subdomain}.substack.com"
                                        if full_url not in results:
                                            results.append(full_url)
                                            if len(results) >= max_results:
                                                break
        except Exception as e:
            print(f"[Substack] DuckDuckGo search error: {e}")

        return results

    def search_substack(
        self,
        query: str,
        max_results: int = 10
    ) -> list[str]:
        """
        Search Substack for newsletters matching a query.
        Uses multiple discovery methods since Substack search is JS-rendered.
        """
        results = []
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15;7) AppleWebKit/537.36"
        }
        # Method 1: Try Substack's public API endpoint (undocumented)
        try:
            api_url = f"https://substack.com/api/v1/search?query={query}&type=newsletter"
            response = self.http_client.get(api_url, headers=headers)
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, dict) and "results" in data:
                    for item in data.get("results", [])[:max_results]:
                        if isinstance(item, dict) and "publication" in item:
                            pub = item["publication"]
                            url = pub.get("subdomain", "")
                            if url:
                                full_url = f"https://{url}.substack.com"
                                if full_url not in results:
                                    results.append(full_url)
                print(f"[Substack] API found {len(results)} newsletters for '{query}'")
                if results:
                    return results[:max_results]
        except Exception as e:
            print(f"[Substack] API search failed: {e}")

        # Method 2: Web search for Substack newsletters
        try:
            web_results = self._web_search_substack(query, max_results)
            if web_results:
                results.extend(web_results)
                print(f"[Substack] Web search found {len(web_results)} newsletters for '{query}'")
        except Exception as e:
            print(f"[Substack] Web search failed: {e}")

        # Method 3: Fallback to curated list of known AI/tech newsletters
        if not results:
            known_newsletters = {
                "AI Safety": [
                    "https://alignmentnewsletter.substack.com",
                    "https://aigu.substack.com",
                    "https://aifutures.substack.com",
                    "https://deepmindsafety.substack.com",
                    "https://aiconverge.substack.com",
                ],
                "AI Education": [
                    "https://importai.substack.com",
                    "https://deeplearning.substack.com",
                    "https://lastweekinai.substack.com",
                    "https://artificialintelligencemachinelearning.substack.com",
                    "https://artificialteaching.substack.com",
                    "https://aieducation.substack.com",
                    "https://teachingai.substack.com",
                ],
                "Machine Learning": [
                    "https://deeplearning.substack.com",
                    "https://themachinelearning.substack.com",
                    "https://mlsubstack.substack.com",
                    "https://machinelearningweekly.substack.com",
                    "https://mlresearch.substack.com",
                ],
                "AI Governance": [
                    "https://importai.substack.com",
                    "https://aigovernance.substack.com",
                    "https://techpolicy.substack.com",
                    "https://airegulation.substack.com",
                ],
                "Data Science": [
                    "https://datascience.substack.com",
                    "https://towardsdatascience.substack.com",
                    "https://dataelixir.substack.com",
                ],
            }
            # Get relevant newsletters
            for topic_key, newsletters in known_newsletters.items():
                if topic_key.lower() in query.lower() or query.lower() in topic_key.lower():
                    for nl_url in newsletters:
                        if nl_url not in results:
                            results.append(nl_url)
            print(f"[Substack] Found {len(results)} from known newsletters for '{query}'")
        return results[:max_results]
    def get_newsletter_info(self, substack_url: str) -> Optional[SubstackCandidate]:
        """
        Get detailed information about a Substack newsletter.
        """
        domain = self._extract_domain(substack_url)
        if not domain:
            return None
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15;7) AppleWebKit/537.36"
        }
        try:
            # Fetch main page
            response = self.http_client.get(substack_url, headers=headers)
            soup = BeautifulSoup(response.text, "html.parser")
            # Extract newsletter info
            name = ""
            description = ""
            author = ""
            subscriber_count = None
            # Title
            title_tag = soup.find("title")
            if title_tag:
                name = title_tag.text.strip()
                if " | Substack" in name:
                    name = name.split(" | Substack")[0].strip()
            # Meta description
            meta_desc = soup.find("meta", attrs={"name": "description"})
            if meta_desc:
                description = meta_desc.get("content", "")
            # Author (usually in meta or structured data)
            author_meta = soup.find("meta", attrs={"property": "article:author"})
            if author_meta:
                author = author_meta.get("content", "")
            # Try to find subscriber count (if available)
            # This is often in the page as text like "X subscribers"
            page_text = soup.get_text()
            sub_match = re.search(r'(\d+(?:,\d+)*)\s*subscribers?', page_text, re.I)
            if sub_match:
                count_str = sub_match.group(1).replace(",", "")
                try:
                    subscriber_count = int(count_str)
                except ValueError:
                    pass
            # Get RSS feed
            rss_url = f"https://{domain}.substack.com/feed"
            rss_info = self._get_rss_info(rss_url)
            if not rss_info:
                return None
            return SubstackCandidate(
                name=name or domain,
                substack_url=substack_url,
                rss_url=rss_url,
                description=description,
                author=author,
                subscriber_count=subscriber_count,
                post_count=rss_info.get("post_count", 0),
                recent_posts=rss_info.get("recent_posts", []),
                topics=[],
                auto_score=0.0,
                priority="medium",
                reason=f"Discovered via Substack search",
                metadata={
                    "domain": domain,
                    "subscriber_count": subscriber_count,
                    "post_count": rss_info.get("post_count", 0)
                }
            )
        except Exception as e:
            print(f"[Substack] Error fetching {substack_url}: {e}")
            return None
    def _extract_domain(self, url: str) -> Optional[str]:
        """Extract substack domain from URL."""
        match = re.search(r'https?://([^.]+)\.substack\.com', url)
        if match:
            return match.group(1)
        return None
    def _get_rss_info(self, rss_url: str) -> Optional[dict]:
        """Parse RSS feed to get post info."""
        try:
            feed = feedparser.parse(rss_url)
            if feed.bozo:
                print(f"[Substack] RSS parse error for {rss_url}: {feed.bozo_exception}")
                return None
            posts = []
            for entry in feed.entries[:5]:  # Get 5 most recent
                posts.append({
                    "title": entry.get("title", ""),
                    "link": entry.get("link", ""),
                    "published": entry.get("published", entry.get("pubDate", ""))
                })
            return {
                "post_count": len(feed.entries),
                "recent_posts": posts,
                "feed_title": feed.feed.get("title", "")
            }
        except Exception as e:
            print(f"[Substack] RSS error: {e}")
            return None
    def calculate_score(self, candidate: SubstackCandidate, topics: list[str]) -> float:
        """Calculate auto-score for a candidate."""
        score = 0.0
        # 1. Topic relevance (2 points max)
        relevance = self._calculate_relevance(candidate, topics)
        score += relevance * 2.0
        # 2. Posting consistency (1 point)
        if candidate.post_count >= 20:
            score += 1.0
        elif candidate.post_count >= 10:
            score += 0.7
        elif candidate.post_count >= 5:
            score += 0.5
        # 3. Subscriber count (1 point) - sweet spot
        if candidate.subscriber_count:
            if 1000 <= candidate.subscriber_count <= 100000:
                score += 1.0
            elif 100 <= candidate.subscriber_count <= 500000:
                score += 0.7
        # 4. Content quality signals (1 point)
        if candidate.recent_posts and len(candidate.recent_posts) >= 3:
            # Has consistent recent content
            score += 0.5
        return round(score, 2)
    def _calculate_relevance(self, candidate: SubstackCandidate, topics: list[str]) -> float:
        """Calculate relevance score based on topics."""
        if not topics:
            return 0.5
        # Check name and description for topic keywords
        text = f"{candidate.name} {candidate.description}".lower()
        for post in candidate.recent_posts[:3]:
            text += f" {post.get('title', '')}"
        matches = 0
        for topic in topics:
            keywords = topic.lower().split()
            for keyword in keywords:
                if keyword in text:
                    matches += 1
                    break
        return min(matches / len(topics), 1.0)
    def discover(
        self,
        topic: str,
        keywords: list[str],
        category: str = "",
        max_results: int = 10,
        min_score: float = 2.0,
        use_checkpoint: bool = True
    ) -> list[SubstackCandidate]:
        """
        Discover Substack newsletters for a topic.

        Args:
            topic: The topic name (e.g., "Model Updates")
            keywords: Search keywords for discovery
            category: PRD "Newly Discovered" category mapping
            max_results: Maximum results to return
            min_score: Minimum score threshold
            use_checkpoint: Whether to use checkpointing
        """
        candidates = []

        # Skip if topic already completed (from checkpoint)
        if use_checkpoint and topic in self.checkpoint.completed_topics:
            print(f"[Substack] Topic '{topic}' already completed, skipping")
            return []

        if use_checkpoint:
            self.checkpoint.set_current_topic(topic)

        # Search for each keyword
        for keyword in keywords[:3]:  # Limit to top 3 keywords
            urls = self.search_substack(keyword, max_results=max_results)
            for url in urls:
                normalized = self._normalize_url(url)

                # Check checkpoint first - skip if already fetched
                if use_checkpoint and self.checkpoint.is_url_checked(url):
                    print(f"[Substack] Skipping (already checked): {url}")
                    continue

                # Skip if already in Notion
                if normalized in self.existing_sources:
                    print(f"[Substack] Skipping (in approved sources): {url}")
                    if use_checkpoint:
                        self.checkpoint.mark_url_checked(url)
                    continue
                if normalized in self.existing_candidates:
                    print(f"[Substack] Skipping (in candidates): {url}")
                    if use_checkpoint:
                        self.checkpoint.mark_url_checked(url)
                    continue

                # Get newsletter info
                candidate = self.get_newsletter_info(url)

                # Mark URL as checked regardless of result (avoid re-fetching failures)
                if use_checkpoint:
                    self.checkpoint.mark_url_checked(url)

                if not candidate:
                    continue

                # Calculate score
                candidate.auto_score = self.calculate_score(candidate, keywords)
                # Determine priority
                if candidate.auto_score >= 4.0:
                    candidate.priority = "high"
                elif candidate.auto_score >= 3.5:
                    candidate.priority = "medium"
                else:
                    candidate.priority = "low"
                # Filter by minimum score
                if candidate.auto_score >= min_score:
                    candidate.topics = [topic]
                    candidate.category = category
                    candidate.reason = f"Discovered for topic '{topic}' (keyword: {keyword})"
                    candidates.append(candidate)
                    print(f"[Substack] Found: {candidate.name} (score: {candidate.auto_score})".encode('utf-8', errors='replace').decode('utf-8'))

            # Rate limiting
            time.sleep(2)

        # Deduplicate by URL
        seen = set()
        unique_candidates = []
        for c in candidates:
            if c.substack_url not in seen:
                seen.add(c.substack_url)
                unique_candidates.append(c)

        # Mark topic as completed
        if use_checkpoint:
            self.checkpoint.mark_topic_completed(topic)

        return unique_candidates[:max_results]
    def _is_duplicate(self, url: str) -> tuple[bool, str]:
        """Check if URL already exists in sources or candidates."""
        normalized = self._normalize_url(url)
        in_sources = normalized in self.existing_sources
        in_candidates = normalized in self.existing_candidates
        return (in_sources, in_candidates)
    def stage_to_notion(self, candidate: SubstackCandidate) -> str:
        """Add candidate to Notion database."""
        if not self.candidates_db_id:
            raise ValueError("Candidates database ID not configured")
        try:
            # Build sample content from recent posts
            sample_content = ""
            for post in candidate.recent_posts[:3]:
                sample_content += f"- {post.get('title', 'Untitled')}\n"
            properties = {
                "Name": {
                    "title": [{"text": {"content": candidate.name}}]
                },
                "URL": {"url": candidate.substack_url},
                "Type": {"select": {"name": "SUBSTACK"}},
                "Category": {"select": {"name": candidate.category}} if candidate.category else None,
                "Status": {"select": {"name": "New"}},
                "Priority": {"select": {"name": candidate.priority.title()}},
                "Topics": {
                    "multi_select": [{"name": t} for t in candidate.topics]
                },
                "Reason": {
                    "rich_text": [{"text": {"content": candidate.reason}}]
                },
                "Sample Content": {
                    "rich_text": [{"text": {"content": sample_content[:2000]}}]
                },
                "Discovered At": {
                    "date": {"start": datetime.now().isoformat()}
                }
            }
            # Remove None values
            properties = {k: v for k, v in properties.items() if v is not None}
            response = self.notion.pages.create(
                parent={"type": "data_source_id", "data_source_id": self.candidates_db_id},
                properties=properties
            )
            print(f"[Substack] Staged: {candidate.name}")
            return response["id"]
        except Exception as e:
            print(f"[Substack] Error staging to Notion: {e}")
            raise
    def run_discovery(
        self,
        topic: str,
        keywords: list[str],
        max_results: int = 10,
        stage: bool = True,
        use_checkpoint: bool = True
    ) -> list[SubstackCandidate]:
        """
        Run full discovery workflow.
        """
        print(f"\n{'='*60}")
        print(f"Substack Discovery: {topic}")
        print(f"{'='*60}\n")
        # Discover candidates
        candidates = self.discover(
            topic=topic,
            keywords=keywords,
            max_results=max_results
        )
        print(f"\nFound {len(candidates)} candidates meeting threshold")
        if not candidates:
            return []
        # Sort by score
        candidates.sort(key=lambda c: c.auto_score, reverse=True)
        # Display results
        for i, c in enumerate(candidates, 1):
            print(f"\n{i}. {c.name}")
            print(f"   URL: {c.substack_url}")
            print(f"   Score: {c.auto_score} ({c.priority} priority)")
            print(f"   Posts: {c.post_count}")
            if c.subscriber_count:
                print(f"   Subscribers: {c.subscriber_count:,}")
        # Stage to Notion if requested
        if stage:
            print(f"\nStaging to Notion...")
            for c in candidates:
                try:
                    self.stage_to_notion(c)
                except Exception as e:
                    print(f"  Error staging {c.name}: {e}")
        return candidates
def main():
    """CLI entry point with checkpointing support."""
    import argparse
    parser = argparse.ArgumentParser(description="Substack Discovery Agent with Checkpointing")
    parser.add_argument("--topic", help="Single topic to discover")
    parser.add_argument("--keywords", nargs="+", help="Search keywords")
    parser.add_argument("--max-results", type=int, default=10, help="Maximum results per topic")
    parser.add_argument("--stage", action="store_true", help="Stage to Notion")
    parser.add_argument("--sources-db", help="Existing sources DB (for duplicate check)")
    parser.add_argument("--all-topics", action="store_true", help="Run all topics from config")
    parser.add_argument("--config", type=Path, help="Path to discovery_profile.yaml")
    parser.add_argument("--resume", action="store_true", help="Resume from checkpoint")
    parser.add_argument("--clear-checkpoint", action="store_true", help="Clear checkpoint and start fresh")
    parser.add_argument("--checkpoint-status", action="store_true", help="Show checkpoint status")
    args = parser.parse_args()

    discoverer = SubstackDiscoverer()

    # Handle checkpoint status
    if args.checkpoint_status:
        if discoverer.checkpoint.load():
            print(f"\n[Checkpoint Status]")
            print(f"  Checked URLs: {len(discoverer.checkpoint.checked_urls)}")
            print(f"  Staged URLs: {len(discoverer.checkpoint.staged_urls)}")
            print(f"  Completed topics: {discoverer.checkpoint.completed_topics}")
            print(f"  Current topic: {discoverer.checkpoint.current_topic}")
            print(f"  Last run: {discoverer.checkpoint.last_run}")
            if discoverer.checkpoint.pending_candidates:
                print(f"  Pending candidates: {len(discoverer.checkpoint.pending_candidates)}")
        else:
            print("[Checkpoint] No checkpoint found")
        return

    # Handle clear checkpoint
    if args.clear_checkpoint:
        discoverer.checkpoint.reset()
        print("[Checkpoint] Cleared")
        if not args.topic and not args.all_topics:
            return

    # Load checkpoint if resuming
    if args.resume:
        discoverer.checkpoint.load()

    # Load existing sources for duplicate checking
    if args.sources_db:
        discoverer.load_existing_sources(args.sources_db)
    else:
        discoverer.load_all_existing()

    # Run discovery
    if args.all_topics:
        topics = discoverer.load_topics_from_config(args.config)
        if not topics:
            print("[Substack] No topics found in config")
            return

        print(f"\n[Substack] Running discovery for {len(topics)} topics")
        print(f"[Substack] Checkpoint enabled: {not args.clear_checkpoint}")
        print(f"[Substack] Resume mode: {args.resume}")

        total_candidates = []
        for topic_config in topics:
            topic_name = topic_config["name"]
            keywords = topic_config.get("keywords", [topic_name])
            category = topic_config.get("category", "")

            # Skip completed topics if resuming
            if args.resume and topic_name in discoverer.checkpoint.completed_topics:
                print(f"\n[Substack] Skipping completed topic: {topic_name}")
                continue

            candidates = discoverer.run_discovery(
                topic=topic_name,
                keywords=keywords,
                max_results=args.max_results,
                stage=args.stage,
                use_checkpoint=True
            )
            total_candidates.extend(candidates)

            # Brief pause between topics
            time.sleep(3)

        print(f"\n{'='*60}")
        print(f"Discovery Complete")
        print(f"{'='*60}")
        print(f"Total candidates found: {len(total_candidates)}")

    elif args.topic:
        keywords = args.keywords or [args.topic]
        discoverer.run_discovery(
            topic=args.topic,
            keywords=keywords,
            max_results=args.max_results,
            stage=args.stage,
            use_checkpoint=not args.clear_checkpoint
        )
    else:
        parser.print_help()
if __name__ == "__main__":
    main()
