# 멀티 에이전트 지원 기획서

**작성일:** 2026-04-13
**근거:** FR1 (에이전트 등록), FR37-38 (Knowledge Gap Analysis)
**영향 파일:**
- `apps/web/components/cherry/kaas-dashboard-page.tsx` — 왼쪽 패널 에이전트 목록
- `apps/web/components/cherry/kaas-catalog-page.tsx` — 에이전트 선택 드롭다운

---

## 1. 배경

에이전트 빌더는 여러 에이전트를 운영한다:
- 코딩 어시스턴트 (domain: AI Engineering, LLM Frameworks)
- 기술 리서치봇 (domain: Embeddings, RAG Pipelines)
- 고객 응대봇 (domain: Prompt Engineering, Evaluation)

각 에이전트는 별도 API Key, 별도 domain interests, 별도 지식 수준을 가진다.
카탈로그에서 구매할 때도 **어떤 에이전트를 위해 구매하는지** 선택해야 한다.

---

## 2. 대시보드 — 왼쪽 패널 변경

### 현재
- 단일 에이전트 프로필 고정 표시

### 변경
```
┌─────────────────────────────────┐
│ My Agents                    [+]│
│                                 │
│ ┌─ 선택됨 ────────────────────┐ │
│ │ 🤖 Coding Assistant         │ │
│ │ AI Engineering, LLM Fra...  │ │
│ │ Silver · 230cr              │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 🔬 Research Bot             │ │
│ │ Embeddings, RAG Pipelines   │ │
│ │ Bronze · 150cr              │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 💬 Support Bot              │ │
│ │ Prompt Eng, Evaluation      │ │
│ │ Bronze · 80cr               │ │
│ └─────────────────────────────┘ │
│                                 │
│ ─── 선택된 에이전트 상세 ────── │
│                                 │
│ WALLET                          │
│ 0x742d...F4a8                   │
│                                 │
│ KARMA TIER                      │
│ Silver · 1,250 points           │
│                                 │
│ API KEY                         │
│ [ck_live_a1b2c3...] [복사]     │
│                                 │
│ DOMAIN INTERESTS                │
│ [AI Engineering] [LLM Frame..]  │
│                                 │
│ MCP SERVER                      │
│ cherry-kaas.mcp.server Connected│
└─────────────────────────────────┘
```

### 요소별 설명

**에이전트 목록 (상단)**
- 카드 형태로 등록된 에이전트 나열
- 각 카드: 아이콘 + 이름 + domain 요약 + Karma 티어 + 크레딧 잔액
- 선택된 에이전트: 강조 보더
- 클릭으로 선택 전환 → 오른쪽 Wallet 패널도 해당 에이전트 데이터로 변경

**[+] 버튼 — 에이전트 추가**
- 클릭 시 등록 폼 표시 (현재 미등록 상태 폼과 동일)
- 에이전트 이름 입력 + wallet 연결 + domain 선택 → Register
- 등록 완료 → 목록에 추가

**선택된 에이전트 상세 (하단)**
- 현재 Agent Profile 그대로 (Wallet, Karma, API Key, Domain, MCP)
- 선택한 에이전트 기준으로 표시

---

## 3. 카탈로그 — 에이전트 선택 드롭다운

### 현재
- Agent Knowledge Compare 버튼만 있음
- 하드코딩된 1개 에이전트 지식으로 비교

### 변경
```
┌──────────────────────────────────────────────────┐
│ Knowledge Catalog                                │
│ 9 concepts                                       │
│                                                  │
│ ┌──────────────────┐  [Agent Compare]  [Dashboard]│
│ │ 🤖 Coding Assist▾│                             │
│ └──────────────────┘                             │
│                                                  │
│ [Search...]                                      │
│ [All] [Basics] [Advanced] [Technique]            │
│                                                  │
│ (카드 그리드 — 선택된 에이전트 기준 뱃지 표시)    │
└──────────────────────────────────────────────────┘
```

