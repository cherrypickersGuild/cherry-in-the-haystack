#!/usr/bin/env python
"""
Source Discovery Agent CLI

Usage:
    python -m source_discovery discover --topic "AI Safety" --type RSS
    python -m source_discovery review --status new --limit 10
    python -m source_discovery approve <candidate_id> --score 4
    python -m source_discovery reject <candidate_id> --reason "Low quality"
    python -m source_discovery sync
    python -m source_discovery stats
"""
import argparse
import sys
from datetime import datetime
from src.discoverer import SourceDiscoverer, SourceCandidate, SourceType
def discover(args):
    """Run source discovery."""
    discoverer = SourceDiscoverer()
    # Configure database IDs
    if args.candidates_db:
        discoverer.set_candidates_database(args.candidates_db)
    if args.sources_db:
        discoverer.load_existing_sources(args.sources_db)
    # Run discovery
    candidates = discoverer.discover_sources(
        topic=args.topic,
        source_type=SourceType(args.type) if args.type else None,
        max_results=args.limit
    )
    print(f"\n{'='*60}")
    print(f"Discovery Complete: {len(candidates)} candidates found")
    print(f"{'='*60}\n")
    if not candidates:
        print("No candidates meeting threshold found.")
        return
    # Display results
    for i, c in enumerate(candidates, 1):
        print(f"\n--- Candidate {i} ---")
        print(f"Name: {c.name}")
        print(f"URL: {c.url}")
        print(f"Type: {c.source_type.value}")
        print(f"Score: {c.auto_score} ({c.priority} priority)")
        print(f"Topics: {', '.join(c.topics)}")
        print(f"Reason: {c.reason}")
    # Stage to Notion if requested
    if args.stage:
        print(f"\nStaging {len(candidates)} candidates to Notion...")
        for c in candidates:
            try:
                page_id = discoverer.stage_candidate(c)
                print(f"  ✓ {c.name} -> {page_id}")
            except Exception as e:
                print(f"  ✗ {c.name}: {e}")
def review(args):
    """Interactive review of candidates."""
    discoverer = SourceDiscoverer()
    if args.candidates_db:
        discoverer.set_candidates_database(args.candidates_db)
    # Get candidates
    candidates = discoverer.get_candidates_for_review(
        status=args.status,
        limit=args.limit,
        priority=args.priority
    )
    if not candidates:
        print(f"No candidates with status '{args.status}' found.")
        return
    print(f"\nFound {len(candidates)} candidates to review\n")
    for i, candidate in enumerate(candidates):
        print(f"\n{'='*60}")
        print(f"Candidate {i+1} of {len(candidates)}")
        print(f"{'='*60}")
        print(f"Name: {candidate.name}")
        print(f"URL: {candidate.url}")
        print(f"Type: {candidate.source_type.value}")
        print(f"Auto Score: {candidate.auto_score} ({candidate.priority} priority)")
        print(f"\nTopics: {', '.join(candidate.topics)}")
        print(f"\nReason: {candidate.reason}")
        if candidate.sample_content:
            sample = candidate.sample_content[:500]
            print(f"\nRecent Content Sample:")
            print(f"  {sample}...")
        if candidate.metadata:
            print(f"\nMetadata:")
            for key, value in candidate.metadata.items():
                if value:
                    print(f"  {key}: {value}")
        print(f"\n{'='*60}")
        print(f"Actions: [a]pprove [r]eject [s]kip [n]otes [o]pen [q]uit")
        while True:
            action = input("> ").strip().lower()
            if action == 'a':
                # Approve
                score_input = input("Score (1-5): ").strip()
                try:
                    score = int(score_input)
                    if score < 1 or score > 5:
                        print("Score must be 1-5")
                        continue
                except ValueError:
                    print("Invalid score")
                    continue
                notes = input("Notes (optional): ").strip()
                if discoverer.approve_candidate(
                    candidate.notion_page_id,
                    score,
                    "CLI Reviewer",
                    notes
                ):
                    print("✓ Approved!")
                break
            elif action == 'r':
                # Reject
                reason = input("Rejection reason: ").strip()
                if discoverer.reject_candidate(
                    candidate.notion_page_id,
                    "CLI Reviewer",
                    reason
                ):
                    print("✓ Rejected!")
                break
            elif action == 's':
                # Skip
                print("Skipped for now.")
                break
            elif action == 'n':
                # Notes only
                notes = input("Notes: ").strip()
                print(f"Notes recorded (you can still approve/reject later)")
                break
            elif action == 'o':
                # Open in browser
                import webbrowser
                webbrowser.open(candidate.url)
                continue
            elif action == 'q':
                # Quit
                print("Exiting review mode.")
                return
            else:
                print("Invalid action. Use: a/r/s/n/o/q")
                continue
            # Move to next candidate
            break
def approve(args):
    """Approve a specific candidate."""
    discoverer = SourceDiscoverer()
    if args.candidates_db:
        discoverer.set_candidates_database(args.candidates_db)
    if discoverer.approve_candidate(
        args.candidate_id,
        args.score,
        "CLI",
        args.notes or ""
    ):
        print(f"✓ Approved candidate {args.candidate_id}")
    else:
        print(f"✗ Failed to approve candidate")
