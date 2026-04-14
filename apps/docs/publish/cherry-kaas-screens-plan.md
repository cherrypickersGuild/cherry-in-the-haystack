# Cherry KaaS — 화면 추가 개발 기획

> **기준일**: 2026-04-13  
> **목적**: 기존 Cherry(solteti.site) 위에 KaaS(Knowledge-as-a-Service) 레이어 추가  
> **데드라인**: 2026-04-16 23:59 KST (BuidlHack2026 제출)

---

## 현재 구현된 화면 (변경 없음)

```
사이드바 구조
├── DIGEST
│   ├── This Week's Highlight   → /  (메인, Buzz Distribution + Trending + Top Picks)
│   └── Patch Notes             → /digest/patch-notes
├── NEWLY DISCOVERED
│   ├── Model Updates           → /digest/model-updates
│   ├── Frameworks              → /digest/frameworks
│   └── Case Studies            → /digest/case-studies
└── LEARNING
    └── Concept Reader          → /concepts/[slug]
        ├── Basics: Prompting Techniques, RAG, Fine-tuning,
        │          Agent Architectures, Embeddings & Vector DBs, Evaluation
        └── Advanced: Chain-of-Thought, Multi-hop RAG, PEFT/LoRA/QLoRA,
                      Multi-agent Systems, Custom Embeddings, Adversarial Evaluation
```

**Concept Reader 페이지 구성 요소** (RAG 페이지 확인 기준):
- 개념 메타: 업데이트 날짜, 소스 수, Knowledge Team verified 뱃지, 읽기 시간
- 01 Overview: 개념 설명 + Choose when 조건
- 02 Cherries: 큐레이션된 소스 카드들 (아이콘 + 출처명 + 요약)
- 03 Child Concepts: Subtopic / Prerequisite / Extends / Related 카드 그리드
- 04 Progressive References: MECE 학습 경로
- 우측 사이드바: Learning Roadmap 그래프, New in Digest, Knowledge Team 멤버

---

## 추가할 화면 목록

### 우선순위 기준
- 🔴 **P0** — 해커톤 데모 필수 (없으면 심사 통과 불가)
- 🟡 **P1** — 데모 설득력 강화 (있으면 심사위원 인상)
- 🟢 **P2** — 해커톤 이후 구현

---

## P0 — 데모 필수 화면 (3개)

---

### 1. Catalog 페이지 `/kaas/catalog`

**목적**: 에이전트가 구매/구독 가능한 지식 목록 탐색  
**진입점**: 사이드바에 `KAAS` 섹션 추가 → "Knowledge Catalog" 항목

#### 레이아웃
```
상단: 헤더 + 검색바 + 필터(카테고리, 가격, 품질점수)

카드 그리드 (기존 Concept Reader 카드 디자인 재활용):
┌─────────────────────────────────────┐
│  [BASICS]  Retrieval-Augmented Gen  │
│  ──────────────────────────────── │
│  Quality Score:  ★★★★★  (4.8)    │
│  Freshness:      Updated Feb 20     │
│  Sources:        12 sources         │
│  Curator:        Keanu J. + 4       │
│  ──────────────────────────────── │
│  Summary preview (2줄 텍스트)        │
│  ──────────────────────────────── │
│  📋 Query  5 credits  ($0.05)       │
│  📄 Deep   20 credits ($0.20)       │
│  🔔 Subscribe  100 credits/mo       │
│                      [Try Query →]  │
└─────────────────────────────────────┘
```

#### 데이터 구조 (표시 필드)
| 필드 | 설명 | 출처 |
|------|------|------|
| `concept_id` | slug (예: `rag`, `chain-of-thought`) | 기존 DB |
| `title` | 개념명 | 기존 DB |
| `category` | Basics / Advanced | 기존 DB |
| `quality_score` | 0-5 (formula: source_count × recency × curator_rep) | 신규 계산 |
| `freshness` | 마지막 업데이트 날짜 | 기존 DB |
| `source_count` | 큐레이션된 소스 수 | 기존 DB |
| `curators` | Knowledge Team 멤버 | 기존 DB |
| `price_query` | 고정 5 credits | 상수 |
| `price_deep` | 고정 20 credits | 상수 |
| `price_subscribe` | 고정 100 credits/month | 상수 |
| `query_count_total` | 누적 쿼리 수 (수요 신호) | 신규 |

