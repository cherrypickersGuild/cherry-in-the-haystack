"""
Pipeline Runner - Replaces Airflow DAG orchestration.

Each function corresponds to an Airflow DAG:
- run_news_pulling()      -> news_pulling DAG
- run_sync_dist()         -> sync_dist DAG
- run_collection_weekly() -> collect_weekly DAG
- run_journal_daily()     -> journal_daily DAG
- run_action()            -> action DAG
"""

import os
import traceback
from datetime import datetime, date

from dotenv import load_dotenv

load_dotenv()

from pg_cli import PGClient


def _get_pg_client():
    return PGClient()


def run_news_pulling():
    """
    Main news pulling pipeline. Replaces the news_pulling DAG.

    Flow: Pull -> Dedup -> Score -> Filter -> Summarize -> Push to Notion -> Save to PostgreSQL
    """
    pg = _get_pg_client()
    run_id = pg.record_job_start("news_pulling")
    start_date = date.today().isoformat()

    stats = {
        "rss": {"pulled": 0, "deduped": 0, "pushed": 0, "pg_saved": 0},
        "api_crawler": {"pulled": 0, "deduped": 0, "pushed": 0, "pg_saved": 0},
        "substack": {"pulled": 0, "deduped": 0, "pushed": 0, "pg_saved": 0},
    }

    try:
        # ============================================================
        # 1. RSS Pipeline
        # ============================================================
        print("=" * 60)
        print("  RSS Pipeline")
        print("=" * 60)

        from ops_rss import OperatorRSS
        op_rss = OperatorRSS()

        rss_pages = op_rss.pull()
        stats["rss"]["pulled"] = len(rss_pages)

        rss_deduped = op_rss.dedup(rss_pages, target="toread")
        stats["rss"]["deduped"] = len(rss_deduped)

        if rss_deduped:
            # Score & Filter (skip if embedding API fails or disabled)
            skip_scoring = os.getenv("SKIP_SCORING", "false").lower() == "true"
            skip_summarize = os.getenv("SKIP_SUMMARIZE", "false").lower() == "true"

            if skip_scoring:
                print("[INFO] Scoring disabled via SKIP_SCORING=true, using all deduped articles")
                rss_filtered = rss_deduped
            else:
                try:
                    max_distance = float(os.getenv("MAX_DISTANCE", "0.5"))
                    rss_scored = op_rss.score(
                        rss_deduped,
                        start_date=start_date,
                        max_distance=max_distance)
                    rss_filtered = op_rss.filter(rss_scored, k=1, min_score=4)
                except Exception as e:
                    print(f"[WARN] Score/Filter failed ({e}), proceeding with all deduped articles")
                    rss_filtered = rss_deduped

            if skip_summarize:
                print("[INFO] Summarize disabled via SKIP_SUMMARIZE=true, using raw content")
                rss_summarized = rss_filtered
            else:
                rss_summarized = op_rss.summarize(rss_filtered)

            # Push to Notion
            pushed_stats = op_rss.push(rss_summarized, ["notion"])
            stats["rss"]["pushed"] = pushed_stats.get("total", 0)

            # Save to PostgreSQL
            pg_stats = pg.save_articles(rss_summarized)
            stats["rss"]["pg_saved"] = pg_stats.get("saved", 0)

        # ============================================================
        # 2. API Crawler Pipeline (HackerNews + Dev.to)
        # ============================================================
        print("=" * 60)
        print("  API Crawler Pipeline")
        print("=" * 60)

        from ops_api_crawler import OperatorAPICrawler
        op_api = OperatorAPICrawler()

        api_pages = op_api.pull()
        stats["api_crawler"]["pulled"] = len(api_pages)

        api_deduped = op_api.dedup(api_pages, target="toread")
        stats["api_crawler"]["deduped"] = len(api_deduped)

        if api_deduped:
            skip_summarize = os.getenv("SKIP_SUMMARIZE", "false").lower() == "true"
            if skip_summarize:
                print("[INFO] Summarize disabled for API crawler, using raw content")
                api_summarized = api_deduped
            else:
                api_summarized = op_api.summarize(api_deduped)

            pushed_stats = op_api.push(api_summarized, ["notion"])
            stats["api_crawler"]["pushed"] = pushed_stats.get("total", 0)

            pg_stats = pg.save_articles(api_summarized)
            stats["api_crawler"]["pg_saved"] = pg_stats.get("saved", 0)

        # ============================================================
        # 3. Substack Pipeline
        # ============================================================
        print("=" * 60)
        print("  Substack Pipeline")
        print("=" * 60)

        try:
            substack_feeds = pg.get_feed_configs(enabled_only=True)
            substack_feeds = [f for f in substack_feeds if f["source_type"] == "substack"]

            if substack_feeds:
                from ops_substack_crawler import OperatorSubstackCrawler
                op_substack = OperatorSubstackCrawler()

                substack_pages = op_substack.pull(feed_configs=substack_feeds)
                stats["substack"]["pulled"] = len(substack_pages)

                substack_deduped = op_substack.dedup(substack_pages)
                stats["substack"]["deduped"] = len(substack_deduped)

                if substack_deduped:
                    skip_summarize = os.getenv("SKIP_SUMMARIZE", "false").lower() == "true"
                    if skip_summarize:
                        print("[INFO] Summarize disabled for Substack, using raw content")
                        substack_summarized = substack_deduped
                    else:
                        substack_summarized = op_substack.summarize(substack_deduped)

                    pushed_stats = op_substack.push(substack_summarized, ["notion"])
                    stats["substack"]["pushed"] = pushed_stats.get("total", 0)

                    pg_stats = pg.save_articles(substack_summarized)
                    stats["substack"]["pg_saved"] = pg_stats.get("saved", 0)
            else:
                print("[INFO] No Substack feeds configured, skipping")
        except Exception as e:
            print(f"[ERROR] Substack pipeline failed: {e}")
            traceback.print_exc()

        # ============================================================
        # Done
        # ============================================================
        pg.record_job_success(run_id, stats=stats)
        print(f"\n{'=' * 60}")
        print(f"  News Pulling Complete - Stats:")
        for source, s in stats.items():
            print(f"    {source}: pulled={s['pulled']}, deduped={s['deduped']}, pushed={s['pushed']}, pg_saved={s['pg_saved']}")
        print(f"{'=' * 60}\n")

    except Exception as e:
        print(f"[FATAL] news_pulling pipeline failed: {e}")
        traceback.print_exc()
        pg.record_job_failure(run_id, str(e))


