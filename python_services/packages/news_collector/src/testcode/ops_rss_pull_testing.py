import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from ops_rss import OperatorRSS

def main():
    print("=== TEST: RSS pull ===")

    op = OperatorRSS()
    result = op.pull()
    
    print("\n=== RESULT ===")
    print(f"type: {type(result)}")
    print(f"len: {len(result)}")

    print("\n=== ALL ARTICLES ===")

    for i, article in enumerate(result):
        print(f"\n--- [{i}] ---")
        for k, v in article.items():
            print(f"{k}: {str(v)[:50]}")

    # ✅ 구조 검증 (첫 번째만 체크)
    if len(result) > 0:
        sample = result[0]
        required_keys = ["url", "title", "author", "article_raw", "published_at", "cherry_category"]

        for key in required_keys:
            assert key in sample, f"{key} 없음"

    print("\n✅ pull() 구조 정상")


if __name__ == "__main__":
    main()