# 프론트 메뉴(IA) 확장 — 구현 기획서

> **작성일**: 2026-07-14 (전면 갱신) · **브랜치**: `menu-refactoring` · **상태**: 기획(검토 대기, 미구현)
> **선행 산출물**: 목업 [`apps/docs/mockups/sidebar-mockup.html`] · 디자인 기획안 [`apps/docs/frontend-ia-menu-design-plan.md`]
> **정책**: `apps/docs/agent_read/agent-policy.md` 준수 — **코드 수정·커밋은 사용자 허락 후**. 기획서는 **최소 3회 검토, 1회마다 멈춤.**

---

## 0. 확정 사항 (대표 컨펌 완료)

1. ✅ **목업대로 실제 사이트 메뉴를 확장**한다.
2. ✅ **기존 페이지가 있는 메뉴는 손대지 않는다** (내용 그대로, 그룹 안으로 위치만 이동).
3. ✅ **신규 메뉴는 "목업의 기획페이지"를 그대로 페이지 본문으로 넣는다.** (Curation In Progress 같은 새 플레이스홀더 만들지 않음)
4. ✅ **그룹 헤더는 페이지 없음** → 클릭 시 **열고닫기 토글 + 첫 서브메뉴 활성화·표시**.
5. ✅ **Agent Shop은 현위치 유지** (Digest 다음).
6. ✅ **default 폴백에 기대지 않는다** — 메뉴 **하나하나가 어디로 가는지 taxonomy에 명시**한다. 신규 id가 `default:`(홈)로 새는 일 자체를 없앤다. (1회차 검토 반영)
7. ✅ **4개 그룹의 접힘 상태를 각각 따로 기억**한다 (그룹별 개별 저장). (1회차 검토 반영)
8. ✅ **Basics/Advanced 하위는 현행 유지** — 문서에 "어떻게 만들라"는 지침이 없다. 현재 `HandbookPlaceholder`가 `TOPIC_META`(제목·섹션·설명)로 **제목에 맞게 렌더**하고 있으므로 그대로 둔다. (1회차 검토 반영)

### 0-1. ⚠️ 문서 기준선 (2026-07-14 재확인)

| 문서 | 상태 |
|------|------|
| **PRD product-scope** (canonical `main`) | Cherry Category와 **완전히 동일**하게 갱신됨 (Cases 3개 · Discourse 6개 · Building Blocks + 하위태그) |
| **Cherry Category (260530)** | 기준(baseline) |
| **UI & Information Architecture (260415)** | **갱신 전 버전** — 2건만 다름 |

→ **충돌은 5건이 아니라 2건**이다:
- **Building Blocks 명칭**: 현행 PRD·Cherry Category = `Building Blocks` / UI & Information Architecture (260415) = `Patterns & Implementations`
- **Community**: 현행 PRD·Cherry Category = 있음 / UI & Information Architecture (260415) = **누락**

> ⚠️ 로컬 `deploy` 브랜치의 `docs/PRD/product-scope.md`는 아직 **구버전**이다. 판단 기준은 **canonical `main`**.

---

## 1. 메뉴 트리 (확정)

```
DIGEST                     [기존]  This Week's Highlights · Patch Notes
AGENT SHOP 🔥              [기존]  Knowledge Market · Arena          ← 현위치 유지
NEWLY DISCOVERED
  Overview                 [신규]
  ▸ Research & Models      [헤더]  → 클릭 시 Model Updates 활성화
      Model Updates        [기존]
      Papers               [신규]
      Benchmarks & Datasets[신규]
  ▸ Engineering & Tooling  [헤더]  → 클릭 시 Frameworks & SDK 활성화
      Frameworks & SDK     [기존]
      Dev Tools            [신규]
      Building Blocks      [신규] ⚠️충돌
  ▸ Cases ★                [헤더]  → 클릭 시 Domain Applications 활성화
      Domain Applications  [신규]
      Case Studies         [기존]
      Product Discovery    [신규]
  ▸ Discourse              [헤더]  → 클릭 시 Regulations·Policy·Compliance 활성화
      Regulations · Policy · Compliance [신규]
      Community            [신규] ⚠️충돌
      Big Tech Trends      [신규]
      Market & Investment  [신규]
      Technical Deep Dives [신규]
      Insights & Opinions  [신규]
LEARNING                   [기존]  Concept Reader · Basics(▸) · Advanced(▸)
UTILITY
  Archive                  [신규]
  Compare Knowledge        [신규]
  Change Tracking          [신규]
```

- **기존 페이지 유지(무손상)**: Highlights · Patch Notes · Knowledge Market · Arena · **Model Updates · Frameworks · Case Studies** · Concept Reader · Basics(+24 개념) · Advanced(+6 개념)
- **신규 기획페이지 = 16개**: Overview(1) + Papers·Benchmarks(2) + Dev Tools·Building Blocks(2) + Domain Applications·Product Discovery(2) + Discourse(6) + Utility(3)
- **그룹 헤더 4개**: 페이지 없음. 토글 + 첫 자식 활성화.

