# Cherry KaaS 작업 지침서

**프로젝트:** Cherry KaaS (Knowledge-as-a-Service)
**데드라인:** 2026-04-16 23:59 KST (Ludium 포털 제출)

---

## 1. 커뮤니케이션 규칙

### 1-0. 설명 의무

- **사용자에게 할 일을 알려줄 때**: 무엇을 하는 건지, 왜 하는 건지 먼저 설명한 후 단계를 안내한다. "이걸 왜 하는지" 사용자가 물어보기 전에 선제적으로 설명한다.
- **AI가 작업을 진행할 때**: 지금 무엇을 하려는 건지, 왜 이걸 하는 건지 먼저 설명한 후 실행한다. 설명 없이 코드부터 작성하지 않는다.
- **전문 용어 사용 시**: 처음 등장하는 용어는 한 줄로 뜻을 설명한다.

---

## 2. 필수 규칙

### 2-1. 매 작업 시 반드시 수행

1. **작업 시작 전** — `3-checklist-table.md` 검수표에서 해당 단계의 "시작" 컬럼에 날짜 기입
2. **작업 진행 중** — `2-implementation-guide.md` 진행검수서의 해당 단계를 그대로 따라 구현
3. **작업 완료 후** — 해당 단계의 테스트 항목을 모두 실행하고 결과를 검수표에 기록
4. **대화 종료 시** — `4-progress-log.md` 로그파일에 해당 대화에서 작업한 내용, 변경 파일, 이슈를 기록

### 2-2. 코드 작성 규칙

- 기존 모노레포 컨벤션 준수 (NestJS Controller/Service/Module, Zod DTO, kebab-case 파일명)
- `kaas_` prefix로 새 DB 테이블 생성
- chain-adapter 인터페이스를 통해서만 블록체인 호출
- DEMO_FALLBACK 분기를 모든 외부 의존성 호출에 포함
- `.gitignore`에 `apps/docs/KaaS/` 등록 확인 (기획 문서 원격 유출 방지)

### 2-3. 커밋 규칙

- Story 단위로 커밋 (예: `feat: Story 1.1 — CherryCredit.sol deploy`)
- `apps/docs/KaaS/` 폴더는 절대 커밋하지 않음
- force push 금지 (사전 승인 없이)
- 커밋 전 빌드 확인 (`npx next build` 또는 `pnpm -r build`)

### 2-4. 테스트 규칙

- 모든 Story 완료 후 해당 테스트를 반드시 실행
- 테스트 실패 시 다음 Story로 넘어가지 않음
- 테스트 결과를 검수표에 PASS/FAIL로 기록

---

## 3. 참조 문서

| 문서 | 위치 | 용도 |
|------|------|------|
| PRD | `apps/docs/KaaS/prd.md` | 기능 요구사항 (FR1-39) |
| Epics | `apps/docs/KaaS/epics.md` | Story별 Acceptance Criteria |
| Architecture | `apps/docs/KaaS/architecture.md` | 기술 아키텍처, 패턴, 네이밍 |
| 카탈로그 기획 | `apps/docs/publish/catalog-page-spec.md` | 카탈로그 UI 스펙 |
| 콘솔 기획 | `apps/docs/publish/query-page-spec.md` | 플로팅 콘솔 UI 스펙 |
| 멀티에이전트 기획 | `apps/docs/publish/multi-agent-spec.md` | 멀티에이전트 스펙 |
| 체크리스트 | `apps/docs/agent_read/cherry_kaas_dev_checklist.html` | Day별 진행 현황 |
| 진행검수서 | `apps/docs/KaaS_plan/2-implementation-guide.md` | 단계별 구현 가이드 |
| 검수표 | `apps/docs/KaaS_plan/3-checklist-table.md` | 진행/테스트/검수 체크 |
| 로그 | `apps/docs/KaaS_plan/4-progress-log.md` | 대화별 작업 기록 |

---

## 4. 진행 흐름

```
1. 검수표에서 다음 미완료 항목 확인
2. 진행검수서에서 해당 단계의 구현 지침 읽기
3. 지침대로 구현
4. 테스트 실행 → 검수표에 결과 기록
5. 로그파일에 작업 내용 기록
6. 다음 항목으로 이동
```

---

## 5. 인프라 & 외부 계정

### 4-1. 필수 외부 계정/서비스

