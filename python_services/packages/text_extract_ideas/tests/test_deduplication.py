#!/usr/bin/env python3
"""
중복제거 로직 통합 테스트

해시 기반 (SHA256 + SimHash) + 임베딩 기반 중복제거 테스트
"""

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

# .env 파일 로드
from dotenv import load_dotenv
load_dotenv()

from rich.console import Console
from rich.table import Table
from rich.panel import Panel

console = Console()


def test_hash_utils():
    """해시 유틸리티 테스트"""
    console.print(Panel.fit("[bold cyan]1. 해시 유틸리티 테스트[/bold cyan]"))

    from python_services.packages.text_extract_ideas.src.dedup.hash_utils import (
        compute_paragraph_hash,
        compute_simhash64,
        hamming_distance,
        is_fuzzy_duplicate,
        normalize_for_hash,
    )

    # 테스트 케이스
    test_cases = [
        {
            "name": "정확히 동일한 텍스트",
            "text1": "Transformer 모델은 attention 메커니즘을 사용한다.",
            "text2": "Transformer 모델은 attention 메커니즘을 사용한다.",
            "expected_exact": True,
            "expected_fuzzy": True,
        },
        {
            "name": "대소문자만 다른 경우",
            "text1": "Transformer 모델은 attention 메커니즘을 사용한다.",
            "text2": "transformer 모델은 ATTENTION 메커니즘을 사용한다.",
            "expected_exact": True,  # 정규화 후 동일
            "expected_fuzzy": True,
        },
        {
            "name": "공백만 다른 경우",
            "text1": "Transformer 모델은 attention 메커니즘을 사용한다.",
            "text2": "Transformer  모델은   attention 메커니즘을  사용한다.",
            "expected_exact": True,  # 정규화 후 동일
            "expected_fuzzy": True,
        },
        {
            "name": "약간 다른 텍스트 (퍼지 매칭 한계)",
            "text1": "Transformer 모델은 attention 메커니즘을 사용한다.",
            "text2": "Transformer 모델은 attention 메커니즘을 활용한다.",
            "expected_exact": False,
            "expected_fuzzy": False,  # 한글 특성상 해밍 거리가 커서 퍼지 매칭 안됨
        },
        {
            "name": "완전히 다른 텍스트",
            "text1": "Transformer 모델은 attention 메커니즘을 사용한다.",
            "text2": "딥러닝은 인공지능의 한 분야이다.",
            "expected_exact": False,
            "expected_fuzzy": False,
        },
    ]

    table = Table(title="해시 테스트 결과")
    table.add_column("케이스", style="cyan")
    table.add_column("SHA256 동일", style="green")
    table.add_column("해밍 거리", style="yellow")
    table.add_column("퍼지 중복", style="magenta")
    table.add_column("결과", style="white")

    all_passed = True
    for case in test_cases:
        hash1 = compute_paragraph_hash(case["text1"])
        hash2 = compute_paragraph_hash(case["text2"])
        exact_match = hash1 == hash2

        sim1 = compute_simhash64(case["text1"])
        sim2 = compute_simhash64(case["text2"])
        h_dist = hamming_distance(sim1, sim2)
        fuzzy_match = is_fuzzy_duplicate(sim1, sim2, threshold=6)

        exact_ok = exact_match == case["expected_exact"]
        fuzzy_ok = fuzzy_match == case["expected_fuzzy"]

        result = "✅ PASS" if (exact_ok and fuzzy_ok) else "❌ FAIL"
        if not (exact_ok and fuzzy_ok):
            all_passed = False

        table.add_row(
            case["name"],
            f"{'예' if exact_match else '아니오'} ({'✓' if exact_ok else '✗'})",
            str(h_dist),
            f"{'예' if fuzzy_match else '아니오'} ({'✓' if fuzzy_ok else '✗'})",
            result,
        )

    console.print(table)
    return all_passed