---

## 2. 기획페이지(NDSpecPage) 내용

신규 메뉴를 클릭하면 **목업 우측 패널을 그대로** 보여준다.

| 행 | 내용 | 예 (Building Blocks) |
|----|------|---------------------|
| **개요** | 이 페이지가 무엇인지 | "바로 가져다 조립하는 부품: 프롬프트·템플릿·코드 스니펫·오케스트레이션 패턴·MCP·에이전트 구성…" |
| **데이터 태그** | News DB `Cherry Category` 값 | `building-blocks` |
| **그룹** | 소속 그룹 | Engineering & Tooling / 엔지니어링·툴링 |
| **근거 문서** | 어떤 기획서 근거인지 | `Cherry Category (260530)` `PRD product-scope` |
| **⚠️ 충돌** | (있을 때만) 기준·현행 vs 과거 | 현행: PRD·Cherry Category = Building Blocks / 과거: UI & Information Architecture (260415) = Patterns & Implementations |

**목적**: 그 페이지를 열면 *"여긴 뭐 하는 페이지이고, 무슨 문서 근거로 나왔고, 앞으로 뭘 만들면 되는지"* 가 바로 보인다. **기획서가 사이트 안에 살아 있는 상태.**

---

## 3. 구현 구조 (⚠️ 이 앱의 제약 반영)

**핵심 제약**: 개발자 서피스(`/`)는 **URL 라우트가 아니라 상태 기반**이다. `sidebar.tsx`의 `SECTIONS` → `active` id → `app/page.tsx`가 switch로 렌더. (`/arena` 같은 실제 라우트 없음)

```
lib/nd-taxonomy.ts                ← [신규] 단일 소스(Single Source of Truth)
   id · tag · label(EN/KO) · group · 개요 · 근거문서 · 충돌
        │
        ├──► components/cherry/sidebar.tsx   [수정] SECTIONS 확장 + 헤더 클릭 동작
        │
        └──► components/cherry/nd-spec-page.tsx [신규] 기획페이지 렌더
                     ▲
        app/page.tsx [수정] ──┤ model-updates·frameworks·case-studies → 기존 컴포넌트(그대로)
                              └ 그 외 taxonomy에 있으면      → <NDSpecPage id={active}/>
```

### 3-0. ⚠️ taxonomy의 범위 (반드시 한정)

`nd-taxonomy.ts`는 **사이드바 전체가 아니라, 이번에 손대는 부분만** 담는다. 전체를 옮기면 기존 메뉴(Digest·Agent Shop·Learning)까지 건드리게 되어 "기존 무손상" 원칙과 충돌한다.

| 담는다 (19개 leaf + 그룹 4개) | 담지 않는다 (기존 `SECTIONS` 하드코딩 유지) |
|---|---|
| ND 카테고리 **15개** (3개 기존 + 12개 신규) | DIGEST (Highlights · Patch Notes) |
| `nd-overview` (신규) | AGENT SHOP (Knowledge Market · Arena) |
| Utility **3개** (신규) | LEARNING (Concept Reader · **Basics 24개** · **Advanced 6개**) |
| 그룹 정의 4개 (research/eng/cases/discourse) | |

- 이 19개 중 **3개**(`model-updates`·`frameworks`·`case-studies`)는 **기존 컴포넌트**로, **16개**는 `NDSpecPage`로 렌더.
- **데이터 태그(`tag`)는 선택 필드(optional)** — 실제 `Cherry Category` 태그를 갖는 건 **ND 15개뿐**이다. `nd-overview`·Utility 3개는 태그 없음.
- ND 15개는 **`id === tag`** 로 동일하다 (예: `building-blocks` → 태그 `building-blocks`).

### 3-1. 왜 단일 소스가 필수인가
현재 taxonomy가 **sidebar.tsx / nd-placeholder-page.tsx / page.tsx 세 곳에 흩어져 이미 어긋나 있다.**
예: `nd-placeholder-page.tsx`의 `CATEGORY_META`는 아직 옛 이름(`"patterns"` → "Patterns & Implementations", `"research-papers"`, `"deep-dives"` 등)을 쓴다.
→ **taxonomy를 파일 하나로 모아** 사이드바·기획페이지가 같은 데이터를 보게 한다. 안 그러면 같은 사고가 반복된다.

### 3-2. 수정 파일 (4개)

