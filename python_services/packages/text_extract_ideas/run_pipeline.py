#!/usr/bin/env python3
"""PDF 파이프라인 실행 스크립트."""
import sys
import warnings

warnings.filterwarnings('ignore')

# 환경변수 로드
from dotenv import load_dotenv
load_dotenv()

from src.workflow.workflow import run_pdf_pipeline


def main():
    # 기본값 또는 인자로 PDF 경로 받기
    if len(sys.argv) > 1:
        pdf_path = sys.argv[1]
    else:
        pdf_path = 'AI Engineering.pdf'
        #AI Engineering.pdf
        #LLM Engineers Handbook.pdf
    model_version = sys.argv[2] if len(sys.argv) > 2 else 'gemini-2.5-flash'

    print(f"📄 PDF: {pdf_path}")
    print(f"🤖 Model: {model_version}")
    print()

    result = run_pdf_pipeline(
        pdf_path=pdf_path,
        model_version=model_version
    )

    if isinstance(result, dict) and result.get('error'):
        print(f"\n❌ Error: {result['error']}")
        sys.exit(1)


if __name__ == '__main__':
    main()
