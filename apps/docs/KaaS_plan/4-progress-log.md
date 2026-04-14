# Cherry KaaS 진행 로그

> 매 대화 종료 시 반드시 아래 형식으로 기록할 것.

---


### 세션 1: 초기 설정 + 카탈로그

**작업 내용:**
- 사이드바에 KAAS 섹션 추가 (이후 AGENT SHOPPING + HOT로 변경)
- kaas-catalog-page.tsx 생성 (9개 개념, 검색, 카테고리 필터, 상세 모달)
- page.tsx에 kaas-catalog 라우트 연결

**변경 파일:**
- `apps/web/components/cherry/sidebar.tsx`
- `apps/web/components/cherry/kaas-catalog-page.tsx` (신규)
- `apps/web/app/page.tsx`

**이슈:** 없음

---

### 세션 2: Compare + 콘솔 + 대시보드

**작업 내용:**
- Agent Knowledge Compare 기능 추가 (3단계: up-to-date/outdated/gap)
- kaas-query-page.tsx → kaas-console.tsx로 플로팅 콘솔 변경
- kaas-dashboard-page.tsx 생성 (2패널: Agent Profile + Wallet)
- 사이드바 구조 변경: KAAS → AGENT SHOPPING (HOT), DIGEST 아래로 이동
- Query Knowledge 사이드바 메뉴 제거 (콘솔로 대체)
- Dashboard를 카탈로그 모달 → 글로벌 헤더 버튼으로 이동
- Admin 버튼 Link → 팝업 모달(iframe)로 변경

**변경 파일:**
- `apps/web/components/cherry/kaas-catalog-page.tsx` (Compare, 에이전트 드롭다운)
- `apps/web/components/cherry/kaas-console.tsx` (신규, 3자 대화)
- `apps/web/components/cherry/kaas-dashboard-page.tsx` (신규, 멀티에이전트)
- `apps/web/components/cherry/sidebar.tsx` (구조 변경)
- `apps/web/app/page.tsx` (모달, 콘솔 마운트)

**삭제 파일:**
- `apps/web/components/cherry/kaas-query-page.tsx` (dead code 삭제)

**이슈:** 없음

---

### 세션 3: 기획서 정리 + Purchase/Follow 변경

**작업 내용:**
- depth 3단계(summary/concept/evidence) → Purchase(20cr)/Follow(25cr) 모델로 전면 변경
- PRD, epics.md, architecture.md, publish specs 전부 수정
- 카탈로그 모달 버튼 3개 → 2개 (Purchase + Follow)
- 콘솔 depth 셀렉터 → Purchase/Follow 셀렉터
- 체크리스트 전면 업데이트 (Day 0 완료 체크, 용어 통일)
- KaaS_plan 폴더 생성 (작업지침서, 진행검수서, 검수표, 로그)

**변경 파일:**
- `apps/docs/KaaS/prd.md` (FR8, FR15, Endpoint, Schema)
- `apps/docs/KaaS/epics.md` (Story 2.4, 3.1, 5.1, 5.3, 5.4, DB 스키마)
- `apps/docs/KaaS/architecture.md` (Knowledge Service, DB, credit calculator)
- `apps/docs/publish/catalog-page-spec.md`
- `apps/docs/publish/query-page-spec.md`
- `apps/web/components/cherry/kaas-catalog-page.tsx` (Purchase/Follow 버튼)
- `apps/web/components/cherry/kaas-console.tsx` (Action 타입, 드롭다운)
- `apps/docs/agent_read/cherry_kaas_dev_checklist.html` (전면 업데이트)

**이슈:**
- Cherry 아이콘 SVG → Lucide Cherry로 변경 시 디자인 열화 → 사용자 지시로 Lucide 유지
- git rebase 과정에서 apps/docs/KaaS/ 파일이 의도치 않게 커밋됨 → 재정리 완료

---

### 세션 1: Story 1.1 — CherryCredit.sol 작성 + 배포 시도

**작업 내용:**
- `apps/contracts/` 디렉토리 생성 (Hardhat 프로젝트)
- Hardhat 2 + hardhat-toolbox 설치 (Hardhat 3은 호환 문제로 다운그레이드)
- `CherryCredit.sol` 스마트 컨트랙트 작성 (4함수, 3이벤트, 접근제어)
- `scripts/deploy.ts` 배포 스크립트 작성 (배포 + deposit/provenance 테스트 포함)
- 컴파일 성공
- Status Network 배포 시도 → **ETIMEDOUT** (Tailscale VPN 환경에서 Node.js 직접 연결 차단)