#### 컴포넌트 목록
- `CatalogHeader` — 제목 + 통계 (총 N개 개념, 총 M 소스)
- `CatalogFilter` — 카테고리 탭 (All / Basics / Advanced) + 정렬 (Quality / Freshness / Popularity)
- `ConceptCard` — 위 카드 디자인, 기존 Concept Reader 카드에서 가격 정보 추가
- `SearchBar` — 개념 검색 (클라이언트사이드 필터링)

---

### 2. Query 인터페이스 `/kaas/query`

**목적**: 에이전트가 자연어로 지식을 쿼리하는 핵심 데모 화면  
**진입점**: Catalog 카드의 `[Try Query →]` 버튼 또는 사이드바 직접 접근

#### 레이아웃 (좌우 2단)

**좌측 — 입력 패널**
```
┌─────────────────────────────────────┐
│  Query Knowledge                     │
│                                     │
│  Question                           │
│  ┌───────────────────────────────┐  │
│  │ What is the best embedding    │  │
│  │ model for Korean text?        │  │
│  └───────────────────────────────┘  │
│                                     │
│  Response Depth                     │
│  ○ Summary      5 credits  ($0.05)  │
│  ● Concept     10 credits  ($0.10)  │  ← 기본값
│  ○ Evidence    20 credits  ($0.20)  │
│                                     │
│  Budget Cap    [  50  ] credits     │
│                                     │
│  Chain                              │
│  [Status Network ▼]                 │
│                                     │
│  Credit Balance: 250 credits        │
│                                     │
│  [  Query Now  ]                    │
└─────────────────────────────────────┘
```

**우측 — 결과 패널**
```
┌─────────────────────────────────────┐
│  Response                           │
│  ─────────────────────────────────  │
│  Concept: Embeddings & Vector DBs   │
│  Confidence: ████████░░ 82%         │
│                                     │
│  [답변 텍스트 — 개념 설명]            │
│                                     │
│  Sources Used (3)                   │
│  ├── 🍒 Chip Huyen — AI Engineering │
│  ├── 🍒 LlamaIndex Docs             │
│  └── 🍒 MTEB Leaderboard            │
│                                     │
│  ─────────────────────────────────  │
│  Provenance                         │
│  On-chain hash:                     │
│  0x7a3f...c2d1                      │
│  Status Network (Sepolia)           │
│  [View on Explorer ↗]               │
│                                     │
│  Credits Used: 10  |  Remaining: 240│
└─────────────────────────────────────┘
```

#### 상태 흐름
```
idle → loading (쿼리 전송 중) → streaming (답변 스트리밍) → complete
                                                          → error
```

#### 데이터 플로우
1. `POST /api/kaas/query` — `{ question, depth, budget_cap, chain }`
2. 서버: 기존 Concept Reader 데이터에서 관련 개념 + evidence 검색
3. 서버: 크레딧 차감 (중앙화)
4. 서버: 온체인 provenance hash 기록 (Status Network)
5. 응답: `{ answer, concept_id, sources[], provenance_hash, credits_used }`

#### 컴포넌트 목록
- `QueryInput` — 질문 textarea + 글자 수
- `DepthSelector` — 라디오 3개 + 크레딧/달러 표시
- `BudgetCap` — 숫자 입력
- `ChainSelector` — Status / BNB / NEAR 드롭다운
- `CreditBalance` — 실시간 잔액 표시
- `QueryResult` — 답변 + 소스 목록 + Provenance 박스
- `ProvenanceBox` — 해시 + 체인명 + Explorer 링크

---

### 3. Agent Dashboard `/kaas/dashboard`

**목적**: 에이전트(개발자)의 API 키, 크레딧, 쿼리 히스토리 관리  
**진입점**: 사이드바 KAAS 섹션 또는 로그인 후 리다이렉트

