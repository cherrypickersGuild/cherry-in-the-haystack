
import os
import sys
import logging
from datetime import datetime
from dotenv import load_dotenv

# Add current directory to path to recognize modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from ops_rss import OperatorRSS
import utils

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('ManualRSSUpdate')

def run_manual_update():
    print("#####################################################")
    print("# Starting Manual RSS Update")
    print("#####################################################")
    
    # Load environment variables
    load_dotenv()
    
    op = OperatorRSS()
    
    # 1. Pull Data
    print("\n--- Pulling RSS Data ---")
    try:
        pages = op.pull()
        print(f"Pulled {len(pages)} articles.")
    except Exception as e:
        print(f"[ERROR] Failed to pull data: {e}")
        return

    if not pages:
        print("No pages pulled. Exiting.")
        return

    # 2. Dedup (Check against Notion)
    print("\n--- Deduplicating (Checking Notion) ---")
    try:
        deduped_pages = op.dedup(pages, target="toread")
        print(f"New articles to process: {len(deduped_pages)}")
    except Exception as e:
        print(f"[ERROR] Failed to dedup: {e}")
        # If dedup fails (e.g. DB connection), we shouldn't proceed presumably
        return

    if not deduped_pages:
        print("No new articles found. Exiting.")
        return

    # 3. Summarize (LLM)
    # Note: We skip Scoring/Filtering to avoid Milvus dependency and ensure all new items are pushed.
    print(f"\n--- Summarizing {len(deduped_pages)} articles ---")
    summarized_pages = []
    try:
        summarized_pages = op.summarize(deduped_pages)
        print(f"Summarized {len(summarized_pages)} articles.")
    except Exception as e:
        print(f"[ERROR] Failed to summarize: {e}")
        print("[WARN] OpenAI Quota Exceeded or LLM Error. Proceeding to push without summaries.")
        
        # Fallback: Prepare pages for push even without summary
        import copy
        for page in deduped_pages:
            p = copy.deepcopy(page)
            p["__summary"] = "Summary unavailable due to LLM Quota Error."
            p["__categories"] = []
            p["__why_it_matters"] = "N/A"
            p["__insights"] = []
            p["__examples"] = []
            # Content might be empty if load_web failed or wasn't called (it's called in summarize)
            # We'll leave it as is or try to load? 
            # ops_rss.summarize loads content. We can skip loading for now to be safe/fast.
            if "content" not in p:
                p["content"] = ""
            summarized_pages.append(p)

    # 4. Push to Notion
    print("\n--- Pushing to Notion ---")

    try:
        targets = ["notion"]
        # Push all summarized pages
        pushed_stats = op.push(summarized_pages, targets)
        print(f"Push stats: {pushed_stats}")
    except Exception as e:
        print(f"[ERROR] Failed to push to Notion: {e}")

    print("\n#####################################################")
    print("# Manual Update Completed")
    print("#####################################################")

if __name__ == "__main__":
    run_manual_update()
