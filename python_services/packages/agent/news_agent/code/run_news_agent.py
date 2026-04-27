import argparse
import csv
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

try:
    from .article_assessment_contract import validate_article_assessment_contract
    from .solteti_agent_api import ask_evaluation, build_article_input_from_package, finish_evaluation
except ImportError:
    from article_assessment_contract import validate_article_assessment_contract
    from solteti_agent_api import ask_evaluation, build_article_input_from_package, finish_evaluation


def load_env_file(env_path: Path) -> None:
    if not env_path.exists():
        return
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def get_database_url() -> str:
    database_url = os.getenv("DATABASE_URL", "").strip()
    if database_url:
        return database_url

    host = os.getenv("DB_HOST", "").strip()
    port = os.getenv("DB_PORT", "5432").strip()
    name = os.getenv("DB_NAME", "").strip()
    user = os.getenv("DB_USER", "").strip()
    password = os.getenv("DB_PASSWORD", "").strip()
    if host and name and user and password:
        return f"postgresql://{user}:{password}@{host}:{port}/{name}"
    raise ValueError("DATABASE_URL is not set.")


def parse_json_output(text: str) -> Dict[str, Any] | None:
    try:
        return json.loads(text)
    except Exception:
        pass

    if not text:
        return None

    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None

    snippet = text[start : end + 1]
    try:
        return json.loads(snippet)
    except Exception:
        return None


def load_items(csv_path: Path) -> List[Dict[str, str]]:
    with csv_path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    items = []
    for row in rows:
        title = (row.get("title") or "").strip()
        content = (row.get("content") or row.get("text") or "").strip()
        if not title and not content:
            continue
        items.append({"title": title, "content": content})
    return items


def sanitize_filename(value: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9._-]+", "_", value.strip())
    return cleaned or "news"


def render_newsletter_markdown(draft: Dict[str, Any]) -> str:
    lines: List[str] = []
    title = (draft.get("title") or "").strip()
    if title:
        lines.append(f"# {title}")
        lines.append("")

    subject = (draft.get("subject_line") or "").strip()
    if subject:
        lines.append(f"_Subject: {subject}_")
        lines.append("")

    intro = (draft.get("intro") or "").strip()
    if intro:
        lines.append(intro)
        lines.append("")

    tldr = draft.get("tldr") or []
    if tldr:
        lines.append("## TL;DR")
        for item in tldr:
            lines.append(f"- {item}")
        lines.append("")

    for section in draft.get("sections") or []:
        heading = (section.get("heading") or "").strip()
        if heading:
            lines.append(f"## {heading}")
        angle = (section.get("angle") or "").strip()
        if angle:
            lines.append(f"**Angle:** {angle}")
            lines.append("")
        body = (section.get("body") or "").strip()
        if body:
            lines.append(body)
            lines.append("")
        why = (section.get("why_it_matters") or "").strip()
        if why:
            lines.append(f"**Why it matters:** {why}")
            lines.append("")
        references = section.get("references") or []
        if references:
            lines.append("**References**")
            for reference in references:
                lines.append(f"- {reference}")
            lines.append("")

    closing = (draft.get("closing") or "").strip()
    if closing:
        lines.append("## Closing")
        lines.append(closing)
        lines.append("")

    editor_notes = draft.get("editor_notes") or []
    if editor_notes:
        lines.append("## Editor Notes")
        for note in editor_notes:
            lines.append(f"- {note}")
        lines.append("")

    return "\n".join(lines).strip() + "\n"


DEFAULT_PROMPTS = {
    "analyst": (
        "You are a senior ML engineer. Summarize the news item concisely for ML engineers. "
        "Extract the likely company or org. Choose a category from: Model Release, Research, Product, "
        "Safety, Infra, Funding, Policy, Other. Return JSON: summary, category, company, tags (list). "
        "No marketing language."
    ),
    "scorer": (
        "You are scoring importance for ML engineers on a 1-5 scale. "
        "Apply this hard rule: if the news is about non-ML-core productivity/office software "
        "(e.g., Excel add-ins) or does not directly affect model training, evaluation, serving, "
        "or ML engineering workflows, subtract 2 points from the score (floor at 1). "
        "Use this rubric:\n"
        "5: Everyone must know. Broad impact + urgent + actionable now + durable. Examples: major model updates/pricing/API changes; "
        "critical security vuln in widely used libs/runtimes; paradigm-shifting Transformer/GPT-level paper; big changes to ubiquitous tools (e.g., LangChain, Claude Code).\n"
        "4: Very meaningful but lacks certainty/urgency/breadth. Example: Veo 3 update (valuable trend), credible rumor of major vendor policy/pricing change.\n"
        "3: Nice-to-know background. Most SOTA papers; new benchmark comparisons.\n"
        "2: Minor practical impact; niche tools/services, speculative or hard-to-apply ideas.\n"
        "1: No value; stale/rehashed info, hype, low evidence.\n"
        "Return JSON: importance_score (1-5), rationale (1-2 sentences)."
    ),
    "editor": (
        "Decide if this should go into an ML engineer newsletter. "
        "Return JSON: newsletter_fit (bool), newsletter_edit (1-3 sentences), edit_notes (optional). "
        "If not fit, newsletter_edit should explain what would make it fit. "
        "IMPORTANT: If importance_score <= 3, set newsletter_fit to false and explain briefly why."
    ),
    "qa": (
        "Review the merged output for technical precision, contradictions, or missing key context. "
        "Return ONLY JSON with keys: title, summary, importance_score, category, newsletter_fit, "
        "newsletter_edit, rationale, tags, company. Be concise."
    ),
}

DEFAULT_NEWSLETTER_PROMPTS = {
    "dedup_resolver": (
        "You are the dedup resolver for a weekly AI newsletter. "
        "Resolve near-duplicate articles that cover the same event. "
        "Choose a canonical article when duplicates exist and explain the merge reason. "
        "Return ONLY JSON with keys: duplicate_clusters, keep_article_ids, dedup_notes. "
        "duplicate_clusters must be a list of {canonical_article_id, secondary_articles, merge_reason}."
    ),
    "selection_critic": (
        "You are the selection critic for a weekly AI newsletter. "
        "Review the chosen articles before writing starts. Respect human selections, but identify: "
        "duplicates, weak fits for the stated editorial angle, missing context article types, and article set risks. "
        "Return ONLY JSON with keys: keep_article_ids, duplicate_groups, off_angle_article_ids, "
        "missing_context_notes, selection_feedback, relationship_hints. "
        "relationship_hints must be a list of {from_article_id, to_article_id, relation, rationale}. "
        "Allowed relation values: supports, duplicates, contrasts, follow_up_to."
    ),
    "planner": (
        "You are the planning editor for a high-signal AI newsletter. "
        "Given the editorial angle, selected article set, and selection critic feedback, decide: "
        "the issue thesis, the section grouping, article grouping, dropped articles, and what each section is trying to argue. "
        "Prefer issue-level synthesis over article-by-article recap. "
        "Return ONLY JSON with keys: issue_thesis, section_plan, dropped_articles, global_risks. "
        "section_plan must be a list of {section_id, heading, angle, article_ids, priority}."
    ),
    "audience_adapter": (
        "You are the audience adapter for a weekly AI newsletter. "
        "Translate the raw editorial intent into writing guidance for the target audience. "
        "Audience choices include ml_engineer, technical_marketer, product_leader, mixed_technical. "
        "Return ONLY JSON with keys: target_audience, audience_needs, emphasis_points, avoid_points, framing_guidance."
    ),
    "normalizer": (
        "You are the evidence normalizer for a weekly AI newsletter. "
        "Convert each selected article into a compact factual schema. "
        "For each article produce: what_happened, why_now, operational_implication, evidence_quality, "
        "risk_uncertainty, one_sentence_implication, uncertainty_note, and references. "
        "Also produce section_inputs aligned with the provided section plan. "
        "Return ONLY JSON with keys: normalized_items, section_inputs. "
        "section_inputs must be a list of {section_id, heading, angle, article_ids, synthesized_points, section_risks}."
    ),
    "writer": (
        "You are the main writer for a high-signal weekly AI newsletter. "
        "Write from the issue thesis and normalized section inputs, not from raw article chronology. "
        "Prioritize why the news matters to readers over merely listing what happened. "
        "Negative instructions: no press-release tone, no vendor hype, no repeated vendor claims, "
        "no vague statements without operational meaning. "
        "TL;DR must contain decision-useful statements, not body paraphrases. "
        "Return ONLY JSON with keys: title, subject_line, intro, tldr, sections, closing, "
        "editor_notes, confidence, needs_human_check. "
        "Each section must include heading, angle, body, references, why_it_matters."
    ),
    "section_qa": (
        "You are the section QA reviewer for a newsletter draft. "
        "Check each section independently for thesis clarity, evidence grounding, reader value, and redundancy. "
        "Return ONLY JSON with keys: section_reviews, global_section_issues. "
        "section_reviews must be a list of {heading, verdict, issues, revision_note}."
    ),
    "skeptic": (
        "You are the skeptic and factual critic for a newsletter draft. "
        "Find only the concrete problems: overclaim, unsupported generalization, duplicated explanation, "
        "missing important context, weak section logic, and risky factual phrasing. "
        "Return ONLY JSON with keys: issues, revision_instructions, confidence_adjustment, needs_human_check. "
        "issues must be a list of {severity, type, message}."
    ),
    "title": (
        "You are the title specialist for a newsletter draft. "
        "Generate one best title, one best subject line, and 3 alternate titles from the issue thesis and final draft. "
        "Return ONLY JSON with keys: title, subject_line, alt_titles."
    ),
    "style": (
        "You are the final style and brand editor. "
        "Do not change the underlying claims unless the revision instructions require it. "
        "Improve tone, density, clarity, title quality, and subject line quality for a technically literate audience. "
        "Negative instructions: no generic hype, no bloated intros, no repetitive transitions. "
        "Return ONLY JSON with keys: title, subject_line, intro, tldr, sections, closing, "
        "editor_notes, confidence, needs_human_check."
    ),
}