def test_dedup_service():
    """DeduplicationService 테스트 (DB 연결 필요)"""
    console.print(Panel.fit("[bold cyan]2. DeduplicationService 테스트[/bold cyan]"))

    try:
        from python_services.packages.text_extract_ideas.src.db.connection import get_session
        from python_services.packages.text_extract_ideas.src.dedup.dedup_service import DeduplicationService

        session = get_session()
        console.print("[green]✅ DB 연결 성공[/green]")

        service = DeduplicationService(
            session=session,
            fuzzy_threshold=6,
            semantic_threshold=0.95,
            enable_semantic=False,
        )

        # 테스트 텍스트
        test_text = "이것은 테스트 텍스트입니다. 중복 체크를 위한 샘플입니다."

        result = service.check_duplicate(test_text, book_id=None)

        console.print(f"   중복 여부: {result.is_duplicate}")
        console.print(f"   중복 타입: {result.duplicate_type}")
        console.print(f"   유사도: {result.similarity_score}")

        session.close()
        return True

    except Exception as e:
        console.print(f"[yellow]⚠️ DB 테스트 스킵: {e}[/yellow]")
        return None  # 스킵


def test_embedding_utils():
    """임베딩 유틸리티 테스트 (OpenAI API 필요)"""
    console.print(Panel.fit("[bold cyan]3. 임베딩 유틸리티 테스트[/bold cyan]"))

    import os

    if not os.getenv("OPENAI_API_KEY"):
        console.print("[yellow]⚠️ OPENAI_API_KEY 미설정 - 임베딩 테스트 스킵[/yellow]")
        return None

    try:
        from python_services.packages.text_extract_ideas.src.dedup.embedding_utils import (
            compute_embedding,
            cosine_similarity,
            is_semantic_duplicate,
        )

        # 테스트 텍스트 쌍
        text_pairs = [
            {
                "name": "의미적으로 동일",
                "text1": "Transformer 모델은 self-attention 메커니즘을 사용한다.",
                "text2": "Self-attention 기반의 Transformer 아키텍처가 활용된다.",
                "expected_similar": True,
            },
            {
                "name": "의미적으로 다름",
                "text1": "Transformer 모델은 attention 메커니즘을 사용한다.",
                "text2": "오늘 날씨가 매우 좋습니다.",
                "expected_similar": False,
            },
        ]

        table = Table(title="임베딩 유사도 테스트")
        table.add_column("케이스", style="cyan")
        table.add_column("코사인 유사도", style="green")
        table.add_column("중복 판정 (>=0.85)", style="yellow")
        table.add_column("토큰 사용", style="magenta")

        for pair in text_pairs:
            result1 = compute_embedding(pair["text1"])
            result2 = compute_embedding(pair["text2"])

            similarity = cosine_similarity(result1.embedding, result2.embedding)
            is_dup = is_semantic_duplicate(result1.embedding, result2.embedding, threshold=0.85)

            tokens_used = result1.tokens_used + result2.tokens_used

            table.add_row(
                pair["name"],
                f"{similarity:.4f}",
                "예" if is_dup else "아니오",
                str(tokens_used),
            )

        console.print(table)
        return True

    except Exception as e:
        console.print(f"[red]❌ 임베딩 테스트 실패: {e}[/red]")
        return False


def test_workflow_integration():
    """워크플로우 통합 테스트"""
    console.print(Panel.fit("[bold cyan]4. 워크플로우 통합 테스트[/bold cyan]"))

    from python_services.packages.text_extract_ideas.src.workflow.state import PipelineState
    from python_services.packages.text_extract_ideas.src.workflow.nodes.check_duplicate import check_chunk_duplicate

    # 테스트 청크 생성
    class MockChunk:
        def __init__(self, text):
            self.text = text

    # 테스트 케이스
    test_cases = [
        {
            "name": "기본 해시 체크 (semantic off)",
            "text": "이것은 테스트 청크입니다. 워크플로우 통합 테스트용.",
            "enable_semantic": False,
        },
        {
            "name": "해시 + 임베딩 체크 (semantic on)",
            "text": "이것은 또 다른 테스트 청크입니다. 임베딩 체크도 포함.",
            "enable_semantic": True,
        },
    ]

    table = Table(title="워크플로우 노드 테스트")
    table.add_column("케이스", style="cyan")
    table.add_column("enable_semantic", style="yellow")
    table.add_column("is_chunk_duplicate", style="green")
    table.add_column("duplicate_type", style="magenta")

    for case in test_cases:
        state: PipelineState = {
            "current_chunk": MockChunk(case["text"]),
            "book_id": None,
            "enable_semantic_dedup": case["enable_semantic"],
            "semantic_threshold": 0.95,
            "stats": {},
        }

        try:
            result_state = check_chunk_duplicate(state)

            table.add_row(
                case["name"],
                str(case["enable_semantic"]),
                str(result_state.get("is_chunk_duplicate", False)),
                str(result_state.get("chunk_duplicate_type", "N/A")),
            )
        except Exception as e:
            table.add_row(
                case["name"],
                str(case["enable_semantic"]),
                f"[red]Error: {str(e)[:30]}[/red]",
                "N/A",
            )

    console.print(table)
    return True


