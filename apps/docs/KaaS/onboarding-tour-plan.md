# Cherry Onboarding Tour — 기획서

## 목적

사이트에 처음 온 사용자가 "여기서 뭘 해야 하나" 빠르게 파악하게 돕는 **말풍선(tooltip) 기반 가이드 투어**를 추가한다.

## 디자인 원칙

- **Opt-out 가능**: 강제로 뜨면 기존 유저가 짜증남 → 첫 방문시만 자동, 이후는 명시적 호출
- **두 가지 트리거**: (1) 최초 접속 자동 (2) 안내 아이콘 클릭으로 재시청
- **페이지별 스코프**: 전체 사이트 투어 vs 대시보드 전용 투어 분리
- **건너뛰기 즉시 허용**: 강요 금지. "Skip all" / "Got it" 버튼 항상 노출
- **기존 매뉴얼과 상호보완**: `cherry-manuals/*.md`는 "텍스트 Q&A 레퍼런스", 투어는 "처음 UX 빠른 소개". 중복 최소화.

## 데이터 소스 결정

기존 `/cherry-manuals/*.md`를 LLM이 요약해주는 **콘솔 답변 방식**이 이미 있음.
투어는 다른 레이어 — **짧은 말풍선 시퀀스** 필요. 마크다운 전체를 띄우면 안 됨.

결론: **투어 전용 JSON 스텝 정의** 별도 파일로 관리 (`lib/onboarding-steps.ts`).

```ts
type TourStep = {
  id: string                    // 스텝 고유 id
  target?: string               // querySelector (없으면 화면 중앙 dialog)
  placement?: "top" | "right" | "bottom" | "left" | "center"
  title: string                 // 한줄 제목
  body: string                  // 본문 (2~4줄)
  cta?: { label: string; action: "next" | "skip" | "goto"; target?: string }
}

type Tour = {
  id: "site" | "dashboard"      // 투어 종류
  steps: TourStep[]
  version: number               // 내용 바뀌면 증가 → 기존 유저에게 재노출 옵션
}
```

## 트리거 정의

### A. 최초 접속 자동 (Site Tour)
- localStorage key `cherry-tour-site-seen` 없으면 자동 시작
- 완료 또는 Skip → `cherry-tour-site-seen = "v1"` 저장
- 버전 bump 시 재노출 선택 가능 (기본은 재노출 안 함 — 귀찮으니)

### B. 대시보드 진입시 자동 (Dashboard Tour)
- 대시보드 페이지에 **에이전트 0개**일 때 + `cherry-tour-dashboard-seen` 없으면 자동
- 에이전트가 이미 등록돼 있으면 자동 실행 안 함 (경험 유저로 간주)

### C. 안내 아이콘 수동 실행
- 헤더에 `?` 아이콘 하나 추가
- 현재 페이지 기준 해당 투어 강제 실행 (seen 여부 무시)
- 사이트 투어: 모든 페이지에서 `?` → "Site Tour" 옵션
- 대시보드: `?` → "Dashboard Tour"

## 투어 시나리오

### 1. Site Tour (최초 접속)

총 5스텝, 각 스텝 예상 체류 5초.

| # | Target | 제목 | 본문 |
|---|---|---|---|
| 1 | (center) | 👋 Welcome to Cherry | "AI 엔지니어링 지식 허브입니다. 매일 수집한 논문·도구·모델 소식을 페이지별로 정리해 보여줍니다." |
| 2 | `[data-tour="sidebar-nav"]` | 📚 Reader Pages | "왼쪽 사이드바에서 모델 업데이트·프레임워크·케이스 스터디 등 주제별 일일 뉴스피드를 볼 수 있습니다." |
| 3 | `[data-tour="kaas-nav"]` | 🤖 KaaS | "에이전트가 지식을 사고 파는 마켓. 대시보드에서 에이전트를 등록하고 카탈로그에서 스킬을 구매합니다." |
| 4 | `[data-tour="console-fab"]` | 💬 Cherry Console | "오른쪽 아래 떠 있는 말풍선. 페이지별로 맞춤 도움말과 LLM 채팅이 가능합니다." |
| 5 | (center) | 🚀 시작해볼까요? | "대시보드에서 에이전트 하나 등록하는 것부터 시작해보세요. [Go to Dashboard] [Close]" |

마지막 스텝의 CTA는 대시보드로 이동 + 바로 Dashboard Tour 연결.

### 2. Dashboard Tour (에이전트 0 또는 수동)

총 6스텝.

| # | Target | 제목 | 본문 |
|---|---|---|---|
| 1 | `[data-tour="agent-list"]` | 🤖 My Agents | "여기에 등록된 에이전트 목록이 나옵니다. 각 에이전트는 자기 지갑·크레딧·API Key를 갖습니다." |
| 2 | `[data-tour="agent-add"]` | ➕ 에이전트 등록 | "+ 버튼을 눌러 첫 에이전트를 만들어보세요. 이름·이모지·지갑 타입만 있으면 됩니다." |
| 3 | `[data-tour="wallet-panel"]` | 💰 Wallet | "등록 후 여기서 크레딧을 충전하세요. NEAR 또는 MetaMask 지갑 중 선택할 수 있습니다." |
| 4 | `[data-tour="diff-button"]` | 📚 Diff | "에이전트가 지금 뭘 알고 있는지 자기 보고서를 받습니다. 로컬에 실제 저장된 스킬 파일 기준." |
| 5 | `[data-tour="catalog-link"]` | 🛒 Catalog | "KaaS → Catalog 로 이동해 스킬을 구매하세요. Compare 버튼으로 에이전트 지식 갭을 먼저 진단할 수 있습니다." |
| 6 | (center) | 🎉 Ready | "등록 → 충전 → 구매 이 순서로 한 번 돌려보면 전체 흐름이 보입니다." |

