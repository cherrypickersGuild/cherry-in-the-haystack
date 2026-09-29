# Cherry in the Haystack — Docs

> **진입점은 이 파일 하나.** 작업 전 status가 `current`인 문서만 근거로 삼는다.

**Last updated: 2026-09-29**

## 문서 지도

| 위치 | Status | 내용 |
|---|---|---|
| `architecture/` | ⚠️ 미검증 | DB 스키마(ddl-v1.2) · 배포 · 보안 · 기술스택 — 구설계지만 코드와 연결돼 있어 개별 검증 필요 |
| `PRD/` | ⚠️ 미검증 | 구 SaaS 플랫폼 스펙 (3~5월). skillgraph 전환 이전. 개별 검증 필요 |
| `KaaS/` | ⚠️ 미검증 | Workshop (Cherry for Everyone 베이스). 상대적 최신이나 검증 필요 |
| `ux-design-specification.md` | ⚠️ 미검증 | 페이지 명세 — 검증 필요 |
| `workflows/` | ⚠️ 미검증 | 소스 디스커버리 워크플로 |
| `user/` | ✅ current | — |
| `archive/` | 🗄️ archive | 슈퍼세이드됨. 읽기만, 작업 근거로 쓰지 않음 |

> ⚠️ = HK 검증 전. 검증 결과는 `CLEANUP-PLAN.md` 인벤토리에 기록한다.

## Archive 목록 (2026-09-29 치움)

- `HANDOVER.md` — 크롤러 파이프라인 인수인계 (5/30). 작동 코드 설명이지만 신규 작업 기준 아님
- `epics.md` — 구 스프린트 에픽
- `ux-design-directions.html`, `ux-design-specification-backup-20260404.md` — 이전 버전/중복
- `ddl-v1.1.sql(.bak)`, `crawler-autogen-migration.sql` (root 복사본) — 구 DDL (현재는 v1.2)
- `bmm-workflow-status.yaml`, `codebase-restructure-memo-ko.md` — 완료된 작업 흔적

## 문서 규칙

- 새 문서 머리에 `status: draft|current|superseded` + 날짜 명시
- 스펙 변경은 PRD 수정이 아니라 **ADR 추가**로
- 회의록·실험 로그는 이 repo가 아니라 **cherry-docs**로
- **신규 스펙(PRD 등) 작성은 BMAD workflow로 진행한다** — 에이전트가 임의로 초안을 쓰지 않는다
- 정리 계획·인벤토리는 `CLEANUP-PLAN.md`
