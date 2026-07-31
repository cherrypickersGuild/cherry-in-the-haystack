/**
 * Newly Discovered + Utility 메뉴 taxonomy — 단일 소스(Single Source of Truth)
 *
 * 사이드바(sidebar.tsx)와 기획페이지(nd-spec-page.tsx)가 이 파일 하나만 본다.
 * 데이터가 흩어지면 반드시 어긋나므로(예: 기존 nd-placeholder-page.tsx의 옛 이름) 여기서만 정의한다.
 *
 * 범위: ND 카테고리 15개 + Overview + Utility 3개 = 19개, 그룹 4개.
 *   - Digest / Agent Shop / Learning(Basics·Advanced)은 여기 없음 → sidebar.tsx의 기존 SECTIONS 유지.
 *
 * 근거 문서(2026-07-14 기준):
 *   - 현행 PRD product-scope ≡ Cherry Category (260530)  … 카테고리 완전 동일
 *   - UI & Information Architecture (260415)             … 갱신 전 버전, 2건만 다름(충돌)
 *
 * 관련: apps/docs/frontend-menu-implementation-plan.md, apps/docs/mockups/sidebar-mockup.html
 */

/* ─────────────────────────────────────────────
   근거 문서
───────────────────────────────────────────── */
export type NDDocCode = "cat" | "prd" | "ia"

export const ND_DOCS: Record<NDDocCode, { label: string; title: string }> = {
  cat: {
    label: "Cherry Category (260530)",
    title: "Cherry Category 정의 (260530) · 콘텐츠 태그 taxonomy · 2026-05-30 · 최신·기준",
  },
  prd: {
    label: "PRD product-scope",
    title: "docs/PRD/product-scope.md · 제품 범위 (Cherry Category와 동일하게 갱신됨)",
  },
  ia: {
    label: "UI & Information Architecture (260415)",
    title: "UI & Information Architecture (260415) · 2026-04-15 · 화면 정보구조",
  },
}

/* ─────────────────────────────────────────────
   충돌 (문서 간 이견) — 현재 2건
───────────────────────────────────────────── */
export type NDConflictSide = { doc: string; date: string; says: string }
export type NDConflict = {
  topic: string
  base: NDConflictSide   // 채택한 쪽 (현행·기준)
  clash: NDConflictSide  // 다른 쪽 (갱신 전)
}

/* ─────────────────────────────────────────────
   그룹 / 항목
───────────────────────────────────────────── */
export type NDGroupKey = "research" | "eng" | "cases" | "discourse"

export type NDGroup = {
  key: NDGroupKey
  label: string
  ko: string
  desc: string
  basis: NDDocCode[]
  star?: boolean
  children: string[]  // 사이드바에 렌더되는 하위 항목 id (순서대로)
  /** 헤더 클릭 시 활성화할 페이지. 없으면 children[0]. 메뉴엔 안 보이지만 그룹의 랜딩 페이지로 쓰는 항목용. */
  landingId?: string
}

export type NDItem = {
  id: string
  label: string
  ko: string
  /** Cherry Category 데이터 태그. ND 15개만 가진다(Overview·Utility는 없음). ND 15개는 id === tag. */
  tag?: string
  group?: NDGroupKey
  /** 개요 — 이 페이지가 무엇인지 */
  desc: string
  /** 근거 문서 (여러 문서가 일치하면 대표 문서 하나) */
  basis: NDDocCode[]
  /** 근거(설명) — 왜 이렇게 정해졌는지 한 줄 */
  note: string
  /** 사이드바 NEW 배지 (목업 기준: Overview · Utility 3종). ⚠️ 배지는 conflict 유무로 자동 판정. */
  isNew?: boolean
  conflict?: NDConflict
  /**
   * true = 이미 진짜 페이지가 있는 메뉴 → 기존 컴포넌트로 렌더(기획페이지 아님).
   * false/undefined = 신규 → NDSpecPage(기획페이지)로 렌더.
   */
  existing?: boolean
}