DEFAULT_ARTICLE_ASSESSMENT_PROMPTS = {
    "entity_classifier": (
        "You are the entity classifier for FR-2.1 article assessment. "
        "Write decision_reason in English. "
        "Select the best representative entity only from allowed_entities. Never invent ids. "
        "If the article evidence is weak, be conservative and prefer the most explicitly mentioned entity only. "
        "Choose the best page/category/entity path, produce ranked candidates, decide one side_category_code, "
        "and explain the decision briefly. "
        "Return ONLY JSON with keys: representative_entity, classification_candidates, decision_reason, side_category_code. "
        "representative_entity must include id, page, category_id, category_name, name. "
        "classification_candidates must be a list of up to 5 objects with id, page, category_id, category_name, name, confidence."
    ),
    "content_scorer": (
        "You are the content scoring agent for FR-2.1. "
        "Write ai_summary, why_it_matters, key_points, risk_notes in English. "
        "ai_summary must be 1-2 English sentences only. "
        "Do not infer product details not supported by the article body. "
        "Score the article from 1 to 5 using relevance, depth, novelty, and practicality. "
        "Produce a concise AI summary, score breakdown, and reader-useful snippets. "
        "Return ONLY JSON with keys: ai_summary, ai_score, score_breakdown, ai_snippets_json. "
        "score_breakdown must include relevance, depth, novelty, practicality, rationale. "
        "ai_snippets_json must include why_it_matters, key_points, risk_notes."
    ),
    "evidence_extractor": (
        "You are the evidence extractor for FR-2.1. "
        "Write all explanatory fields in English. "
        "Use only the provided grounding_chunks when creating evidence items. "
        "Every evidence_items[].text must be copied from a grounding chunk verbatim or as an exact substring. "
        "Do not invent evidence lines. "
        "Extract grounded tags, evidence items, and a compact structured extraction object from the article. "
        "Return ONLY JSON with keys: ai_tags_json, ai_evidence_json, ai_structured_extraction_json. "
        "ai_tags_json must contain TAG or KEYWORD objects only. "
        "ai_evidence_json must contain evidence_items. "
        "ai_structured_extraction_json must contain source and review."
    ),
    "assessment_qa": (
        "You are the final QA and contract enforcer for FR-2.1 article assessment. "
        "You will receive article context, allowed entity constraints, and intermediate agent outputs. "
        "Write ai_summary, decision_reason, why_it_matters, key_points, risk_notes in English. "
        "Do not add unsupported facts beyond the article body or grounding_chunks. "
        "Return ONLY the final raw contract JSON with these top-level keys exactly: "
        "idempotency_key, version, representative_entity, ai_summary, ai_score, ai_classification_json, "
        "side_category_code, ai_tags_json, ai_snippets_json, ai_evidence_json, ai_structured_extraction_json. "
        "Do not omit keys. Use null, [] or {} when needed. "
        "Do not invent representative entity ids outside allowed_entities."
    ),
}


def load_prompts(path: Path | None) -> Dict[str, str]:
    prompts = DEFAULT_PROMPTS.copy()
    if path and path.exists():
        try:
            data = json.loads(path.read_text())
            if isinstance(data, dict):
                for key, value in data.items():
                    if isinstance(value, str) and value.strip():
                        prompts[key] = value.strip()
        except Exception:
            pass
    return prompts


def load_newsletter_prompts(path: Path | None) -> Dict[str, str]:
    prompts = DEFAULT_NEWSLETTER_PROMPTS.copy()
    if path and path.exists():
        try:
            data = json.loads(path.read_text())
            if isinstance(data, dict):
                for key, value in data.items():
                    if isinstance(value, str) and value.strip():
                        prompts[key] = value.strip()
        except Exception:
            pass
    return prompts


def load_article_assessment_prompts(path: Path | None) -> Dict[str, str]:
    prompts = DEFAULT_ARTICLE_ASSESSMENT_PROMPTS.copy()
    if path and path.exists():
        try:
            data = json.loads(path.read_text())
            if isinstance(data, dict):
                for key, value in data.items():
                    if isinstance(value, str) and value.strip():
                        prompts[key] = value.strip()
        except Exception:
            pass
    return prompts


def build_agents(prompts: Dict[str, str]):
    try:
        from agents import Agent, Runner, OpenAIProvider
    except Exception as exc:
        raise RuntimeError(
            "Agents SDK is not available. Install the OpenAI Agents SDK package before running this script."
        ) from exc

    model_name = os.getenv("OPENAI_MODEL", "gpt-4.1")
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise ValueError("OPENAI_API_KEY is not set.")

    provider = OpenAIProvider(api_key=api_key)
    model = provider.get_model(model_name)

    analyst = Agent(
        name="NewsAnalyst",
        instructions=prompts.get("analyst", DEFAULT_PROMPTS["analyst"]),
        model=model,
    )

    scorer = Agent(
        name="ImportanceScorer",
        instructions=prompts.get("scorer", DEFAULT_PROMPTS["scorer"]),
        model=model,
    )

    editor = Agent(
        name="NewsletterEditor",
        instructions=prompts.get("editor", DEFAULT_PROMPTS["editor"]),
        model=model,
    )

    qa = Agent(
        name="QAReviewer",
        instructions=prompts.get("qa", DEFAULT_PROMPTS["qa"]),
        model=model,
    )

    return Agent, Runner, analyst, scorer, editor, qa


def build_newsletter_agent(prompt: str):
    try:
        from agents import Agent, Runner, OpenAIProvider
    except Exception as exc:
        raise RuntimeError(
            "Agents SDK is not available. Install the OpenAI Agents SDK package before running this script."
        ) from exc

    model_name = os.getenv("OPENAI_MODEL", "gpt-4.1")
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise ValueError("OPENAI_API_KEY is not set.")

    provider = OpenAIProvider(api_key=api_key)
    model = provider.get_model(model_name)

    agent = Agent(
        name="NewsletterDrafter",
        instructions=prompt,
        model=model,
    )
    return Runner, agent


def build_newsletter_pipeline_agents(prompts: Dict[str, str]):
    try:
        from agents import Agent, Runner, OpenAIProvider
    except Exception as exc:
        raise RuntimeError(
            "Agents SDK is not available. Install the OpenAI Agents SDK package before running this script."
        ) from exc

    model_name = os.getenv("OPENAI_MODEL", "gpt-4.1")
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise ValueError("OPENAI_API_KEY is not set.")

    provider = OpenAIProvider(api_key=api_key)
    model = provider.get_model(model_name)

    agent_names = [
        ("dedup_resolver", "DedupResolver"),
        ("selection_critic", "SelectionCritic"),
        ("audience_adapter", "AudienceAdapter"),
        ("planner", "PlannerAgent"),
        ("normalizer", "EvidenceNormalizer"),
        ("writer", "NewsletterWriter"),
        ("section_qa", "SectionQAAgent"),
        ("skeptic", "SkepticAgent"),
        ("title", "TitleAgent"),
        ("style", "StyleBrandAgent"),
    ]
    agents_map: Dict[str, Any] = {}
    for prompt_key, name in agent_names:
        agents_map[prompt_key] = Agent(
            name=name,
            instructions=prompts[prompt_key],
            model=model,
        )
    return Runner, agents_map


def build_article_assessment_agents(prompts: Dict[str, str]):
    try:
        from agents import Agent, Runner, OpenAIProvider
    except Exception as exc:
        raise RuntimeError(
            "Agents SDK is not available. Install the OpenAI Agents SDK package before running this script."
        ) from exc

    model_name = os.getenv("OPENAI_MODEL", "gpt-4.1")
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise ValueError("OPENAI_API_KEY is not set.")

    provider = OpenAIProvider(api_key=api_key)
    model = provider.get_model(model_name)

    agent_names = [
        ("entity_classifier", "ArticleEntityClassifier"),
        ("content_scorer", "ArticleContentScorer"),
        ("evidence_extractor", "ArticleEvidenceExtractor"),
        ("assessment_qa", "ArticleAssessmentQA"),
    ]
    agents_map: Dict[str, Any] = {}
    for prompt_key, name in agent_names:
        agents_map[prompt_key] = Agent(
            name=name,
            instructions=prompts[prompt_key],
            model=model,
        )
    return Runner, agents_map


def run_item(runner, analyst, scorer, editor, qa, title: str, content: str) -> Dict[str, Any]:
    base = f"Title: {title}\n\nContent:\n{content}\n"

    analyst_res = runner.run_sync(analyst, base)
    analyst_json = parse_json_output(analyst_res.final_output) or {}

    scorer_res = runner.run_sync(
        scorer,
        base + "\nAnalyst Output:\n" + json.dumps(analyst_json, ensure_ascii=True),
    )
    scorer_json = parse_json_output(scorer_res.final_output) or {}

    editor_res = runner.run_sync(
        editor,
        base + "\nAnalyst Output:\n" + json.dumps(analyst_json, ensure_ascii=True),
    )
    editor_json = parse_json_output(editor_res.final_output) or {}

    merged = {
        "title": title,
        "summary": analyst_json.get("summary", ""),
        "category": analyst_json.get("category", "Other"),
        "company": analyst_json.get("company", ""),
        "tags": analyst_json.get("tags", []),
        "importance_score": scorer_json.get("importance_score", 3),
        "rationale": scorer_json.get("rationale", ""),
        "newsletter_fit": editor_json.get("newsletter_fit", False),
        "newsletter_edit": editor_json.get("newsletter_edit", ""),
    }

    try:
        importance_value = int(merged.get("importance_score", 3))
    except Exception:
        importance_value = 3
    if importance_value <= 3:
        merged["newsletter_fit"] = False
        if not merged.get("newsletter_edit"):
            merged["newsletter_edit"] = "Skip: importance score <= 3 for ML engineer audience."

    qa_res = runner.run_sync(qa, json.dumps(merged, ensure_ascii=True, indent=2))
    qa_json = parse_json_output(qa_res.final_output)
    if qa_json:
        return qa_json
    return merged


def run_pipeline(items: List[Dict[str, str]], output_dir: str, prompts: Dict[str, str]) -> Dict[str, Any]:
    Agent, Runner, analyst, scorer, editor, qa = build_agents(prompts)
    runner = Runner

    results = []
    for item in items:
        result = run_item(runner, analyst, scorer, editor, qa, item["title"], item["content"])
        results.append(result)

    output = {
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "count": len(results),
        "items": results,
    }

    output_dir_path = Path(output_dir)
    output_dir_path.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = output_dir_path / f"news_agent_output_{timestamp}.json"
    output_path.write_text(json.dumps(output, ensure_ascii=True, indent=2))

    print(json.dumps(output, ensure_ascii=True, indent=2))
    print(f"Wrote: {output_path}")
    return output


