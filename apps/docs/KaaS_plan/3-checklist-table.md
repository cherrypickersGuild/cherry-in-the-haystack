# Cherry KaaS 검수표

**최종 업데이트:** 2026-04-16 (세션 2)

> 매 작업 시작/완료 시 이 파일을 업데이트할 것.
> 테스트 결과는 PASS / FAIL / SKIP 으로 기록.
> 검수/컨펌은 사용자(기획자) 확인 후 체크.

---

## Day -1 — 사전 준비 (인프라 & 환경)

| # | 항목 | 담당 | 시작 | 완료 | 확인 | 비고 |
|---|------|------|------|------|------|------|
| 0-1 | MetaMask 설치 + 테스트넷 지갑 생성 | 사용자 | | | | |
| 0-2a | Status Network MetaMask 추가 (Chain ID 1660990954) | 사용자 | | | | |
| 0-2b | Status Network Faucet 토큰 수령 | 사용자 | | | | gasless 확인 |
| 0-2c | Explorer에서 지갑 주소 조회 확인 | 사용자 | | | | |
| 0-3 | (선택) opBNB Testnet MetaMask 추가 + 토큰 | 사용자 | | | | Day 4용 |
| 0-4 | (선택) NEAR AI Cloud 계정 생성 | 사용자 | | | | Day 4용 |
| 0-5a | Node 20+ 확인 | 사용자 | | | | |
| 0-5b | pnpm 9+ 확인 | 사용자 | | | | |
| 0-5c | pnpm install 성공 | AI | | | | |
| 0-6 | .env에 블록체인 변수 추가 (DEPLOYER_PRIVATE_KEY 등) | 사용자+AI | | | | 사용자: PK 제공 |
| 0-7 | API 서버 실행 + Swagger UI 접근 | AI | | | | |

---

## Day 0 — 프론트엔드 퍼블리싱 (완료)

| Story | 항목 | 시작 | 완료 | 테스트 | 검수 | 컨펌 |
|-------|------|------|------|--------|------|------|
| 5.0 | 사이드바 AGENT SHOPPING + HOT | 04-14 | 04-14 | PASS | O | O |
| 5.1 | 플로팅 콘솔 (3자 대화, Purchase/Follow) | 04-14 | 04-14 | PASS | O | O |
| 5.2 | 카탈로그 (9개 개념, 모달, 큐레이터 코멘트) | 04-14 | 04-14 | PASS | O | O |
| 5.3 | 대시보드 모달 (멀티에이전트, Wallet) | 04-14 | 04-14 | PASS | O | O |
| 5.4 | Agent Knowledge Compare (드롭다운, 3단계) | 04-14 | 04-14 | PASS | O | O |

---

## Day 1 — 스마트 컨트랙트 & 블록체인

| Story | 항목 | 시작 | 완료 | 테스트 결과 | 검수 | 컨펌 |
|-------|------|------|------|-------------|------|------|
| 1.1-a | Hardhat 프로젝트 생성 | 04-14 | 04-14 | PASS | O | O |
| 1.1-b | CherryCredit.sol 작성 (4함수, 3이벤트) | 04-14 | 04-14 | PASS | O | O |
| 1.1-c | 컴파일 성공 | 04-14 | 04-14 | PASS | O | O |
| 1.1-d | 유닛 테스트 (배포 스크립트 내 deposit+provenance) | 04-14 | 04-14 | PASS | O | O |
| 1.1-e | Status Network 배포 (서버에서 실행) | 04-14 | 04-14 | PASS | O | O |
| 1.1-f | Gasless 검증 (잔액 0 ETH, gasPrice 0으로 배포 성공) | 04-14 | 04-14 | PASS | O | O |
| 1.1-g | .env에 컨트랙트 주소 기록 | 04-14 | 04-14 | PASS | O | O |
| 1.1-h | Explorer에서 컨트랙트 확인 (is_contract: true) | 04-14 | 04-14 | PASS | O | O |
| 1.2-a | chain-adapter 패키지 생성 | 04-14 | 04-14 | PASS | O | O |
| 1.2-b | IChainAdapter 인터페이스 정의 | 04-14 | 04-14 | PASS | O | O |
| 1.2-c | StatusAdapter 구현 | 04-14 | 04-14 | PASS | O | O |
| 1.2-d | MockAdapter 구현 | 04-14 | 04-14 | PASS | O | O |
| 1.2-e | 팩토리 함수 + 환경변수 스위칭 | 04-14 | 04-14 | PASS | O | O |
| 1.2-f | Mock 단위 테스트 | 04-14 | — | SKIP | — | — |
| 1.3-a | kaas-tables.sql 작성 (4테이블) | 04-14 | 04-14 | PASS | O | O |
| 1.3-b | SQL 실행 (DBeaver → RDS) | 04-14 | 04-14 | PASS | O | O |
| 1.3-c | 테이블/컬럼/인덱스/FK 확인 | 04-14 | — | — | — | — |
| 1.3-d | INSERT 테스트 row 확인 | 04-14 | — | — | — | — |

