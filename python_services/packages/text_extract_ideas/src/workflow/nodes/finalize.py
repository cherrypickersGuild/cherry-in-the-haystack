from src.workflow.state import PipelineState


def finalize(state: PipelineState) -> PipelineState:
    stats = state.get("stats", {})
    error = state.get("error")

    # 에러가 있으면 에러 메시지 출력
    if error:
        print(f"\n❌ 파이프라인 에러: {error}")
        return state

    # 처리 요약 출력
    _print_summary(stats)

    return state


def _print_summary(stats: dict) -> None:
    """처리 요약 출력."""
    print()  # 진행률 표시 후 줄바꿈
    print("\n" + "=" * 60)
    print("📊 처리 요약")
    print("=" * 60)
    print(f"감지 방법: {stats.get('detection_method', 'toc')}")
    print(f"총 챕터: {stats.get('total_chapters', 0)}")
    print(f"총 섹션: {stats.get('total_sections', 0)}")
    print(f"완료 섹션: {stats.get('completed_sections', 0)}")
    print(f"실패 섹션: {stats.get('failed_sections', 0)}")
    print(f"총 문단: {stats.get('total_paragraphs', 0)}")
    print(f"추출된 아이디어: {stats.get('total_ideas', 0)}")
    print(f"중복 스킵: {stats.get('duplicates_skipped', 0)}")
    print("=" * 60)
