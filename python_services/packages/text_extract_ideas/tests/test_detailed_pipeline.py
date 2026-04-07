#!/usr/bin/env python3
"""
상세 파이프라인 테스트 - TOC 기반 챕터/섹션/문단/아이디어 전체 확인

PDF → TOC 기반 챕터/섹션 감지 → 문단 분할 → 아이디어 추출
결과를 JSON 파일과 콘솔에 출력.
"""

import sys
import json
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent))

from rich.console import Console
from rich.panel import Panel
from rich.tree import Tree
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn

from src.workflow.state import create_initial_state
from src.workflow.nodes import extract_text
from src.workflow.nodes.process_section import (
    _chunk_section,
    _extract_idea,
)
from src.utils.pdf.hierarchy_detector import (
    detect_chapters_from_toc,
    get_leaf_sections,
)

console = Console()

# Front matter 패턴 (건너뛸 챕터들)
FRONT_MATTER_PATTERNS = [
    "Cover",
    "Copyright",
    "Table of Contents",
    "Preface",
    "Acknowledgments",
    "Foreword",
    "Introduction",  # 주의: 일부 책에서는 실제 챕터일 수 있음
    "About the Author",
    "About the",
    "Dedication",
    "Contents",
]


def is_front_matter(title: str) -> bool:
    """Front matter 챕터인지 확인."""
    title_lower = title.lower().strip()
    for pattern in FRONT_MATTER_PATTERNS:
        if title_lower.startswith(pattern.lower()):
            return True
    return False