---

## Day 2 — Knowledge API + Credit System

| Story | 항목 | 시작 | 완료 | 테스트 결과 | 검수 | 컨펌 |
|-------|------|------|------|-------------|------|------|
| 2.1-a | kaas.concept + kaas.evidence DDL 확인 (content_md 포함) | 04-14 | 04-14 | PASS | O | O |
| 2.1-b | KnowledgeService → Knex DB 조회로 전면 변경 | 04-14 | 04-14 | PASS | O | O |
| 2.1-c | findAll/findById/findByIdWithContent DB 조회 테스트 | 04-14 | 04-15 | PASS | O | O |
| 2.1-d | kaas-seed-demo-data.sql (9 concept + 20 evidence INSERT) | 04-14 | 04-14 | PASS | O | O |
| 2.1-e | 사용자 DBeaver에서 SQL 실행 | 04-15 | 04-15 | PASS | O | O |
| 2.1-f | seed-data.json 삭제 + nest-cli.json assets 제거 | 04-14 | 04-14 | PASS | O | O |
| 2.1-g | 카탈로그 조회 시 content_md 미포함 확인 | 04-15 | 04-15 | PASS | O | O |
| 2.1-h | 구매 시 content_md 포함 확인 (776자) | 04-15 | 04-15 | PASS | O | O |
| 2.1-i | 15개 전체 재테스트 PASS | 04-15 | 04-15 | PASS | O | O |
| 2.2-a | kaas.module.ts 생성 | 04-14 | 04-14 | PASS | O | O |
| 2.2-b | POST /agents/register 구현 | 04-14 | 04-14 | PASS | O | O |
| 2.2-c | GET /agents 목록 구현 | 04-14 | 04-14 | PASS | O | O |
| 2.2-d | API Key 인증 (authenticate) 구현 | 04-14 | 04-14 | PASS | O | O |
| 2.2-e | curl 등록 테스트 | 04-14 | 04-14 | PASS | O | O |
| 2.2-f | API Key 인증 테스트 (balance 조회 성공) | 04-14 | 04-14 | PASS | O | O |
| 2.2-g | DB 레코드 확인 (시드 3 + 신규등록 확인) | 04-15 | 04-15 | PASS | O | O |
| 2.3-a | GET /catalog 구현 | 04-14 | 04-14 | PASS | O | O |
| 2.3-b | GET /catalog/:id 구현 | 04-14 | 04-14 | PASS | O | O |
| 2.3-c | GET /catalog?q= 검색 구현 | 04-14 | 04-14 | PASS | O | O |
| 2.3-d | curl 수동 테스트 (9개 반환 확인) | 04-14 | 04-14 | PASS | O | O |
| 2.3-e | CONCEPT_NOT_FOUND 에러 테스트 (404) | 04-15 | 04-15 | PASS | O | O |
| 2.4-a | POST /purchase 구현 | 04-14 | 04-14 | PASS | O | O |
| 2.4-b | POST /follow 구현 (25cr, subscription) | 04-14 | 04-14 | PASS | O | O |
| 2.4-c | 크레딧 차감 연동 (Purchase 20cr, Follow 25cr) | 04-14 | 04-15 | PASS | O | O |
| 2.4-d | curl 구매 테스트 (evidence+provenance+content_md) | 04-14 | 04-15 | PASS | O | O |
| 2.4-e | 인증 필요 확인 (401) | 04-15 | 04-15 | PASS | O | O |
| 2.4-f | INSUFFICIENT_CREDITS 테스트 | 04-14 | — | SKIP | — | — |
| 2.4-g | DEMO_FALLBACK 테스트 | 04-14 | — | SKIP | — | — |
| 2.4-h | kaas.query_log DB 확인 (history 2건) | 04-15 | 04-15 | PASS | O | O |
| 2.5-a | POST /catalog/compare 구현 | 04-14 | 04-14 | PASS | O | O |
| 2.5-b | upToDate/outdated/gaps/recommendations 응답 확인 | 04-15 | 04-15 | PASS | O | O |
| 2.5-c | 에이전트별 비교 테스트 (rag outdated, 8 gaps) | 04-15 | 04-15 | PASS | O | O |
| 3.1-a | getBalance 서비스 구현 | 04-14 | 04-14 | PASS | O | O |
| 3.1-b | consume 서비스 구현 (Karma 할인 포함) | 04-14 | 04-14 | PASS | O | O |
| 3.1-c | GET /credits/balance 엔드포인트 | 04-14 | 04-14 | PASS | O | O |
| 3.1-d | Karma 할인 적용 테스트 (Silver 15%) | 04-14 | — | SKIP | — | — |
| 3.1-e | 잔액 부족 INSUFFICIENT_CREDITS 테스트 | 04-14 | — | SKIP | — | — |
| 3.2-a | POST /credits/deposit 구현 | 04-14 | 04-14 | PASS | O | O |
| 3.2-b | curl 충전 테스트 (250cr) | 04-14 | 04-14 | PASS | O | O |
| 3.2-c | Status Network 실충전 테스트 | 04-14 | — | SKIP | — | — |
| 3.2-d | Ledger DB 확인 (deposit 기록) | 04-15 | 04-15 | PASS | O | O |
| 3.3-a | provenance 해시 생성 + DB 기록 | 04-14 | 04-14 | PASS | O | O |
| 3.3-b | 비동기 온체인 기록 | 04-14 | — | SKIP | — | — |
| 3.3-c | 재시도 로직 (3회) | 04-14 | — | SKIP | — | — |
| 3.3-d | kaas.query_log.provenance_hash 확인 | 04-15 | 04-15 | PASS | O | O |

