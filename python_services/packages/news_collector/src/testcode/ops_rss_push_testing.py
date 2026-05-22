import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from ops_rss import OperatorRSS

def main():
    print("=== TEST: RSS push ===")

    sample_pages = [
        {
            'url': 'https://www.decodingai.com/p/how-i-automated-91-percent-of-my-business',
            'title': 'How to Ship a Weekly Article in One Day',
            'author': 'Paul Iusztin',
            'article_raw': '<p>Test content</p>',
            'published_at': '2026-04-15T14:10:24Z',
            'list_name': 'Paul Iusztin',
            'cherry_category': 'Insights'
        },
        {
            'url': 'https://www.decodingai.com/p/recursive-language-models',
            'title': 'Your RAG Pipeline Is Overkill',
            'author': 'Paul Iusztin',
            'article_raw': '<p>Test content</p>',
            'published_at': '2026-04-15T14:10:24Z',
            'list_name': 'Paul Iusztin',
            'cherry_category': 'Insights'
        },
    ]

    op = OperatorRSS()
    targets = ["notion"]

    stat = op.push(sample_pages, targets)

    # print("\n=== RESULT ===")
    # print(f"total: {stat['total']}")
    # print(f"error: {stat['error']}")
    # print(f"success: {stat['total'] - stat['error']}")

    # assert stat["total"] == len(sample_pages), "total 수 불일치"
    # assert stat["error"] == 0, f"에러 발생: {stat['error']}건"

    # print("\n✅ push() 정상")


if __name__ == "__main__":
    main()