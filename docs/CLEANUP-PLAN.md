# Cherry Docs 정리 계획 (2026-09-29)

> 목적: skillgraph 피칭을 위한 문서 블로커 제거.
> 원칙: **전부 보존한다 (archive), 아무것도 삭제하지 않는다.** 현재 문서는 status 라벨로 구분하고, 새 skillgraph 문서는 새 폴더에 작성한다.

## 현재 상태 (2026-09-29 실태)

- `docs/` 64개 파일, 마지막 수정 전부 3~5월 — skillgraph 전환 이전 구설계
- Notion 운영문서(운영+아카이브 237페이지)는 cherry-docs/archive 백업 완료 (`a7a7a66`)
- 코드 모듈은 살아있음 (kaas, pipeline, patch_notes 등) — 문서만 낡음

## 새 구조

```
docs/
├── README.md            ← 유일한 진입점. status 표 포함
├── skillgraph/          ← 신규 작성 (PRD, ADR, epic/story)
│   ├── PRD.md
│   ├── adr/             ← ADR-001 스토리지 결정 등
│   └── epics.md
├── architecture/        ← 기존 유지 (DB·배포·보안 등 아직 유효)
├── PRD/                 ← 기존 (구 SaaS 플랫폼 스펙)
├── KaaS/                ← 기존 (Workshop/Cherry for Everyone 관련)
┑── archive/             ← 슈퍼세이드된 문서 이동 (삭제 아님)
```

## README.md status 표 (핵심)

| 문서 | Status | 비고 |
|---|---|---|
| skillgraph/PRD.md | 🆕 current | 새로 작성 |
| PRD/product-scope.md | ⚠️ partial | 콘텐츠 구조(3섹션·4단 페이지)는 유효, 그래프/온톨로지 부분은 skillgraph PRD로 대체 |
| PRD/index.md (13종 전체) | ⚠️ partial | index 갱신 필요 |
| HANDOVER.md | 🗄️ archive | 크롤러 파이프라인 인수인계 (5/30) — 구버전이지만 작동 코드 설명 |
| architecture/ 29종 | ⚠️ case-by-case | DDL·배포·보안 유효 / 온톨로지·그래프 관련은 skillgraph ADR로 대체 |
| KaaS/ | ✅ current | Workshop(Cherry for Everyone 베이스) — 최신 |
| epics.md | 🗄️ archive | 구 스프린트 에픽 — BMAD 신규 에픽으로 대체 |
| ux-* | ⚠️ partial | 명세는 유탰, 그래프 시각화는 skillgraph UI 스펙으로 보강 필요 |

## 실행 단계 (오늘 밤)

1. `docs/archive/` 생성 + 슈퍼세이드 문서 이동 (HANDOVER, epics.md, backup 파일, ddl-v1.1 등 구버전)
2. `docs/README.md` 작성 — status 표 + 읽기 순서 (coding agent용)
3. `docs/skillgraph/PRD.md` 스캐폴드 — brain 리서치(skillgraph-research-report, schema-v0, chunking-mece-pilot) 기반 초안. 목표: **coding agent가 이 문서를 읽고 구현 착수 가능한 수준**
4. 커밋 & 푸시

## 작성 규칙

- 새 skillgraph 문서는 brain 리서치 결과를 소스로 삼되, repo 안에 자급자족적으로 쓴다 (coding agent가 brain에 접근 못함)
- 한국어+영어 혼용 환경 고려 — 헤더 영어, 본문 한국어
- 각 문서 머리에 `status: draft|current|superseded` 와 `last-updated` 명시
```