---

## Day 3 — API 연결 + MCP + Curator

| Story | 항목 | 시작 | 완료 | 테스트 결과 | 검수 | 컨펌 |
|-------|------|------|------|-------------|------|------|
| 5.5-a | app.module.ts에 KaasModule import | 04-14 | 04-14 | PASS | O | O |
| 5.5-b | lib/api.ts에 12개 fetch 함수 추가 | 04-14 | 04-14 | PASS | O | O |
| 5.5-c | 서버 시작 + Swagger 전체 확인 | 04-15 | 04-15 | PASS | O | O |
| 5.6-a | 콘솔 purchaseConcept/followConcept API + mock fallback | 04-14 | 04-14 | PASS | O | O |
| 5.6-b | 구매 → 실응답 + 실해시 확인 | 04-15 | 04-15 | PASS | O | O |
| 5.6-c | 크레딧 before→after 실데이터 | 04-14 | 04-14 | PASS | O | O |
| 5.6-d | Explorer 링크 → 실트랜잭션 | 04-14 | 04-14 | PASS | O | O |
| 5.7-a | 카탈로그 fetchCatalog API + mock fallback | 04-14 | 04-14 | PASS | O | O |
| 5.7-b | Compare → compareKnowledge API + mock fallback | 04-14 | 04-14 | PASS | O | O |
| 5.7-c | Purchase/Follow → 실API + 콘솔 연결 | 04-14 | 04-14 | PASS | O | O |
| 5.8-a | 대시보드 fetchAgents API + mock fallback | 04-14 | 04-14 | PASS | O | O |
| 5.8-b | 에이전트 등록 → API 호출 | 04-14 | 04-14 | PASS | O | O |
| 5.8-c | 잔액/이력 → API 호출 | 04-14 | — | — | — | — |
| ADM-a | Admin 페이지 리디자인 (iframe→컴포넌트) | 04-15 | 04-15 | PASS | O | O |
| ADM-b | KaasAdminController 8개 엔드포인트 | 04-15 | 04-15 | PASS | O | O |
| ADM-c | 지식 큐레이팅 UI (기본정보/콘텐츠/Evidence) | 04-15 | 04-15 | PASS | O | O |
| ADM-d | content_md 에디터 + .md 파일 업로드 | 04-15 | 04-15 | PASS | O | O |
| ADM-e | 프롬프트 템플릿 탭 디자인 통일 | 04-15 | 04-15 | PASS | O | O |
| 4.1-a | mcp-server.ts 생성 | 04-15 | 04-15 | PASS | O | O |
| 4.1-b | 5개 MCP Tools 구현 (search, get, purchase, follow, compare) | 04-15 | 04-15 | PASS | O | O |
| 4.1-c | MCP Resources 구현 (catalog, concept/{id}) | 04-15 | 04-15 | PASS | O | O |
| 4.1-d | Claude Desktop 연동 테스트 | 04-15 | 04-15 | PASS | O | O |
| AGT-a | 에이전트 등록 (MetaMask + LLM 타입/모델/API Key) | 04-15 | 04-15 | PASS | O | O |
| AGT-b | LLM 프록시 엔드포인트 (POST /llm/chat) | 04-15 | 04-15 | PASS | O | O |
| AGT-c | 콘솔 GPT/Claude 실제 응답 연동 | 04-15 | 04-15 | PASS | O | O |
| AGT-d | 에이전트 삭제 + 모델 변경 | 04-15 | 04-15 | PASS | O | O |
| AGT-e | Dashboard 통합 (Admin + Dashboard → 3탭) | 04-15 | 04-15 | PASS | O | O |
| MCP-a | MCP stdio → Streamable HTTP 전환 | 04-16 | 04-16 | PASS | O | O |
| MCP-b | API Key 인증 미들웨어 (Bearer token ck_live_...) | 04-16 | 04-16 | PASS | O | O |
| MCP-c | 세션 관리 (연결된 에이전트 추적 + 웹 상태 표시) | 04-16 | 04-16 | PASS | O | O |
| ELC-a | Elicitation: 에이전트에게 지식 목록 요청 (POST /mcp/elicit) | 04-16 | 04-16 | PASS | O | O |
| ELC-b | 웹 Compare 버튼 → Elicitation → gap 분석 → 태그 표시 | 04-16 | 04-16 | PASS | O | O |
| SMP-a | Sampling: MCP createMessage → Claude Code 미지원(-32601) → OpenAI GPT-4.1-nano로 대체 | 04-16 | 04-16 | SKIP | — | — |
| SMP-b | 에이전트 응답 → 웹 채팅에 표시 (KaaS orange / Agent purple) | 04-16 | 04-16 | PASS | O | O |
| SMP-c | 3자 대화 (User ↔ KaaS ↔ Agent) 콘솔 | 04-16 | 04-16 | PASS | O | O |
| ONC-a | chain-adapter → provenance 서비스 연결 (staticNetwork fix) | 04-16 | 04-16 | PASS | O | O |
| ONC-b | 구매 시 Status Network 실제 트랜잭션 기록 | 04-16 | — | SKIP | — | — |
| ONC-c | Explorer에서 트랜잭션 확인 | 04-16 | — | SKIP | — | — |
| WS-a | WebSocket Gateway (kaas-ws.gateway.ts) — socket.io /kaas 네임스페이스 | 04-16 | 04-16 | PASS | O | O |
| WS-b | stdio MCP → socket.io 자동 연결 (connectWebSocket, KAAS_AGENT_API_KEY) | 04-16 | 04-16 | PASS | O | O |
| WS-c | 구매/팔로우 후 자동 knowledge 제출 (pushKnowledgeUpdate) | 04-16 | 04-16 | PASS | O | O |
| WS-d | Dashboard MCP 연결/해제 명령어 생성기 (claude mcp add/remove) | 04-16 | 04-16 | PASS | O | O |
| WS-e | 채팅창 KaaS 답변 — OpenAI GPT-4.1-nano + 카탈로그 컨텍스트 + 구매 유도 | 04-16 | 04-16 | PASS | O | O |
| 6.1-a | 큐레이터 보상 계산 (40%) | | | | | |
| 6.1-b | GET /rewards/balance | | | | | |
| 6.1-c | POST /rewards/withdraw gasless | | | | | |
| 6.1-d | DB 확인 (kaas.curator_reward) | | | | | |