| 파일 | 종류 | 작업 |
|------|------|------|
| `apps/web/lib/nd-taxonomy.ts` | 신규 | 목업 데이터 이식 (15 카테고리 + Overview + Utility + 그룹 정의 + 충돌 2건) |
| `apps/web/components/cherry/nd-spec-page.tsx` | 신규 | 기획페이지 컴포넌트 (개요/태그/그룹/근거문서/충돌) |
| `apps/web/components/cherry/sidebar.tsx` | 수정 | `SECTIONS` 확장(ND 4그룹 + UTILITY), `GroupHeaderButton`이 **토글 + 첫 자식 `onSelect`** |
| `apps/web/app/page.tsx` | 수정 | 기존 3개 분기 유지 + taxonomy에 있으면 `NDSpecPage` 렌더 (16개 case 손으로 안 씀) |

### 3-3. ⚠️ 명시적 매핑 원칙 — `default:` 폴백에 기대지 않는다

**현재 코드의 함정**: `app/page.tsx`의 `renderContent()`가 `case "highlight": default:` 구조라 **모르는 id는 조용히 홈 화면을 렌더**한다. 에러도 안 난다. → 사이드바에 메뉴만 추가하고 렌더 분기를 빠뜨리면 **"클릭해도 홈이 뜨는" 무증상 버그**가 된다.

**대응 — 메뉴 하나하나가 어디로 가는지 명시한다. 페이지는 3종류다:**

#### ① 진짜 페이지 — 실제 콘텐츠 있음 → **그대로 둠**
| 메뉴 id | 렌더 대상 |
|---------|----------|
| `highlight` | 홈 (PageHeader + Treemap) — `default:`도 여기 |
| `patch-notes` | `PatchNotesPage` |
| `kaas-catalog` / `kaas-arena` | `KaasCatalogPage` / `KaasArenaPage` |
| `model-updates` | `NDModelUpdatesPage` |
| `frameworks` | `NDFrameworksPage` |
| `case-studies` | `NDCaseStudiesPage` |
| `concept-reader` | `ConceptReaderPage` |

#### ② 기존 더미 — 이미 더미 → **그대로 둠** (나중에 진짜 개념 페이지로 채울 대상)
| 메뉴 | 렌더 대상 |
|------|----------|
| **Basics 24개 개념** (`foundations`, `prompting-reasoning`, `rag-systems` …) | `HandbookPlaceholder` (`TOPIC_META`의 제목·설명) |
| **Advanced 6개 개념** (`chain-of-thought`, `multi-hop-rag`, `peft-lora` …) | `HandbookPlaceholder` |

> ⚠️ **목업의 Basics/Advanced 하위(`b-prompting`, `b-rag`, `a-cot` 등 7개)는 목업 전용 예시 더미다. 실제 id가 아니므로 절대 이식하지 않는다.** 이식하면 **기존 24+6개 메뉴가 사라진다.** 기존 `SECTIONS`의 Basics/Advanced를 그대로 둔다.

#### ③ 기획페이지 — **신규 16개** → `NDSpecPage` (나중에 진짜 기사 피드로 채울 대상)
| 그룹 | 메뉴 |
|------|------|
| Newly Discovered | `nd-overview` |
| Research & Models | `papers` · `benchmarks-datasets` |
| Engineering & Tooling | `dev-tools` · `building-blocks` |
| Cases | `domain-applications` · `product-discovery` |
| Discourse | `regulations-policy-compliance` · `community` · `big-tech-trends` · `market-investment` · `technical-deep-dives` · `insights-opinions` |
| Utility | `archive` · `compare-kb` · `change-tracking` |

- **taxonomy가 신규 16개 id를 전부 커버**하므로 `default:`로 새는 id가 없다.
- `default:`는 **홈(`highlight`) 전용**으로만 남긴다.
- 안전장치: 개발 중 **사이드바의 모든 id가 렌더 분기에 존재하는지 확인**한다(누락 시 콘솔 경고).

### 3-4. 접힘 상태 — 4개 그룹을 각각 따로 기억

**현재 코드의 함정**: `sidebar.tsx`가 mount 시 `setCollapsed(parsed)`로 **저장값을 통째로 교체**한다. 기존 사용자의 localStorage(`cherry_sidebar_collapsed`)엔 `{basics, advanced}`뿐이라 **신규 4개 그룹 키가 `undefined`(=펼침)** 이 되어 기본값이 안 먹는다.

**대응**: 저장값을 **기본값과 병합**한다.
```
setCollapsed({ ...DEFAULT_COLLAPSED, ...parsed })
```
- `DEFAULT_COLLAPSED`에 신규 4개 그룹(`research` / `eng` / `cases` / `discourse`) 키 추가.
- **그룹별로 개별 저장·복원**되어야 한다 (하나 접었다고 다른 게 같이 접히지 않음).

### 3-5. 백엔드
- **불필요.** 기획페이지라 태그별 기사 API 없이 동작한다.
- 나중에 실제 피드를 붙일 때: `Cherry Category` 태그로 필터하는 엔드포인트가 필요하다 (현재 없음 → 그때 별도 기획).

