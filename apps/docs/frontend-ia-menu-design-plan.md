# 프론트 확장 — 정보구조(IA) / 메뉴 디자인 기획안

> **작성일**: 2026-07-13 · **대상**: 개발자 서피스(`/`) 사이드바 메뉴 재설계 · **상태**: 기획(검토용, 미구현)
> **목적**: 요구 문서 3개 + 현재 라이브 사이트를 종합해 **최종 메뉴 트리**를 확정하기 위한 기획안. **충돌 지점은 ⚠️로 표시**하고 채택 권고안을 제시한다.
> **정책**: 바로 구현하지 않는다. 이 문서를 검토·확정한 뒤 메뉴 구현 착수.

## 출처 (3개 요구 문서 + 대조군)

| # | 문서 | 생성일 | 레이어 | 역할 |
|---|------|--------|--------|------|
| 1 | UI & Information Architecture (260415) | 2026-02-24 (最古) | **화면 IA** | 사이드바/네비 뼈대 + 와이어프레임 |
| 2 | PRD `docs/PRD/product-scope.md` | 중간 | **제품 범위** | 3대 섹션 + 티어/개인화/뉴스레터 |
| 3 | Cherry Category (260530) | 2026-05-30 (最新) | **콘텐츠 태그 taxonomy** | News DB 태그. "**PRD와 반드시 동기화**" 명시 |
| — | 현재 라이브 `cherryinthehaystack.com` | 현재 | 구현 현황 | 대조군(스크린샷) |

**종합 원칙**
- **콘텐츠 분류(태그)의 기준선 = 최신 Category(5/30)**. PRD·IA와 다르면 Category를 최신 의도로 본다.
- **화면 뼈대(Digest/Basics/Advanced/보조페이지) = IA + 현재 사이트** 유지.
- 충돌은 덮지 말고 **명시 + 권고안 + "결정필요" 상태**로 남긴다.

---

## 1. 최종 메뉴 트리 (제안)

> ⚠️ = 문서 간 충돌 지점(§2 매트릭스에서 상세). `kebab-case` = 데이터 태그(News DB), 표시 라벨은 Title Case.

```
DIGEST  (다이제스트)
 ├─ This Week's Highlights  (한 주 요약 / Weekly Update)
 └─ Patch Notes             (변경사항 · Changelog)

LEARNING  (개념 학습)                          ← Basics/Advanced + Concept Reader
 ├─ Concept Reader   개념 리더 — 4섹션 포맷(Overview→Cherries→Child Concepts→Progressive References)
 ├─ Basics    기초    · 개념 기반 동적 목록(Prompt Engineering, RAG, Fine-tuning, Agents, Embeddings, Evaluation, Inference Optimization…)
 └─ Advanced  심화    · 동일 도메인 심화 (+ A2A, Multi-agent, PEFT/LoRA, Adversarial Eval…)

NEWLY DISCOVERED  (새로 발견)                   ← 4그룹 (핵심)
 ├─ Overview   전체 개요                         [IA "이번 시즌 구현" 항목]
 │
 ├─ ① Research & Models  (연구·모델)
 │    ├─ Model Updates          model-updates          신규 모델·API·버전·가격·프로토콜 변경
 │    ├─ Papers                 papers                 학회 논문(외부 링크, 직접 큐레이션 X)
 │    └─ Benchmarks & Datasets  benchmarks-datasets    벤치·데이터셋·리더보드 (+조감도/landscape 뷰)
 │
 ├─ ② Engineering & Tooling  (엔지니어링·툴링)
 │    ├─ Frameworks & SDK       frameworks             프레임워크·SDK·릴리스·의존성
 │    ├─ Dev Tools              dev-tools              생산성·모니터링·디버깅 (+ Hall of Fame)
 │    └─ Building Blocks ⚠️      building-blocks        조립용 부품: 프롬프트/템플릿/스니펫/오케스트레이션/MCP/에이전트
 │         └ 하위태그(한 페이지에 함께): building-blocks-mixed · agents · mcp · prompt
 │         ⚠️ PRD/IA 명칭은 "Patterns & Implementations" — 최신 Category 명칭 채택
 │
 ├─ ③ Cases  (산업·사례)  ⭐우선순위
 │    ├─ Domain Applications ⚠️  domain-applications    도메인별 솔루션/프롬프트/짤막 뉴스
 │    ├─ Case Studies           case-studies           유스케이스·ROI·도입·성공/실패·컨퍼런스
 │    └─ Product Discovery ⚠️    product-discovery      AI로 실생활 문제 해결(개발자 생산성은 dev-tools로)
 │         ⚠️ PRD엔 Case Studies 1개만 존재 → Category/IA의 3분할 채택
 │
 └─ ④ Discourse  (담론)
      ├─ Regulations · Policy · Compliance   regulations-policy-compliance   정책·규제·법·표준
      ├─ Community ⚠️                         community              사람·이벤트·밋업·기여자
      ├─ Big Tech Trends ⚠️                   big-tech-trends        빅테크 움직임(모델·투자 제외)
      ├─ Market & Investment ⚠️               market-investment      VC·M&A·후원·자금 흐름
      ├─ Technical Deep Dives                 technical-deep-dives   롱폼 기술·시스템 설계 분석
      └─ Insights & Opinions                  insights-opinions      오피니언·예측·트렌드

보조 페이지 (IA "이번 시즌 구현" · 네비 하단/유틸)
 ├─ Archive              아카이브
 ├─ Compare Knowledge    지식베이스 비교
 └─ Change Tracking      변경사항 추적

⚠️ 결정필요 —  AGENT SHOP  (Knowledge Market · Arena)
 └ 요구 문서 3개 어디에도 없음(KaaS 해커톤 산물). 유지 / `/start` 컨슈머로 이전 / 숨김 중 택1 (§4)
```