/* ─────────────────────────────────────────────
   그룹 정의 (4개)
───────────────────────────────────────────── */
export const ND_GROUPS: NDGroup[] = [
  {
    key: "eng",
    label: "Engineering Blocks",
    ko: "엔지니어링·툴링",
    desc: "AI 앱을 만들고 배포하는 도구·프레임워크·패턴 그룹.",
    basis: ["cat"],
    // Building Blocks는 메뉴에 노출하지 않고, 그룹 헤더 클릭 시 뜨는 랜딩 페이지로만 사용(위계 정리).
    // Dev Tools는 메뉴에서 숨김(페이지 정의는 남겨둠 — 나중에 사용할 수 있음).
    children: ["frameworks", "prompting"],
    landingId: "building-blocks",
  },
  {
    key: "cases",
    label: "Cases",
    ko: "산업·사례",
    desc: "실제 도메인 적용과 시장 사례 그룹. (우선순위)",
    basis: ["cat"],
    star: true,
    // Engineering Blocks 패턴: 헤더 클릭 → 전체 Cases 카탈로그(메뉴엔 숨김), 서브 = 카테고리별 Best 랜드스케이프
    children: ["case-studies", "domain-applications", "product-discovery"],
    landingId: "cases-catalog",
  },
  {
    key: "research",
    label: "Research & Models",
    ko: "연구·모델",
    desc: "기초 연구·모델 출시·평가 리소스를 추적하는 그룹.",
    basis: ["cat"],
    // Engineering Blocks / Cases 패턴: 헤더 클릭 → 전체 Research 카탈로그(메뉴엔 숨김), 서브 = 기존 항목
    children: ["model-updates", "papers", "benchmarks-datasets"],
    landingId: "research-catalog",
  },
  {
    key: "discourse",
    label: "Discourse",
    ko: "담론",
    desc: "AI 거버넌스·커뮤니티·사고 리더십 그룹.",
    basis: ["cat"],
    children: [
      "regulations-policy-compliance",
      "community",
      "big-tech-trends",
      "market-investment",
      "technical-deep-dives",
      "insights-opinions",
    ],
    landingId: "discourse-catalog",
  },
]