def run_detailed_test(
    pdf_path: str,
    max_chapters: int = 3,
    max_sections_per_chapter: int = 5,
    max_paragraphs_per_section: int = 5,
    output_json: bool = True,
    start_chapter: int = 1,
    skip_front_matter: bool = False,
):
    """
    TOC 기반 상세 파이프라인 테스트 실행.

    Args:
        pdf_path: PDF 파일 경로
        max_chapters: 테스트할 최대 챕터 수
        max_sections_per_chapter: 챕터당 테스트할 최대 섹션 수
        max_paragraphs_per_section: 섹션당 아이디어 추출할 최대 문단 수
        output_json: JSON 파일로 결과 저장 여부
        start_chapter: 시작 챕터 번호 (1-indexed, 필터링 후 기준)
        skip_front_matter: Front matter (Preface 등) 건너뛰기
    """
    results = {
        "pdf_path": pdf_path,
        "timestamp": datetime.now().isoformat(),
        "pipeline_type": "toc",
        "options": {
            "start_chapter": start_chapter,
            "skip_front_matter": skip_front_matter,
            "max_chapters": max_chapters,
            "max_sections_per_chapter": max_sections_per_chapter,
            "max_paragraphs_per_section": max_paragraphs_per_section,
        },
        "summary": {},
        "chapters": []
    }

    console.print(Panel.fit(
        f"[bold blue]TOC 기반 상세 파이프라인 테스트[/bold blue]\n"
        f"PDF: {pdf_path}\n"
        f"최대 챕터: {max_chapters}개 | 섹션: {max_sections_per_chapter}개 | 문단: {max_paragraphs_per_section}개\n"
        f"시작 챕터: {start_chapter} | Front matter 건너뛰기: {'예' if skip_front_matter else '아니오'}\n"
        f"감지 방법: [yellow]TOC (PDF 목차 기반)[/yellow]"
    ))

    # ============================================================
    # 1. PDF → Plain Text + TOC 추출
    # ============================================================
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        task = progress.add_task("PDF → Plain Text + TOC 추출 중...", total=None)
        state = create_initial_state(pdf_path=pdf_path)
        state = extract_text(state)

        if state.get("error"):
            console.print(f"[red]❌ 에러: {state['error']}[/red]")
            return

        plain_text = state.get("plain_text", "")
        toc = state.get("toc", [])
        has_toc = state.get("has_toc", False)
        page_positions = state.get("page_positions", [])

        console.print(f"\n[green]✅ Plain Text + TOC 추출 완료[/green]")
        console.print(f"   텍스트 길이: {len(plain_text):,}자")
        console.print(f"   TOC 항목: {len(toc)}개 {'✅' if has_toc else '❌ (TOC 없음)'}")

        if not has_toc:
            console.print("[red]❌ PDF에 TOC가 없습니다.[/red]")
            return

        # Step 2: TOC 기반 챕터/섹션 감지
        progress.update(task, description="TOC 기반 챕터/섹션 감지 중...")
        chapters = detect_chapters_from_toc(
            pdf_path=pdf_path,
            plain_text=plain_text,
            page_positions=page_positions,
        )
        console.print(f"   감지된 챕터: {len(chapters)}개")

    # 기본 정보
    results["summary"]["text_length"] = len(plain_text)
    results["summary"]["total_chapters"] = len(chapters)

    # 전체 섹션 수 계산
    def count_sections(sections):
        count = len(sections)
        for sec in sections:
            count += count_sections(sec.children)
        return count

    total_sections = sum(count_sections(ch.sections) for ch in chapters)
    results["summary"]["total_sections"] = total_sections

    console.print(f"   감지된 섹션: {total_sections}개")

    # ============================================================
    # 2. 챕터 필터링
    # ============================================================
    filtered_chapters = chapters

    if skip_front_matter:
        original_count = len(filtered_chapters)
        filtered_chapters = [ch for ch in filtered_chapters if not is_front_matter(ch.title)]
        skipped_count = original_count - len(filtered_chapters)
        if skipped_count > 0:
            console.print(f"\n[yellow]📌 Front matter {skipped_count}개 챕터 건너뜀[/yellow]")

    # 시작 챕터 적용 (1-indexed)
    if start_chapter > 1:
        filtered_chapters = filtered_chapters[start_chapter - 1:]
        console.print(f"[yellow]📌 챕터 {start_chapter}부터 시작[/yellow]")

    if not filtered_chapters:
        console.print("[red]❌ 처리할 챕터가 없습니다.[/red]")
        return

    results["summary"]["filtered_chapters"] = len(filtered_chapters)

    # ============================================================
    # 3. 문서 구조 트리 출력
    # ============================================================
    console.print(f"\n[yellow]📚 문서 구조 트리 (TOC 기반)[/yellow]")
    doc_tree = Tree("[bold]📖 문서 구조[/bold]")

    def add_sections_to_tree(parent_branch, sections, max_show=5):
        for idx, section in enumerate(sections[:max_show]):
            child_count = len(section.children)
            sec_branch = parent_branch.add(
                f"[green]L{section.level}. {section.title[:40]}[/green] "
                f"({len(section.content):,}자, {child_count} 하위)"
            )
            if section.children:
                add_sections_to_tree(sec_branch, section.children, max_show=3)
        if len(sections) > max_show:
            parent_branch.add(f"[dim]... (+{len(sections) - max_show}개)[/dim]")

    for ch_idx, chapter in enumerate(filtered_chapters[:10]):
        section_count = count_sections(chapter.sections)
        ch_branch = doc_tree.add(
            f"[bold cyan]Ch{chapter.chapter_number}. {chapter.title[:50]}[/bold cyan] "
            f"({len(chapter.content):,}자, {section_count} 섹션)"
        )
        add_sections_to_tree(ch_branch, chapter.sections, max_show=5)

    if len(filtered_chapters) > 10:
        doc_tree.add(f"[dim]... (+{len(filtered_chapters) - 10}개 챕터)[/dim]")

    console.print(doc_tree)

    # ============================================================
    # 4. 챕터별 상세 처리
    # ============================================================
    total_paragraphs = 0
    total_ideas = 0

    for ch_idx, chapter in enumerate(filtered_chapters[:max_chapters]):
        console.print(f"\n{'='*70}")
        console.print(f"[bold yellow]📖 챕터 {chapter.chapter_number}: {chapter.title}[/bold yellow]")
        console.print(f"   본문: {len(chapter.content):,}자 | 섹션: {len(chapter.sections)}개")
        console.print(f"   감지 방법: {chapter.detection_method}")
        console.print(f"{'='*70}")

        chapter_result = {
            "chapter_number": chapter.chapter_number,
            "title": chapter.title,
            "detection_method": chapter.detection_method,
            "text_length": len(chapter.content),
            "section_count": len(chapter.sections),
            "sections": []
        }

        # 말단 섹션 추출
        leaf_sections = get_leaf_sections(chapter)
        tested_sections = 0

        for section, hierarchy_path in leaf_sections[:max_sections_per_chapter]:
            console.print(f"\n   [cyan]{'─'*50}[/cyan]")
            console.print(f"   [bold cyan]📑 {section.title}[/bold cyan]")
            console.print(f"   계층: {hierarchy_path}")
            console.print(f"   레벨: {section.level} | 본문: {len(section.content):,}자")

            if len(section.content.strip()) < 100:
                console.print("   [dim]⚠️ 본문이 너무 짧아 건너뜁니다.[/dim]")
                continue

            tested_sections += 1

            section_result = {
                "title": section.title,
                "level": section.level,
                "hierarchy_path": hierarchy_path,
                "text_length": len(section.content),
                "paragraphs": []
            }

            # 청킹 수행 (LLM 기반)
            try:
                chunks = _chunk_section(
                    section_text=section.content,
                    section_title=section.title,
                    chapter_id=ch_idx + 1,
                    chapter_title=chapter.title,
                    hierarchy_path=hierarchy_path,
                    section_level=section.level,
                )
                console.print(f"   ✅ {len(chunks)}개 문단 분할 완료")
            except Exception as e:
                console.print(f"   [red]❌ 청킹 실패: {e}[/red]")
                chunks = []

            total_paragraphs += len(chunks)
            section_result["paragraph_count"] = len(chunks)

            # 문단별 아이디어 추출
            for para_idx, chunk in enumerate(chunks[:max_paragraphs_per_section]):
                console.print(f"\n      [dim]── 문단 {para_idx + 1}/{len(chunks)} ({len(chunk.text)}자) ──[/dim]")

                # 텍스트 전체 출력
                console.print(f"      [dim]{chunk.text}[/dim]")

                # 계층 정보 출력
                console.print(f"      [cyan]계층: {chunk.hierarchy_path}[/cyan]")

                # 앞뒤 문단 컨텍스트
                prev_text = chunks[para_idx - 1].text if para_idx > 0 else ""
                next_text = chunks[para_idx + 1].text if para_idx < len(chunks) - 1 else ""

                paragraph_result = {
                    "index": para_idx + 1,
                    "text": chunk.text,
                    "text_length": len(chunk.text),
                    "hierarchy_path": chunk.hierarchy_path,
                    "detection_method": chunk.detection_method,
                }

                # LLM으로 개념 추출 (컨텍스트 포함)
                try:
                    extracted = _extract_idea(
                        chunk.text,
                        hierarchy_path=chunk.hierarchy_path,
                        prev_text=prev_text,
                        next_text=next_text,
                    )

                    if extracted and extracted.concept:
                        console.print(f"      [green]✅ 핵심 개념: {extracted.concept}[/green]")
                        paragraph_result["concept"] = extracted.concept
                        total_ideas += 1
                    else:
                        console.print(f"      [yellow]⚠️ 추출된 개념 없음[/yellow]")
                        paragraph_result["concept"] = None

                except Exception as e:
                    console.print(f"      [red]❌ 추출 실패: {e}[/red]")
                    paragraph_result["concept"] = None
                    paragraph_result["error"] = str(e)

                section_result["paragraphs"].append(paragraph_result)

            # 나머지 문단 (아이디어 추출 없이)
            if len(chunks) > max_paragraphs_per_section:
                remaining = len(chunks) - max_paragraphs_per_section
                console.print(f"\n      [dim]... +{remaining}개 문단 (아이디어 추출 생략)[/dim]")

            chapter_result["sections"].append(section_result)

        # 나머지 섹션
        if len(leaf_sections) > max_sections_per_chapter:
            remaining = len(leaf_sections) - max_sections_per_chapter
            console.print(f"\n   [dim]... +{remaining}개 섹션 (처리 생략)[/dim]")

        results["chapters"].append(chapter_result)

    # ============================================================
    # 5. 최종 요약
    # ============================================================
    results["summary"]["tested_chapters"] = min(max_chapters, len(filtered_chapters))
    results["summary"]["total_paragraphs"] = total_paragraphs
    results["summary"]["total_ideas_extracted"] = total_ideas

    console.print(f"\n{'='*70}")
    console.print("[bold green]📊 최종 요약[/bold green]")
    console.print(f"{'='*70}")

    summary_table = Table(show_header=False, box=None)
    summary_table.add_column("항목", style="cyan")
    summary_table.add_column("값", style="white")

    summary_table.add_row("텍스트 길이", f"{len(plain_text):,}자")
    summary_table.add_row("감지된 전체 챕터", str(len(chapters)))
    summary_table.add_row("필터링 후 챕터", str(len(filtered_chapters)))
    summary_table.add_row("감지된 전체 섹션", str(total_sections))
    summary_table.add_row("테스트한 챕터", str(min(max_chapters, len(filtered_chapters))))
    summary_table.add_row("처리된 문단", str(total_paragraphs))
    summary_table.add_row("추출된 아이디어", str(total_ideas))
    summary_table.add_row("감지 방법", "TOC (PDF 목차)")

    console.print(summary_table)

    # JSON 저장
    if output_json:
        output_path = Path("pipeline_test_results.json")
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
        console.print(f"\n[green]📁 결과 저장: {output_path}[/green]")

    return results


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="TOC 기반 상세 파이프라인 테스트")
    parser.add_argument("pdf_path", nargs="?", default="AI Engineering.pdf")
    parser.add_argument("--chapters", "-c", type=int, default=2, help="테스트할 챕터 수")
    parser.add_argument("--sections", "-s", type=int, default=3, help="챕터당 섹션 수")
    parser.add_argument("--paragraphs", "-p", type=int, default=3, help="섹션당 아이디어 추출할 문단 수")
    parser.add_argument("--start-chapter", type=int, default=1, help="시작 챕터 번호 (1-indexed, 필터링 후 기준)")
    parser.add_argument("--skip-front-matter", action="store_true", help="Front matter (Preface 등) 건너뛰기")
    parser.add_argument("--no-json", action="store_true", help="JSON 저장 안함")

    args = parser.parse_args()

    pdf_path = Path(args.pdf_path)
    if not pdf_path.exists():
        pdf_path = Path(__file__).parent.parent / args.pdf_path

    if not pdf_path.exists():
        console.print(f"[red]❌ 파일 없음: {args.pdf_path}[/red]")
        sys.exit(1)

    run_detailed_test(
        str(pdf_path),
        max_chapters=args.chapters,
        max_sections_per_chapter=args.sections,
        max_paragraphs_per_section=args.paragraphs,
        output_json=not args.no_json,
        start_chapter=args.start_chapter,
        skip_front_matter=args.skip_front_matter,
    )