#### 레이아웃 (3단 그리드 + 테이블)

**상단 스탯 카드 3개**
```
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│  Credit Balance  │ │  Queries Today   │ │  Active Subs     │
│  250 credits     │ │  12              │ │  3 concepts      │
│  $2.50 value     │ │  ↑ +3 vs yesterday│ │  WebSocket live  │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

**API Key 섹션**
```
API Key
sk-cherry-xxxx-xxxx-xxxx-xxxxxxxxxxxx  [Copy] [Regenerate]
Tier: Free (100 queries/day)  →  Upgrade
```

**Recent Queries 테이블**
| Time | Question | Concept | Depth | Credits | Provenance |
|------|----------|---------|-------|---------|------------|
| 14:23 | Best embedding for Korean... | Embeddings | concept | 10 | 0x7a3f... |
| 14:15 | How does RAG chunking work | RAG | summary | 5 | 0x2b9c... |

**Active Subscriptions**
```
┌──────────────────────────────────────────────────┐
│  RAG                WebSocket  ● Live  100cr/mo  │
│  Agent Architectures  Webhook  ● Live  100cr/mo  │
│  [+ Add Subscription]                            │
└──────────────────────────────────────────────────┘
```

**Chain Activity**
- 온체인 트랜잭션 최근 5건 (Status Network 기준)
- 각 tx 해시 + Explorer 링크

#### 컴포넌트 목록
- `StatCard` — 숫자 + 레이블 + 변화율
- `ApiKeyCard` — 마스킹된 키 + 복사/재생성 버튼
- `QueryHistoryTable` — 페이지네이션 포함
- `SubscriptionList` — 구독 목록 + 상태 인디케이터
- `ChainActivity` — 트랜잭션 피드

---

## P1 — 데모 강화 화면 (2개)

---

### 4. Curator Earnings 페이지 `/kaas/curator`

**목적**: 큐레이터의 수익 현황 + 온체인 출금  
**진입점**: 사이드바 KAAS 섹션 → "Curator Earnings"

#### 레이아웃
```
이번 달 수익 요약
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│  Earned (Apr)    │ │  Queries on      │ │  Top Concept     │
│  $18.40          │ │  my content      │ │  RAG             │
│  184 credits     │ │  460 queries     │ │  280 queries     │
└──────────────────┘ └──────────────────┘ └──────────────────┘

내 개념별 수익 테이블
| Concept | Queries | Revenue Share (40%) | Trend |
|---------|---------|----------------------|-------|
| RAG     | 280     | $5.60                | ↑     |

Pending Withdrawal
Available: 184 credits ($1.84)
[Withdraw to Wallet]  ← 온체인 트랜잭션 트리거
Last withdrawal: Apr 5 · 0x... · [Explorer ↗]
```

---

### 5. MCP Integration 가이드 `/kaas/mcp`

**목적**: 개발자가 MCP로 Cherry KaaS를 5분 내 연동하는 방법  
**진입점**: Dashboard의 "Connect via MCP" 버튼

#### 레이아웃
```
Cherry KaaS MCP Server

Step 1: Install
━━━━━━━━━━━━━━━
npm install @cherry/kaas-mcp

Step 2: Configure (코드 블록 + 복사 버튼)
━━━━━━━━━━━━━━━
{
  "mcpServers": {
    "cherry-kaas": {
      "command": "npx",
      "args": ["@cherry/kaas-mcp"],
      "env": {
        "CHERRY_API_KEY": "sk-cherry-xxxx"  ← 자동 채워짐
      }
    }
  }
}

Step 3: Available Tools
━━━━━━━━━━━━━━━
• query_knowledge(question, depth, budget_cap)
• get_concept(concept_id)
• search_concepts(query, category)