**변경 파일:**
- `apps/contracts/` 전체 신규 (package.json, hardhat.config.ts, tsconfig.json, contracts/CherryCredit.sol, scripts/deploy.ts)

**이슈:**
- Hardhat 3 + hardhat-toolbox 호환 문제 → Hardhat 2로 다운그레이드
- Tailscale VPN 환경에서 Node.js → Status Network RPC 연결 타임아웃
  - curl은 정상 (시스템 프록시 경유), Node.js는 직접 연결 시도하여 실패
  - 해결 방안: 서버에서 배포 실행, 또는 Node.js에 프록시 설정

### 세션 1 계속: Story 1.1 배포 성공 + Story 1.2 + 1.3

**작업 내용:**
- Tailscale 우회: 서버(ubuntu@100.117.80.91)에 contracts/ 전송 후 서버에서 배포
- gasPrice: 0 설정으로 잔액 0 ETH 상태에서 배포 성공
- 컨트랙트 주소: `0x153DAcC25Ad05DcFb1f258c28eb47e48c13e682b`
- Explorer에서 is_contract: true 확인
- .env에 CHERRY_CREDIT_ADDRESS 기록

- Story 1.2 — Chain Adapter 구현 완료
  - `packages/chain-adapter/src/` (interface, status-adapter, mock-adapter, index)
  - 팩토리 함수: DEMO_FALLBACK → Mock, CHAIN_ADAPTER=status → Status

- Story 1.3 — kaas-tables.sql 작성 + 사용자가 RDS에 실행 완료
  - kaas_agent, kaas_credit_ledger, kaas_query_log, kaas_curator_reward 4개 테이블

**변경 파일:**
- `apps/contracts/` 전체 (Hardhat 프로젝트, CherryCredit.sol, deploy.ts)
- `packages/chain-adapter/` 전체 신규
- `apps/docs/staged_mock/kaas-tables.sql` 신규
- `apps/api/.env` (CHERRY_CREDIT_ADDRESS 추가)

**이슈:**
- Hardhat 3 → 2 다운그레이드 (toolbox 호환)
- Tailscale VPN → Node.js 외부 연결 차단 → 서버에서 배포로 해결
- Status Network gasless → gasPrice: 0 명시 필요

**다음:** DB 기반 카탈로그 이동

### 세션 3: 지식 저장 구조 DB 이동

**이건 뭘 한 건가:**
카탈로그 9개 개념이 seed-data.json 파일에 하드코딩되어 있었음. 에이전트가 구매하는 "상품"이므로 DB에 저장해야 함. MCP Resource 방식, Agent Skills Progressive Disclosure 패턴 등을 조사하여 지식 저장 구조를 확정.

**논의 결과:**
- 에이전트 제출 형식: { topic, lastUpdated } — 현재 수준 유지
- Cherry가 판매하는 지식: DB에 저장된 마크다운 콘텐츠 (kaas.concept.content_md)
- 카탈로그 조회 시 content_md 제외 (미리보기만), 구매 시 content_md 포함

**작업 내용:**
1. kaas.concept + kaas.evidence DDL에 content_md TEXT 컬럼 추가
2. 9개 concept + 20개 evidence INSERT SQL 작성 (content_md에 상세 마크다운 포함)
3. KnowledgeService를 readFileSync → Knex DB 조회로 전면 변경
4. findByIdWithContent() 메서드 추가 (구매용 — content_md 포함)
5. 컨트롤러 3개 async/await 추가
6. seed-data.json 삭제 + nest-cli.json assets 제거
7. 기획서 6개 파일 수정 (DDL, schema SQL, architecture, epics, 진행검수서, 검수표)
8. 15개 API 테스트 전부 PASS