| 서비스 | 용도 | URL | 비고 |
|--------|------|-----|------|
| MetaMask | 테스트넷 지갑 (배포용) | 브라우저 확장 | 테스트넷 전용 신규 지갑 생성 |
| Status Network Faucet | 테스트넷 토큰 수령 | https://faucet.status.network/ | gasless라 소량만 필요 |
| Status Network Explorer | 트랜잭션 확인 | https://sepoliascan.status.network | tx: /tx/{hash}, address: /address/{addr} |
| opBNB Faucet (Day 4) | BNB 테스트넷 토큰 | https://testnet.binance.org/faucet-smart | Story 7.1용 |
| opBNB Explorer (Day 4) | BNB 트랜잭션 확인 | https://testnet.opbnbscan.com | Story 7.1용 |
| NEAR AI Cloud (Day 4) | TEE 추론 데모 | https://cloud-api.near.ai | Story 7.2용, 계정 생성 필요 |
| GitHub | 코드 저장소 + 제출 | https://github.com/springCoolers/cherry-in-the-haystack | 이미 존재 |
| Ludium 포털 | 해커톤 제출 | (제출 URL 확인 필요) | 4/16 23:59 KST 마감 |

### 4-2. 블록체인 정보

| 항목 | 값 |
|------|---|
| Status Network RPC | `https://public.sepolia.rpc.status.network` |
| Status Network Chain ID | `1660990954` |
| Karma 컨트랙트 주소 | `0x7ec5Dc75D09fAbcD55e76077AFa5d4b77D112fde` (Status Sepolia) |
| opBNB RPC (Day 4) | `https://opbnb-testnet-rpc.bnbchain.org:8545` |
| opBNB Chain ID (Day 4) | `5611` |
| Explorer URL 패턴 | `https://sepoliascan.status.network/tx/{txHash}` |

### 5-3. 환경변수

> 기존 `apps/api/.env`에 이미 DB/Redis/JWT 등 설정됨. 블록체인 변수만 추가.

**기존 .env (건드리지 않음):**
```bash
ENVIRONMENT=local
LOCAL_DB_HOST=...       # RDS 주소
LOCAL_DB_PORT=15432     # (RDS 직접 연결 시 5432)
LOCAL_DB_USER=cherrythebest
LOCAL_DB_PASSWORD=...
LOCAL_DB_NAME=cherry
JWT_SECRET=...
AGENT_API_KEY=...
```

**추가할 블록체인 변수 (기존 .env 하단에 추가):**
```bash
# === Cherry KaaS — Smart Contract ===
DEPLOYER_PRIVATE_KEY=0x...            # MetaMask 테스트넷 지갑 private key
STATUS_RPC_URL=https://public.sepolia.rpc.status.network
CHERRY_CREDIT_ADDRESS=0x...           # Story 1.1 배포 후 기입
KARMA_CONTRACT_ADDRESS=0x7ec5Dc75D09fAbcD55e76077AFa5d4b77D112fde
CHAIN_ADAPTER=status                  # status | bnb | near | mock
DEMO_FALLBACK=false                   # true: 목 데이터 사용, false: 실데이터
```

### 5-4. 현재 개발 환경

> 이미 구축된 인프라. 새로 설치하는 것 없음.

- **DB**: AWS RDS (ap-northeast-2) — 로컬에서도 RDS 직접 연결
- **Redis**: 서버 패키지 + 로컬 설치 (port 16379)
- **배포**: dokploy
- **테이블 생성**: SQL 직접 실행 (knex migrate 사용 안 함)
- **SQL 파일 위치**: `apps/docs/staged_mock/*.sql`

### 4-6. 에러 코드 & HTTP 상태

| 에러 코드 | HTTP | 설명 |
|-----------|------|------|
| INSUFFICIENT_CREDITS | 402 | 크레딧 잔액 부족 (required/available 포함) |
| KARMA_TIER_REQUIRED | 403 | 해당 기능에 더 높은 Karma 티어 필요 |
| CONCEPT_NOT_FOUND | 404 | 개념 ID 미존재 |
| INVALID_API_KEY | 401 | API Key 없거나 유효하지 않음 |

### 4-7. Karma 티어 기준

| 티어 | Karma 잔액 | 크레딧 할인 |
|------|-----------|------------|
| Bronze | 0 ~ 99 | 0% |
| Silver | 100 ~ 999 | 5% |
| Gold | 1,000 ~ 9,999 | 15% |
| Platinum | 10,000+ | 30% |

### 4-8. 큐레이터 보상 계산식

```
구매가 20cr인 개념에 evidence 3건 (큐레이터 A: 2건, B: 1건)
총 보상 = 20 × 40% = 8cr
큐레이터 A = 8 × (2/3) = 5.33cr
큐레이터 B = 8 × (1/3) = 2.67cr
```

---

## 6. 현재 상태

- **Day 0 완료**: 프론트엔드 퍼블리싱 (카탈로그, 콘솔, 대시보드, 사이드바)
- **Day 1부터 시작**: 스마트 컨트랙트 & 블록체인 (Story 1.1 ~ 1.3)
- **기존 모듈**: app_user, pipeline, pipeline_user, agent_comm, prompt_template, patch_notes, stats, schedule
- **신규 생성 필요**: kaas 모듈, chain-adapter 패키지, contracts 디렉토리