/* ─────────────────────────────────────────────
   항목 정의 (19개)
   existing: true  → 진짜 페이지 있음(기존 컴포넌트)
   existing 없음   → 신규 = 기획페이지(NDSpecPage)
───────────────────────────────────────────── */
export const ND_ITEMS: NDItem[] = [
  /* ── Newly Discovered — Overview ── */
  {
    id: "nd-overview",
    label: "Overview",
    ko: "전체 개요",
    desc: "Newly Discovered 4개 그룹의 최신 항목을 한눈에 보는 개요 페이지.",
    basis: ["ia"],
    note: "UI & Information Architecture (260415) · 이번 시즌 구현",
    isNew: true,
    existing: true,
  },

  /* ── Research & Models ── */
  {
    // 메뉴엔 안 보이는 그룹 랜딩(전체 카탈로그). Research & Models 헤더 클릭 시 뜬다.
    id: "research-catalog",
    label: "Research & Models",
    ko: "연구·모델 전체",
    group: "research",
    desc: "기초 연구·모델·평가 리소스 전체 카탈로그 — Papers·Model Updates·Benchmarks & Datasets 3분류, 기관/카테고리별.",
    basis: ["cat"],
    note: "Research 그룹 랜딩(Engineering Blocks의 Building Blocks와 같은 역할)",
    existing: true,
  },
  {
    id: "model-updates",
    label: "Model Updates",
    ko: "모델 업데이트",
    tag: "model-updates",
    group: "research",
    desc: "신규 모델 출시·API 업데이트·버전/가격/프로토콜 변경. 예) GPT-4.5 launch, Claude 4 API update, token limit 변경.",
    basis: ["cat"],
    note: "Cherry Category (260530)에 정의 (대표 문서)",
    existing: true,
  },
  {
    id: "papers",
    label: "Papers",
    ko: "논문",
    tag: "papers",
    group: "research",
    desc: "학회 논문·학계 돌파구·새 기법. 직접 큐레이션하지 않고 외부 링크로 연결. 예) NeurIPS, ICML spotlight. (+조감도 landscape)",
    basis: ["cat"],
    note: "Cherry Category (260530)에 정의 · 외부 링크 · +조감도(landscape)",
    existing: true,
  },
  {
    id: "benchmarks-datasets",
    label: "Benchmarks & Datasets",
    ko: "벤치마크·데이터셋",
    tag: "benchmarks-datasets",
    group: "research",
    desc: "벤치마크 결과·신규 데이터셋·평가 도구·리더보드(큐레이션 링크). 예) MMLU 갱신, LM-eval-harness. (+조감도 landscape)",
    basis: ["cat"],
    note: "Cherry Category (260530)에 정의 · +조감도(landscape)",
    existing: true,
  },

  /* ── Engineering Blocks ── */
  {
    id: "frameworks",
    label: "Frameworks Best",
    ko: "프레임워크·SDK",
    tag: "frameworks",
    group: "eng",
    desc: "개발 프레임워크·SDK·API 라이브러리, 릴리스/사용중단/의존성 업데이트. 예) LangChain v0.3, PEFT update.",
    basis: ["cat"],
    note: "Cherry Category (260530)에 정의 (대표 문서)",
    existing: true,
  },
  {
    id: "prompting",
    label: "Prompting Best",
    ko: "프롬프트·스킬",
    tag: "prompting",
    group: "eng",
    desc: "빌딩블락스의 프롬프트·스킬 계열을 테마별로: 기법·가이드·프롬프트 도구/라이브러리·데이터셋·스킬·마켓·스펙. 각 테마 top5.",
    basis: ["cat"],
    note: "Building Blocks 파생(자동 생성 + 관리자 큐레이션)",
    existing: true,
  },
  {
    id: "dev-tools",
    label: "Dev Tools",
    ko: "개발 도구",
    tag: "dev-tools",
    group: "eng",
    desc: "개발자 생산성 도구·모니터링·디버깅·테스트 서비스, 도구 디렉토리 + 명예의 전당(Hall of Fame).",
    basis: ["cat"],
    note: "Cherry Category (260530)에 정의 · +Hall of Fame",
  },
  {
    id: "building-blocks",
    label: "Building Blocks",
    ko: "빌딩 블록",
    tag: "building-blocks",
    group: "eng",
    desc: "바로 가져다 조립하는 부품: 프롬프트·템플릿·코드 스니펫·오케스트레이션 패턴·MCP·에이전트 구성. 하위태그(mixed/agents/mcp/prompt)는 한 페이지에 함께 표시.",
    basis: ["cat", "prd"],
    note: "현행 PRD·Cherry Category는 'Building Blocks'(+하위태그) — UI & Information Architecture (260415)만 옛 명칭 'Patterns & Implementations'",
    conflict: {
      topic: "셋째 항목 명칭",
      base: {
        doc: "PRD product-scope · Cherry Category (260530)",
        date: "현행·기준",
        says: "명칭 = Building Blocks (하위태그 mixed/agents/mcp/prompt)",
      },
      clash: {
        doc: "UI & Information Architecture (260415)",
        date: "2026-04-15 · 갱신 전",
        says: "옛 명칭 = Patterns & Implementations",
      },
    },
    // 실제 페이지 구현됨(NDBuildingBlocksPage) → 기획페이지 아님
    existing: true,
  },

  /* ── Cases (우선순위) ── */
  {
    // 메뉴엔 안 보이는 그룹 랜딩(전체 카탈로그). Cases 헤더 클릭 시 뜬다.
    id: "cases-catalog",
    label: "Cases",
    ko: "사례 전체",
    group: "cases",
    desc: "실제 AI 활용 사례 전체 카탈로그 — Case Studies·Domain Applications·Product Discovery 3분류, 도메인별.",
    basis: ["cat"],
    note: "Cases 그룹 랜딩(Engineering Blocks의 Building Blocks와 같은 역할)",
    existing: true,
  },
  {
    id: "domain-applications",
    label: "Domain Applications",
    ko: "도메인 응용",
    tag: "domain-applications",
    group: "cases",
    desc: "도메인별 개선된 솔루션/프롬프트/워크플로, 도메인별 AI 활용 짧은 뉴스. 예) 콘텐츠 제작·학교·정신건강 도메인 사례.",
    basis: ["cat"],
    note: "3문서 모두 Cases 3분할(대표: Cherry Category 260530). 구 PRD는 Case Studies 1개였으나 현행 PRD에서 3분할로 정정됨",
    existing: true,
  },
  {
    id: "case-studies",
    label: "Case Studies",
    ko: "사례 연구",
    tag: "case-studies",
    group: "cases",
    desc: "도메인 특화 유스케이스·ROI·도입 전략·성공/실패 사례·컨퍼런스 발표. 예) 배민 text-to-SQL.",
    basis: ["cat"],
    note: "Cherry Category (260530)에 정의 (대표 문서)",
    existing: true,
  },
  {
    id: "product-discovery",
    label: "Product Discovery",
    ko: "제품 발굴",
    tag: "product-discovery",
    group: "cases",
    desc: "AI로 실생활 문제를 푸는 솔루션 모음(개발자 생산성 도구는 제외 → Dev Tools). 예) 이력서 빌더·의료 영상 스크리너.",
    basis: ["cat"],
    note: "3문서 모두 Cases 3분할에 포함(대표: Cherry Category 260530)",
    existing: true,
  },

  /* ── Discourse ── */
  {
    // 메뉴엔 안 보이는 그룹 랜딩(전체 카탈로그). Discourse 헤더 클릭 시 뜬다.
    id: "discourse-catalog",
    label: "Discourse",
    ko: "담론 전체",
    group: "discourse",
    desc: "AI 거버넌스·커뮤니티·빅테크·시장·기술심층·오피니언 전체 카탈로그.",
    basis: ["cat"],
    note: "Discourse 그룹 랜딩(Building Blocks와 같은 역할)",
    existing: true,
  },
  {
    id: "regulations-policy-compliance",
    label: "Regulations · Policy · Compliance",
    ko: "규제·정책·컴플라이언스",
    tag: "regulations-policy-compliance",
    existing: true,
    group: "discourse",
    desc: "AI 정책·규제·컴플라이언스·법적 선례·표준(ISO/IEC). 예) EU AI Act, FTC 가이드라인.",
    basis: ["cat"],
    note: "Cherry Category (260530)에 정의 (대표 문서)",
  },
  {
    id: "community",
    label: "Community",
    ko: "커뮤니티",
    tag: "community",
    existing: true,
    group: "discourse",
    desc: "사람·이벤트·밋업·오픈소스 마일스톤·기여자 스포트라이트.",
    basis: ["cat", "prd"],
    note: "UI & Information Architecture (260415)엔 누락 → PRD·Cherry Category 따라 유지",
    conflict: {
      topic: "Community 존재 여부",
      base: {
        doc: "Cherry Category (260530) · PRD product-scope",
        date: "현행·기준",
        says: "Community 카테고리 유지",
      },
      clash: {
        doc: "UI & Information Architecture (260415)",
        date: "2026-04-15 · 갱신 전",
        says: "담론 그룹에 Community 없음 (누락)",
      },
    },
  },
  {
    id: "big-tech-trends",
    label: "Big Tech Trends",
    ko: "빅테크 동향",
    tag: "big-tech-trends",
    existing: true,
    group: "discourse",
    desc: "빅테크의 전략적 움직임(모델 업데이트·투자 소식 제외). 예) 구글 AI 조직 개편, 메타 오픈소스 전략.",
    basis: ["cat"],
    note: "3문서 모두 독립 카테고리(대표: Cherry Category 260530). 구 PRD는 Insights에 포함이었으나 현행 PRD에서 독립됨",
  },
  {
    id: "market-investment",
    label: "Market & Investment",
    ko: "시장·투자",
    tag: "market-investment",
    existing: true,
    group: "discourse",
    desc: "벤처 투자·M&A·후원 등 AI 산업 자금 흐름. 예) LLM 스타트업 시리즈 A, AI 기업 인수.",
    basis: ["cat"],
    note: "3문서 모두 독립 카테고리(대표: Cherry Category 260530). 구 PRD엔 없었으나 현행 PRD에 추가됨",
  },
  {
    id: "technical-deep-dives",
    label: "Technical Deep Dives",
    ko: "기술 심층분석",
    tag: "technical-deep-dives",
    existing: true,
    group: "discourse",
    desc: "롱폼 기술 아티클·시스템 설계 분석·성능 분석·비교 평가.",
    basis: ["cat"],
    note: "Cherry Category (260530)에 정의 (대표 문서)",
  },
  {
    id: "insights-opinions",
    label: "Insights & Opinions",
    ko: "인사이트·오피니언",
    tag: "insights-opinions",
    existing: true,
    group: "discourse",
    desc: "오피니언 리더십·새 패턴·예측·트렌드 분석. 예) 'Why RAG won't scale'.",
    basis: ["cat"],
    note: "Cherry Category (260530)에 정의 (대표 문서)",
  },

  /* ── Utility ── */
  {
    id: "archive",
    label: "Archive",
    ko: "아카이브",
    desc: "과거 발행 콘텐츠 아카이브 뷰.",
    basis: ["ia"],
    note: "UI & Information Architecture (260415) · 이번 시즌 구현",
    isNew: true,
  },
  {
    id: "compare-kb",
    label: "Compare Knowledge",
    ko: "지식베이스 비교",
    desc: "지식베이스 비교 — 버전/에이전트 간 지식 차이 비교.",
    basis: ["ia"],
    note: "UI & Information Architecture (260415) · 이번 시즌 구현",
    isNew: true,
  },
  {
    id: "change-tracking",
    label: "Change Tracking",
    ko: "변경사항 추적",
    desc: "변경사항 추적 — 개념·콘텐츠 업데이트 이력.",
    basis: ["ia"],
    note: "UI & Information Architecture (260415) · 이번 시즌 구현",
    isNew: true,
  },
]

/* ─────────────────────────────────────────────
   조회 헬퍼
───────────────────────────────────────────── */
const ITEM_BY_ID = new Map(ND_ITEMS.map((i) => [i.id, i]))
const GROUP_BY_KEY = new Map(ND_GROUPS.map((g) => [g.key, g]))

export function getNDItem(id: string): NDItem | undefined {
  return ITEM_BY_ID.get(id)
}

export function getNDGroup(key: string): NDGroup | undefined {
  return GROUP_BY_KEY.get(key as NDGroupKey)
}

/** 이 id가 기획페이지(NDSpecPage)로 렌더되어야 하는가 — 신규(=existing 아님) 항목만 true */
export function isNDSpecPage(id: string): boolean {
  const item = ITEM_BY_ID.get(id)
  return !!item && !item.existing
}

/** Utility 섹션 항목 id (그룹에 속하지 않음) */
export const ND_UTILITY_IDS = ["archive", "compare-kb", "change-tracking"] as const

/** 그룹 헤더 클릭 시 활성화할 첫 자식 id */
export function firstChildOf(key: NDGroupKey): string {
  return GROUP_BY_KEY.get(key)!.children[0]
}
