# Cherry in the Haystack — Docs

> **진입점은 이 파일 하나.** Coding agent(BMAD 등)는 이 README를 먼저 읽고, status가 `current`인 문서만 작업 근거로 삼는다.

**Last updated: 2026-09-29**

## 문서 지도

| 위치 | Status | 내용 |
|---|---|---|
| **`skillgraph/`** | 🆕 **current** | 신규 — 스킬그래프 PRD · ADR · epic/story. **모든 신규 작업의 기준** |
| `architecture/` | ⚠️ partial | DB 스키마(ddl-v1.2) · 배포 · 보안 · 기술스택은 유효. 온톨로지/그래프 설계는 skillgraph/ADR로 대체됨 |
| `PRD/` | ⚠️ partial | 구 SaaS 플랫폼 스펙. 콘텐츠 3섹션(Basics/Advanced/Newly Discovered)·컨셉 페이지 구조는 유효. 나머지는 skillgraph/PRD가 우선 |
| `KaaS/` | ✅ current | Workshop (Cherry for Everyone 베이스) — 카드 조합 에이전트 빌더. 최신 |
| `ux-design-specification.md` | ⚠️ partial | 페이지 명세 유효. 그래프 시각화는 skillgraph UI 스펙 작성 시 보강 |
| `workflows/` | ✅ current | 소스 디스커버리 워크플로 |
| `user/` | ✅ current | — |
| `archive/` | 🗄️ archive | 슈퍼세이드됨. 읽기만 하고 작업 근거로 쓰지 않는다 |

## 읽기 순서 (coding agent 기준)

1. `skillgraph/PRD.md` — 무엇을 만드는가
2. `skillgraph/adr/` — 왜 이렇게 결정됐는가
3. `architecture/technology-stack.md` + `architecture/data-architecture.md` — 기존 시스템 위에 얹는 방법
4. `PRD/product-scope.md` §Content Structure — 콘텐츠 구조 계승
5. `KaaS/` — Workshop 연동 시

## Archive 목록 (치운 것)

- `HANDOVER.md` — 크롤러 파이프라인 인수인계 (5/30). 작동 코드 설명이지만 신규 작업 기준 아님
- `epics.md` — 구 스프린트 에픽. 신규 에픽은 `skillgraph/epics.md`로
- `ux-design-directions.html`, `ux-…-backup-…` — 이전 버전/중복
- `ddl-v1.1.sql(.bak)`, `crawler-autogen-migration.sql` — 구 DDL (현재는 v1.2)
- `bmm-workflow-status.yaml`, `codebase-restructure-memo-ko.md` — 완료된 작업 흔적

## 문서 규칙

- 새 문서 머리에 `status: draft|current|superseded` + 날짜 명시
- 스펙 변경은 PRD 수정이 아니라 **ADR 추가**로 (이유가 남는다)
- 회의록·실험 로그는 이 repo가 아니라 **cherry-docs** 로
- 정리 계획의 상세는 `CLEANUP-PLAN.md`
