import os
import time
import copy
import traceback
from operator import itemgetter
from datetime import date, datetime
from time import mktime

from notion import NotionAgent
from llm_agent import LLMAgentSummary
import utils
from ops_base import OperatorBase
from db_cli import DBClient
from ops_milvus import OperatorMilvus
from ops_notion import OperatorNotion
from config.rss_feeds import get_enabled_feeds

import feedparser
import requests


class OperatorRSS(OperatorBase):
    """
    An Operator to handle:
    - pulling data from source
    - save to local json
    - restore from local json
    - dedup
    - summarization
    - ranking
    - publish
    """

    def _fetch_articles(self, list_name, feed_url, count=3):
        """
        Fetch artciles from feed url (pull last n)
        """
        print(f"[fetch_articles] list_name: {list_name}, feed_url: {feed_url}, count: {count}")

        # Fetch RSS feed with proper headers to avoid being blocked by Reddit
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/rss+xml, application/xml, text/xml, */*',
            'Accept-Language': 'en-US,en;q=0.9',
        }

        try:
            response = requests.get(feed_url, headers=headers, timeout=10)
            response.raise_for_status()
            feed = feedparser.parse(response.content)
        except Exception as e:
            print(f"[ERROR] Failed to fetch RSS feed: {e}")
            feed = feedparser.parse('')  # Empty feed to avoid errors

        # Debug information
        print(f"[DEBUG] feed.bozo: {feed.bozo}, entries count: {len(feed.entries)}")
        if feed.bozo:
            print(f"[DEBUG] feed.bozo_exception: {feed.bozo_exception}")
        if hasattr(feed, 'status'):
            print(f"[DEBUG] HTTP status: {feed.status}")

        pulled_cnt = 0

        articles = []
        for entry in feed.entries:
            pulled_cnt += 1

            if pulled_cnt > count:
                print(f"[fetch_articles] Stop pulling, reached count: {count}")
                break

            # Extract relevant information from each entry
            title = entry.title
            link = entry.link

            # Example: Thu, 03 Mar 2022 08:00:00 GMT
            published = entry.published
            published_parsed = entry.published_parsed
            published_key = published

            # Convert above struct_time object to datetime
            created_time = date.today().isoformat()
            if published_parsed:
                dt = datetime.fromtimestamp(mktime(published_parsed))
                created_time = dt.isoformat()

                # Notes: The feedparser returns unreliable dates, e.g.
                # sometimes 2023-05-25T16:09:00.004-07:00
                # sometimes 2023-05-25T16:09:00.003-07:00
                # It leads the inconsistent md5 hash result which
                # causes duplicate result, so use YYYY-MM-DD instead
                published_key = dt.strftime("%Y-%m-%d")

            hash_key = f"{list_name}_{title}_{published_key}".encode('utf-8')
            article_id = utils.hashcode_md5(hash_key)

            print(f"[fetch_articles] pulled_cnt: {pulled_cnt}, list_name: {list_name}, title: {title}, published: {created_time}, article_id: {article_id}, hash_key: [{hash_key}]")

            # Create a dictionary representing an article
            article = {
                "id": article_id,
                'source': "RSS",
                'list_name': list_name,
                'title': title,
                'url': link,
                'created_time': created_time,
                "summary": entry.get("summary") or "",
                "content": "",
                "tags": entry.get("tags") or [],
                "published": published,
                "published_key": published_key,
            }

            # Add the article to the list
            articles.append(article)

        return articles

    def pull(self):
        """
        Pull RSS

        @return pages <id, page>
        """
        print("#####################################################")
        print("# Pulling RSS")
        print("#####################################################")

        # Load RSS feeds from centralized configuration
        rss_list = get_enabled_feeds()
        print(f"Loaded {len(rss_list)} enabled RSS feeds from config")

        # Fetch articles from rss list
        pages = {}

        for rss in rss_list:
            name = rss["name"]
            url = rss["url"]
            count = rss.get("count", 3)  # Use configured count or default to 3
            print(f"Fetching RSS: {name}, url: {url}, count: {count}")

            articles = self._fetch_articles(name, url, count=count)
            print(f"articles: {articles}")

            for article in articles:
                page_id = article["id"]
                pages[page_id] = article

        return pages

    def dedup(self, extractedPages, target="inbox"):
        print("#####################################################")
        print("# Dedup RSS")
        print("#####################################################")
        print(f"Number of pages: {len(extractedPages)}")

        client = DBClient()
        deduped_pages = []

        for page_id, page in extractedPages.items():
            title = page["title"]
            list_name = page["list_name"]
            created_time = page["created_time"]

            print(f"Dedupping page, title: {title}, list_name: {list_name}, created_time: {created_time}, page_id: {page_id}")

            if not client.get_notion_toread_item_id(
                    "rss", list_name, page_id):
                deduped_pages.append(page)
                print(f" - No duplicate RSS article found, move to next. title: {title}, page_id: {page_id}")

        return deduped_pages

    def filter(self, pages, **kwargs):
        print("#####################################################")
        print("# Filter RSS (After Scoring)")
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
        tops = sorted(filtered1, key=lambda page: page["__relevant_score"], reverse=True)
        print(f"After sorting: {tops}")

        filtered2 = []
        for i in range(min(k, len(tops))):
            filtered2.append(tops[i])

        print(f"Filter output size: {len(filtered2)}")
        return filtered2

    def score(self, data, **kwargs):
        print("#####################################################")
        print("# Scoring RSS")
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
                score_text = f"{page['title']} - {page['list_name']} - {page['summary']}"
                score_text = score_text[:1024]
                print(f"Scoring page: {title}, score_text: {score_text}")

                relevant_metas = op_milvus.get_relevant(
                    start_date, score_text, topk=2,
                    max_distance=max_distance, db_client=client)

                page_score = op_milvus.score(relevant_metas)

                scored_page = copy.deepcopy(page)
                scored_page["__relevant_score"] = page_score

                scored_list.append(scored_page)
                print(f"RSS article scored {page_score}")

            except Exception as e:
                print(f"[ERROR]: Score page failed, skip: {e}")
                traceback.print_exc()

        print(f"Scored_pages ({len(scored_list)}): {scored_list}")
        return scored_list

    def summarize(self, pages):
        print("#####################################################")
        print("# Summarize RSS Articles")
        print("#####################################################")
        SUMMARY_MAX_LENGTH = int(os.getenv("SUMMARY_MAX_LENGTH", 20000))
        print(f"Number of pages: {len(pages)}")
        print(f"Summary max length: {SUMMARY_MAX_LENGTH}")

        client = DBClient()
        redis_key_expire_time = os.getenv(
            "BOT_REDIS_KEY_EXPIRE_TIME", 604800)

        summarized_pages = []

        # Track current feed to reuse LLM agent for same feed
        current_feed_name = None
        llm_agent = None

        for page in pages:
            page_id = page["id"]
            title = page["title"]
            content = page["content"]
            list_name = page["list_name"]
            source_url = page["url"]
            print(f"Summarying page, title: {title}, list_name: {list_name}")

            # Initialize or reinitialize LLM agent when feed changes
            if current_feed_name != list_name or llm_agent is None:
                import llm_prompts
                feed_prompt = llm_prompts.get_rss_prompt(list_name)
                print(f"[INFO] Initializing LLM agent for feed: {list_name}")
                print(f"[INFO] Using prompt: {feed_prompt[:100]}...")

                llm_agent = LLMAgentSummary()
                llm_agent.init_prompt(combine_prompt=feed_prompt)
                llm_agent.init_llm()
                current_feed_name = list_name
            # print(f"Page content ({len(content)} chars): {content}")

            st = time.time()

            llm_summary_resp = client.get_notion_summary_item_id(
                "rss", list_name, page_id)

            if not llm_summary_resp:
                # Double check the content, if empty, load it from
                # the source url. For RSS, we will load content
                # from this entrypoint
                if not content:
                    # Try to load web content first, fallback to RSS summary if failed
                    try:
                        # load_web() returns None if validation fails
                        content = utils.load_web(source_url, validate=True, min_length=200)
                        if content:
                            print(f"Successfully loaded web content: {len(content)} chars")
                    except Exception as e:
                        print(f"[ERROR] Exception occurred during utils.load_web(), source_url: {source_url}, {e}")
                        content = None

                    # Fallback to RSS summary if web load failed or invalid
                    if not content:
                        print("Web load failed or invalid, using RSS summary field as fallback")
                        rss_summary = page.get("summary", "")
                        if rss_summary:
                            content = rss_summary
                            print(f"Using RSS summary as fallback: {len(content)} chars")
                        else:
                            print("[ERROR] Both web load and RSS summary failed, skip it")
                            continue

                summary = llm_agent.run(content)

                print(f"Cache llm response for {redis_key_expire_time}s, page_id: {page_id}, summary: {summary}")
                client.set_notion_summary_item_id(
                    "rss", list_name, page_id, summary,
                    expired_time=int(redis_key_expire_time))

            else:
                print("Found llm summary from cache, decoding (utf-8) ...")
                summary = utils.bytes2str(llm_summary_resp)

            # categorizing page
            print(f"Categorizing page, title: {title}, list_name: {list_name}")

            llm_category_resp = client.get_notion_category_item_id(
                "rss", list_name, page_id)

            if not llm_category_resp:
                # Initialize categorization LLM agent
                from llm_agent import LLMAgentGeneric
                import llm_prompts

                category_agent = LLMAgentGeneric()
                category_agent.init_prompt(llm_prompts.LLM_PROMPT_CATEGORIZATION)
                category_agent.init_llm()

                # Run categorization on summary
                category_response = category_agent.run(summary)

                print(f"Cache llm category response for {redis_key_expire_time}s, page_id: {page_id}, category: {category_response}")
                client.set_notion_category_item_id(
                    "rss", list_name, page_id, category_response,
                    expired_time=int(redis_key_expire_time))
            else:
                print("Found llm category from cache, decoding (utf-8) ...")
                category_response = utils.bytes2str(llm_category_resp)

            # Parse category JSON (multi-select)
            import json
            try:
                category_data = json.loads(category_response)
                categories = category_data.get("categories", [])
            except json.JSONDecodeError as e:
                print(f"[ERROR] Failed to parse category JSON: {e}, response: {category_response}")
                categories = []

            # assemble summary and categories into page
            summarized_page = copy.deepcopy(page)
            summarized_page["content"] = content
            summarized_page["__summary"] = summary
            summarized_page["__categories"] = categories

            print(f"Used {time.time() - st:.3f}s, Summarized page_id: {page_id}, categories: {categories}, summary: {summary}")
            summarized_pages.append(summarized_page)


        print("[INFO] Enhanced analysis enabled for RSS, running analysis...")
        summarized_pages = self.analyze_enhanced(summarized_pages)

        return summarized_pages

    def analyze_enhanced(self, pages):
        """
        Generate enhanced analysis (why_it_matters, insights, examples)
        for RSS articles
        """
        print("#####################################################")
        print("# Enhanced Analysis for RSS Articles")
        print("#####################################################")
        ANALYSIS_MAX_LENGTH = int(os.getenv("ANALYSIS_MAX_LENGTH", 15000))
        print(f"Number of pages: {len(pages)}")
        print(f"Analysis max length: {ANALYSIS_MAX_LENGTH}")

        # Initialize LLM agent
        llm_agent = LLMAgentSummary()
        llm_agent.init_prompt()  # for potential summary fallback
        llm_agent.init_llm()
        llm_agent.init_enhanced_analysis_prompt()

        client = DBClient()
        redis_key_expire_time = os.getenv("BOT_REDIS_KEY_EXPIRE_TIME", 604800)

        analyzed_pages = []

        for page in pages:
            page_id = page["id"]
            title = page["title"]
            content = page.get("content", "")
            summary = page.get("__summary", "")
            list_name = page["list_name"]

            print(f"Analyzing page, title: {title}, list_name: {list_name}")

            st = time.time()

            # Check cache
            cached_analysis = client.get_notion_enhanced_analysis_item_id(
                "rss", list_name, page_id
            )

            if cached_analysis:
                print("Found cached enhanced analysis")
                import json
                analysis = json.loads(utils.bytes2str(cached_analysis))
            else:
                # Determine input: content first, then summary fallback
                analysis_input = content if content else summary

                if not analysis_input:
                    print("[WARN] No content or summary available, skipping analysis")
                    continue

                # Truncate to max length
                analysis_input = analysis_input[:ANALYSIS_MAX_LENGTH]
                print(f"Analysis input length: {len(analysis_input)} chars")

                # Run LLM
                analysis = llm_agent.run_enhanced_analysis(analysis_input)

                # Cache result
                import json
                analysis_json = json.dumps(analysis, ensure_ascii=False)
                client.set_notion_enhanced_analysis_item_id(
                    "rss", list_name, page_id, analysis_json,
                    expired_time=int(redis_key_expire_time)
                )
                print(f"Cached enhanced analysis for {redis_key_expire_time}s")

            # Add to page
            analyzed_page = copy.deepcopy(page)
            analyzed_page["__why_it_matters"] = analysis.get("why_it_matters", "")
            analyzed_page["__insights"] = analysis.get("insights", [])
            analyzed_page["__examples"] = analysis.get("examples", [])

            print(f"Used {time.time() - st:.3f}s, Enhanced analysis complete")
            print(f"  - Why it matters: {analyzed_page['__why_it_matters'][:100]}...")
            print(f"  - Insights: {len(analyzed_page['__insights'])} items")
            print(f"  - Examples: {len(analyzed_page['__examples'])} items")

            analyzed_pages.append(analyzed_page)

        return analyzed_pages

    def _get_top_items(self, items: list, k):
        """
        items: [(name, score), ...]
        """
        tops = sorted(items, key=itemgetter(1), reverse=True)
        return tops[:k]

    def push(self, pages, targets, topk=3):
        print("#####################################################")
        print("# Push RSS")
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

                        notion_agent.createDatabaseItem_ToRead_RSS(
                            database_id,
                            page,
                            topics_topk,
                            categories_topk)

                        self.markVisited(page_id, source="rss", list_name=list_name)

                    except Exception as e:
                        print(f"[ERROR]: Push to notion failed, skip: {e}")
                        stat["error"] += 1
                        traceback.print_exc()

            else:
                print(f"[ERROR]: Unknown target {target}, skip")

        return stat