---

## 2. 충돌 매트릭스 (⚠️ 항목별 상세)

| # | 항목 | PRD | IA(260415) | Category(260530·최신) | 현재 사이트 | **채택 권고** | 상태 |
|---|------|-----|-----------|----------------------|------------|--------------|------|
| C1 | **Cases 개수** | Case Studies **1개** | 3개 | domain-applications·case-studies·product-discovery **3개** | Case Studies 1개 | **3개**(최신 기준) | 권고, 확정필요 |
| C2 | **Big Tech 위치** | Insights에 **포함** | **독립** | **독립** `big-tech-trends` | 없음 | **독립 카테고리** | 권고, 확정필요 |
| C3 | **Market & Investment** | **없음** | 독립 | **독립** `market-investment` | 없음 | **독립 카테고리** | 권고, 확정필요 |
| C4 | **Community** | 있음(Discourse) | **누락** | 있음 `community` | 없음 | **유지**(IA 누락은 실수로 판단) | 권고, 확정필요 |
| C5 | **②셋째 명칭** | Patterns & Implementations | Patterns & Implementations | **`building-blocks`** | Frameworks만 | **Building Blocks**(최신) | 권고 |
| C6 | **Digest/Changelog** | 콘텐츠 구조엔 없음(기능만) | 최상위 메뉴 | 태그 대상 아님 | 최상위 메뉴 | **최상위 UI 섹션 유지** | 합의 |
| C7 | **Agent Shop/Arena** | 없음 | 없음 | 없음 | **있음(HOT)** | **별도 결정**(§4) | ⚠️결정필요 |

**해석**: C1~C4는 전부 "**최신 Category가 PRD보다 세분화**"한 방향(담론 6개·사례 3개). Category 문서가 "PRD와 동기화" 대상이라고 스스로 밝혔으므로, **Category를 최신 확정본으로 두고 PRD를 갱신**하는 게 정합적. C4(Community)만 IA에서 빠졌는데 PRD·Category 둘 다 있으므로 유지 권고.

→ 결과: **Newly Discovered = 4그룹 / 총 15개 카테고리** (①3 + ②3 + ③3 + ④6).

---

## 3. "메뉴가 아닌 것" — 제외 명시 (Category Pipeline Tags)

Category의 **Pipeline-Specific Tags**는 UI 메뉴가 아니라 **파이프라인 전처리 태그**. 사이드바에서 제외:

| 태그 | 성격 | UI 노출 |
|------|------|--------|
| `news-collect` | 다이제스트→개별 기사 분해 전처리(분해 후 소멸) | ❌ |
| `ai-education` | 온톨로지 파이프라인 입력(개념페이지 evidence화) | ❌(개념페이지로 흡수) |
| `how-people-use-ai` | **"Cherry UI에 표시 안 함" 명시**, 수집만 | ❌ |