Live Demo (인터랙티브)
━━━━━━━━━━━━━━━
[질문 입력창] → [Send] → 실시간 응답 + 온체인 해시 표시
```

---

## P2 — 해커톤 이후 화면

| 화면 | 경로 | 설명 |
|------|------|------|
| Subscription 관리 | `/kaas/subscriptions` | WebSocket 구독 현황, 알림 설정 |
| Analytics | `/kaas/analytics` | 쿼리 통계, 수요 신호 대시보드 |
| Agent Registry | `/kaas/agents` | 등록된 에이전트 목록 + 관심 도메인 |
| Credit Purchase | `/kaas/credits` | 크레딧 구매 (fiat/token) |
| Quality Score 상세 | `/kaas/quality` | 품질 점수 계산 방법 투명 공개 |

---

## 사이드바 변경사항

기존 사이드바에 `KAAS` 섹션 추가:

```
DIGEST
  This Week's Highlight
  Patch Notes
NEWLY DISCOVERED
  Model Updates
  Frameworks
  Case Studies
LEARNING
  Concept Reader
    Basics / Advanced ...
KAAS                          ← 신규 섹션
  Knowledge Catalog           → /kaas/catalog
  Query Knowledge             → /kaas/query
  Dashboard                   → /kaas/dashboard
  Curator Earnings            → /kaas/curator   (P1)
  MCP Integration             → /kaas/mcp       (P1)
```

---

## 공통 UI 컴포넌트 (신규 추가)

기존 디자인 시스템(Tailwind CSS, sidebar 컬러 변수) 그대로 사용:

| 컴포넌트 | 용도 | 재사용 위치 |
|---------|------|------------|
| `CreditBadge` | "5 credits" 뱃지 | Catalog, Query, Dashboard |
| `ProvenanceBox` | 온체인 해시 + Explorer 링크 | Query, Dashboard, Curator |
| `ChainSelector` | Status/BNB/NEAR 드롭다운 | Query |
| `StatCard` | 숫자 + 레이블 카드 | Dashboard, Curator |
| `ApiKeyDisplay` | 마스킹 키 + 복사 버튼 | Dashboard |
| `QualityScore` | ★★★★★ + 숫자 | Catalog |
| `FreshnessTag` | "Updated Feb 20" | Catalog |

---

## API 엔드포인트 (신규)

기존 Next.js API Routes에 추가:

```
POST /api/kaas/register       에이전트 등록 → API Key 발급
GET  /api/kaas/catalog        개념 목록 + 가격 + 품질 점수
POST /api/kaas/query          자연어 쿼리 → 답변 + 온체인 해시
POST /api/kaas/subscribe      개념/카테고리 구독 등록
GET  /api/kaas/dashboard      에이전트 크레딧, 히스토리
GET  /api/kaas/curator        큐레이터 수익 현황
POST /api/kaas/curator/withdraw  온체인 출금 트리거
```

---

## 구현 순서 (4일 플랜)

```
Day 1 (오늘)
  ├── 스마트 컨트랙트 배포 (Status Network Sepolia)
  ├── Chain Adapter 구현 (CHAIN_ADAPTER env var)
  └── /api/kaas/* 엔드포인트 스캐폴딩

Day 2
  ├── /kaas/catalog 페이지 (기존 ConceptCard 재활용)
  └── /api/kaas/catalog 완성

Day 3
  ├── /kaas/query 페이지 (핵심 데모 화면)
  ├── /api/kaas/query 완성 (온체인 provenance 포함)
  └── MCP 서버 연동

Day 4
  ├── /kaas/dashboard 페이지
  ├── 사이드바 KAAS 섹션 추가
  ├── 데모 영상 촬영 (2-4분)
  └── README 작성
```

---

## 데모 시나리오 (심사용)

**핵심 플로우 (3분)**:
1. Catalog 접속 → RAG 개념 카드 확인 (품질 점수, 가격)
2. Query 인터페이스 → "한국어 텍스트에 맞는 임베딩 모델은?" 입력 → Concept depth 선택
3. 응답 수신 → Sources 3개 표시 → **온체인 Provenance Hash** 강조
4. Dashboard → 크레딧 차감 확인 → Status Network Explorer에서 트랜잭션 확인
5. (보너스) MCP 페이지 → Claude 에이전트가 Cherry KaaS 쿼리하는 라이브 데모

---

*이 문서는 구현 진행에 따라 업데이트*