def run_sync_dist():
    """
    Sync content from Notion ToRead and distribute to Milvus embeddings.
    Replaces the sync_dist DAG.
    """
    pg = _get_pg_client()
    run_id = pg.record_job_start("sync_dist")

    try:
        from ops_rss import OperatorRSS
        from ops_milvus import OperatorMilvus
        from db_cli import DBClient

        op = OperatorRSS()
        op_milvus = OperatorMilvus()
        db_client = DBClient()

        # Sync from various sources
        sources = ["RSS", "Article", "Youtube", "Twitter", "Reddit"]

        total_synced = 0
        for source in sources:
            print(f"Syncing source: {source}")
            try:
                data = op.sync(source)
                if data:
                    # Distribute to Milvus (create embeddings)
                    op_milvus.dist(data, start_date="", db_client=db_client)
                    op.updateLastEditedTimeForData(data, source=source, db_client=db_client)
                    total_synced += len(data)
            except Exception as e:
                print(f"[ERROR] Sync failed for {source}: {e}")
                traceback.print_exc()

        pg.record_job_success(run_id, stats={"total_synced": total_synced})
        print(f"Sync complete: {total_synced} items synced")

    except Exception as e:
        print(f"[FATAL] sync_dist pipeline failed: {e}")
        traceback.print_exc()
        pg.record_job_failure(run_id, str(e))


def run_collection_weekly():
    """
    Collect weekly content summary. Replaces the collect_weekly DAG.
    Only runs on Saturdays (checked by scheduler, but can be called directly).
    """
    pg = _get_pg_client()
    run_id = pg.record_job_start("collection_weekly")

    try:
        from ops_rss import OperatorRSS

        op = OperatorRSS()
        data = op.pull_takeaways(category="todo")

        if not data:
            print("[INFO] No data for weekly collection")
            pg.record_job_success(run_id, stats={"items": 0})
            return

        # Process and push weekly collection
        from notion import NotionAgent
        from ops_notion import OperatorNotion

        notion_api_key = os.getenv("NOTION_TOKEN")
        notion_agent = NotionAgent(notion_api_key)
        op_notion = OperatorNotion()

        db_index_id = op_notion.get_index_toread_dbid()

        import utils
        db_pages = utils.get_notion_database_pages_toread(
            notion_agent, db_index_id)

        if db_pages:
            database_id = db_pages[0]["database_id"]

            # Group by source
            pages_by_source = {}
            takeaway_pages = []

            for page_id, page in data.items():
                source = page.get("source", "Unknown")
                pages_by_source.setdefault(source, []).append(page)
                takeaway_pages.append(page)

            title = f"Weekly Collection - {datetime.now().strftime('%Y-%m-%d')}"
            notion_agent.createDatabaseItem_ToRead_Collection(
                database_id,
                title,
                "Collection",
                pages_by_source,
                [],
                [],
                takeaway_pages
            )

        pg.record_job_success(run_id, stats={"items": len(data)})
        print(f"Weekly collection complete: {len(data)} items")

    except Exception as e:
        print(f"[FATAL] collection_weekly pipeline failed: {e}")
        traceback.print_exc()
        pg.record_job_failure(run_id, str(e))