**변경 파일:**
- docs/architecture/ddl-v1.1.sql (content_md 추가)
- apps/docs/staged_mock/kaas-tables-v2-schema.sql (동일)
- apps/docs/staged_mock/kaas-seed-demo-data.sql (concept + evidence INSERT 추가)
- apps/api/src/modules/kaas/kaas-knowledge.service.ts (전면 재작성)
- apps/api/src/modules/kaas/types/kaas.types.ts (ConceptWithContent 추가)
- apps/api/src/modules/kaas/kaas-catalog.controller.ts (await)
- apps/api/src/modules/kaas/kaas-compare.controller.ts (await)
- apps/api/src/modules/kaas/kaas-query.controller.ts (findByIdWithContent + content_md)
- apps/api/nest-cli.json (assets 제거)
- apps/docs/KaaS/architecture.md (6개 테이블)
- apps/docs/KaaS/epics.md (Story 2.1)
- apps/docs/KaaS_plan/2-implementation-guide.md (Story 2.1)
- apps/docs/KaaS_plan/3-checklist-table.md

**삭제 파일:**
- apps/api/src/modules/kaas/data/seed-data.json
- apps/api/src/modules/kaas/data/ (디렉토리)

**다음:** Day 3 — 프론트엔드 API 연결

### 세션 2: Day 2 — KaaS NestJS 모듈 구현

**작업 내용:**
- `apps/api/src/modules/kaas/` 전체 모듈 생성
- 디렉토리 구조: input-dto/, output-dto/, types/, entity/, data/
- seed-data.json (9개 개념, 카탈로그와 동일)
- KaasKnowledgeService (findAll, findById, search, findByCategory)
- KaasAgentService (register, findByApiKey, authenticate)
- KaasCreditService (getBalance, consume with Karma 할인, deposit)
- KaasProvenanceService (generateHash, recordQuery, getQueryHistory)
- 컨트롤러 5개: Agent, Catalog, Query(Purchase/Follow), Credit, Compare
- app.module.ts에 KaasModule import

**API 테스트 결과 (Swagger/curl):**
- GET /api/v1/kaas/catalog → 9개 개념 ✓
- POST /api/v1/kaas/agents/register → API Key 발급 ✓
- POST /api/v1/kaas/credits/deposit → 250cr 충전 ✓
- GET /api/v1/kaas/credits/balance → 잔액 250 ✓
- POST /api/v1/kaas/purchase → RAG 구매 성공 (20cr 차감, 230 잔액, provenance 해시, evidence 3건) ✓

**변경 파일:**
- `apps/api/src/modules/kaas/` 전체 신규 (15개 파일)
- `apps/api/src/app.module.ts` (KaasModule import 추가)
- `apps/api/nest-cli.json` (assets: seed-data.json 복사 설정)

**이슈:**
- seed-data.json import 시 `import * as` → `this.concepts.find is not a function` 에러 → readFileSync로 변경
- nest-cli.json에 assets 설정 필요 (빌드 시 JSON 파일 dist에 복사)
- 서버 포트: 4000 (기존 코드 확인 필요했음)
- HttpException으로 에러 throw 방식 변경

**미테스트:**
- POST /api/v1/kaas/follow
- POST /api/v1/kaas/catalog/compare
- GET /api/v1/kaas/credits/history

---


### 세션 1: chain-adapter 위치 이동 + 기획서 수정

**작업 내용:**
1. `packages/chain-adapter/` → `apps/api/src/modules/kaas/chain-adapter/`로 이동
   - 이유: apps/ 외 공유 디렉토리(packages/) 수정 금지 정책
   - KaaS 모듈 내부 서브디렉토리로 통합
2. 기획서 5개 파일에서 경로 참조 일괄 수정:
   - `apps/docs/agent_read/cherry_kaas_dev_checklist.html`
   - `apps/docs/KaaS_plan/2-implementation-guide.md` (8곳)
   - `apps/docs/KaaS/architecture.md` (3곳)
   - `apps/docs/KaaS/epics.md` (1곳)
3. 지식 Diff & 버전 관리 기획서 작성 (`apps/docs/publish/knowledge-diff-spec.md`)
   - Phase 2 (해커톤 이후) 기능으로 문서화
   - concept_version, agent_knowledge 테이블 설계
   - diff API, MCP Tool 설계

**변경 파일:**
- `apps/api/src/modules/kaas/chain-adapter/` (interface.ts, mock-adapter.ts, status-adapter.ts, index.ts)
- `apps/docs/agent_read/cherry_kaas_dev_checklist.html`
- `apps/docs/KaaS_plan/2-implementation-guide.md`
- `apps/docs/KaaS/architecture.md`
- `apps/docs/KaaS/epics.md`
- `apps/docs/publish/knowledge-diff-spec.md` (신규)