---

## 4. 현재 사이트 대비 변경점 + Agent Shop 결정

현재 라이브(스크린샷):
```
DIGEST: Highlights · Patch Notes
AGENT SHOP(HOT): Knowledge Market · Arena     ← 요구문서 없음
NEWLY DISCOVERED: Model Updates · Frameworks · Case Studies   ← 3개 축약
LEARNING: Concept Reader · Basics · Advanced
```

**주요 변경**
1. **Newly Discovered를 3개 → 4그룹 15카테고리로 전면 확장** (본 기획의 핵심).
2. Digest / LEARNING(Basics·Advanced·Concept Reader)는 **유지**.
3. **⚠️ Agent Shop / Arena / Knowledge Market 처리 — 결정 필요**:
   - (a) **`/start` 컨슈머 서피스로 이전** — 개발자 `/`는 요구문서대로 "지식 플랫폼"으로 순수화. **권고안**(두 서피스 분리 원칙과 일관).
   - (b) 최상위 별도 섹션으로 **유지**.
   - (c) **숨김/보류**.
   > 이 결정이 최상위 메뉴 구성을 좌우하므로 먼저 확정 필요.

---

## 5. 데이터 ↔ UI 매핑 규칙

- **데이터(News DB `Cherry Category`)**: `kebab-case` 태그(위 15개) — AI 룰베이스 분류기가 부여, Knowledge Team이 수동 보정.
- **UI 라벨**: Title Case(영문) + 한글 병기. 다국어(PRD: EN/KO) 지원.
- **다중 태그 허용**: 한 기사가 `frameworks` + `case-studies` 동시 가능 → 두 카테고리 페이지에 모두 노출.
- **그룹 페이지 = 태그 필터 뷰**: 각 카테고리 페이지 = 해당 태그 필터된 기사 리스트(개인화 시 재랭킹).

---

## 6. IA "이번 시즌 구현" 반영 (초록색 = build now)

IA 문서가 이번 시즌 구현 대상으로 표기한 것 → 본 기획에 포함:
- 사이트 전체 UI & 랜딩 페이지 · 한 주 요약(Weekly) · Changelog(To-be) · 개념설명 페이지(WIP, AS-IS 유지)
- **조감도(landscape) 뷰**: datasets · papers · benchmarks
- **Newly Discovered Overview** + 기본 템플릿
- Archive 페이지 · 변경사항 추적 · Compare Knowledge Base

IA "이번에 안 만들 것" → 범위 밖(템플릿 색상 요구 등)으로 보류.

---

## 7. 미결정 사항 (검토에서 확정)

1. **C7 Agent Shop/Arena** 처리: 이전(/start) / 유지 / 숨김 — **최우선 결정**.
2. **C1~C4** 최신 Category(사례3·담론6·Community유지) 그대로 확정할지.
3. **Basics/Advanced 하위 목록**을 고정 메뉴로 둘지, Graph DB 개념 기반 **동적 목록**으로 둘지.
4. 카테고리 15개를 **한 번에 다 노출**할지, 그룹 접기(현재 사이드바의 Basics/Advanced 접기 UX)로 **점진 노출**할지.
5. 최상위 그룹 라벨: 현재 "AGENT SHOP / NEWLY DISCOVERED / LEARNING" vs 요구문서 명칭 정합.
6. 개인화(PRD): Free=커뮤니티 큐레이션 / Paid=카테고리 show-hide + 재랭킹 "Community | For You" 토글 — 메뉴에 반영 시점.

---

## 8. 다음 단계

1. §7 미결정(특히 Agent Shop) 결정.
2. 확정 트리로 **사이드바 와이어프레임/목업**(시각안) 작성.
3. 프론트 사이드바(`components/cherry/sidebar.tsx`) + 라우팅 구현 착수(허락 후).

---

*(검토용 기획안. 실제 코드/데이터와 대조해 확정. 관련: `apps/docs/agent_read/api-backend-status-2026-07-13.md`, `apps/docs/analytics-two-surface-implementation-plan.md`.)*
