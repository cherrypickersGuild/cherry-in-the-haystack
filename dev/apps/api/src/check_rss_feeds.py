
import sys
import os
import requests
import feedparser

# Ensure we can import from config
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from config.rss_feeds import get_enabled_feeds, FeedCategories

def test_feed(feed):
    name = feed['name']
    url = feed['url']
    category = feed.get('category', 'Unknown')
    
    print(f"Testing [{category}] {name}: {url}...")
    try:
        # Use headers to mimic browser
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/rss+xml, application/xml, text/xml, */*'
        }
        response = requests.get(url, headers=headers, timeout=10)
        
        print(f"  Status Code: {response.status_code}")
        
        if response.status_code != 200:
             print(f"  [FAIL] HTTP Error {response.status_code}")
             return False

        feed_data = feedparser.parse(response.content)
        
        if feed_data.bozo:
            print(f"  [WARN] Feed bozo (malformed): {feed_data.bozo_exception}")

        if len(feed_data.entries) > 0:
            print(f"  [SUCCESS] Found {len(feed_data.entries)} entries.")
            print(f"  Latest title: {feed_data.entries[0].title}")
            return True
        else:
            print(f"  [FAIL] No entries found.")
            return False

    except Exception as e:
        print(f"  [ERROR] {e}")
        return False

if __name__ == "__main__":
    print("Loading feeds from config...")
    feeds = get_enabled_feeds()
    
    # Filter for Category 1 (Practical) if requested, or just run all.
    # User asked about Category 1 specifically, but checking all is safer.
    # Let's check Category 1 first then others.
    
    cat1_feeds = [f for f in feeds if f.get('category') == FeedCategories.PRACTICAL]
    other_feeds = [f for f in feeds if f.get('category') != FeedCategories.PRACTICAL]
    
    print(f"\n--- Testing Category 1 (Practical) Feeds ({len(cat1_feeds)}) ---")
    results = []
    for feed in cat1_feeds:
        res = test_feed(feed)
        results.append((feed['name'], res))
        print("-" * 40)

    print(f"\n--- Testing Other Feeds ({len(other_feeds)}) ---")
    for feed in other_feeds:
        res = test_feed(feed)
        results.append((feed['name'], res))
        print("-" * 40)
        
    print("\nSUMMARY:")
    for name, success in results:
        status = "PASS" if success else "FAIL"
        print(f"[{status}] {name}")