**참고:** 4-progress-log.md의 Day 1 기록(107, 115줄)은 당시 실제 경로였으므로 역사적 기록으로 유지

**다음:** DB 이동 플랜 실행 (DDL content_md 추가, 시드 SQL, KnowledgeService DB 전환)

### 세션 2: DB 시드 실행 + 15개 API 재테스트 + 401 버그 수정

**작업 내용:**
1. 사용자가 kaas-seed-demo-data.sql을 RDS에 실행 완료
2. 15개 API 통합 테스트 전부 PASS:
   - GET /catalog → 9개, content_md 미포함 ✓
   - GET /catalog/rag → evidence 3건 ✓
   - GET /catalog/nonexistent → 404 ✓
   - POST /agents/register → API Key 발급 ✓
   - POST /credits/deposit → 250cr ✓
   - GET /credits/balance → 250 ✓
   - POST /purchase → 20cr 차감, evidence 3건, content_md 776자, provenance ✓
   - POST /follow → 25cr 차감, subscription, provenance ✓
   - GET /credits/balance → 205 ✓
   - GET /credits/history → 2건 (purchase+follow) ✓
   - POST /catalog/compare → outdated 1, gaps 8 ✓
   - 401 Unauthorized ✓ (버그 수정 후)
   - GET /agents → 4+개 ✓
   - 카탈로그 content_md 미포함 ✓
   - 구매 content_md 포함 ✓
3. 버그 수정: KaasCreditController.auth()에서 `throw new Error` → `throw new UnauthorizedException` (500→401)
4. 기획서 + 검수표 전체 업데이트 (Day 2 완료 체크, Day 3 API 연결 완료 체크)

**변경 파일:**
- apps/api/src/modules/kaas/kaas-credit.controller.ts (UnauthorizedException)
- apps/docs/agent_read/cherry_kaas_dev_checklist.html (Day 2+3 완료)
- apps/docs/KaaS_plan/3-checklist-table.md (전체 업데이트)
- apps/docs/KaaS_plan/4-progress-log.md (이 로그)

**다음:** MCP Server (Story 4.1), Curator Rewards (Story 6.1)

### 세션 3: Admin 페이지 리디자인 + 지식 큐레이팅 기능

**작업 내용:**
1. Admin 페이지를 iframe → 직접 React 컴포넌트로 교체
2. 2탭 구조: "지식 큐레이팅" + "프롬프트 템플릿"
3. 지식 큐레이팅 기능 신규 구현:
   - 좌측 패널: concept 목록/검색, + 새 개념 버튼
   - 우측 패널: 기본 정보 편집, 콘텐츠(content_md) 에디터 + .md 파일 업로드, Evidence CRUD
4. Backend: KaasAdminController (8개 엔드포인트) + KnowledgeService write 메서드 추가
5. DTO 4개: create-concept, update-concept, create-evidence, update-evidence
6. lib/api.ts에 8개 admin API 함수 추가
7. template/edit/page.tsx에서 TemplateEditorBody 추출 → Admin 모달에서 재사용
8. 대시보드 스타일로 디자인 통일 (카드 레이아웃, 색상 팔레트)
9. 디자인 반복 수정: 색상 조정 (골드 포인트, 초록 액센트, 의미별 라벨 색상)

**신규 파일:**
- apps/api/src/modules/kaas/kaas-admin.controller.ts
- apps/api/src/modules/kaas/input-dto/create-concept.dto.ts
- apps/api/src/modules/kaas/input-dto/update-concept.dto.ts
- apps/api/src/modules/kaas/input-dto/create-evidence.dto.ts
- apps/api/src/modules/kaas/input-dto/update-evidence.dto.ts
- apps/web/components/cherry/kaas-admin-page.tsx

**수정 파일:**
- apps/api/src/modules/kaas/kaas-knowledge.service.ts (admin CRUD 메서드 8개 추가)
- apps/api/src/modules/kaas/kaas.module.ts (KaasAdminController 등록)
- apps/web/lib/api.ts (admin API 함수 8개 추가)
- apps/web/app/page.tsx (iframe → KaasAdminPage 컴포넌트)
- apps/web/app/template/edit/page.tsx (TemplateEditorBody 추출 + 디자인 수정)
- apps/web/components/cherry/kaas-dashboard-page.tsx (지갑 주소 축약)