---

## 4. 미결정 사항 (검토에서 확정)

| # | 항목 | 선택지 | 비고 |
|---|------|--------|------|
| D1 | **Basics/Advanced 헤더**도 "클릭 → 첫 자식 활성화" 적용할지 | (a) 기존대로 토글만 (b) 신규 그룹과 동일하게 | 기존 동작 변경이라 별도 판단 |
| D2 | **`nd-placeholder-page.tsx`** (옛 taxonomy, 미사용) 처리 | (a) 방치 (b) 삭제 | 파생 결정 → 허락 필요 |
| D4 | Utility 섹션 **위치** | 최하단 고정 / Learning 위 | |

**해소됨**
- ~~D3 ND 4그룹 기본 접힘 여부~~ → **그룹별로 각각 따로 기억**(§3-4). 초기 기본값은 구현 시 `DEFAULT_COLLAPSED`로 지정하고, 이후엔 사용자가 접은 상태가 그룹별로 저장·복원된다.

---

## 5. 검수표

범례: `-` 미착수 · `W` 진행 중 · `T` 테스트 통과 · `✅` 검수 완료

### Phase 0 — 기획 확정
| 항목 | 상태 | 메모 |
|---|---|---|
| 0-1 기획서 1회차 검토 | - | AI 보고 → 사용자 지시 대기 |
| 0-2 기획서 2회차 검토 | - | AI |
| 0-3 기획서 3회차 검토 | - | AI |
| 0-4 미결정(D1~D4) 확정 | - | **사용자 승인** |
| 0-5 구현 착수 허락 | - | **사용자 승인** |

### Phase 1 — 데이터 단일화
| 항목 | 상태 | 메모 |
|---|---|---|
| 1-1 `lib/nd-taxonomy.ts` 신규 (목업 데이터 이식) | - | AI |
| 1-2 목업 ↔ taxonomy 값 1:1 대조 검증 | - | AI |

### Phase 2 — 기획페이지
| 항목 | 상태 | 메모 |
|---|---|---|
| 2-1 `nd-spec-page.tsx` 신규 | - | AI |
| 2-2 충돌 2건(Building Blocks·Community) 렌더 확인 | - | AI |

### Phase 3 — 사이드바
| 항목 | 상태 | 메모 |
|---|---|---|
| 3-1 `SECTIONS` 확장 (ND 4그룹 + UTILITY) | - | AI |
| 3-2 헤더 클릭 = 토글 + 첫 자식 활성화 | - | AI |
| 3-3 **접힘 상태 병합 저장** (`{...DEFAULT_COLLAPSED, ...parsed}`) | - | AI · §3-4 |
| 3-4 **4개 그룹이 각각 따로 접힘/펼침 기억되는지** | - | AI 테스트 |
| 3-5 기존 메뉴(Digest/AgentShop/Learning) 무변경 확인 | - | AI |

### Phase 4 — 라우팅·검증
| 항목 | 상태 | 메모 |
|---|---|---|
| 4-1 `page.tsx` 분기 (기존은 그대로 + 신규 16개 SpecPage) | - | AI · §3-3 |
| 4-2 **사이드바 모든 id가 렌더 분기에 존재** (누락 시 경고) | - | AI · **무증상 폴백 방지** |
| 4-3 **신규 16개 클릭 시 홈으로 빠지지 않는지** | - | AI · **default 폴백 검증** |
| 4-4 `npx tsc --noEmit` (기존 무관 에러 제외) | - | AI |
| 4-5 로컬 실행 후 전체 메뉴 클릭 확인 | - | **사용자 직접 실행** |
| 4-6 커밋 | - | **사용자 지시 시에만** |

## 성과 목표 (완료 기준)

- [ ] 사이드바가 **목업과 동일한 구조**(4그룹·15카테고리 + Overview + Utility)로 보인다.
- [ ] **기존 페이지 7종**(Highlights·Patch Notes·Knowledge Market·Arena·Model Updates·Frameworks·Case Studies)과 Learning이 **이전과 똑같이 동작**한다.
- [ ] **신규 16개 메뉴**를 클릭하면 목업과 동일한 **기획페이지**(개요·태그·그룹·근거문서·충돌)가 뜬다.
- [ ] **그룹 헤더 4개** 클릭 시 열고닫기 + 첫 서브메뉴가 활성화된다.
- [ ] taxonomy가 **파일 하나**(`nd-taxonomy.ts`)에서만 정의된다 (사이드바·기획페이지가 같은 소스를 봄).
- [ ] `npx tsc --noEmit` 신규 에러 없음.

---

*(검토용. 코드 수정·커밋은 사용자 허락 후. 관련: `agent-policy.md`, `frontend-ia-menu-design-plan.md`, `mockups/sidebar-mockup.html`)*