def normalize_selected_ids(selected_ids: List[Any]) -> List[str]:
    return [str(value).strip() for value in selected_ids if str(value).strip()]


def fetch_db_news_candidates(
    *,
    selected_article_ids: List[str] | None = None,
    week_start: str | None = None,
    week_end: str | None = None,
    min_score: int = 4,
    limit: int = 20,
) -> List[Dict[str, Any]]:
    try:
        import psycopg2
        from psycopg2.extras import RealDictCursor
    except Exception as exc:
        raise RuntimeError(f"psycopg2 is not available: {exc}") from exc

    where_clauses = [
        "ca.review_status = 'Published'",
        "COALESCE(ca.score, 0) >= %(min_score)s",
    ]
    params: Dict[str, Any] = {"min_score": min_score, "limit": limit}
    selected_article_ids = normalize_selected_ids(selected_article_ids or [])
    if selected_article_ids:
        where_clauses.append("ca.id::text = ANY (%(selected_article_ids)s)")
        params["selected_article_ids"] = selected_article_ids
    if week_start:
        where_clauses.append("ca.week_start >= %(week_start)s")
        params["week_start"] = week_start
    if week_end:
        where_clauses.append("ca.week_start <= %(week_end)s")
        params["week_end"] = week_end

    query = f"""
    SELECT
        ca.id::text AS curated_article_id,
        ca.title,
        ca.summary,
        ca.score,
        ca.review_status,
        ca.week_start,
        ca.slug,
        ca.tags,
        ar.id::text AS article_raw_id,
        ar.url AS article_url,
        ar.title AS article_raw_title,
        ar.published_at,
        ar.author AS article_author,
        ar.language AS article_language,
        ar.content_raw,
        s.name AS source_name,
        s.type::text AS source_type,
        s.homepage_url AS source_homepage_url,
        te.name AS tracked_entity_name,
        te.description AS tracked_entity_description,
        ec.name AS entity_category_name,
        tp.entity_page::text AS entity_page
    FROM content.curated_article ca
    JOIN content.article_raw ar ON ar.id = ca.article_raw_id
    LEFT JOIN content.source s ON s.id = ar.source_id
    LEFT JOIN content.tracked_entity te ON te.id = ca.tracked_entity_id
    LEFT JOIN content.tracked_entity_placement tp
        ON tp.tracked_entity_id = ca.tracked_entity_id
       AND tp.revoked_at IS NULL
       AND tp.is_active = TRUE
    LEFT JOIN content.entity_category ec
        ON ec.id = tp.entity_category_id
       AND ec.revoked_at IS NULL
    WHERE {" AND ".join(where_clauses)}
    ORDER BY ca.score DESC, ca.week_start DESC NULLS LAST, ca.updated_at DESC
    LIMIT %(limit)s
    """

    conn = psycopg2.connect(get_database_url())
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(query, params)
            rows = cursor.fetchall()
    finally:
        conn.close()

    return [dict(row) for row in rows]


def safe_list(value: Any) -> List[Any]:
    return value if isinstance(value, list) else []


def dedupe_preserve_order(values: List[str]) -> List[str]:
    seen = set()
    ordered: List[str] = []
    for value in values:
        if not value or value in seen:
            continue
        seen.add(value)
        ordered.append(value)
    return ordered