## 구현 구조

### 의존성
- **Driver.js** (경량, 4KB gzipped) — 추천. Shepherd.js도 대안.
- 아니면 자작 (backdrop + positioned div) — 4~5시간 작업량. 깔끔한 커스텀 가능.

해커톤 맥락에선 Driver.js 권장 (빠름).

### 파일 구조
```
apps/web/
  lib/
    onboarding-steps.ts         ← 투어 정의 (JSON)
    onboarding-storage.ts       ← localStorage 추상
  components/
    cherry/
      OnboardingTour.tsx        ← Driver.js 래퍼, 글로벌 1개
      HelpIconButton.tsx        ← 수동 실행 버튼
  app/
    page.tsx                    ← <OnboardingTour/> 마운트
    providers.tsx (or layout)   ← Driver.js CSS import
```

### 통합 지점
1. **Target 엘리먼트에 `data-tour` attribute 추가** — 기존 UI 컴포넌트에 소량 수정
   - `data-tour="sidebar-nav"` → Left sidebar root
   - `data-tour="kaas-nav"` → KaaS Dashboard 메뉴 항목
   - `data-tour="console-fab"` → Cherry Console 플로팅 버튼
   - `data-tour="agent-list"` → `My Agents` 섹션
   - `data-tour="agent-add"` → `+` 버튼
   - `data-tour="wallet-panel"` → WalletPanel 컴포넌트 root
   - `data-tour="diff-button"` → 에이전트 카드의 Diff 버튼
   - `data-tour="catalog-link"` → Sidebar 카탈로그 링크

2. **글로벌 `<OnboardingTour />`** — `app/layout.tsx` 혹은 `page.tsx` 최상단
   - mount 시 localStorage 확인 → 조건부 자동 실행
   - `window.dispatchEvent(new CustomEvent("cherry-tour-start", { detail: { id } }))` 형식으로 수동 트리거 받기

3. **Help Icon** — 헤더에 `?` 아이콘
   - 클릭 시 드롭다운: "Site Tour" / "Dashboard Tour" / "Catalog Tour" (확장 가능)
   - 선택 시 위의 CustomEvent dispatch

### 스토리지 키 스펙
```
cherry-tour-site-seen       = "v1"                         (완료 시)
cherry-tour-dashboard-seen  = "v1"                         (완료 시)
cherry-tour-skipped         = ["site", "dashboard"]        (skip 누른 목록)
cherry-tour-disabled        = "true"                       (유저가 "앞으로 보지 않기" 체크)
```

"앞으로 보지 않기" 옵션이 Global flag. 켜져 있으면 자동 실행 전면 차단. 수동 실행은 여전히 작동.

### 반응형 / 접근성
- 모바일에서도 작동해야 함 — Driver.js 기본 지원
- `Esc` 키로 닫힘 (backdrop 클릭도 닫힘)
- 키보드 네비게이션 지원 (←/→ 키로 스텝 이동)
- ARIA label 추가

## 확장 로드맵 (해커톤 이후)

- Catalog Tour 추가 (Compare 버튼 사용법, 구매 플로우)
- Knowledge Curation Tour (큐레이터 전용)
- 각 투어에 **체크리스트 모드** — 투어 대신 진행률 표시하는 UI
- 다국어 지원 (한/영 토글)

## 작업 분량 추산

| 단계 | 예상 시간 |
|---|---|
| Driver.js 설치 + 기본 래퍼 구현 | 30분 |
| onboarding-steps.ts 정의 작성 (Site + Dashboard) | 30분 |
| 기존 UI에 data-tour attribute 삽입 (8~10군데) | 30분 |
| HelpIconButton 컴포넌트 + 드롭다운 | 30분 |
| localStorage 연동 + 자동 실행 조건 로직 | 20분 |
| 모바일/접근성 점검 + 스타일 조정 | 30분 |
| **합계** | **약 3시간** |

해커톤 데모용이면 **Site Tour만 먼저** 넣고 Dashboard Tour는 후속으로. 이 경우 1.5시간.

## 논의 포인트 (기획 확정 전)

1. **투어 라이브러리 선택**: Driver.js 쓸지, 자작할지
2. **스텝 개수**: 지금 제안은 Site 5 / Dashboard 6 — 너무 길지 않나?
3. **첫 방문 판정 기준**: localStorage 외에 유저 DB 레벨로도 기록할지 (여러 브라우저 동기화)
4. **help 아이콘 위치**: 우상단 헤더 vs 좌하단 설정 메뉴 vs 기존 Cherry Console 내부
5. **언어**: 한글 전용인가, 영문 병기인가
6. **디자인 톤**: 기존 Cherry 디자인(cherry 색상 계열) 맞출지, Driver.js 기본 스타일로 둘지
7. **CTA 자동 이동 방지**: 지금 안은 마지막 스텝에서 "Go to Dashboard" 누르면 자동 이동하게 돼 있는데, 유저 당황 방지 위해 별도 버튼으로 분리할지
8. **에이전트 0개 기준**: Dashboard Tour 자동 실행 조건이 "에이전트 0" — 기준 맞나, 아니면 항상 첫 진입 시 뜨는 게 맞나