---

## Day 4 — 멀티체인

| Story | 항목 | 시작 | 완료 | 테스트 결과 | 검수 | 컨펌 |
|-------|------|------|------|-------------|------|------|
| 7.1-a | bnb-adapter.ts 구현 | | | | | |
| 7.1-b | opBNB 배포 | | | | | |
| 7.1-c | 2건 트랜잭션 확인 | | | | | |
| 7.1-d | 데모 영상 + 트윗 | | | | | |
| 7.2-a | near-adapter.ts 구현 | | | | | |
| 7.2-b | NEAR AI Cloud 연동 | | | | | |
| 7.2-c | 데모 영상 | | | | | |

---

## 금요일 — 테스트 & 제출

| 항목 | 시작 | 완료 | 테스트 결과 | 검수 | 컨펌 |
|------|------|------|-------------|------|------|
| 해피패스 1회차 (등록→충전→구매→해시→Explorer) | | | | | |
| 해피패스 2회차 | | | | | |
| 해피패스 3회차 | | | | | |
| 해피패스 4회차 | | | | | |
| 해피패스 5회차 | | | | | |
| 5회 모두 2분 이내 완료 확인 | | | | | |
| 데모 영상 촬영 (Status 2분) | | | | | |
| 데모 영상 촬영 (BNB/NEAR) | | | | | |
| Ludium 포털 제출 | | | | | |