def run_journal_daily():
    """
    Daily journal processing. Replaces the journal_daily DAG.
    """
    pg = _get_pg_client()
    run_id = pg.record_job_start("journal_daily")

    try:
        from ops_rss import OperatorRSS
        from db_cli import DBClient

        op = OperatorRSS()
        data = op.pull_journal(category="todo")

        if not data:
            print("[INFO] No journal data to process")
            pg.record_job_success(run_id, stats={"items": 0})
            return

        # Process journal entries
        from notion import NotionAgent
        from ops_notion import OperatorNotion
        from llm_agent import LLMAgentSummary

        notion_api_key = os.getenv("NOTION_TOKEN")
        notion_agent = NotionAgent(notion_api_key)
        op_notion = OperatorNotion()

        db_index_id = op_notion.get_index_toread_dbid()

        import utils
        db_pages = utils.get_notion_database_pages_toread(
            notion_agent, db_index_id)

        if db_pages:
            database_id = db_pages[0]["database_id"]

            for page_id, page in data.items():
                content = page.get("content", "")
                if not content:
                    continue

                # Summarize and translate
                llm_agent = LLMAgentSummary()
                llm_agent.init_prompt()
                llm_agent.init_llm()

                summary = llm_agent.run(content)

                journal_page = {
                    "id": page_id,
                    "title": page.get("title", "Journal"),
                    "name": page.get("title", "Journal"),
                    "source": "Inbox-Journal",
                    "text": summary,
                    "translation": "",
                }

                notion_agent.createDatabaseItem_ToRead_Journal(
                    database_id, journal_page)

        # Update last edited time
        db_client = DBClient()
        op.updateLastEditedTimeForData(
            data, source="Journal", list_name="todo", db_client=db_client)

        pg.record_job_success(run_id, stats={"items": len(data)})
        print(f"Journal daily complete: {len(data)} items")

    except Exception as e:
        print(f"[FATAL] journal_daily pipeline failed: {e}")
        traceback.print_exc()
        pg.record_job_failure(run_id, str(e))


def run_action():
    """
    Action processing (TODOs, Q&A, deep-dives). Replaces the action DAG.
    """
    pg = _get_pg_client()
    run_id = pg.record_job_start("action")

    try:
        from ops_rss import OperatorRSS
        from db_cli import DBClient

        op = OperatorRSS()
        data = op.pull_takeaways(category="todo")

        if not data:
            print("[INFO] No action data to process")
            pg.record_job_success(run_id, stats={"items": 0})
            return

        # Process actions (TODO generation)
        from notion import NotionAgent
        from ops_notion import OperatorNotion
        from llm_agent import LLMAgentSummary
        import llm_prompts

        notion_api_key = os.getenv("NOTION_TOKEN")
        notion_agent = NotionAgent(notion_api_key)
        op_notion = OperatorNotion()

        db_index_id = op_notion.get_index_toread_dbid()

        import utils
        db_pages = utils.get_notion_database_pages_toread(
            notion_agent, db_index_id)

        processed = 0
        if db_pages:
            database_id = db_pages[0]["database_id"]

            for page_id, page in data.items():
                content = page.get("content", "")
                blocks = page.get("blocks", {})

                if not content and blocks:
                    content = notion_agent.concatBlocksText(blocks)

                if not content:
                    continue

                processed += 1

        # Update last edited time
        db_client = DBClient()
        op.updateLastEditedTimeForData(
            data, source="Article", list_name="todo", db_client=db_client)

        pg.record_job_success(run_id, stats={"items": processed})
        print(f"Action complete: {processed} items processed")

    except Exception as e:
        print(f"[FATAL] action pipeline failed: {e}")
        traceback.print_exc()
        pg.record_job_failure(run_id, str(e))


# Allow direct execution for testing
if __name__ == "__main__":
    import sys

    pipeline_map = {
        "news_pulling": run_news_pulling,
        "sync_dist": run_sync_dist,
        "collection_weekly": run_collection_weekly,
        "journal_daily": run_journal_daily,
        "action": run_action,
    }

    if len(sys.argv) > 1:
        job_name = sys.argv[1]
        if job_name in pipeline_map:
            print(f"Running pipeline: {job_name}")
            pipeline_map[job_name]()
        else:
            print(f"Unknown pipeline: {job_name}")
            print(f"Available: {', '.join(pipeline_map.keys())}")
    else:
        print("Usage: python pipeline.py <job_name>")
        print(f"Available: {', '.join(pipeline_map.keys())}")
