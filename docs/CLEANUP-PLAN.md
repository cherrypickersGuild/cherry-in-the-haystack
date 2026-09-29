# Cherry Docs 정리 — 인벤토리 & 검증 시트 (2026-09-29)

> **사용법:** 아래 목록을 보고 **지울 것 지우고 · 검증하고** → 판정 열(비어 있음)에 기록.
> 판정 값: `keep`(현행 유지) / `archive`(치움, 보존) / `delete`(삭제) / 자유 메모
> 원칙: 지우기 전 전부 보존(archive). **PRD 등 신규 스펙은 BMAD workflow로만 작성** — 에이전트가 임의로 쓰지 않는다.

## 진행 상황

- ✅ Notion 237페이지 백업 완료 → `cherry-docs/archive/notion-backup-20260929/` (커밋 `a7a7a66`)
- ✅ 1차 archive 9건: HANDOVER.md · epics.md · ux-design-directions.html · ux-backup · ddl-v1.1(.bak) · crawler-migration(root) · bmm-workflow-status.yaml · codebase-restructure-memo — 전부 구버전/중복/완료 흔적 (커밋 `93760fc`)
- ⬜ 아래 57개 파일 검증 대기 (HK)

## A. architecture/ (25개)

| 파일 | 날짜 | 크기 | 내용 | 판정 |
|---|---|---|---|---|
| ddl-v1.2.sql | 0530 | **143K** | 현행 DDL | **keep** — 9/29 HK: 전부 살리기. 지한님 정보 얻은 후 reconcile |
| data-architecture.md | 0415 | **64K** | 데이터 아키텍처 종합 | |
| handbook-ddl-redesign-proposal.md | 0530 | 41K | 스키마 전면 재설계 **제안** | |
| handbook-ddl-v2.sql | 0530 | 26K | handbook v2 DDL | |
| handbook-apply.sql | 0530 | 26K | v2 적용 스크립트 | |
| epic-to-architecture-mapping.md | 0415 | 17K | 에픽↔아키텍처 매핑 | |
| deployment-architecture.md | 0415 | 13K | 배포 | |
| technology-stack.md | 0415 | 8K | 기술스택 | |
| handbook-ddl-revision-proposal.md | 0530 | 19K | 스키마 수정 기획안 | |
| code-structure-decision.md | 0407 | 7K | ADR-010 모노레포 구조 | |
| architecture-decision-records-adrs.md | 0415 | 7K | ADR 목록/양식 | |
| novel-pattern-designs.md | 0319 | 7K | 신규 패턴 설계 | |
| decision-summary.md | 0319 | 5K | 결정 요약 | |
| project-initialization.md | 0415 | 4K | 초기화 | |
| project-structure.md | 0415 | 4K | 구조 | |
| implementation-patterns.md | 0407 | 4K | 구현 패턴 | |
| cost-estimation.md | 0415 | 4K | LLM API 비용 추정 | |
| technology-stack-details.md | 0415 | 3K | 기술스택 상세 | |
| security-architecture.md | 0415 | 2K | 보안 | |
| api-contracts.md | 0319 | 2K | API 계약 | |
| consistency-rules.md | 0319 | 2K | 일관성 규칙 | |
| performance-considerations.md | 0319 | 1K | 성능 | |
| executive-summary.md | 0415 | 1K | 요약 | |
| crawler-autogen-migration.sql | 0530 | 8K | 크롤러 마이그레이션 | |
| development-environment.md · index.md | 03~04 | 0K | 빈 파일 | |

## B. PRD/ (13개) — 구 SaaS 플랫폼 스펙

| 파일 | 날짜 | 크기 | 내용 | 판정 |
|---|---|---|---|---|
| product-scope.md | 0531 | 25K | 제품 범위 — 3섹션·컨셉 페이지 구조 | |
| functional-requirements.md | 0531 | 22K | 기능 요구사항 14영역 | |
| validation-report.md | 0415 | 27K | 검증 리포트 | |
| saas-platform-api-backend-…md | 0415 | 14K | SaaS+API 백엔드 스펙 | |
| non-functional-requirements.md | 0415 | 13K | 비기능 요구사항 | |
| index.md | 0319 | 5K | TOC | |
| success-criteria.md | 0319 | 3K | 성공 기준 | |
| executive-summary.md | 0319 | 3K | 요약 | |
| acceptance-criteria-summary.md | 0319 | 1K | 수용 기준 | |
| project-classification.md | 0415 | 2K | 분류 | |
| product-magic-summary.md | 0319 | 2K | 매직 요약 | |
| next-steps.md · references.md | 0415 | 0K | 빈 파일 | |

## C. KaaS/ (13개) — Workshop · Cherry for Everyone 베이스

| 파일 | 날짜 | 크기 | 내용 | 판정 |
|---|---|---|---|---|
| prd.md | 0415 | 32K | KaaS PRD | |
| epics.md | 0415 | 27K | 에픽 분해 | |
| architecture.md | 0415 | 25K | 아키텍처 결정 | |
| epic-1-2-fr-to-schema-mapping.md | 0415 | 24K | FR→스키마 매핑 | |
| implementation-readiness-report.md | 0415 | 22K | 구현 준비도 | |
| track-requirements-mapping.md | 0417 | 21K | 트랙 요구사항 매핑 | |
| pitch.md | 0417 | 10K | **피칭 문서** | |
| product-brief-…-distillate.md | 0415 | 11K | 브리프 디스틸레이트 | |
| product-brief-cherry-kaas.md | 0415 | 9K | 브리프 | |
| agent-registration-flow.md | 0415 | 8K | 에이전트 등록 플로우 | |
| research/market-…-research.md | 0415 | 39K | 시장 리서치 | |
| research/technical-…-research.md | 0415 | 41K | 기술 리서치 (해커톤) | |

## D. 기타 (5개)

| 파일 | 날짜 | 크기 | 내용 | 판정 |
|---|---|---|---|---|
| ux-design-specification.md | 0404 | 26K | UX 명세 | |
| workflows/source-discovery-workflow.md | 0415 | 10K | 소스 디스커버리 HITL | |
| user/README.md | 0407 | 0K | 빈 | |
| README.md | 0929 | 1K | 진입점 (오늘 작성) | — |

## 리서치 상태 (참고 — 결정 아님)

- skillgraph 리서치: brain `cherry-research-result/` — 스키마 v0.1 초안 · 파일럿 1(Chunking) 완료 · 파일럿 2 대기. **진행 중, HK 결정 전.**
- 신규 PRD/ADR은 BMAD 워크플로 산출물로만 repo에 들어온다.