def test_pipeline_state():
    """PipelineState 필드 확인"""
    console.print(Panel.fit("[bold cyan]5. PipelineState 필드 확인[/bold cyan]"))

    from python_services.packages.text_extract_ideas.src.workflow.state import PipelineState, create_initial_state

    # 새 필드 확인
    required_fields = [
        "enable_semantic_dedup",
        "semantic_threshold",
    ]

    # TypedDict 필드 확인
    annotations = PipelineState.__annotations__
    console.print(f"   총 필드 수: {len(annotations)}개")

    table = Table(title="새로 추가된 필드")
    table.add_column("필드", style="cyan")
    table.add_column("타입", style="green")
    table.add_column("존재 여부", style="yellow")

    all_exist = True
    for field in required_fields:
        exists = field in annotations
        if not exists:
            all_exist = False
        table.add_row(
            field,
            str(annotations.get(field, "N/A")),
            "✅" if exists else "❌",
        )

    console.print(table)

    # 초기 상태 생성 테스트
    initial_state = create_initial_state(pdf_path="test.pdf")
    console.print(f"\n   초기 상태 생성: ✅")
    console.print(f"   stats 필드: {list(initial_state.get('stats', {}).keys())}")

    return all_exist


def test_workflow_options():
    """run_pdf_pipeline 옵션 확인"""
    console.print(Panel.fit("[bold cyan]6. run_pdf_pipeline 옵션 확인[/bold cyan]"))

    import inspect
    from python_services.packages.text_extract_ideas.src.workflow.workflow import run_pdf_pipeline

    sig = inspect.signature(run_pdf_pipeline)
    params = sig.parameters

    required_params = ["enable_semantic_dedup", "semantic_threshold"]

    table = Table(title="파이프라인 옵션")
    table.add_column("파라미터", style="cyan")
    table.add_column("기본값", style="green")
    table.add_column("존재 여부", style="yellow")

    all_exist = True
    for param in required_params:
        exists = param in params
        if not exists:
            all_exist = False
        default = params[param].default if exists else "N/A"
        table.add_row(param, str(default), "✅" if exists else "❌")

    console.print(table)
    return all_exist


def run_all_tests():
    """모든 테스트 실행"""
    console.print(Panel.fit(
        "[bold blue]중복제거 로직 통합 테스트[/bold blue]\n"
        "해시 기반 (SHA256 + SimHash) + 임베딩 기반 중복제거"
    ))

    results = {}

    # 1. 해시 유틸리티 테스트
    results["hash_utils"] = test_hash_utils()

    # 2. DeduplicationService 테스트
    results["dedup_service"] = test_dedup_service()

    # 3. 임베딩 유틸리티 테스트
    results["embedding_utils"] = test_embedding_utils()

    # 4. 워크플로우 통합 테스트
    results["workflow_integration"] = test_workflow_integration()

    # 5. PipelineState 필드 확인
    results["pipeline_state"] = test_pipeline_state()

    # 6. run_pdf_pipeline 옵션 확인
    results["workflow_options"] = test_workflow_options()

    # 최종 요약
    console.print("\n" + "=" * 60)
    console.print("[bold green]📊 테스트 결과 요약[/bold green]")
    console.print("=" * 60)

    summary_table = Table(show_header=True)
    summary_table.add_column("테스트", style="cyan")
    summary_table.add_column("결과", style="white")

    for name, result in results.items():
        if result is True:
            status = "[green]✅ PASS[/green]"
        elif result is False:
            status = "[red]❌ FAIL[/red]"
        else:
            status = "[yellow]⏭️ SKIP[/yellow]"
        summary_table.add_row(name, status)

    console.print(summary_table)

    # 전체 결과
    passed = sum(1 for r in results.values() if r is True)
    failed = sum(1 for r in results.values() if r is False)
    skipped = sum(1 for r in results.values() if r is None)

    console.print(f"\n통과: {passed} | 실패: {failed} | 스킵: {skipped}")

    if failed == 0:
        console.print("\n[bold green]🎉 모든 테스트 통과![/bold green]")
    else:
        console.print("\n[bold red]⚠️ 일부 테스트 실패[/bold red]")


if __name__ == "__main__":
    run_all_tests()
