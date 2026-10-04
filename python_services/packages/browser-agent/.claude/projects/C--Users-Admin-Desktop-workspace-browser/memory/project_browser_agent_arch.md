---
name: project-browser-agent-arch
description: browser-agent 프로젝트의 targeted ADR 결정 사항 — OQ-1, OQ-7 해소 및 Python/TS 통합 경계 확정
metadata:
  type: project
---

2026-05-23에 browser-agent 프로젝트의 4개 phase-blocker 결정을 완료했다.

**Why:** OQ-1(스키마 미결), OQ-7(Notion 필드 미결), Python/TS 경계 불명확으로 F-2/F-3/F-4/F-7 구현 시 스키마 재작업 불가피했음.

**결정 요약:**
- ADR-011: `content.crawler_analysis` — source당 1:1, UUID v7, JSONB shape CHECK, prompt_template_version FK
- ADR-012: `content.crawler_registry` — source당 1:many, `crawler_status_enum`(pending_review/active/deprecated), `consecutive_failures` Playwright 전용 카운터, `run_kind_enum`에 CRAWLER_ANALYSIS/CRAWLER_GENERATION 추가
- ADR-013: Python↔TS — 기존 FastAPI(port 8000) 확장, `python_services/api/routers/crawler.py`, analyze 60s/generate 30s timeout, per-request browser-use 세션
- ADR-015: Notion DB 2개 확정 — LinkedIn DB(`342f199edf7c803ebb2cfcb30bd492e3`, URL속성=`Linkedin`), Custom Crawl DB(`340f199edf7c80cabc78f94853d2c426`, URL속성=`URL`), 공통속성: Name/source_type/browser_use_only
- ADR-014: PR base=`feature/browser-crawl-agent`, head=`feat/crawler/{source_name}`, handbook-bot, 중복 시 기존 PR close 후 재오픈

**산출물 위치:** `_bmad-output/planning-artifacts/architecture.md`

**How to apply:** 이 결정들이 확정됐으므로 구현 스토리 작성 시 이 ADR을 직접 참조하면 됨. 스키마 재설계 없이 F-2/F-3/F-4/F-7 구현 진행 가능.