def reject(args):
    """Reject a specific candidate."""
    discoverer = SourceDiscoverer()
    if args.candidates_db:
        discoverer.set_candidates_database(args.candidates_db)
    if discoverer.reject_candidate(
        args.candidate_id,
        "CLI",
        args.reason or "Rejected via CLI"
    ):
        print(f"✓ Rejected candidate {args.candidate_id}")
    else:
        print(f"✗ Failed to reject candidate")
def sync(args):
    """Sync approved candidates to sources database."""
    discoverer = SourceDiscoverer()
    if args.candidates_db:
        discoverer.set_candidates_database(args.candidates_db)
    synced = discoverer.sync_approved_to_sources(args.sources_db)
    print(f"\nSynced {synced} candidates to sources database")
def stats(args):
    """Show discovery statistics."""
    discoverer = SourceDiscoverer()
    if args.candidates_db:
        discoverer.set_candidates_database(args.candidates_db)
    # Get counts by status
    new_candidates = discoverer.get_candidates_for_review(status="new", limit=100)
    approved = discoverer.get_candidates_for_review(status="Approved", limit=100)
    rejected = discoverer.get_candidates_for_review(status="Rejected", limit=100)
    print(f"\n{'='*60")
    print("Source Discovery Statistics")
    print(f"{'='*60}\n")
    print(f"New (pending review):    {len(new_candidates)}")
    print(f"Approved:                {len(approved)}")
    print(f"Rejected:                {len(rejected)}")
    # Priority breakdown
    high_priority = [c for c in new_candidates if c.priority == "high"]
    print(f"\nHigh priority (review first): {len(high_priority)}")
    # Type breakdown
    types = {}
    for c in new_candidates:
        t = c.source_type.value
        types[t] = types.get(t, 0) + 1
    print(f"\nBy Source Type:")
    for t, count in types.items():
        print(f"  {t}: {count}")
def main():
    parser = argparse.ArgumentParser(
        description="Source Discovery Agent",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    subparsers = parser.add_subparsers(dest="subcommands", required=True)
    # Discover command
    discover_parser = subparsers.add_parser(
        "discover",
        help="Discover new sources"
    )
    discover_parser.add_argument(
        "--topic", "-t",
        required=True,
        help="Topic to discover sources for"
    )
    discover_parser.add_argument(
        "--type",
        choices=["RSS", "TWITTER", "YOUTUBE", "REDDIT", "BLOG"],
        help="Source type filter"
    )
    discover_parser.add_argument(
        "--limit",
        type=int,
        default=10,
        help="Maximum results"
    )
    discover_parser.add_argument(
        "--stage",
        action="store_true",
        help="Stage candidates to Notion"
    )
    discover_parser.add_argument(
        "--candidates-db",
        help="Notion candidates database ID"
    )
    discover_parser.add_argument(
        "--sources-db",
        help="Notion sources database ID (for duplicate check)"
    )
    discover_parser.set_defaults(func=discover)
    # Review command
    review_parser = subparsers.add_parser(
        "review",
        help="Interactive review of candidates"
    )
    review_parser.add_argument(
        "--status",
        default="new",
        choices=["new", "under_review"],
        help="Filter by status"
    )
    review_parser.add_argument(
        "--limit",
        type=int,
        default=10,
        help="Maximum candidates to show"
    )
    review_parser.add_argument(
        "--priority",
        choices=["high", "medium", "low"],
        help="Filter by priority"
    )
    review_parser.add_argument(
        "--candidates-db",
        help="Notion candidates database ID"
    )
    review_parser.set_defaults(func=review)
    # Approve command
    approve_parser = subparsers.add_parser(
        "approve",
        help="Approve a candidate"
    )
    approve_parser.add_argument(
        "candidate_id",
        help="Candidate Notion page ID"
    )
    approve_parser.add_argument(
        "--score",
        type=int,
        required=True,
        choices=[1, 2, 3, 4, 5],
        help="Final score (1-5)"
    )
    approve_parser.add_argument(
        "--notes",
        help="Review notes"
    )
    approve_parser.add_argument(
        "--candidates-db",
        help="Notion candidates database ID"
    )
    approve_parser.set_defaults(func=approve)
    # Reject command
    reject_parser = subparsers.add_parser(
        "reject",
        help="Reject a candidate"
    )
    reject_parser.add_argument(
        "candidate_id",
        help="Candidate Notion page ID"
    )
    reject_parser.add_argument(
        "--reason",
        required=True,
        help="Rejection reason"
    )
    reject_parser.add_argument(
        "--candidates-db",
        help="Notion candidates database ID"
    )
    reject_parser.set_defaults(func=reject)
    # Sync command
    sync_parser = subparsers.add_parser(
        "sync",
        help="Sync approved candidates to sources database"
    )
    sync_parser.add_argument(
        "--sources-db",
        required=True,
        help="Notion sources database ID"
    )
    sync_parser.add_argument(
        "--candidates-db",
        help="Notion candidates database ID"
    )
    sync_parser.set_defaults(func=sync)
    # Stats command
    stats_parser = subparsers.add_parser(
        "stats",
        help="Show discovery statistics"
    )
    stats_parser.add_argument(
        "--candidates-db",
        help="Notion candidates database ID"
    )
    stats_parser.set_defaults(func=stats)
    args = parser.parse_args()
    args.func(args)
if __name__ == "__main__":
    main()