### 요소별 설명

**에이전트 선택 드롭다운**
- 등록된 에이전트 목록 표시
- 선택 변경 시 → Compare 결과 자동 갱신 (해당 에이전트의 knowledge 기준)
- 미선택(또는 미등록) 시 → Compare 버튼 비활성, 뱃지 없음

**Compare 연동**
- 선택된 에이전트의 known_topics + lastUpdated 기준으로 gap analysis
- 에이전트별로 다른 Compare 결과 표시

**구매 시**
- 콘솔에 선택된 에이전트 이름이 표시됨
- "Coding Assistant가 RAG를 evidence depth로 구매"

---

## 4. 목 데이터

```typescript
const MOCK_AGENTS = [
  {
    id: "agent-1",
    name: "Coding Assistant",
    icon: "🤖",
    walletAddress: "0x742d...F4a8",
    karmaTier: "Silver",
    karmaBalance: 1250,
    credits: 230,
    domainInterests: ["AI Engineering", "LLM Frameworks", "Embeddings"],
    apiKey: "ck_live_a1b2c3d4e5f6g7h8i9j0",
    registeredAt: "2026-04-10",
    knowledge: [
      { topic: "RAG", lastUpdated: "2025-11-15" },
      { topic: "Prompt Engineering", lastUpdated: "2026-01-20" },
      { topic: "Embeddings", lastUpdated: "2026-04-12" },
    ],
  },
  {
    id: "agent-2",
    name: "Research Bot",
    icon: "🔬",
    walletAddress: "0x892a...B3c1",
    karmaTier: "Bronze",
    karmaBalance: 320,
    credits: 150,
    domainInterests: ["Embeddings", "RAG Pipelines", "Semantic Search"],
    apiKey: "ck_live_k9l8m7n6o5p4q3r2s1t0",
    registeredAt: "2026-04-12",
    knowledge: [
      { topic: "Embeddings", lastUpdated: "2026-04-10" },
      { topic: "Semantic Search", lastUpdated: "2026-03-01" },
    ],
  },
  {
    id: "agent-3",
    name: "Support Bot",
    icon: "💬",
    walletAddress: "0x553f...D7e2",
    karmaTier: "Bronze",
    karmaBalance: 180,
    credits: 80,
    domainInterests: ["Prompt Engineering", "Evaluation"],
    apiKey: "ck_live_u1v2w3x4y5z6a7b8c9d0",
    registeredAt: "2026-04-13",
    knowledge: [
      { topic: "Prompt Engineering", lastUpdated: "2026-04-01" },
    ],
  },
]
```

---

## 5. 구현 체크리스트

### 대시보드
- [ ] MOCK_AGENTS 배열로 목 데이터 변경
- [ ] 왼쪽 패널 상단에 에이전트 카드 목록 + [+] 추가 버튼
- [ ] 에이전트 선택 → 하단 상세 + 오른쪽 Wallet 데이터 연동
- [ ] [+] 클릭 → 등록 폼 (이름 + wallet + domain)
- [ ] 등록 완료 → 목록에 추가

### 카탈로그
- [ ] 헤더에 에이전트 선택 드롭다운 추가
- [ ] 선택 변경 → Compare 결과 자동 갱신
- [ ] 구매 시 선택된 에이전트 이름이 콘솔에 표시
- [ ] 미선택/미등록 시 Compare 비활성

### 콘솔
- [ ] 선택된 에이전트 이름 표시 (헤더 or 메시지)
- [ ] 에이전트별 크레딧 잔액 반영

---

## 6. 후속 (API 연결 시)

- MOCK_AGENTS → `GET /api/v1/kaas/agents` (사용자의 에이전트 목록)
- 에이전트 추가 → `POST /api/v1/kaas/agents/register`
- 에이전트별 크레딧 → `GET /api/v1/kaas/credits/balance?agent_id=xxx`
- 에이전트별 Compare → `POST /api/v1/kaas/catalog/compare` body에 agent_id 포함