**API 테스트 (curl):**
- GET /admin/concepts → 10개 ✓
- GET /admin/concepts/rag → contentMd 776자, evidence 3건 ✓
- PATCH /admin/concepts/rag → quality_score 변경 ✓
- POST /admin/concepts → 생성 ✓
- DELETE /admin/concepts → 204 ✓
- POST /admin/concepts/rag/evidence → 추가 ✓
- DELETE evidence → 204 ✓

**다음:** MCP Server (Story 4.1)

---


### 세션 1: MCP Server + 에이전트 등록/LLM 연동 + Dashboard 통합

**작업 내용:**
1. MCP Server 구현 (mcp-server.ts) — 5 Tools + 2 Resources, Claude Desktop 연동
2. 에이전트 등록 리팩토링 — MetaMask + LLM 타입(Claude/GPT/Custom) + 모델 선택 + API Key
3. LLM 프록시 엔드포인트 (POST /llm/chat) — 구매한 content_md 기반 GPT/Claude 실제 응답
4. Dashboard 통합 — Admin + My Dashboard → 3탭 (대시보드/지식 큐레이팅/프롬프트 템플릿)
5. 에이전트 삭제, 모델 변경, Deposit API 키 제거 (body/query 방식으로)
6. 콘솔 — 구매 시에만 대화 표시, 입력란 제거, Cherry 중복 메시지 수정
7. 카탈로그 — 에이전트 없으면 Purchase/Follow 비활성, Compare 비활성
8. DB 컬럼 추가: llm_provider, llm_api_key, llm_model

**신규 파일:**
- apps/api/src/modules/kaas/kaas-llm.controller.ts
- apps/api/src/modules/kaas/input-dto/deposit.dto.ts
- apps/api/start-mcp.sh

**주요 수정:**
- apps/api/src/mcp-server.ts (전체)
- apps/api/src/modules/kaas/kaas-agent.controller.ts (DELETE, PATCH model)
- apps/api/src/modules/kaas/kaas-agent.service.ts (deleteAgent, updateModel)
- apps/api/src/modules/kaas/kaas-credit.controller.ts (Authorization 헤더 → body/query)
- apps/api/src/modules/kaas/kaas-query.controller.ts (동일)
- apps/web/components/cherry/kaas-dashboard-page.tsx (3탭 통합, 에이전트 등록 폼)
- apps/web/components/cherry/kaas-console.tsx (구매 전용, LLM 연동)
- apps/web/components/cherry/kaas-catalog-page.tsx (에이전트 체크)
- apps/web/app/page.tsx (모달 통합, 버튼 1개)

**남은 작업:**
- ONC: 온체인 트랜잭션 기록 (chain-adapter → provenance 서비스 연결)
- KNW: 에이전트 지식 영구 저장 (구매한 knowledge DB 저장 + LLM context)
- 6.1: 큐레이터 보상
- Day 4: 멀티체인

### 세션 2: WebSocket 실시간 통신 + KaaS 채팅 + UX 개선

**작업 내용:**
1. **WebSocket Gateway** (`kaas-ws.gateway.ts`) 구현
   - NestJS socket.io 서버, `/kaas` 네임스페이스
   - `handleConnection`/`handleDisconnect`: api_key로 에이전트 매핑
   - `pushKnowledgeUpdate(agentId, knowledge[])`: 에이전트에게 WS 실시간 전송
   - `chatWithAgent(agentId, message)`: chat_request 전송 → chat_reply 수신 (10s timeout)
2. **stdio MCP WebSocket 자동 연결** (`mcp-server.ts`)
   - `socket.io-client` 설치 (pnpm)
   - `connectWebSocket(apiKey)`: 서버 시작 시 /kaas 네임스페이스에 자동 연결
   - `request_knowledge` 이벤트 수신 → DB 조회 → `submit_knowledge` 응답
   - 구매/팔로우 Tool 실행 후 `submitKnowledgeViaWs(key)` 자동 호출
3. **구매/팔로우 후 자동 knowledge 제출** (`kaas-query.controller.ts`)
   - `addToKnowledge(agentId, conceptId)` → DB 업데이트 → `pushKnowledgeUpdate` WS 전송
   - 구매하면 즉시 에이전트 지식 목록이 WS로 서버에 제출됨
