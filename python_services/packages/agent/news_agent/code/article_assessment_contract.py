from __future__ import annotations

from typing import Any, Dict, List


REQUIRED_TOP_LEVEL_KEYS = [
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


def _as_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _is_number_between(value: Any, minimum: float, maximum: float) -> bool:
    try:
        numeric = float(value)
    except Exception:
        return False
    return minimum <= numeric <= maximum


def validate_article_assessment_contract(
    payload: Dict[str, Any],
    *,
    user_article_state_id: str | None = None,
    allowed_entities: List[Dict[str, Any]] | None = None,
    allowed_side_categories: List[Dict[str, Any]] | None = None,
    expected_version: str = "0.3",
) -> List[str]:
    errors: List[str] = []
    if not isinstance(payload, dict):
        return ["payload must be an object"]

    for key in REQUIRED_TOP_LEVEL_KEYS:
        if key not in payload:
            errors.append(f"missing top-level key: {key}")

    if errors:
        return errors

    if user_article_state_id:
        expected_idempotency_key = f"uas:{user_article_state_id.lower()}"
        if _as_text(payload.get("idempotency_key")) != expected_idempotency_key:
            errors.append(
                f"idempotency_key mismatch: expected {expected_idempotency_key}, got {_as_text(payload.get('idempotency_key'))}"
            )

    if _as_text(payload.get("version")) != expected_version:
        errors.append(f"version must be {expected_version}")

    representative_entity = payload.get("representative_entity")
    if not isinstance(representative_entity, dict):
        errors.append("representative_entity must be an object")
    else:
        for key in ["id", "page", "category_id", "category_name", "name"]:
            if not _as_text(representative_entity.get(key)):
                errors.append(f"representative_entity.{key} is required")

        if allowed_entities:
            allowed_by_id = {
                _as_text(item.get("id")): item
                for item in allowed_entities
                if isinstance(item, dict) and _as_text(item.get("id"))
            }
            rep_id = _as_text(representative_entity.get("id"))
            allowed = allowed_by_id.get(rep_id)
            if not allowed:
                errors.append("representative_entity.id must come from allowed_entities")
            else:
                for key in ["page", "category_id", "category_name", "name"]:
                    if _as_text(representative_entity.get(key)) != _as_text(allowed.get(key)):
                        errors.append(
                            f"representative_entity.{key} mismatch for id {rep_id}: expected {_as_text(allowed.get(key))}, got {_as_text(representative_entity.get(key))}"
                        )

    ai_summary = payload.get("ai_summary")
    if not isinstance(ai_summary, str) or not ai_summary.strip():
        errors.append("ai_summary must be a non-empty string")

    try:
        ai_score = int(payload.get("ai_score"))
    except Exception:
        ai_score = None
    if ai_score is None or ai_score < 1 or ai_score > 5:
        errors.append("ai_score must be an integer between 1 and 5")

    ai_classification_json = payload.get("ai_classification_json")
    if not isinstance(ai_classification_json, dict):
        errors.append("ai_classification_json must be an object")
    else:
        final_path = ai_classification_json.get("final_path")
        candidates = ai_classification_json.get("candidates")
        decision_reason = ai_classification_json.get("decision_reason")
        if not isinstance(final_path, dict):
            errors.append("ai_classification_json.final_path must be an object")
        else:
            for key in ["page", "category_name", "entity_name"]:
                if not _as_text(final_path.get(key)):
                    errors.append(f"ai_classification_json.final_path.{key} is required")
        if not isinstance(candidates, list):
            errors.append("ai_classification_json.candidates must be a list")
        else:
            for index, candidate in enumerate(candidates):
                if not isinstance(candidate, dict):
                    errors.append(f"ai_classification_json.candidates[{index}] must be an object")
                    continue
                for key in ["page", "category_name", "entity_name"]:
                    if not _as_text(candidate.get(key)):
                        errors.append(f"ai_classification_json.candidates[{index}].{key} is required")
                if "confidence" not in candidate or not _is_number_between(candidate.get("confidence"), 0, 1):
                    errors.append(f"ai_classification_json.candidates[{index}].confidence must be between 0 and 1")
        if not isinstance(decision_reason, str) or not decision_reason.strip():
            errors.append("ai_classification_json.decision_reason must be a non-empty string")

    side_category_code = _as_text(payload.get("side_category_code"))
    if not side_category_code:
        errors.append("side_category_code must be a non-empty string")
    elif allowed_side_categories:
        allowed_codes = {
            _as_text(item.get("code")).upper()
            for item in allowed_side_categories
            if isinstance(item, dict) and _as_text(item.get("code"))
        }
        if allowed_codes and side_category_code.upper() not in allowed_codes:
            errors.append("side_category_code must come from allowed_side_categories")

    ai_tags_json = payload.get("ai_tags_json")
    if not isinstance(ai_tags_json, list):
        errors.append("ai_tags_json must be a list")
    else:
        for index, item in enumerate(ai_tags_json):
            if not isinstance(item, dict):
                errors.append(f"ai_tags_json[{index}] must be an object")
                continue
            kind = _as_text(item.get("kind")).upper()
            value = _as_text(item.get("value"))
            if kind not in {"TAG", "KEYWORD"}:
                errors.append(f"ai_tags_json[{index}].kind must be TAG or KEYWORD")
            if not value:
                errors.append(f"ai_tags_json[{index}].value is required")
            if kind == "KEYWORD":
                try:
                    frequency = int(item.get("frequency"))
                except Exception:
                    frequency = None
                if frequency is None or frequency < 1:
                    errors.append(f"ai_tags_json[{index}].frequency must be >= 1")
                if "confidence" not in item or not _is_number_between(item.get("confidence"), 0, 1):
                    errors.append(f"ai_tags_json[{index}].confidence must be between 0 and 1")

    ai_snippets_json = payload.get("ai_snippets_json")
    if not isinstance(ai_snippets_json, dict):
        errors.append("ai_snippets_json must be an object")
    else:
        if not _as_text(ai_snippets_json.get("why_it_matters")):
            errors.append("ai_snippets_json.why_it_matters is required")
        for key in ["key_points", "risk_notes"]:
            value = ai_snippets_json.get(key)
            if not isinstance(value, list):
                errors.append(f"ai_snippets_json.{key} must be a list")
            elif not all(isinstance(item, str) and item.strip() for item in value):
                errors.append(f"ai_snippets_json.{key} must contain non-empty strings only")

    ai_evidence_json = payload.get("ai_evidence_json")
    if not isinstance(ai_evidence_json, dict):
        errors.append("ai_evidence_json must be an object")
    else:
        evidence_items = ai_evidence_json.get("evidence_items")
        if not isinstance(evidence_items, list):
            errors.append("ai_evidence_json.evidence_items must be a list")
        else:
            for index, item in enumerate(evidence_items):
                if not isinstance(item, dict):
                    errors.append(f"ai_evidence_json.evidence_items[{index}] must be an object")
                    continue
                for key in ["kind", "text", "url", "source_name", "published_at"]:
                    if not _as_text(item.get(key)):
                        errors.append(f"ai_evidence_json.evidence_items[{index}].{key} is required")

    ai_structured_extraction_json = payload.get("ai_structured_extraction_json")
    if not isinstance(ai_structured_extraction_json, dict):
        errors.append("ai_structured_extraction_json must be an object")
    else:
        source = ai_structured_extraction_json.get("source")
        review = ai_structured_extraction_json.get("review")
        if not isinstance(source, dict):
            errors.append("ai_structured_extraction_json.source must be an object")
        else:
            for key in ["name", "type"]:
                if not _as_text(source.get(key)):
                    errors.append(f"ai_structured_extraction_json.source.{key} is required")
        if not isinstance(review, dict):
            errors.append("ai_structured_extraction_json.review must be an object")
        else:
            if not _as_text(review.get("type")):
                errors.append("ai_structured_extraction_json.review.type is required")
            if review.get("reviewer") is not None and not isinstance(review.get("reviewer"), str):
                errors.append("ai_structured_extraction_json.review.reviewer must be string or null")
            if review.get("comment") is not None and not isinstance(review.get("comment"), str):
                errors.append("ai_structured_extraction_json.review.comment must be string or null")

    return errors