def slugify_tag(value: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return cleaned[:80]


def clamp_score(value: Any, default: int = 3) -> int:
    try:
        score = int(value)
    except Exception:
        return default
    return max(1, min(5, score))


def clamp_confidence(value: Any, default: float = 0.5) -> float:
    try:
        confidence = float(value)
    except Exception:
        return default
    return max(0.0, min(1.0, confidence))


def as_text(value: Any, default: str = "") -> str:
    if value is None:
        return default
    return str(value).strip()


def normalize_allowed_entities(allowed_entities: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    normalized: List[Dict[str, Any]] = []
    for item in safe_list(allowed_entities):
        if not isinstance(item, dict):
            continue
        normalized.append(
            {
                "id": item.get("id"),
                "page": as_text(item.get("page")) or None,
                "category_id": item.get("category_id"),
                "category_name": as_text(item.get("category_name")) or None,
                "name": as_text(item.get("name")) or None,
            }
        )
    return normalized


def tokenize_for_match(text: str) -> List[str]:
    return re.findall(r"[a-z0-9]+", text.lower())


def has_sufficient_article_body(article: Dict[str, Any]) -> bool:
    content_raw = as_text(article.get("content_raw") or article.get("content"))
    summary = as_text(article.get("summary"))
    return len(content_raw) >= 300 or len(summary) >= 120


def split_grounding_chunks(text: str, chunk_size: int = 420, overlap: int = 80) -> List[str]:
    cleaned = re.sub(r"\s+", " ", text).strip()
    if not cleaned:
        return []
    paragraphs = [part.strip() for part in re.split(r"\n\s*\n", text) if part.strip()]
    chunks: List[str] = []
    if paragraphs:
        for part in paragraphs:
            compact = re.sub(r"\s+", " ", part).strip()
            if not compact:
                continue
            if len(compact) <= chunk_size:
                chunks.append(compact)
                continue
            start = 0
            while start < len(compact):
                chunk = compact[start : start + chunk_size].strip()
                if chunk:
                    chunks.append(chunk)
                if start + chunk_size >= len(compact):
                    break
                start += max(1, chunk_size - overlap)
    if not chunks:
        start = 0
        while start < len(cleaned):
            chunk = cleaned[start : start + chunk_size].strip()
            if chunk:
                chunks.append(chunk)
            if start + chunk_size >= len(cleaned):
                break
            start += max(1, chunk_size - overlap)
    return dedupe_preserve_order(chunks)[:20]


def build_grounding_chunks(article: Dict[str, Any], limit: int = 5) -> List[Dict[str, Any]]:
    content_raw = as_text(article.get("content_raw"))
    title = as_text(article.get("title"))
    summary = as_text(article.get("summary"))
    entity_name = as_text(article.get("expected_entity_name"))
    query_tokens = set(tokenize_for_match(" ".join([title, summary, entity_name])))
    raw_chunks = split_grounding_chunks(content_raw)
    scored: List[Dict[str, Any]] = []
    for index, chunk in enumerate(raw_chunks):
        chunk_tokens = set(tokenize_for_match(chunk))
        overlap_score = len(query_tokens & chunk_tokens)
        title_overlap = len(set(tokenize_for_match(title)) & chunk_tokens)
        entity_overlap = len(set(tokenize_for_match(entity_name)) & chunk_tokens)
        score = overlap_score + (2 * title_overlap) + (3 * entity_overlap)
        scored.append(
            {
                "chunk_id": index + 1,
                "text": chunk,
                "score": score,
            }
        )
    scored.sort(key=lambda item: (item["score"], len(item["text"])), reverse=True)
    if not scored and summary:
        return [{"chunk_id": 1, "text": summary, "score": 1}]
    return scored[:limit]


def entity_match_score(article: Dict[str, Any], entity: Dict[str, Any]) -> int:
    title = as_text(article.get("title")).lower()
    summary = as_text(article.get("summary")).lower()
    content = as_text(article.get("content_raw")).lower()
    source_name = as_text(article.get("source_name")).lower()
    page = as_text(entity.get("page")).lower()
    category_name = as_text(entity.get("category_name")).lower()
    name = as_text(entity.get("name")).lower()
    score = 0
    if name and name in title:
        score += 20
    if name and name in summary:
        score += 12
    if name and name in content:
        score += 10
    if category_name and category_name in source_name:
        score += 6
    name_tokens = set(tokenize_for_match(name))
    title_tokens = set(tokenize_for_match(title))
    summary_tokens = set(tokenize_for_match(summary))
    content_tokens = set(tokenize_for_match(content[:1500]))
    score += len(name_tokens & title_tokens) * 4
    score += len(name_tokens & summary_tokens) * 3
    score += len(name_tokens & content_tokens) * 2
    if "protocol" in title and page == "frameworks":
        score += 2
    return score


def shrink_allowed_entities_for_article(article: Dict[str, Any], allowed_entities: List[Dict[str, Any]], limit: int = 12) -> List[Dict[str, Any]]:
    scored: List[tuple[int, Dict[str, Any]]] = []
    for entity in allowed_entities:
        scored.append((entity_match_score(article, entity), entity))
    scored.sort(key=lambda item: (item[0], as_text(item[1].get("name"))), reverse=True)
    strong = [entity for score, entity in scored if score > 0][:limit]
    if strong:
        return strong
    return allowed_entities[: min(limit, len(allowed_entities))]


def resolve_representative_entity(
    selected_entity: Dict[str, Any] | None,
    allowed_entities: List[Dict[str, Any]],
) -> Dict[str, Any]:
    if not isinstance(selected_entity, dict):
        selected_entity = {}
    allowed_by_id = {str(item["id"]): item for item in allowed_entities if item.get("id")}
    allowed_by_name: Dict[str, List[Dict[str, Any]]] = {}
    for item in allowed_entities:
        name = as_text(item.get("name")).lower()
        if name:
            allowed_by_name.setdefault(name, []).append(item)

    selected_id = as_text(selected_entity.get("id"))
    if selected_id and selected_id in allowed_by_id:
        match = allowed_by_id[selected_id]
        return {
            "id": match.get("id"),
            "page": match.get("page"),
            "category_id": match.get("category_id"),
            "category_name": match.get("category_name"),
            "name": match.get("name"),
        }

    selected_name = as_text(selected_entity.get("name")).lower()
    if selected_name and len(allowed_by_name.get(selected_name, [])) == 1:
        match = allowed_by_name[selected_name][0]
        return {
            "id": match.get("id"),
            "page": match.get("page"),
            "category_id": match.get("category_id"),
            "category_name": match.get("category_name"),
            "name": match.get("name"),
        }

    return {
        "id": None,
        "page": None,
        "category_id": None,
        "category_name": None,
        "name": None,
    }


def normalize_classification_candidates(
    candidates: List[Dict[str, Any]],
    allowed_entities: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    normalized: List[Dict[str, Any]] = []
    allowed_by_id = {str(item["id"]): item for item in allowed_entities if item.get("id")}
    allowed_by_name: Dict[str, List[Dict[str, Any]]] = {}
    for item in allowed_entities:
        name = as_text(item.get("name")).lower()
        if name:
            allowed_by_name.setdefault(name, []).append(item)

    for candidate in safe_list(candidates):
        if not isinstance(candidate, dict):
            continue
        match: Dict[str, Any] | None = None
        candidate_id = as_text(candidate.get("id"))
        if candidate_id and candidate_id in allowed_by_id:
            match = allowed_by_id[candidate_id]
        else:
            candidate_name = as_text(candidate.get("name") or candidate.get("entity_name")).lower()
            if candidate_name and len(allowed_by_name.get(candidate_name, [])) == 1:
                match = allowed_by_name[candidate_name][0]
        if not match:
            continue
        normalized.append(
            {
                "page": match.get("page"),
                "category_name": match.get("category_name"),
                "entity_name": match.get("name"),
                "confidence": clamp_confidence(candidate.get("confidence"), 0.5),
            }
        )
    if normalized:
        return normalized[:5]
    return []


def normalize_side_category_code(value: Any, allowed_side_categories: List[Dict[str, Any]]) -> str | None:
    code = as_text(value).upper().replace(" ", "_")
    if not code:
        return None
    allowed_codes = {
        as_text(item.get("code")).upper(): item
        for item in safe_list(allowed_side_categories)
        if isinstance(item, dict) and as_text(item.get("code"))
    }
    if allowed_codes:
        return code if code in allowed_codes else None
    return code


def infer_side_category_code(article: Dict[str, Any]) -> str | None:
    title = as_text(article.get("title")).lower()
    body = as_text(article.get("content_raw") or article.get("content") or article.get("summary")).lower()
    text = f"{title} {body}"
    if any(token in text for token in ["case study", "deployed", "deployment", "customer story", "law firm", "in production"]):
        return "CASE_STUDY"
    if any(token in text for token in ["pricing", "price", "launches", "announced", "release", "introduces"]):
        return "ANNOUNCEMENT"
    if any(token in text for token in ["policy", "regulation", "bill", "government"]):
        return "POLICY"
    return None


def normalize_tag_item(item: Dict[str, Any]) -> Dict[str, Any] | None:
    if not isinstance(item, dict):
        return None
    kind = as_text(item.get("kind")).upper()
    value = as_text(item.get("value"))
    if kind not in {"TAG", "KEYWORD"} or not value:
        return None
    normalized: Dict[str, Any] = {"kind": kind, "value": slugify_tag(value) if kind == "TAG" else value}
    if kind == "KEYWORD":
        try:
            frequency = int(item.get("frequency") or 1)
        except Exception:
            frequency = 1
        normalized["frequency"] = max(1, frequency)
        normalized["confidence"] = clamp_confidence(item.get("confidence"), 0.5)
    return normalized


def default_tag_items(article: Dict[str, Any], representative_entity: Dict[str, Any]) -> List[Dict[str, Any]]:
    tags: List[Dict[str, Any]] = []
    entity_name = as_text(representative_entity.get("name"))
    category_name = as_text(representative_entity.get("category_name"))
    if entity_name:
        slug = slugify_tag(entity_name)
        if slug:
            tags.append({"kind": "TAG", "value": slug})
    if category_name:
        slug = slugify_tag(category_name)
        if slug:
            tags.append({"kind": "TAG", "value": slug})
    for value in safe_list(article.get("tags"))[:3]:
        slug = slugify_tag(as_text(value))
        if slug:
            tags.append({"kind": "TAG", "value": slug})
    return tags


def normalize_tag_items(
    tags: List[Dict[str, Any]],
    article: Dict[str, Any],
    representative_entity: Dict[str, Any],
) -> List[Dict[str, Any]]:
    normalized: List[Dict[str, Any]] = []
    seen = set()
    for item in safe_list(tags) + default_tag_items(article, representative_entity):
        normalized_item = normalize_tag_item(item)
        if not normalized_item:
            continue
        key = json.dumps(normalized_item, ensure_ascii=True, sort_keys=True)
        if key in seen:
            continue
        seen.add(key)
        normalized.append(normalized_item)
    return normalized[:8]


def normalize_evidence_items(items: List[Dict[str, Any]], article: Dict[str, Any]) -> List[Dict[str, Any]]:
    normalized: List[Dict[str, Any]] = []
    grounding_chunks = safe_list(article.get("grounding_chunks"))
    chunk_texts = [as_text(item.get("text")) for item in grounding_chunks if isinstance(item, dict) and as_text(item.get("text"))]
    fallback_text = chunk_texts[0] if chunk_texts else (as_text(article.get("summary")) or as_text(article.get("title")) or as_text(article.get("content_raw"))[:240])
    fallback_item = {
        "kind": "quote",
        "text": fallback_text,
        "url": as_text(article.get("url")),
        "source_name": as_text(article.get("source_name")),
        "published_at": article.get("published_at"),
    }
    for item in safe_list(items) or [fallback_item]:
        if not isinstance(item, dict):
            continue
        text = as_text(item.get("text")) or fallback_text
        if not text:
            continue
        grounded_text = ""
        for chunk_text in chunk_texts:
            if text in chunk_text:
                grounded_text = text
                break
            if chunk_text in text:
                grounded_text = chunk_text
                break
        if not grounded_text and chunk_texts:
            grounded_text = chunk_texts[len(normalized) % len(chunk_texts)]
        if grounded_text:
            text = grounded_text
        normalized.append(
            {
                "kind": as_text(item.get("kind"), "quote") or "quote",
                "text": text[:500],
                "url": as_text(item.get("url")) or as_text(article.get("url")),
                "source_name": as_text(item.get("source_name")) or as_text(article.get("source_name")),
                "published_at": item.get("published_at") or article.get("published_at"),
            }
        )
    return normalized[:5]


def normalize_structured_extraction(
    payload: Dict[str, Any],
    article: Dict[str, Any],
    side_category_code: str | None,
) -> Dict[str, Any]:
    source = payload.get("source") if isinstance(payload, dict) else {}
    review = payload.get("review") if isinstance(payload, dict) else {}
    return {
        "source": {
            "name": as_text((source or {}).get("name")) or as_text(article.get("source_name")),
            "type": as_text((source or {}).get("type")) or as_text(article.get("source_type")) or "UNKNOWN",
        },
        "review": {
            "type": as_text((review or {}).get("type")) or (side_category_code.replace("_", " ").title() if side_category_code else "Announcement"),
            "reviewer": (review or {}).get("reviewer"),
            "comment": (review or {}).get("comment"),
        },
    }


def normalize_article_assessment_output(
    *,
    article_input: Dict[str, Any],
    qa_output: Dict[str, Any],
    entity_output: Dict[str, Any],
    scorer_output: Dict[str, Any],
    evidence_output: Dict[str, Any],
) -> Dict[str, Any]:
    allowed_entities = normalize_allowed_entities(safe_list(article_input.get("allowed_entities")))
    allowed_side_categories = safe_list(article_input.get("allowed_side_categories"))
    article = article_input.get("article") if isinstance(article_input.get("article"), dict) else article_input

    representative_entity = resolve_representative_entity(
        qa_output.get("representative_entity") or entity_output.get("representative_entity"),
        allowed_entities,
    )
    qa_classification = qa_output.get("ai_classification_json") if isinstance(qa_output.get("ai_classification_json"), dict) else {}
    classification_candidates = normalize_classification_candidates(
        qa_classification.get("candidates") or entity_output.get("classification_candidates"),
        allowed_entities,
    )
    final_path = {
        "page": representative_entity.get("page"),
        "category_name": representative_entity.get("category_name"),
        "entity_name": representative_entity.get("name"),
    }
    side_category_code = normalize_side_category_code((
        as_text(qa_output.get("side_category_code"))
        or as_text(entity_output.get("side_category_code"))
        or as_text(infer_side_category_code(article))
        or None
    ), allowed_side_categories)
    snippets = qa_output.get("ai_snippets_json") if isinstance(qa_output.get("ai_snippets_json"), dict) else {}
    scorer_snippets = scorer_output.get("ai_snippets_json") if isinstance(scorer_output.get("ai_snippets_json"), dict) else {}
    structured = qa_output.get("ai_structured_extraction_json") if isinstance(qa_output.get("ai_structured_extraction_json"), dict) else {}
    evidence_json = qa_output.get("ai_evidence_json") if isinstance(qa_output.get("ai_evidence_json"), dict) else {}
    evidence_stage = evidence_output.get("ai_evidence_json") if isinstance(evidence_output.get("ai_evidence_json"), dict) else {}
    tag_source = safe_list(qa_output.get("ai_tags_json")) or safe_list(evidence_output.get("ai_tags_json"))

    user_article_state_id = as_text(article_input.get("user_article_state_id")) or "unknown"
    ai_summary = as_text(qa_output.get("ai_summary")) or as_text(scorer_output.get("ai_summary")) or as_text(article.get("summary")) or as_text(article.get("title"))
    ai_score = clamp_score(qa_output.get("ai_score") or scorer_output.get("ai_score"), 3)
    decision_reason = as_text(
        qa_classification.get("decision_reason") or entity_output.get("decision_reason")
    )

    return {
        "idempotency_key": f"uas:{user_article_state_id.lower()}",
        "version": as_text(article_input.get("version"), "0.3") or "0.3",
        "representative_entity": representative_entity,
        "ai_summary": ai_summary,
        "ai_score": ai_score,
        "ai_classification_json": {
            "final_path": final_path,
            "candidates": classification_candidates,
            "decision_reason": decision_reason,
        },
        "side_category_code": side_category_code,
        "ai_tags_json": normalize_tag_items(tag_source, article, representative_entity),
        "ai_snippets_json": {
            "why_it_matters": as_text(snippets.get("why_it_matters")) or as_text(scorer_snippets.get("why_it_matters")),
            "key_points": [as_text(value) for value in safe_list(snippets.get("key_points")) or safe_list(scorer_snippets.get("key_points")) if as_text(value)],
            "risk_notes": [as_text(value) for value in safe_list(snippets.get("risk_notes")) or safe_list(scorer_snippets.get("risk_notes")) if as_text(value)],
        },
        "ai_evidence_json": {
            "evidence_items": normalize_evidence_items(
                safe_list(evidence_json.get("evidence_items")) or safe_list(evidence_stage.get("evidence_items")),
                article,
            )
        },
        "ai_structured_extraction_json": normalize_structured_extraction(
            structured or evidence_output.get("ai_structured_extraction_json") or {},
            article,
            side_category_code,
        ),
    }


def compact_article_for_agent(item: Dict[str, Any]) -> Dict[str, Any]:
    summary = (item.get("summary") or "").strip()
    content_raw = (item.get("content_raw") or item.get("content") or "").strip()
    one_sentence_implication = summary
    if not one_sentence_implication and content_raw:
        one_sentence_implication = content_raw[:220].strip()
    uncertainty_note = ""
    lowered = f"{summary} {content_raw[:500]}".lower()
    if any(token in lowered for token in ["reportedly", "rumor", "preview", "early access", "coming soon"]):
        uncertainty_note = "Some claims may be preliminary or not fully specified."
    return {
        "article_id": item.get("curated_article_id") or item.get("id"),
        "title": item.get("title", ""),
        "summary": summary,
        "source_name": item.get("source_name", ""),
        "published_at": item.get("published_at"),
        "score": item.get("score"),
        "tracked_entity_name": item.get("tracked_entity_name", ""),
        "entity_category_name": item.get("entity_category_name", ""),
        "entity_page": item.get("entity_page", ""),
        "one_sentence_implication": one_sentence_implication,
        "uncertainty_note": uncertainty_note,
        "article_url": item.get("article_url") or item.get("url"),
        "tags": item.get("tags") or [],
        "content_raw_excerpt": content_raw[:1600],
    }


def heuristic_relationship_hints(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    hints: List[Dict[str, Any]] = []
    compact = [compact_article_for_agent(item) for item in items]
    for index, left in enumerate(compact):
        left_tokens = set(re.findall(r"[a-z0-9]+", (left.get("title", "") + " " + left.get("tracked_entity_name", "")).lower()))
        for right in compact[index + 1:]:
            right_tokens = set(re.findall(r"[a-z0-9]+", (right.get("title", "") + " " + right.get("tracked_entity_name", "")).lower()))
            overlap = left_tokens & right_tokens
            if len(overlap) >= 3:
                hints.append(
                    {
                        "from_article_id": left["article_id"],
                        "to_article_id": right["article_id"],
                        "relation": "duplicates",
                        "rationale": f"Strong lexical overlap: {', '.join(sorted(list(overlap))[:5])}",
                    }
                )
    return hints


NEGATIVE_INSTRUCTION_LIBRARY = {
    "no_hype": "Do not use hype language or inflated impact claims.",
    "no_vendor_parroting": "Do not repeat vendor framing or promotional slogans.",
    "no_weak_tldr": "Do not write TL;DR bullets that merely paraphrase the body without decision value.",
    "no_chronological_dump": "Do not list events chronologically without issue-level synthesis.",
    "bounded_claims": "Make bounded claims and explicitly note uncertainty where evidence is incomplete.",
}


QUALITY_RUBRIC = [
    "issue-level synthesis",
    "why it matters",
    "bounded claims",
    "non-repetitive sections",
    "decision-useful TL;DR",
]


ALLOWED_RELATIONS = {"supports", "duplicates", "contrasts", "follow_up_to"}


def load_agent_memory(output_dir: str | None, limit: int = 5) -> List[str]:
    if not output_dir:
        return []
    output_dir_path = Path(output_dir)
    if not output_dir_path.exists():
        return []
    files = sorted(output_dir_path.glob("newsletter_draft_*.json"), reverse=True)[:limit]
    warnings: List[str] = []
    for file_path in files:
        try:
            data = json.loads(file_path.read_text())
        except Exception:
            continue
        skeptic_out = (((data.get("pipeline") or {}).get("skeptic") or {}).get("out") or {})
        for issue in safe_list(skeptic_out.get("issues"))[:3]:
            if isinstance(issue, dict):
                message = str(issue.get("message", "")).strip()
                if message:
                    warnings.append(message)
    return dedupe_preserve_order(warnings)[:8]


def build_article_selection_preview(
    *,
    selected_article_ids: List[str] | None = None,
    week_start: str | None = None,
    week_end: str | None = None,
    min_score: int = 4,
    limit: int = 20,
) -> Dict[str, Any]:
    items = fetch_db_news_candidates(
        selected_article_ids=selected_article_ids,
        week_start=week_start,
        week_end=week_end,
        min_score=min_score,
        limit=limit,
    )
    return {
        "source": "db",
        "filters": {
            "selected_article_ids": normalize_selected_ids(selected_article_ids or []),
            "week_start": week_start,
            "week_end": week_end,
            "min_score": min_score,
            "limit": limit,
        },
        "count": len(items),
        "items": items,
    }


def build_newsletter_input_payload(
    *,
    selected_items: List[Dict[str, Any]],
    user_instructions: str,
    few_shots: str,
    brand_tone: str,
    editorial_angle: str,
    audience_mode: str,
    strictness_mode: str,
) -> Dict[str, Any]:
    normalized_items = []
    for item in selected_items:
        compact = compact_article_for_agent(item)
        compact["review_status"] = item.get("review_status")
        compact["week_start"] = item.get("week_start")
        compact["article_author"] = item.get("article_author")
        normalized_items.append(compact)
    return {
        "selected_items": normalized_items,
        "user_instructions": user_instructions,
        "few_shots": few_shots,
        "brand_tone": brand_tone,
        "editorial_angle": editorial_angle,
        "audience_mode": audience_mode,
        "strictness_mode": strictness_mode,
        "relationship_hints": heuristic_relationship_hints(selected_items),
    }


def ensure_section_shape(section: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "heading": section.get("heading", ""),
        "angle": section.get("angle", ""),
        "body": section.get("body", ""),
        "references": safe_list(section.get("references")),
        "why_it_matters": section.get("why_it_matters", ""),
    }


def normalize_draft_shape(draft_json: Dict[str, Any], raw_output: str = "") -> Dict[str, Any]:
    draft = draft_json or {}
    return {
        "title": draft.get("title", ""),
        "subject_line": draft.get("subject_line", ""),
        "intro": draft.get("intro", ""),
        "tldr": safe_list(draft.get("tldr")),
        "sections": [ensure_section_shape(section) for section in safe_list(draft.get("sections"))],
        "closing": draft.get("closing", ""),
        "editor_notes": safe_list(draft.get("editor_notes")),
        "confidence": draft.get("confidence", "medium"),
        "needs_human_check": safe_list(draft.get("needs_human_check")),
        "alt_titles": safe_list(draft.get("alt_titles")),
        "raw_output": raw_output if raw_output and not draft_json else draft.get("raw_output", ""),
    }

def validate_agent_output(stage: str, payload: Dict[str, Any]) -> List[str]:
    errors: List[str] = []
    if not isinstance(payload, dict):
        return [f"{stage}: output must be an object"]
    if stage == "entity_classifier":
        representative_entity = payload.get("representative_entity")
        if not isinstance(representative_entity, dict):
            errors.append("entity_classifier: representative_entity must be an object")
        if not isinstance(payload.get("classification_candidates"), list):
            errors.append("entity_classifier: classification_candidates must be a list")
    elif stage == "content_scorer":
        ai_score = payload.get("ai_score")
        try:
            ai_score_value = int(ai_score)
        except Exception:
            ai_score_value = 0
        if ai_score_value < 1 or ai_score_value > 5:
            errors.append("content_scorer: ai_score must be 1..5")
        if not isinstance(payload.get("ai_snippets_json"), dict):
            errors.append("content_scorer: ai_snippets_json must be an object")
    elif stage == "evidence_extractor":
        if not isinstance(payload.get("ai_tags_json"), list):
            errors.append("evidence_extractor: ai_tags_json must be a list")
        if not isinstance(payload.get("ai_evidence_json"), dict):
            errors.append("evidence_extractor: ai_evidence_json must be an object")
        if not isinstance(payload.get("ai_structured_extraction_json"), dict):
            errors.append("evidence_extractor: ai_structured_extraction_json must be an object")
    elif stage == "assessment_qa":
        required_keys = [
            "idempotency_key",
            "version",
            "representative_entity",
            "ai_summary",
            "ai_score",
            "ai_classification_json",
            "side_category_code",
            "ai_tags_json",
            "ai_snippets_json",
            "ai_evidence_json",
            "ai_structured_extraction_json",
        ]
        for key in required_keys:
            if key not in payload:
                errors.append(f"assessment_qa: missing {key}")
        if not isinstance(payload.get("representative_entity"), dict):
            errors.append("assessment_qa: representative_entity must be an object")
        if not isinstance(payload.get("ai_classification_json"), dict):
            errors.append("assessment_qa: ai_classification_json must be an object")
        if not isinstance(payload.get("ai_tags_json"), list):
            errors.append("assessment_qa: ai_tags_json must be a list")
        if not isinstance(payload.get("ai_snippets_json"), dict):
            errors.append("assessment_qa: ai_snippets_json must be an object")
        if not isinstance(payload.get("ai_evidence_json"), dict):
            errors.append("assessment_qa: ai_evidence_json must be an object")
        if not isinstance(payload.get("ai_structured_extraction_json"), dict):
            errors.append("assessment_qa: ai_structured_extraction_json must be an object")
    elif stage == "dedup_resolver":
        for cluster in safe_list(payload.get("duplicate_clusters")):
            if not isinstance(cluster, dict):
                errors.append("dedup_resolver: duplicate_clusters items must be objects")
                continue
            if not cluster.get("canonical_article_id"):
                errors.append("dedup_resolver: canonical_article_id is required")
    elif stage == "selection_critic":
        for rel in safe_list(payload.get("relationship_hints")):
            if not isinstance(rel, dict):
                errors.append("selection_critic: relationship hints must be objects")
                continue
            if rel.get("relation") not in ALLOWED_RELATIONS:
                errors.append(f"selection_critic: invalid relation {rel.get('relation')}")
    elif stage == "planner":
        plan = safe_list(payload.get("section_plan"))
        if not plan:
            errors.append("planner: empty section_plan")
        for section in plan:
            if not isinstance(section, dict):
                errors.append("planner: section_plan items must be objects")
                continue
            if not safe_list(section.get("article_ids")):
                errors.append("planner: each section requires article_ids")
    elif stage == "normalizer":
        if not safe_list(payload.get("normalized_items")):
            errors.append("normalizer: empty normalized_items")
        if not safe_list(payload.get("section_inputs")):
            errors.append("normalizer: empty section_inputs")
    elif stage in {"writer", "style"}:
        if not safe_list(payload.get("sections")):
            errors.append(f"{stage}: empty sections")
        if not safe_list(payload.get("tldr")):
            errors.append(f"{stage}: empty tldr")
    elif stage == "section_qa":
        if not safe_list(payload.get("section_reviews")):
            errors.append("section_qa: empty section_reviews")
    elif stage == "title":
        if not payload.get("title"):
            errors.append("title: missing title")
        if not payload.get("subject_line"):
            errors.append("title: missing subject_line")
    return errors


def build_retry_note(stage: str, errors: List[str]) -> str:
    joined = "; ".join(errors[:6])
    if any("output must be an object" in error for error in errors):
        return f"Previous attempt failed JSON parsing or object formatting. Return ONLY valid JSON. Errors: {joined}"
    if any("empty section_plan" in error for error in errors):
        return f"Previous attempt produced an empty plan. You must return at least one valid section_plan entry. Errors: {joined}"
    if any("invalid relation" in error for error in errors):
        return f"Previous attempt used invalid relation types. Use only supports, duplicates, contrasts, follow_up_to. Errors: {joined}"
    return f"Previous attempt had schema mismatches. Repair the output and return ONLY valid JSON. Errors: {joined}"


def extract_usage_summary(value: Any, *, _depth: int = 0, _seen: set[int] | None = None) -> Dict[str, Any] | None:
    if _seen is None:
        _seen = set()
    if value is None or _depth > 4:
        return None
    object_id = id(value)
    if object_id in _seen:
        return None
    _seen.add(object_id)

    if isinstance(value, dict):
        data = value
    elif isinstance(value, (list, tuple)):
        for item in value:
            found = extract_usage_summary(item, _depth=_depth + 1, _seen=_seen)
            if found:
                return found
        return None
    else:
        try:
            data = vars(value)
        except Exception:
            return None

    token_keys = {"input_tokens", "output_tokens", "total_tokens", "reasoning_tokens"}
    if any(key in data for key in token_keys):
        summary: Dict[str, Any] = {}
        for key in token_keys:
            if data.get(key) is not None:
                try:
                    summary[key] = int(data.get(key))
                except Exception:
                    pass
        model_name = data.get("model_name") or data.get("model")
        if model_name:
            summary["model_name"] = as_text(model_name)
        return summary or None

    for item in data.values():
        found = extract_usage_summary(item, _depth=_depth + 1, _seen=_seen)
        if found:
            return found
    return None


def merge_usage_summaries(usages: List[Dict[str, Any]]) -> Dict[str, Any]:
    merged = {
        "input_tokens": 0,
        "output_tokens": 0,
        "total_tokens": 0,
        "reasoning_tokens": 0,
    }
    model_names: List[str] = []
    for usage in usages:
        if not isinstance(usage, dict):
            continue
        for key in ["input_tokens", "output_tokens", "total_tokens", "reasoning_tokens"]:
            try:
                merged[key] += int(usage.get(key) or 0)
            except Exception:
                pass
        model_name = as_text(usage.get("model_name"))
        if model_name and model_name not in model_names:
            model_names.append(model_name)
    merged["model_names"] = model_names
    return merged


def run_agent_json(
    runner: Any,
    agent: Any,
    payload: Dict[str, Any],
    *,
    stage: str,
    max_attempts: int = 2,
) -> Dict[str, Any]:
    attempt_payload = dict(payload)
    errors: List[str] = []
    for attempt in range(max_attempts):
        result = runner.run_sync(agent, json.dumps(attempt_payload, ensure_ascii=True, indent=2))
        parsed = parse_json_output(result.final_output)
        if parsed is None:
            errors = [f"{stage}: output must be an object"]
        else:
            errors = validate_agent_output(stage, parsed)
            if not errors:
                return parsed
        if attempt < max_attempts - 1:
            attempt_payload = dict(payload)
            attempt_payload["_retry_note"] = build_retry_note(stage, errors)
    return {"raw_output": result.final_output, "validation_errors": errors}


def run_agent_json_with_meta(
    runner: Any,
    agent: Any,
    payload: Dict[str, Any],
    *,
    stage: str,
    max_attempts: int = 2,
) -> tuple[Dict[str, Any], Dict[str, Any]]:
    attempt_payload = dict(payload)
    errors: List[str] = []
    attempts: List[Dict[str, Any]] = []
    result = None
    for attempt in range(max_attempts):
        result = runner.run_sync(agent, json.dumps(attempt_payload, ensure_ascii=True, indent=2))
        usage = extract_usage_summary(result) or {}
        parsed = parse_json_output(result.final_output)
        if parsed is None:
            errors = [f"{stage}: output must be an object"]
        else:
            errors = validate_agent_output(stage, parsed)
            attempts.append(
                {
                    "attempt": attempt + 1,
                    "ok": not errors,
                    "validation_errors": errors,
                    "usage": usage,
                }
            )
            if not errors:
                return parsed, {
                    "attempt_count": attempt + 1,
                    "ok": True,
                    "validation_errors": [],
                    "usage": usage,
                    "attempts": attempts,
                }
        attempts.append(
            {
                "attempt": attempt + 1,
                "ok": False,
                "validation_errors": errors,
                "usage": usage,
            }
        )
        if attempt < max_attempts - 1:
            attempt_payload = dict(payload)
            attempt_payload["_retry_note"] = build_retry_note(stage, errors)
    raw_output = result.final_output if result is not None else ""
    return {"raw_output": raw_output, "validation_errors": errors}, {
        "attempt_count": len(attempts),
        "ok": False,
        "validation_errors": errors,
        "usage": merge_usage_summaries([item.get("usage", {}) for item in attempts]),
        "attempts": attempts,
    }


def run_article_assessment_debug(
    article_input: Dict[str, Any],
    prompt_overrides: Dict[str, str] | None = None,
    output_dir: str | None = None,
) -> Dict[str, Any]:
    prompts = DEFAULT_ARTICLE_ASSESSMENT_PROMPTS.copy()
    if prompt_overrides:
        for key, value in prompt_overrides.items():
            if isinstance(value, str) and value.strip():
                prompts[key] = value.strip()

    article = article_input.get("article") if isinstance(article_input.get("article"), dict) else article_input
    meta = article_input.get("meta") if isinstance(article_input.get("meta"), dict) else {}
    if not isinstance(article, dict):
        raise ValueError("article_input must include article fields or an article object.")
    if not as_text(article_input.get("user_article_state_id")):
        raise ValueError("user_article_state_id is required for FR-2.1 output.")
    if not safe_list(article_input.get("allowed_entities")):
        raise ValueError("allowed_entities is required for FR-2.1 input.")

    normalized_input = {
        "user_article_state_id": as_text(article_input.get("user_article_state_id")),
        "version": as_text(article_input.get("version"), "0.3") or "0.3",
        "prompt_template_version_id": article_input.get("prompt_template_version_id") or meta.get("prompt_template_version_id"),
        "run_log_id": article_input.get("run_log_id") or meta.get("run_log_id"),
        "article": {
            "title": as_text(article.get("title")),
            "url": as_text(article.get("url") or article.get("article_url")),
            "content_raw": as_text(article.get("content_raw") or article.get("content")),
            "published_at": article.get("published_at"),
            "summary": as_text(article.get("summary")),
            "source_name": as_text(article.get("source_name")),
            "source_type": as_text(article.get("source_type")) or "UNKNOWN",
            "author": as_text(article.get("author") or article.get("article_author")),
            "language": as_text(article.get("language") or article.get("article_language")),
            "tags": safe_list(article.get("tags")),
        },
        "allowed_entities": normalize_allowed_entities(safe_list(article_input.get("allowed_entities"))),
        "allowed_side_categories": safe_list(article_input.get("allowed_side_categories")),
        "review_context": article_input.get("review_context") if isinstance(article_input.get("review_context"), dict) else {},
    }
    if not has_sufficient_article_body(normalized_input["article"]):
        raise ValueError("Insufficient article body for FR-2.1 assessment. content_raw or summary is too short.")
    reduced_allowed_entities = shrink_allowed_entities_for_article(normalized_input["article"], normalized_input["allowed_entities"])
    normalized_input["allowed_entities_reduced"] = reduced_allowed_entities
    expected_entity_name = reduced_allowed_entities[0].get("name") if reduced_allowed_entities else ""
    normalized_input["article"]["expected_entity_name"] = expected_entity_name
    normalized_input["article"]["grounding_chunks"] = build_grounding_chunks(normalized_input["article"])

    Runner, agents_map = build_article_assessment_agents(prompts)

    entity_input = {
        "user_article_state_id": normalized_input["user_article_state_id"],
        "article": normalized_input["article"],
        "allowed_entities": normalized_input["allowed_entities_reduced"],
        "allowed_side_categories": normalized_input["allowed_side_categories"],
    }
    entity_output, entity_meta = run_agent_json_with_meta(Runner, agents_map["entity_classifier"], entity_input, stage="entity_classifier")

    scorer_input = {
        "article": normalized_input["article"],
        "representative_entity": entity_output.get("representative_entity"),
        "classification_candidates": entity_output.get("classification_candidates"),
        "decision_reason": entity_output.get("decision_reason"),
        "side_category_code": entity_output.get("side_category_code"),
        "quality_dimensions": ["relevance", "depth", "novelty", "practicality"],
    }
    scorer_output, scorer_meta = run_agent_json_with_meta(Runner, agents_map["content_scorer"], scorer_input, stage="content_scorer")

    evidence_input = {
        "article": normalized_input["article"],
        "representative_entity": entity_output.get("representative_entity"),
        "side_category_code": entity_output.get("side_category_code"),
        "review_context": normalized_input["review_context"],
        "existing_tags": normalized_input["article"].get("tags", []),
        "grounding_chunks": normalized_input["article"].get("grounding_chunks", []),
    }
    evidence_output, evidence_meta = run_agent_json_with_meta(Runner, agents_map["evidence_extractor"], evidence_input, stage="evidence_extractor")

    qa_input = {
        "user_article_state_id": normalized_input["user_article_state_id"],
        "version": normalized_input["version"],
        "article": normalized_input["article"],
        "allowed_entities": normalized_input["allowed_entities_reduced"],
        "allowed_side_categories": normalized_input["allowed_side_categories"],
        "entity_output": entity_output,
        "scorer_output": scorer_output,
        "evidence_output": evidence_output,
        "prompt_template_version_id": normalized_input["prompt_template_version_id"],
        "run_log_id": normalized_input["run_log_id"],
    }
    qa_output, qa_meta = run_agent_json_with_meta(Runner, agents_map["assessment_qa"], qa_input, stage="assessment_qa")

    final_output = normalize_article_assessment_output(
        article_input=normalized_input,
        qa_output=qa_output,
        entity_output=entity_output,
        scorer_output=scorer_output,
        evidence_output=evidence_output,
    )

    usage_by_stage = {
        "entity_classifier": entity_meta.get("usage", {}),
        "content_scorer": scorer_meta.get("usage", {}),
        "evidence_extractor": evidence_meta.get("usage", {}),
        "assessment_qa": qa_meta.get("usage", {}),
    }
    contract_errors = validate_article_assessment_contract(
        final_output,
        user_article_state_id=normalized_input["user_article_state_id"],
        allowed_entities=normalized_input["allowed_entities"],
        allowed_side_categories=normalized_input["allowed_side_categories"],
        expected_version=normalized_input["version"],
    )
    debug_output = {
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "input": normalized_input,
        "pipeline": {
            "entity_classifier": {"in": entity_input, "out": entity_output, "meta": entity_meta},
            "content_scorer": {"in": scorer_input, "out": scorer_output, "meta": scorer_meta},
            "evidence_extractor": {"in": evidence_input, "out": evidence_output, "meta": evidence_meta},
            "assessment_qa": {"in": qa_input, "out": qa_output, "meta": qa_meta},
        },
        "usage": {
            "by_stage": usage_by_stage,
            "totals": merge_usage_summaries(list(usage_by_stage.values())),
        },
        "contract_validation": {
            "ok": not contract_errors,
            "errors": contract_errors,
        },
        "agent_json_raw": final_output,
    }

    if output_dir:
        output_dir_path = Path(output_dir)
        output_dir_path.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        stem = sanitize_filename(normalized_input["article"].get("title") or normalized_input["user_article_state_id"])
        output_path = output_dir_path / f"article_assessment_{stem}_{timestamp}.json"
        output_path.write_text(json.dumps(debug_output, ensure_ascii=True, indent=2))

    return debug_output


def run_article_assessment(
    article_input: Dict[str, Any],
    prompt_overrides: Dict[str, str] | None = None,
    output_dir: str | None = None,
) -> Dict[str, Any]:
    debug_output = run_article_assessment_debug(
        article_input=article_input,
        prompt_overrides=prompt_overrides,
        output_dir=output_dir,
    )
    return debug_output["agent_json_raw"]


def run_article_assessment_from_solteti(
    *,
    version_tags: str,
    output_dir: str | None = None,
    prompt_overrides: Dict[str, str] | None = None,
    submit_results: bool = False,
) -> Dict[str, Any]:
    package = ask_evaluation(type_="ARTICLE_AI", version_tags=version_tags)
    prompts_meta = package.get("prompts") if isinstance(package.get("prompts"), dict) else {}
    catalog = package.get("catalog") if isinstance(package.get("catalog"), dict) else {}
    items = package.get("items") if isinstance(package.get("items"), list) else []

    runs: List[Dict[str, Any]] = []
    results: List[Dict[str, Any]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        article_input = build_article_input_from_package(item, catalog, prompts_meta)
        try:
            debug_output = run_article_assessment_debug(
                article_input=article_input,
                prompt_overrides=prompt_overrides,
                output_dir=output_dir,
            )
        except Exception as exc:
            runs.append(
                {
                    "idempotency_key": f"uas:{article_input.get('user_article_state_id')}",
                    "input": article_input,
                    "skipped": True,
                    "skip_reason": str(exc),
                }
            )
            continue
        results.append(debug_output["agent_json_raw"])
        runs.append(
            {
                "idempotency_key": debug_output["agent_json_raw"].get("idempotency_key"),
                "input": article_input,
                "usage": debug_output.get("usage", {}),
                "contract_validation": debug_output.get("contract_validation", {}),
                "allowed_entities_received_count": len(article_input.get("allowed_entities", [])),
                "allowed_entities_sent_to_classifier_count": len(
                    ((debug_output.get("input") or {}).get("allowed_entities_reduced")) or article_input.get("allowed_entities", [])
                ),
            }
        )

    finish_response: Dict[str, Any] | None = None
    if submit_results and results:
        finish_response = finish_evaluation(results)

    return {
        "fetched_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "version_tags": version_tags,
        "prompt_template": {
            "template_id": prompts_meta.get("template_id"),
            "template_name": prompts_meta.get("template_name"),
            "version_ids": [
                version.get("version_id")
                for version in prompts_meta.get("versions", [])
                if isinstance(version, dict)
            ],
            "version_tags": [
                version.get("version_tag")
                for version in prompts_meta.get("versions", [])
                if isinstance(version, dict)
            ],
        },
        "item_count": len(results),
        "runs": runs,
        "results": results,
        "finish_evaluation": finish_response,
    }


def run_newsletter_draft(
    selected_items: List[Dict[str, Any]],
    user_instructions: str,
    few_shots: str,
    brand_tone: str,
    prompt_overrides: Dict[str, str] | None = None,
    source: str = "manual",
    selected_article_ids: List[str] | None = None,
    week_start: str | None = None,
    week_end: str | None = None,
    min_score: int = 4,
    limit: int = 10,
    editorial_angle: str = "",
    audience_mode: str = "mixed_technical",
    strictness_mode: str = "balanced",
    compare_mode: bool = False,
    output_dir: str | None = None,
) -> Dict[str, Any]:
    prompts = DEFAULT_NEWSLETTER_PROMPTS.copy()
    if prompt_overrides:
        for key, value in prompt_overrides.items():
            if isinstance(value, str) and value.strip():
                prompts[key] = value.strip()

    resolved_items = list(selected_items or [])
    if source == "db":
        resolved_items = fetch_db_news_candidates(
            selected_article_ids=selected_article_ids,
            week_start=week_start,
            week_end=week_end,
            min_score=min_score,
            limit=limit,
        )

    if not resolved_items:
        raise ValueError("No selected items found for newsletter draft.")

    input_payload = build_newsletter_input_payload(
        selected_items=resolved_items,
        user_instructions=user_instructions,
        few_shots=few_shots,
        brand_tone=brand_tone,
        editorial_angle=editorial_angle,
        audience_mode=audience_mode,
        strictness_mode=strictness_mode,
    )
    Runner, pipeline_agents = build_newsletter_pipeline_agents(prompts)
    persistent_warnings = load_agent_memory(output_dir)

    dedup_input = {
        "selected_items": input_payload["selected_items"],
        "relationship_hints": input_payload["relationship_hints"],
    }
    dedup_json = run_agent_json(Runner, pipeline_agents["dedup_resolver"], dedup_input, stage="dedup_resolver")
    dedup_keep_ids = dedupe_preserve_order([str(value) for value in safe_list(dedup_json.get("keep_article_ids"))])
    if dedup_keep_ids:
        input_payload["selected_items"] = [
            item for item in input_payload["selected_items"] if str(item.get("article_id")) in dedup_keep_ids
        ]

    selection_critic_input = {
        "editorial_angle": editorial_angle,
        "selected_items": input_payload["selected_items"],
        "relationship_hints": input_payload["relationship_hints"],
        "user_instructions": user_instructions,
        "strictness_mode": strictness_mode,
        "dedup_feedback": dedup_json,
    }
    selection_critic_json = run_agent_json(Runner, pipeline_agents["selection_critic"], selection_critic_input, stage="selection_critic")

    keep_article_ids = dedupe_preserve_order(
        [str(value) for value in safe_list(selection_critic_json.get("keep_article_ids"))]
    )
    if keep_article_ids:
        kept_items = [item for item in input_payload["selected_items"] if str(item.get("article_id")) in keep_article_ids]
        if kept_items:
            input_payload["selected_items"] = kept_items

    audience_input = {
        "editorial_angle": editorial_angle,
        "audience_mode": audience_mode,
        "brand_tone": brand_tone,
        "user_instructions": user_instructions,
        "selected_items": input_payload["selected_items"],
    }
    audience_json = run_agent_json(Runner, pipeline_agents["audience_adapter"], audience_input, stage="audience_adapter")

    planner_input = {
        "editorial_angle": editorial_angle,
        "selected_items": input_payload["selected_items"],
        "selection_feedback": selection_critic_json,
        "user_instructions": user_instructions,
        "brand_tone": brand_tone,
        "audience_guidance": audience_json,
        "strictness_mode": strictness_mode,
        "quality_rubric": QUALITY_RUBRIC,
    }
    planner_json = run_agent_json(Runner, pipeline_agents["planner"], planner_input, stage="planner")

    normalizer_input = {
        "editorial_angle": editorial_angle,
        "issue_thesis": planner_json.get("issue_thesis", ""),
        "section_plan": safe_list(planner_json.get("section_plan")),
        "selected_items": input_payload["selected_items"],
        "relationship_hints": dedupe_preserve_order([
            json.dumps(value, ensure_ascii=True, sort_keys=True) for value in safe_list(input_payload.get("relationship_hints"))
        ]),
        "selection_feedback": selection_critic_json,
        "strictness_mode": strictness_mode,
        "quality_rubric": QUALITY_RUBRIC,
    }
    if normalizer_input["relationship_hints"]:
        normalizer_input["relationship_hints"] = [json.loads(value) for value in normalizer_input["relationship_hints"]]
    normalizer_json = run_agent_json(Runner, pipeline_agents["normalizer"], normalizer_input, stage="normalizer")

    strictness_notes = {
        "strict": [
            "Use the most conservative phrasing.",
            "Explicitly mark uncertainty and avoid speculative synthesis.",
        ],
        "balanced": [
            "Use bounded claims and mention uncertainty when relevant.",
        ],
        "editorial": [
            "Allow stronger synthesis, but avoid unsupported hype.",
        ],
    }

    writer_input = {
        "editorial_angle": editorial_angle,
        "issue_thesis": planner_json.get("issue_thesis", ""),
        "section_plan": safe_list(planner_json.get("section_plan")),
        "section_inputs": safe_list(normalizer_json.get("section_inputs")),
        "normalized_items": safe_list(normalizer_json.get("normalized_items")),
        "brand_tone": brand_tone,
        "audience_guidance": audience_json,
        "audience_mode": audience_mode,
        "few_shots": few_shots,
        "user_instructions": user_instructions,
        "negative_instructions": list(NEGATIVE_INSTRUCTION_LIBRARY.values()),
        "quality_rubric": QUALITY_RUBRIC,
        "strictness_mode": strictness_mode,
        "strictness_notes": strictness_notes.get(strictness_mode, strictness_notes["balanced"]),
        "persistent_warnings": persistent_warnings,
    }
    writer_json = run_agent_json(Runner, pipeline_agents["writer"], writer_input, stage="writer")
    writer_draft = normalize_draft_shape(writer_json, writer_json.get("raw_output", ""))

    comparative_json: Dict[str, Any] = {}
    if compare_mode:
        comparative_input = dict(writer_input)
        comparative_input["comparison_mode"] = "news-first"
        comparative_input["brand_tone"] = f"{brand_tone}; comparison variant with more direct summary ordering"
        comparative_json = run_agent_json(Runner, pipeline_agents["writer"], comparative_input, stage="writer")

    section_qa_input = {
        "draft": writer_draft,
        "issue_thesis": planner_json.get("issue_thesis", ""),
        "section_inputs": safe_list(normalizer_json.get("section_inputs")),
        "quality_rubric": QUALITY_RUBRIC,
    }
    section_qa_json = run_agent_json(Runner, pipeline_agents["section_qa"], section_qa_input, stage="section_qa")
    skeptic_input = {
        "draft": writer_draft,
        "issue_thesis": planner_json.get("issue_thesis", ""),
        "normalized_items": safe_list(normalizer_json.get("normalized_items")),
        "section_inputs": safe_list(normalizer_json.get("section_inputs")),
        "section_reviews": safe_list(section_qa_json.get("section_reviews")),
        "persistent_warnings": persistent_warnings,
    }
    skeptic_json = run_agent_json(Runner, pipeline_agents["skeptic"], skeptic_input, stage="skeptic")

    title_input = {
        "issue_thesis": planner_json.get("issue_thesis", ""),
        "draft": writer_draft,
        "audience_mode": audience_mode,
        "brand_tone": brand_tone,
    }
    title_json = run_agent_json(Runner, pipeline_agents["title"], title_input, stage="title")

    style_input = {
        "draft": writer_draft,
        "brand_tone": brand_tone,
        "editorial_angle": editorial_angle,
        "audience_guidance": audience_json,
        "audience_mode": audience_mode,
        "revision_instructions": safe_list(skeptic_json.get("revision_instructions")),
        "issues": safe_list(skeptic_json.get("issues")),
        "user_instructions": user_instructions,
        "section_reviews": safe_list(section_qa_json.get("section_reviews")),
        "title_candidates": title_json,
        "quality_rubric": QUALITY_RUBRIC,
    }
    style_json = run_agent_json(Runner, pipeline_agents["style"], style_input, stage="style")
    final_draft = normalize_draft_shape(style_json, style_json.get("raw_output", ""))
    if title_json.get("title"):
        final_draft["title"] = title_json.get("title", final_draft["title"])
    if title_json.get("subject_line"):
        final_draft["subject_line"] = title_json.get("subject_line", final_draft["subject_line"])
    final_draft["alt_titles"] = safe_list(title_json.get("alt_titles"))

    if safe_list(skeptic_json.get("needs_human_check")):
        final_draft["needs_human_check"] = dedupe_preserve_order(
            [str(value) for value in final_draft.get("needs_human_check", []) + safe_list(skeptic_json.get("needs_human_check"))]
        )
    confidence_adjustment = skeptic_json.get("confidence_adjustment")
    if confidence_adjustment:
        final_draft["confidence"] = confidence_adjustment

    output = {
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "source": source,
        "selection": {
            "selected_article_ids": normalize_selected_ids(selected_article_ids or []),
            "week_start": week_start,
            "week_end": week_end,
            "min_score": min_score,
            "limit": limit,
            "editorial_angle": editorial_angle,
            "audience_mode": audience_mode,
            "strictness_mode": strictness_mode,
            "compare_mode": compare_mode,
        },
        "input_payload": input_payload,
        "selected_items": resolved_items,
        "agent_memory": persistent_warnings,
        "quality_rubric": QUALITY_RUBRIC,
        "negative_instruction_library": NEGATIVE_INSTRUCTION_LIBRARY,
        "pipeline": {
            "dedup_resolver": {
                "in": dedup_input,
                "out": dedup_json,
            },
            "selection_critic": {
                "in": selection_critic_input,
                "out": selection_critic_json,
            },
            "audience_adapter": {
                "in": audience_input,
                "out": audience_json,
            },
            "planner": {
                "in": planner_input,
                "out": planner_json,
            },
            "normalizer": {
                "in": normalizer_input,
                "out": normalizer_json,
            },
            "writer": {
                "in": writer_input,
                "out": writer_draft,
            },
            "section_qa": {
                "in": section_qa_input,
                "out": section_qa_json,
            },
            "skeptic": {
                "in": skeptic_input,
                "out": skeptic_json,
            },
            "title": {
                "in": title_input,
                "out": title_json,
            },
            "style": {
                "in": style_input,
                "out": final_draft,
            },
        },
        "draft": final_draft,
        "comparative_draft": normalize_draft_shape(comparative_json) if comparative_json else None,
        "markdown": render_newsletter_markdown(final_draft),
    }

    if output_dir:
        output_dir_path = Path(output_dir)
        output_dir_path.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        stem = sanitize_filename(final_draft.get("title") or editorial_angle or "newsletter_draft")
        output_path = output_dir_path / f"newsletter_draft_{stem}_{timestamp}.json"
        output_path.write_text(json.dumps(output, ensure_ascii=True, indent=2))
        output["output_path"] = str(output_path)

    return output


def main() -> int:
    parser = argparse.ArgumentParser(description="Run News Agent on CSV input.")
    parser.add_argument("--input", default="dev/apps/agent/news_agent/data/example_data.csv")
    parser.add_argument("--limit", type=int, default=0, help="Limit number of rows (0 = all).")
    parser.add_argument("--output_dir", default="dev/apps/agent/news_agent/outputs")
    parser.add_argument("--prompts", default="")
    parser.add_argument("--article-assessment-input", default="")
    parser.add_argument("--solteti-article-ai", action="store_true")
    parser.add_argument("--version-tags", default="A")
    parser.add_argument("--submit-results", action="store_true")
    parser.add_argument("--db-preview", action="store_true")
    parser.add_argument("--selected-ids", default="")
    parser.add_argument("--week-start", default="")
    parser.add_argument("--week-end", default="")
    parser.add_argument("--min-score", type=int, default=4)
    parser.add_argument("--newsletter-draft-db", action="store_true")
    parser.add_argument("--user-instructions", default="")
    parser.add_argument("--few-shots", default="")
    parser.add_argument("--brand-tone", default="")
    parser.add_argument("--editorial-angle", default="")
    parser.add_argument("--audience-mode", default="mixed_technical")
    parser.add_argument("--strictness-mode", default="balanced")
    parser.add_argument("--compare-mode", action="store_true")
    args = parser.parse_args()

    env_path = Path(__file__).with_name(".env")
    load_env_file(env_path)

    if args.article_assessment_input:
        input_path = Path(args.article_assessment_input)
        if not input_path.exists():
            print(f"Article assessment input not found: {input_path}")
            return 1
        try:
            article_input = json.loads(input_path.read_text())
        except Exception as exc:
            print(f"Failed to read article assessment input: {exc}")
            return 1
        prompt_path = Path(args.prompts) if args.prompts else Path(__file__).with_name("article_assessment_prompts.json")
        prompts = load_article_assessment_prompts(prompt_path if str(prompt_path) else None)
        output = run_article_assessment(
            article_input=article_input,
            prompt_overrides=prompts,
            output_dir=args.output_dir,
        )
        print(json.dumps(output, ensure_ascii=True, indent=2))
        return 0

    if args.solteti_article_ai:
        prompt_path = Path(args.prompts) if args.prompts else Path(__file__).with_name("article_assessment_prompts.json")
        prompts = load_article_assessment_prompts(prompt_path if str(prompt_path) else None)
        output = run_article_assessment_from_solteti(
            version_tags=args.version_tags,
            output_dir=args.output_dir,
            prompt_overrides=prompts,
            submit_results=args.submit_results,
        )
        print(json.dumps(output, ensure_ascii=True, indent=2))
        return 0

    if args.db_preview:
        selected_ids = [part.strip() for part in args.selected_ids.split(",") if part.strip()]
        output = build_article_selection_preview(
            selected_article_ids=selected_ids,
            week_start=args.week_start or None,
            week_end=args.week_end or None,
            min_score=args.min_score,
            limit=args.limit or 20,
        )
        print(json.dumps(output, ensure_ascii=True, indent=2))
        return 0

    if args.newsletter_draft_db:
        selected_ids = [part.strip() for part in args.selected_ids.split(",") if part.strip()]
        prompt_path = Path(args.prompts) if args.prompts else Path(__file__).with_name("newsletter_prompts.json")
        prompts = load_newsletter_prompts(prompt_path if str(prompt_path) else None)
        output = run_newsletter_draft(
            selected_items=[],
            user_instructions=args.user_instructions,
            few_shots=args.few_shots,
            brand_tone=args.brand_tone,
            prompt_overrides=prompts,
            source="db",
            selected_article_ids=selected_ids,
            week_start=args.week_start or None,
            week_end=args.week_end or None,
            min_score=args.min_score,
            limit=args.limit or 10,
            editorial_angle=args.editorial_angle,
            audience_mode=args.audience_mode,
            strictness_mode=args.strictness_mode,
            compare_mode=args.compare_mode,
            output_dir=args.output_dir,
        )
        print(json.dumps(output, ensure_ascii=True, indent=2))
        return 0

    items = load_items(Path(args.input))
    if args.limit and args.limit > 0:
        items = items[: args.limit]

    if not items:
        print("No items found.")
        return 1

    prompt_path = Path(args.prompts) if args.prompts else Path(os.getenv("NEWS_AGENT_PROMPTS_PATH", ""))
    if not args.prompts and not os.getenv("NEWS_AGENT_PROMPTS_PATH"):
        prompt_path = Path(__file__).with_name("prompts.json")
    prompts = load_prompts(prompt_path if str(prompt_path) else None)

    run_pipeline(items=items, output_dir=args.output_dir, prompts=prompts)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