4. **Dashboard MCP 명령어 생성기** (`kaas-dashboard-page.tsx`)
   - `claude mcp add cherry-kaas <start-mcp.sh 경로> --env KAAS_AGENT_API_KEY=...`
   - `claude mcp remove cherry-kaas` 명령어
   - 각각 복사 버튼 포함
5. **KaaS 채팅창** (`kaas-console.tsx` + `kaas-query.controller.ts`)
   - POST /llm/chat: OpenAI GPT-4.1-nano, 카탈로그 top 10 컨텍스트
   - 시스템 프롬프트: Compare 권유 → 카탈로그 구매 유도 (상품 판매 지향)
   - KaaS 메시지: 주황(`#D4854A`) 헤더 "Cherry KaaS"
   - Agent 메시지: 보라(`#7B5EA7`) 헤더 에이전트 이름
6. **chain-adapter staticNetwork 수정** (`status-adapter.ts`)
   - `new ethers.Network("status-sepolia", 1660990954)` + `{ staticNetwork }` 옵션
   - JsonRpcProvider의 network 자동감지 무한루프 방지
7. **UX 개선** (`kaas-console.tsx`)
   - 자동 스크롤: 메시지 전송/수신 시 하단으로 스크롤
   - DOM 유지: 콘솔 unmount 대신 CSS `hidden` 클래스로 숨김 (스크롤 위치 보존)
   - Compare 시 콘솔 자동 열기 제거 (`notify()` 에서 `setOpen(true)` 제거)
   - 구매 후 콘솔 지식 제출: 전체 knowledge 목록을 `✓` 접두사로 표시

**변경 파일:**
- `apps/api/src/modules/kaas/kaas-ws.gateway.ts` (신규)
- `apps/api/src/modules/kaas/kaas.module.ts` (KaasWsGateway 등록)
- `apps/api/src/mcp-server.ts` (WebSocket 연결, submitKnowledgeViaWs)
- `apps/api/src/modules/kaas/kaas-query.controller.ts` (WS 제출, /llm/chat 엔드포인트)
- `apps/api/src/modules/kaas/chain-adapter/status-adapter.ts` (staticNetwork)
- `apps/web/components/cherry/kaas-dashboard-page.tsx` (MCP 명령어 생성기)
- `apps/web/components/cherry/kaas-console.tsx` (chat 타입 분리, UX 개선)
- `apps/web/components/cherry/kaas-catalog-page.tsx` (onCompareResult 콜백)
- `apps/web/app/page.tsx` (Compare 결과 → notify)
- `apps/web/lib/api.ts` (mcpChat, elicitKnowledge, fetchMcpSessions 추가)
- `apps/api/.env` (OPENAI_API_KEY 추가)

**이슈:**
- `socket.io-client` pnpm 스토어 경로 문제 → `pnpm add socket.io-client`로 설치
- MCP Sampling `-32601`: Claude Code가 MCP 클라이언트로서 `createMessage` 미지원 → OpenAI로 대체
- ANTHROPIC_API_KEY: Claude Desktop이 subprocess 환경에 API Key 미주입
- `conceptId is not defined` 스코프 오류: `const submittedTopic = res.concepts?.[0] ?? conceptId`로 수정

**테스트 결과:**
- WS 연결: 에이전트 연결 시 서버 로그 `[WsGateway] Agent connected` ✅
- Compare → Elicitation → WS 제출: `source: websocket` 응답 ✅
- 구매 → 자동 제출: 구매 후 콘솔에 전체 knowledge 목록 표시 ✅
- KaaS 채팅: 구매 유도 응답 (카탈로그/Compare 안내) ✅
- Agent 채팅: 보라 헤더, KaaS 채팅: 주황 헤더 구분 ✅

**남은 작업:**
- 6.1: 큐레이터 보상 (6.1-a~d)
- 7.1: opBNB 멀티체인
- 7.2: NEAR AI Cloud
- 금요일: 해피패스 5회 + 데모 영상 + Ludium 제출

---

## 2026-04-17 (목) — Day 4

> (작업 시작 시 여기에 기록)

---

## 2026-04-18 (금) — 테스트 & 제출

> (작업 시작 시 여기에 기록)
