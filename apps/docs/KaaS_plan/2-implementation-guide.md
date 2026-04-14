# Cherry KaaS 진행 검수서

**기준 문서:** PRD, epics.md, architecture.md, agent-registration-flow.md, publish specs
**현재 상태:** Day 3. API + 프론트엔드 + MCP stdio 완료. Streamable HTTP 전환 + Elicitation/Sampling 구현 예정.
**참조:** 에이전트 통신 아키텍처 → `apps/docs/KaaS/agent-registration-flow.md`

---

# Day -1 — 사전 준비 (인프라 & 환경 셋업)

> Day 1 시작 전에 반드시 아래 전체를 완료할 것. 하나라도 빠지면 Day 1에서 막힘.

### 담당 범례
- **사용자** = 사람이 직접 해야 함 (브라우저 조작, 계정 생성, 비밀번호 입력, 서명 등)
- **AI** = Claude가 코드 작성/실행 가능
- **사용자+AI** = 사용자가 정보 제공 → AI가 설정 파일에 반영

## STEP 0-1: MetaMask 지갑 생성 `사용자`

1. Chrome에서 MetaMask 확장 설치: https://metamask.io/download/
2. "Create a new wallet" 선택 → 비밀번호 설정
3. **시드 문구 12단어 안전한 곳에 백업** (절대 공유 금지)
4. 지갑 생성 완료 후 → 지갑 주소 복사 (`0x...` 형태)

### 테스트넷 전용 지갑 생성 (권장)
- MetaMask 좌상단 계정 → "Add account" → 이름: "Cherry KaaS Deployer"
- 이 지갑은 테스트넷 전용. 실 자산 절대 넣지 않음

### Private Key 추출
1. MetaMask → 계정 아이콘 → "Account details" → "Show private key"
2. 비밀번호 입력 → Private Key 복사
3. `.env` 파일의 `DEPLOYER_PRIVATE_KEY=0x...`에 붙여넣기

## STEP 0-2: Status Network 테스트넷 설정 `사용자`

### MetaMask에 Status Network 추가
1. MetaMask → 네트워크 → "Add network" → "Add a network manually"
2. 입력:
   - Network Name: `Status Network Sepolia`
   - RPC URL: `https://public.sepolia.rpc.status.network`
   - Chain ID: `1660990954`
   - Currency Symbol: `ETH`
   - Block Explorer: `https://sepoliascan.status.network`
3. "Save" 클릭

### 테스트넷 토큰 수령 (선택 — gasless이므로 없어도 됨)
Status Network는 **gasless 체인**이므로 ETH 잔액 0인 상태에서도 컨트랙트 배포 및 트랜잭션 실행 가능.
토큰이 필요한 경우에만:
1. https://faucet.status.network/ 접속
2. 지갑 주소 입력 → "Request" 클릭
3. Faucet 조건 충족 안 되면 건너뛰어도 됨 (gasless 체인이라 0 ETH로 배포 가능)

### 검증
- MetaMask 네트워크: "Status Network Sepolia" 선택 상태
- 지갑 주소가 Explorer에서 조회 가능: `https://sepoliascan.status.network/address/{내_주소}`

## STEP 0-3: opBNB 테스트넷 설정 (Day 4용) `사용자`

### MetaMask에 opBNB 추가
1. "Add a network manually":
   - Network Name: `opBNB Testnet`
   - RPC URL: `https://opbnb-testnet-rpc.bnbchain.org:8545`
   - Chain ID: `5611`
   - Currency Symbol: `tBNB`
   - Block Explorer: `https://testnet.opbnbscan.com`

### 테스트넷 토큰
1. https://testnet.binance.org/faucet-smart 접속
2. "opBNB Testnet" 선택 → 지갑 주소 입력 → 수령

## STEP 0-4: NEAR AI Cloud 계정 (Day 4용, 선택) `사용자`

1. https://cloud-api.near.ai 접속 → 계정 생성
2. API Key 발급 → `.env`의 `NEAR_AI_API_KEY`에 저장
3. (Day 4에서 사용, 지금은 계정만 생성해두면 됨)

## STEP 0-5: 기존 개발 환경 확인 `AI`

> 이 프로젝트는 이미 인프라가 구축된 상태. 새로 설치하는 것 없음.

### 현재 인프라
- **DB**: AWS RDS (ap-northeast-2) — 로컬에서도 RDS에 직접 연결
  - .env에서 `LOCAL_DB_HOST`를 RDS 주소로 전환하여 사용
  - 주석 처리된 RDS 주소: `db-cherry-board.cluster-cuegkxo0owpw.ap-northeast-2.rds.amazonaws.com`
- **Redis**: 서버에 패키지로 설치됨 + 로컬에도 설치됨 (port 16379)
- **배포**: dokploy
- **테이블 생성**: SQL 직접 실행 (knex migrate 사용 안 함, staged_mock/*.sql 패턴)
- **환경 구분**: `ENVIRONMENT=local|staging|production` (.env config.ts에서 분기)

### 확인만 하면 됨 `AI`
```bash
node --version   # v20.x 이상
pnpm --version   # 9.x 이상
pnpm install     # 이미 되어있으면 빠르게 끝남
```

## STEP 0-6: .env에 블록체인 환경변수 추가 `사용자+AI`

> 기존 apps/api/.env는 건드리지 않음. 블록체인 관련 변수만 추가.
> 사용자: MetaMask Private Key 제공 → AI: .env에 추가

기존 `.env` 하단에 아래만 추가:
```bash
# === Cherry KaaS — Smart Contract ===
DEPLOYER_PRIVATE_KEY=0x사용자가_제공한_MetaMask_private_key
STATUS_RPC_URL=https://public.sepolia.rpc.status.network
CHERRY_CREDIT_ADDRESS=               # Story 1.1 배포 후 기입
KARMA_CONTRACT_ADDRESS=0x7ec5Dc75D09fAbcD55e76077AFa5d4b77D112fde
CHAIN_ADAPTER=status
DEMO_FALLBACK=false
```

## STEP 0-7: 기존 서버 정상 동작 확인 `AI`

```bash
pnpm --filter api dev
# NestJS 서버 시작 → Swagger UI 접근 가능하면 기존 환경 정상
```

정상 시작되면 Day 1 준비 완료.

## 사전 준비 검증 체크리스트

| # | 항목 | 확인 |
|---|------|------|
| 1 | MetaMask 설치 + 테스트넷 지갑 생성 | |
| 2 | Private Key를 .env에 저장 | |
| 3 | Status Network을 MetaMask에 추가 | |
| 4 | Status Network Faucet에서 토큰 수령 (또는 gasless 확인) | |
| 5 | Explorer에서 내 지갑 주소 조회 가능 | |
| 6 | (선택) opBNB Testnet MetaMask 추가 + 토큰 수령 | |
| 7 | (선택) NEAR AI Cloud 계정 생성 | |
| 8 | Node 20+ / pnpm 9+ 확인 | |
| 9 | docker-compose up → PostgreSQL + Redis 정상 | |
| 10 | pnpm install + pnpm -r build 에러 없음 | |
| 11 | .env 파일 생성 + DEPLOYER_PRIVATE_KEY 기입 | |
| 12 | pnpm-workspace.yaml에 contracts 경로 포함 | |
| 13 | 기존 마이그레이션 실행 + 테이블 확인 | |
| 14 | API 서버 실행 + Swagger UI 접근 | |

**위 14개 항목이 모두 확인되면 Day 1 시작 가능.**

---

## 현재 프로젝트 구조 (Day 0 완료 시점)

```
cherry-in-the-haystack/
├── apps/
│   ├── api/src/modules/           # 기존 NestJS 백엔드
│   │   ├── agent_comm/            # 기존 에이전트 통신
│   │   ├── app_user/              # 기존 인증
│   │   ├── pipeline/              # 기존 파이프라인
│   │   ├── prompt_template/       # 기존 프롬프트 템플릿
│   │   └── (kaas/ 신규 생성 예정)
│   └── web/components/cherry/     # 프론트엔드 (Day 0 완료)
│       ├── kaas-catalog-page.tsx   # 카탈로그 (9개 개념, Compare, Purchase/Follow)
│       ├── kaas-console.tsx        # 플로팅 콘솔 (3자 대화, Purchase/Follow)
│       ├── kaas-dashboard-page.tsx # 대시보드 모달 (멀티에이전트, Wallet)
│       └── sidebar.tsx             # AGENT SHOPPING + HOT
├── packages/
│   └── pipeline/                  # 기존
└── apps/contracts/                # CherryCredit.sol (Hardhat)
```

---

# Day 1 — 스마트 컨트랙트 & 블록체인

## Story 1.1 — CherryCredit.sol 작성 & Status Network 배포 `AI` (배포 실행은 `사용자+AI`)

### 사전 조건
- Node.js 20+, pnpm 9+ 설치 확인
- `1-work-guidelines.md` 4장 "인프라 & 외부 계정" 전체 읽기
- MetaMask에 테스트넷 전용 지갑 생성 → private key를 `.env`의 `DEPLOYER_PRIVATE_KEY`에 저장
- Status Network Faucet(https://faucet.status.network/)에서 테스트넷 토큰 수령
- `.env.example`을 복사해서 `.env` 생성 완료
- `pnpm-workspace.yaml`에 `'contracts'` 경로 포함 확인
- Docker(PostgreSQL) 실행 중: `pg_isready -h localhost -p 5432`

### 구현 단계

**1단계: Hardhat 프로젝트 생성**
```bash
mkdir -p contracts
cd contracts
pnpm init
pnpm add -D hardhat @nomicfoundation/hardhat-toolbox typescript ts-node
npx hardhat init  # TypeScript 프로젝트 선택
```

**2단계: hardhat.config.ts 설정**
```typescript
// contracts/hardhat.config.ts
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
dotenv.config();

const config: HardhatUserConfig = {
  solidity: "0.8.24",
  networks: {
    statusSepolia: {
      url: "https://public.sepolia.rpc.status.network",
      chainId: 1660990954,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
    },
  },
};
export default config;
```

**3단계: CherryCredit.sol 작성**
```
contracts/contracts/CherryCredit.sol
```
필수 함수 4개:
- `deposit(address agent, uint256 amount)` — 크레딧 충전. `emit CreditDeposited(agent, amount)`
- `consumeCredit(address agent, uint256 amount, string conceptId, string actionType)` — 구매/팔로우 시 차감. `emit CreditConsumed(agent, amount, conceptId, actionType)`
- `distributeReward(address curator, uint256 amount, string conceptId)` — 큐레이터 보상. `emit RewardDistributed(curator, amount, conceptId)`
- `recordProvenance(bytes32 hash, address agent, string conceptId)` — 프로비넌스 기록. `emit ProvenanceRecorded(hash, agent, conceptId)`

필수 이벤트 3개: `CreditConsumed`, `RewardDistributed`, `ProvenanceRecorded`
접근 제어: `owner` 또는 `authorizedServer`만 financial 함수 호출 가능

**4단계: 배포 스크립트**
```
contracts/scripts/deploy.ts
```

**4-b단계: 컴파일 후 ABI 확인**
```bash
npx hardhat compile
# 생성 위치: contracts/artifacts/contracts/CherryCredit.sol/CherryCredit.json
# 이 JSON의 "abi" 필드를 chain-adapter에서 import하여 사용
```

**5단계: 배포 실행 & gasless 검증**
```bash
cd contracts
npx hardhat run scripts/deploy.ts --network statusSepolia
```
배포 후:
- 컨트랙트 주소를 `.env`의 `CHERRY_CREDIT_ADDRESS`에 기록
- Gasless 검증:
```typescript
// linea_estimateGas 호출 예시
const result = await provider.send('linea_estimateGas', [{
  from: deployerAddress,
  to: contractAddress,
  data: '0x',  // 빈 호출
}]);
console.log('baseFeePerGas:', result.baseFeePerGas);
// 기대값: "0x0" (gasless 확인)
```

**6단계: 테스트**
```bash
npx hardhat test
```

### 테스트 체크리스트

| 테스트 | 방법 | 기대 결과 |
|--------|------|-----------|
| 컴파일 | `npx hardhat compile` | 에러 없이 아티팩트 생성 |
| 유닛 테스트 | `npx hardhat test` | deposit, consumeCredit, distributeReward, recordProvenance 모두 PASS |
| 배포 | `npx hardhat run scripts/deploy.ts --network statusSepolia` | 컨트랙트 주소 출력 |
| Gasless 검증 | `linea_estimateGas` RPC 호출 | baseFeePerGas === 0x0 |
| 이벤트 확인 | 블록 익스플로러에서 트랜잭션 조회 | CreditConsumed 등 이벤트 로그 확인 |
| .env 기록 | `.env` 파일 확인 | `CHERRY_CREDIT_ADDRESS=0x...` 존재 |

---

## Story 1.2 — Chain Adapter 구현 `AI`

### 사전 조건
- Story 1.1 완료 (컨트랙트 주소 확보)

### 구현 단계

**1단계: chain-adapter 디렉토리 생성**
```bash
# KaaS 모듈 내부에 chain-adapter 서브디렉토리 생성
mkdir -p apps/api/src/modules/kaas/chain-adapter
```
ethers.js는 apps/api의 dependencies에 추가

**2단계: IChainAdapter 인터페이스**
```
apps/api/src/modules/kaas/chain-adapter/interface.ts
```
```typescript
export interface TxResult {
  hash: string;
  chain: string;
  explorerUrl: string;
}

export interface IChainAdapter {
  recordProvenance(hash: string, agent: string, conceptId: string): Promise<TxResult>;
  depositCredit(agent: string, amount: number): Promise<TxResult>;
  consumeCredit(agent: string, amount: number, conceptId: string, actionType: string): Promise<TxResult>;
  withdrawReward(curator: string, amount: number): Promise<TxResult>;
  getKarmaTier(address: string): Promise<{ tier: string; balance: number }>;
}
```

**3단계: StatusAdapter 구현**
```
apps/api/src/modules/kaas/chain-adapter/status-adapter.ts
```
- ethers.js v6으로 Status Network 연결
- `linea_estimateGas` 사용 (eth_gasPrice 금지)
- `from` 필드 필수
- CherryCredit.sol ABI import하여 함수 호출

**4단계: MockAdapter 구현**
```
apps/api/src/modules/kaas/chain-adapter/mock-adapter.ts
```
- DEMO_FALLBACK=true일 때 사용
- 모든 함수가 랜덤 hash 반환 (실제 온체인 호출 없음)
- explorerUrl은 `https://sepoliascan.status.network/tx/{hash}` 형태

**5단계: index.ts — 팩토리 함수**
```
apps/api/src/modules/kaas/chain-adapter/index.ts
```
```typescript
export function createChainAdapter(): IChainAdapter {
  const adapter = process.env.CHAIN_ADAPTER ?? "status";
  if (process.env.DEMO_FALLBACK === "true") return new MockAdapter();
  switch (adapter) {
    case "status": return new StatusAdapter();
    case "bnb": return new BnbAdapter();    // Day 4
    case "near": return new NearAdapter();  // Day 4
    default: return new MockAdapter();
  }
}
```

### 테스트 체크리스트

| 테스트 | 방법 | 기대 결과 |
|--------|------|-----------|
| 타입 체크 | `pnpm tsc --noEmit` | 에러 없음 |
| MockAdapter 단위 | Mock 테스트 파일 작성 후 `pnpm test` | recordProvenance → hash 반환 |
| StatusAdapter 연결 | `CHAIN_ADAPTER=status` 환경변수 + 실행 | Status Network RPC 연결 성공 |
| DEMO_FALLBACK | `DEMO_FALLBACK=true` 환경변수 + 실행 | MockAdapter 선택 확인 |
| 팩토리 함수 | `createChainAdapter()` 호출 | 환경변수에 따라 올바른 어댑터 반환 |

---

## Story 1.3 — DB 마이그레이션 `AI`

### 사전 조건
- PostgreSQL 실행 중 (docker-compose up)
- 기존 knex 마이그레이션 환경 확인

### 구현 단계

**1단계: SQL 파일 작성** `AI`

> 이 프로젝트는 knex migrate를 사용하지 않음. staged_mock/*.sql 패턴으로 SQL을 직접 작성하고 실행.

파일 위치: `apps/docs/staged_mock/kaas-tables.sql`

```sql
-- ============================================
-- Cherry KaaS 테이블 생성
-- ============================================

-- 1. kaas.agent (에이전트 등록 정보)
CREATE TABLE IF NOT EXISTS kaas.agent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES core.app_user(id),
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(10) DEFAULT '🤖',
  api_key TEXT NOT NULL UNIQUE,
  wallet_address VARCHAR(42),
  karma_tier VARCHAR(20) DEFAULT 'Bronze',
  karma_balance INTEGER DEFAULT 0,
  domain_interests JSONB DEFAULT '[]'::jsonb,
  knowledge JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kaas.agent_api_key ON kaas.agent (api_key);
CREATE INDEX IF NOT EXISTS idx_kaas.agent_user_id ON kaas.agent (user_id);

-- 2. kaas.credit_ledger (크레딧 입출금 이력)
CREATE TABLE IF NOT EXISTS kaas.credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES kaas.agent(id),
  amount INTEGER NOT NULL,
  type VARCHAR(20) NOT NULL,
  description VARCHAR(500),
  tx_hash VARCHAR(66),
  chain VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. kaas.query_log (구매/팔로우 이력 + 프로비넌스)
CREATE TABLE IF NOT EXISTS kaas.query_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES kaas.agent(id),
  concept_id VARCHAR(100),
  action_type VARCHAR(20) NOT NULL,
  credits_consumed INTEGER NOT NULL,
  provenance_hash VARCHAR(66),
  chain VARCHAR(20),
  response_snapshot JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. kaas.curator_reward (큐레이터 보상)
CREATE TABLE IF NOT EXISTS kaas.curator_reward (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  curator_id UUID NOT NULL,
  query_log_id UUID REFERENCES kaas.query_log(id),
  amount INTEGER NOT NULL,
  withdrawn BOOLEAN DEFAULT false,
  withdrawal_tx_hash VARCHAR(66),
  created_at TIMESTAMP DEFAULT NOW()
);
```

**2단계: SQL 실행** `사용자`

> 사용자가 DBeaver/psql 등에서 RDS에 직접 실행

```bash
# psql로 실행하는 경우:
psql -h db-cherry-board.cluster-cuegkxo0owpw.ap-northeast-2.rds.amazonaws.com \
     -U cherrythebest -d cherry \
     -f apps/docs/staged_mock/kaas-tables.sql
```

또는 DBeaver에서 SQL 파일 열어서 실행.

### 테스트 체크리스트

| 테스트 | 방법 | 기대 결과 |
|--------|------|-----------|
| SQL 실행 | DBeaver 또는 psql에서 kaas-tables.sql 실행 | 에러 없이 완료 |
| 테이블 확인 | `SELECT tablename FROM pg_tables WHERE tablename LIKE 'kaas_%';` | 4개 테이블 존재 |
| 컬럼 확인 | `\d kaas.agent` | 모든 컬럼 존재, 타입 일치 |
| 인덱스 확인 | `\di idx_kaas_*` | idx_kaas.agent_api_key, idx_kaas.agent_user_id |
| FK 확인 | kaas.credit_ledger.agent_id → kaas.agent.id | 참조 무결성 |
| INSERT 테스트 | 테스트 row INSERT → SELECT → DELETE | 정상 동작 |

---

# Day 2 — Knowledge API & Catalog + Credit System

## Story 2.1 — 지식 카탈로그 DB 테이블 + KnowledgeService `AI` (SQL 실행은 `사용자`)

> 카탈로그 개념은 에이전트가 구매하는 "상품". DB에 저장하여 큐레이터가 관리 가능하게 함.
> summary = 카탈로그 미리보기 (짧은 요약), content_md = 구매 후 전달하는 실제 지식 본문 (마크다운)

### 구현 단계

**1단계: DB 테이블 생성 + 시드 데이터 INSERT** `사용자`

> kaas-tables-v2-schema.sql에 이미 kaas.concept + kaas.evidence DDL 포함.
> kaas-seed-demo-data.sql에 9개 concept + evidence INSERT 추가.
> 사용자가 DBeaver에서 실행.

**2단계: KnowledgeService를 DB 조회로 변경** `AI`

파일: `apps/api/src/modules/kaas/kaas-knowledge.service.ts`

- readFileSync(seed-data.json) 제거 → Knex DB 조회
- 모든 메서드 sync → async 변경
- snake_case(DB) → camelCase(API) 매핑

```typescript
// DB에서 개념 + evidence 조회 (카탈로그용 — content_md 제외)
async findAll(): Promise<Concept[]> {
  const rows = await this.knex('kaas.concept').where('is_active', true);
  const evidence = await this.knex('kaas.evidence').whereIn('concept_id', rows.map(r => r.id));
  return rows.map(r => this.mapConcept(r, evidence.filter(e => e.concept_id === r.id)));
}

// 구매용 — content_md 포함
async findByIdWithContent(id: string): Promise<ConceptWithContent | null> {
  const row = await this.knex('kaas.concept').where({ id, is_active: true }).first();
  if (!row) return null;
  const evidence = await this.knex('kaas.evidence').where('concept_id', id);
  return { ...this.mapConcept(row, evidence), contentMd: row.content_md };
}
```

**3단계: 컨트롤러 await 추가** `AI`

- kaas-catalog.controller.ts — findAll(), findOne()에 await
- kaas-compare.controller.ts — findAll()에 await
- kaas-query.controller.ts — findById()를 findByIdWithContent()로 변경, 구매 응답에 content_md 포함

**4단계: 정리** `AI`

- `apps/api/src/modules/kaas/data/seed-data.json` 삭제
- `nest-cli.json`에서 assets 설정 제거

### 테스트 체크리스트

| 테스트 | 방법 | 기대 결과 |
|--------|------|-----------|
| DB 테이블 확인 | `SELECT count(*) FROM kaas.concept` | 9 |
| DB evidence 확인 | `SELECT count(*) FROM kaas.evidence` | 20+ |
| GET /catalog | curl | 9개 개념, content_md **미포함** |
| GET /catalog/rag | curl | RAG 상세 + evidence 3건, content_md **미포함** |
| POST /purchase | curl + API Key | evidence + content_md **포함** |
| 검색 | GET /catalog?q=embedding | Embeddings 포함 |
| 없는 ID | GET /catalog/nonexistent | 404 CONCEPT_NOT_FOUND |

### 재테스트 (기존 API 전체)

> Story 2.1 변경으로 KnowledgeService가 바뀌므로, 기존 13개 테스트 + 신규 2개 = 15개 전부 재실행 필요.

| # | 테스트 | 기대 결과 |
|---|--------|-----------|
| 1 | GET /catalog | 9개 (DB에서) |
| 2 | GET /catalog/rag | 상세 + evidence |
| 3 | CONCEPT_NOT_FOUND | 404 |
| 4 | POST /agents/register | API Key 발급 |
| 5 | POST /credits/deposit | 250cr |
| 6 | GET /credits/balance | 250cr |
| 7 | POST /purchase | 20cr 차감 + evidence + **content_md** + provenance |
| 8 | POST /follow | 25cr 차감 + provenance |
| 9 | GET /credits/balance | 205cr |
| 10 | GET /credits/history | 2건 |
| 11 | POST /catalog/compare | gap analysis |
| 12 | 401 (인증 없이) | 에러 |
| 13 | GET /agents | 목록 |
| 14 | GET /catalog | content_md 미포함 확인 |
| 15 | POST /purchase | content_md 포함 확인 |

---

## Story 2.2 — 에이전트 등록 API `AI`

### 구현 단계

**1단계: NestJS 모듈 생성**
```
apps/api/src/modules/kaas/
├── kaas.module.ts
├── kaas-agent.controller.ts
├── kaas-agent.service.ts
├── input-dto/register-agent.dto.ts
```

**2단계: POST /api/v1/kaas/agents/register 엔드포인트**

Request body (Zod):
```typescript
{
  name: string;               // "Coding Assistant"
  wallet_address?: string;    // "0x742d..."
  domain_interests: string[]; // ["AI Engineering", "Embeddings"]
}
```

API Key 생성:
```typescript
import crypto from 'crypto';
const apiKey = 'ck_live_' + crypto.randomBytes(32).toString('hex');
// 결과: "ck_live_a1b2c3d4..." (71자, 256비트 엔트로피)
```

Response:
```typescript
{
  id: string;
  name: string;
  api_key: string;          // 256비트 엔트로피 (crypto.randomBytes(32))
  wallet_address: string;
  karma_tier: "Bronze";
  created_at: string;
}
```

**3단계: 멀티에이전트 지원**
- 같은 user_id로 여러 에이전트 등록 가능
- GET /api/v1/kaas/agents — 내 에이전트 목록 (JWT 인증)

**4단계: API Key 인증 미들웨어**
- `KaasApiKeyGuard` — Authorization: Bearer {api_key} 헤더 검증
- kaas.agent 테이블에서 api_key 매칭

### 테스트 체크리스트

| 테스트 | 방법 | 기대 결과 |
|--------|------|-----------|
| Swagger 확인 | 브라우저에서 Swagger UI | /api/v1/kaas/agents/register 엔드포인트 표시 |
| 등록 성공 | Swagger에서 POST | 201, api_key 포함 응답 |
| 중복 등록 | 같은 user_id로 2번 POST | 둘 다 성공 (멀티에이전트) |
| 입력 검증 | name 빈 문자열 | 400 에러 |
| API Key 인증 | 발급된 api_key로 인증 요청 | 200 성공 |
| 잘못된 API Key | 랜덤 문자열로 인증 | 401 Unauthorized |
| 목록 조회 | GET /api/v1/kaas/agents (JWT) | 등록한 에이전트 목록 |
| DB 확인 | `SELECT * FROM kaas.agent` | 레코드 존재 |

---

## Story 2.3 — 카탈로그 브라우징 API `AI`

### 구현 단계

**1단계: 컨트롤러 생성**
```
apps/api/src/modules/kaas/kaas-catalog.controller.ts
```

**2단계: 엔드포인트 3개**
- `GET /api/v1/kaas/catalog` — 전체 목록 (인증 불필요)
- `GET /api/v1/kaas/catalog/:conceptId` — 상세 (인증 불필요)
- `GET /api/v1/kaas/catalog?q=embedding` — 검색 (인증 불필요)

**3단계: KnowledgeRepository 연동**
- findAll(), findById(), search() 호출
- CONCEPT_NOT_FOUND 에러 코드 (404)

### 테스트 체크리스트

| 테스트 | 방법 | 기대 결과 |
|--------|------|-----------|
| Swagger 확인 | Swagger UI | 3개 엔드포인트 표시 |
| 목록 조회 | GET /catalog (인증 없이) | 200, 9개 개념 |
| 상세 조회 | GET /catalog/rag | 200, RAG 개념 + evidence |
| 검색 | GET /catalog?q=chain | Chain-of-Thought 포함 |
| 없는 ID | GET /catalog/nonexistent | 404, CONCEPT_NOT_FOUND |
| 인증 불필요 확인 | Authorization 헤더 없이 호출 | 200 성공 |

---

## Story 2.4 — 지식 구매/팔로우 API `AI`

### 구현 단계

**1단계: 컨트롤러 + 서비스**
```
apps/api/src/modules/kaas/kaas-query.controller.ts
apps/api/src/modules/kaas/kaas-query.service.ts
apps/api/src/modules/kaas/input-dto/purchase.dto.ts
apps/api/src/modules/kaas/input-dto/follow.dto.ts
```

**2단계: POST /api/v1/kaas/purchase**
- 인증: KaasApiKeyGuard
- Request: `{ concept_id: string, budget: number }`
- 크레딧 차감: 20cr (Purchase)
- KnowledgeRepository에서 개념 조회 → 전체 evidence 포함 응답
- kaas.query_log에 기록 (action_type: "purchase")
- provenance hash 비동기 기록 (EventEmitter)
- Response: `{ answer, concepts, evidence[], quality_score, credits_consumed, provenance: { hash, chain, explorer_url } }`

**3단계: POST /api/v1/kaas/follow**
- 인증: KaasApiKeyGuard
- Request: `{ concept_id: string, budget_per_update: number }`
- 크레딧 차감: 25cr (Follow)
- 팔로우 등록 (kaas.query_log에 action_type: "follow")
- Response: 동일 구조

**4단계: DEMO_FALLBACK 분기**
```typescript
if (process.env.DEMO_FALLBACK === 'true') {
  return SEED_DATA_RESPONSE;
}
```

### 테스트 체크리스트

| 테스트 | 방법 | 기대 결과 |
|--------|------|-----------|
| Swagger 확인 | Swagger UI | /purchase, /follow 엔드포인트 |
| 구매 성공 | POST /purchase { concept_id: "rag", budget: 20 } | 200, evidence 포함 응답 |
| 팔로우 성공 | POST /follow { concept_id: "rag" } | 200, 팔로우 등록 |
| 인증 필요 | 인증 없이 POST /purchase | 401 |
| 크레딧 부족 | 잔액 0인 에이전트로 | INSUFFICIENT_CREDITS 에러 |
| 없는 개념 | concept_id: "nonexistent" | CONCEPT_NOT_FOUND |
| DB 확인 | `SELECT * FROM kaas.query_log` | purchase/follow 레코드 |
| DEMO_FALLBACK | `DEMO_FALLBACK=true` | seed-data 응답 |

---

## Story 2.5 — Knowledge Gap Analysis API `AI`

### 구현 단계

**1단계: POST /api/v1/kaas/catalog/compare**
- Public (인증 불필요) 또는 에이전트 API Key
- Request: `{ agent_id: string }` 또는 `{ known_topics: [{ topic, lastUpdated }] }`
- KnowledgeRepository 전체 목록과 비교
- 3단계 분류: up-to-date / outdated / gap

**2단계: 응답 구조**
```json
{
  "matched": [{ "conceptId": "rag", "status": "outdated", "agentDate": "2025-11", "catalogDate": "2026-04" }],
  "gaps": [{ "conceptId": "chain-of-thought", "title": "...", "qualityScore": 4.5 }],
  "recommendations": [{ "conceptId": "chain-of-thought", "action": "purchase", "estimatedCredits": 20 }]
}
```

### 테스트 체크리스트

| 테스트 | 방법 | 기대 결과 |
|--------|------|-----------|
| Swagger 확인 | Swagger UI | /catalog/compare 엔드포인트 |
| 비교 성공 | POST /catalog/compare { known_topics: [...] } | matched + gaps + recommendations |
| 빈 토픽 | known_topics: [] | 모든 개념이 gap |
| 전체 일치 | 9개 모두 최신 날짜 | gaps 빈 배열 |
| 에이전트별 | agent_id로 조회 | 해당 에이전트 knowledge 기준 비교 |

---

## Story 3.1 — 크레딧 잔액 조회 & 차감 `AI`

### 구현 단계

**1단계: kaas-credit.service.ts**
- `getBalance(agentId)` — kaas.credit_ledger SUM
- `consume(agentId, amount, conceptId, actionType)` — 잔액 확인 → 차감 → ledger INSERT
- Karma 할인: Silver 15%, Gold 30%

**2단계: GET /api/v1/kaas/credits/balance**
- KaasApiKeyGuard 인증
- Response: `{ balance, totalDeposited, totalConsumed }`

**3단계: Story 2.4의 purchase/follow에서 consume 호출 연동**

### 테스트 체크리스트

| 테스트 | 방법 | 기대 결과 |
|--------|------|-----------|
| 잔액 조회 | GET /credits/balance | 현재 잔액 반환 |
| 차감 | purchase 후 balance 재조회 | 20cr 감소 |
| Karma 할인 | Silver 에이전트로 purchase | 20 * 0.85 = 17cr 차감 |
| 잔액 부족 | 잔액 < 20인 상태에서 purchase | INSUFFICIENT_CREDITS |
| Ledger 확인 | `SELECT * FROM kaas.credit_ledger` | consume 레코드 |

---

## Story 3.2 — 크레딧 충전 온체인 `AI` (MetaMask 서명은 `사용자`)

### 구현 단계

**1단계: POST /api/v1/kaas/credits/deposit**
- Request: `{ agent_id, amount, wallet_signature, chain }`
- EIP-712 서명 검증 (서버 사이드):
```typescript
// EIP-712 Domain
const domain = {
  name: "CherryCredit",
  version: "1",
  chainId: 1660990954,  // Status Network
  verifyingContract: process.env.CHERRY_CREDIT_ADDRESS,
};
// Message Types
const types = {
  DepositCredit: [
    { name: "agent", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "nonce", type: "uint256" },
  ],
};
// ethers.js v6로 서명 검증
const recoveredAddress = ethers.verifyTypedData(domain, types, message, signature);
```
- chain-adapter.depositCredit() 호출
- kaas.credit_ledger에 type=deposit, tx_hash 기록
- Response: `{ balance, tx_hash, chain }`

### 테스트 체크리스트

| 테스트 | 방법 | 기대 결과 |
|--------|------|-----------|
| Swagger 확인 | Swagger UI | /credits/deposit 엔드포인트 |
| 충전 성공 (Mock) | DEMO_FALLBACK=true | 잔액 증가 + 가짜 tx_hash |
| 충전 성공 (Status) | CHAIN_ADAPTER=status | 실제 온체인 트랜잭션 |
| Ledger 확인 | DB 조회 | type=deposit 레코드 |
| 잔액 반영 | 충전 후 balance 조회 | 증가 확인 |

---

## Story 3.3 — 비동기 프로비넌스 기록 `AI`

### 구현 단계

**1단계: kaas-provenance.service.ts**
- EventEmitter로 `provenance.record` 이벤트 발행
- 리스너: chain-adapter.recordProvenance(hash) 호출
- 실패 시 3회 재시도 (exponential backoff)
- 성공 시 kaas.query_log에 provenance_hash, chain UPDATE

**2단계: Story 2.4 연동**
- purchase/follow 응답에 provisional hash 포함
- 온체인 기록은 백그라운드

### 테스트 체크리스트

| 테스트 | 방법 | 기대 결과 |
|--------|------|-----------|
| 이벤트 발행 | purchase 실행 | provenance.record 이벤트 발행 확인 |
| 해시 기록 | DB 조회 | kaas.query_log.provenance_hash NOT NULL |
| API 비블로킹 | purchase 응답 시간 측정 | 온체인 기록 전에 응답 반환 |
| 재시도 | Mock에서 1회 실패 후 성공 | 2번째 시도에서 성공 |
| Explorer | hash로 블록 익스플로러 조회 | 트랜잭션 존재 |

---

# Day 3 — 프론트엔드 API 연결 + MCP + Curator

## Story 5.5 — KaasModule import + API 연결 세팅 `AI`

### 구현 단계

**1단계: app.module.ts에 KaasModule import**
```typescript
import { KaasModule } from './modules/kaas/kaas.module';
// imports 배열에 추가
```

**2단계: 프론트엔드 API 클라이언트 함수**
```
apps/web/lib/api.ts에 추가:
- fetchCatalog()
- fetchConcept(id)
- purchaseConcept(conceptId, apiKey)
- followConcept(conceptId, apiKey)
- fetchBalance(apiKey)
- comparKnowledge(agentId)
- registerAgent(data)
- fetchAgents()
```

### 테스트 체크리스트

| 테스트 | 방법 | 기대 결과 |
|--------|------|-----------|
| 서버 시작 | `pnpm --filter api dev` | KaasModule 로드 로그 |
| Swagger 전체 | 브라우저에서 Swagger UI | /api/v1/kaas/* 전체 엔드포인트 |
| CORS | 프론트에서 fetch | 200 응답 |
| 빌드 | `pnpm --filter web build` | 에러 없음 |

---

## Story 5.6 — 콘솔 API 연결 `AI`

### 구현 단계

**1단계: kaas-console.tsx에서 목 데이터 → fetch 전환**
- `search()` 함수 → `purchaseConcept()` 또는 `followConcept()` API 호출
- 크레딧 잔액 → `fetchBalance()` 실시간 조회
- Provenance → API 응답의 provenance 필드 사용

### 테스트 체크리스트

| 테스트 | 방법 | 기대 결과 |
|--------|------|-----------|
| 구매 흐름 | 콘솔에서 구매 지시 | 실제 API 호출 → 응답 표시 |
| 프로비넌스 | 구매 후 해시 표시 | 실제 온체인 해시 |
| 크레딧 차감 | 구매 후 잔액 변화 | before→after 정확 |
| Explorer 링크 | 해시 클릭 | 블록 익스플로러에서 트랜잭션 확인 |

---

## Story 5.7 — Catalog API 연결 `AI`

### 구현 단계

**1단계: MOCK_CONCEPTS → fetchCatalog() 전환**
**2단계: Compare → API 호출 전환**
**3단계: 모달 Purchase/Follow → 실제 API 호출 + 콘솔 연동**

### 테스트 체크리스트

| 테스트 | 방법 | 기대 결과 |
|--------|------|-----------|
| 카탈로그 로드 | 페이지 접근 | API에서 9개 개념 로드 |
| 검색 | 검색어 입력 | API 기반 필터링 |
| Compare | 에이전트 선택 + Compare | 실제 agent knowledge 기반 비교 |
| 구매 → 콘솔 | 모달에서 Purchase 클릭 | 콘솔 팝업 + 실제 구매 |

---

## Story 5.8 — Dashboard API 연결 `AI`

### 구현 단계

**1단계: MOCK_AGENTS → fetchAgents() 전환**
**2단계: 에이전트 등록 → registerAgent() API 호출**
**3단계: 잔액/이력 → 실제 API 호출**

### 테스트 체크리스트

| 테스트 | 방법 | 기대 결과 |
|--------|------|-----------|
| 에이전트 목록 | My Dashboard 클릭 | API에서 에이전트 로드 |
| 에이전트 등록 | + 버튼 → 등록 | 실제 API 등록 + 목록 갱신 |
| 잔액 | 에이전트 선택 | 실제 잔액 표시 |
| 쿼리 이력 | Queries 탭 | 실제 구매 이력 |

---

## Story 4.1 — MCP Streamable HTTP 서버 `AI`

> 기존 stdio MCP 서버를 Streamable HTTP로 전환하여 원격 에이전트가 접속 가능하게.

### 구현 단계

**1단계: Streamable HTTP transport 전환**
- `@modelcontextprotocol/sdk`의 `StreamableHTTPServerTransport` 사용
- 또는 `@nestjs-mcp/server` 패키지 (NestJS 네이티브 지원)
- NestJS에 `/api/v1/kaas/mcp` 엔드포인트 추가
- 기존 stdio 코드는 유지 (로컬 개발용)

**2단계: Bearer token 인증**
- HTTP 헤더 `Authorization: Bearer ck_live_...`
- 기존 `KaasAgentService.authenticate()` 재사용
- 미인증 → 401 Unauthorized

**3단계: 세션 관리**
- 연결된 에이전트 ID 추적 (in-memory Map)
- Dashboard에 Connected/Disconnected 상태 표시
- WebSocket으로 웹에 실시간 push

**4단계: MCP Tools 5개** (기존과 동일)
- `search_catalog`, `get_concept`, `purchase_concept`, `follow_concept`, `compare_knowledge`

**5단계: MCP Resources 2개**
- `kaas://catalog`, `kaas://concept/{id}`

### 테스트 체크리스트

| 테스트 | 방법 | 기대 결과 |
|--------|------|-----------|
| HTTP 접속 | `curl -X POST /api/v1/kaas/mcp` (JSON-RPC initialize) | MCP 초기화 응답 |
| 인증 실패 | Bearer token 없이 접속 | 401 |
| tools/list | 인증 후 tools/list 호출 | 5개 tool 반환 |
| purchase | purchase_concept 호출 | content_md + provenance |
| 세션 | 에이전트 연결 → Dashboard 확인 | Connected 표시 |

---

## Story 4.2 — Elicitation (에이전트 지식 비교) `AI`

> Cherry가 에이전트에게 보유 지식 목록을 요청하여 카탈로그와 비교.

### 구현 단계

**1단계: Elicitation 요청 구현**
- MCP 서버에서 `elicitation/create` 요청 전송
- message: "보유 지식 목록을 제출해주세요"
- schema: `{ known_topics: [{ topic: string, lastUpdated: string }] }`

**2단계: 웹 Compare 버튼 연동**
- 카탈로그 Compare 버튼 클릭
- → REST API → Cherry 서버 → 연결된 에이전트에 Elicitation
- → 에이전트 응답 수신 → gap 분석
- → 웹에 태그 표시 (✅ Up-to-date / ⚠️ Outdated / 🔴 Gap)

**3단계: 에러 처리**
- 에이전트 미연결 → "에이전트가 연결되지 않았습니다"
- 타임아웃 30초 → 빈 목록으로 처리
- 에이전트 거부 (decline) → 메시지 표시
- 토픽 500개 초과 → 최근 500개만

### 테스트 체크리스트

| 테스트 | 방법 | 기대 결과 |
|--------|------|-----------|
| Compare 정상 | 에이전트 연결 → Compare 클릭 | Elicitation → 응답 → 태그 표시 |
| 미연결 | 에이전트 없이 Compare | "연결되지 않았습니다" 메시지 |
| 타임아웃 | 에이전트 응답 안 함 | 30초 후 전체 Gap 표시 |

---

## Story 4.3 — Sampling (3자 대화) `AI`

> 웹 채팅에서 유저 → 에이전트 → Cherry 3자 대화.

### 구현 단계

**1단계: Sampling 요청 구현**
- MCP 서버에서 `sampling/createMessage` 요청 전송
- 유저 메시지를 에이전트 LLM에 전달
- systemPrompt: "너는 Cherry KaaS에서 지식을 구매하는 에이전트..."

**2단계: 웹 채팅 UI**
- 3자 구분 표시: User(사용자) / Agent(에이전트) / Cherry(플랫폼)
- 유저 입력 → Cherry 서버 → Sampling → 에이전트 응답 → 웹 표시
- 에이전트가 Cherry tool 호출하면 Cherry 메시지도 표시

**3단계: 에러 처리**
- 에이전트 미연결 → "에이전트를 먼저 연결해주세요"
- LLM 에러 → "에이전트 응답 실패"
- 토큰 제한: max_tokens 512

### 테스트 체크리스트

| 테스트 | 방법 | 기대 결과 |
|--------|------|-----------|
| 대화 정상 | "RAG에 대해 알려줘" 입력 | 에이전트가 Cherry tool → 응답 |
| 미연결 | 에이전트 없이 입력 | "연결해주세요" 메시지 |
| 구매 지시 | "RAG 구매해" 입력 | 에이전트 → purchase_concept → 결과 |

---

## Story 4.4 — 온체인 트랜잭션 기록 `AI`

> 구매 시 chain-adapter를 통해 Status Network에 실제 트랜잭션 기록.

### 구현 단계

**1단계: provenance 서비스 → chain-adapter 연결**
- `KaasProvenanceService.recordQuery()`에서 chain-adapter 호출
- `StatusAdapter.recordProvenance(hash, agent, conceptId)` 실행
- 비동기 처리 (API 응답은 먼저 반환, 온체인은 백그라운드)

**2단계: 트랜잭션 결과 저장**
- 실제 tx hash를 query_log에 업데이트
- explorer_url을 실제 트랜잭션 URL로 교체

### 테스트 체크리스트

| 테스트 | 방법 | 기대 결과 |
|--------|------|-----------|
| 온체인 기록 | purchase 후 explorer URL 확인 | 실제 트랜잭션 존재 |
| gasless | ETH 잔액 0에서 기록 | 성공 (gasPrice: 0) |

---

## Story 6.1 — 큐레이터 보상 `AI`

### 구현 단계

**1단계: kaas-reward.service.ts**
- 구매/팔로우 시 → 해당 evidence의 큐레이터 식별 → 40% 수익 분배
- kaas.curator_reward에 INSERT

**2단계: 엔드포인트**
- GET /api/v1/kaas/rewards/balance — 총 적립, 미출금
- POST /api/v1/kaas/rewards/withdraw — chain-adapter.withdrawReward() gasless

### 테스트 체크리스트

| 테스트 | 방법 | 기대 결과 |
|--------|------|-----------|
| 보상 계산 | purchase 후 rewards 조회 | 40% 분배 금액 |
| 출금 | POST /rewards/withdraw | gasless tx_hash 반환 |
| DB 확인 | `SELECT * FROM kaas.curator_reward` | withdrawn=true, tx_hash |

---

# Day 4 — 멀티체인

## Story 7.1 — BNB Chain (opBNB) `AI` (배포 실행 `사용자+AI`, 트윗 `사용자`)

### 구현 단계
1. `apps/api/src/modules/kaas/chain-adapter/bnb-adapter.ts` 구현 `AI`
2. CherryCredit.sol을 opBNB 테스트넷(Chain ID 5611)에 배포 `사용자+AI`
3. 최소 2건 트랜잭션 (deposit + recordProvenance) `AI`
4. 데모 영상 촬영 `사용자`
5. #ConsumerAIonBNB 트윗 `사용자`

### 테스트: opBNB 블록 익스플로러에서 2건 트랜잭션 확인

## Story 7.2 — NEAR AI Cloud `AI` (NEAR 계정/영상 `사용자`)

### 구현 단계
1. `apps/api/src/modules/kaas/chain-adapter/near-adapter.ts` 구현 `AI`
2. NEAR AI Cloud(cloud-api.near.ai) TEE 추론 데모 `사용자+AI`
3. 데모 영상 촬영 `사용자`

### 테스트: NEAR AI Cloud에서 추론 응답 확인

---

# 금요일 — 테스트 & 제출

### 해피패스 5회 연속 검증 (NFR3)

```
1회차 = 아래 전체 플로우:
  1. POST /agents/register → API Key 발급
  2. POST /credits/deposit → 250cr 충전 (gasless)
  3. POST /purchase { concept_id: "rag" } → 20cr 차감, 응답 + provenance hash
  4. GET /credits/balance → 230cr 확인
  5. 블록 익스플로러에서 provenance hash 조회 → 트랜잭션 존재 확인
  6. POST /follow { concept_id: "chain-of-thought" } → 25cr 차감
  7. GET /rewards/balance → 큐레이터 보상 발생 확인

5회 연속 실행 → 모두 에러 없이 완료 (2분 이내)
```

### 데모 영상 촬영
- Status Network: 2분 (등록 → 카탈로그 → 구매 → 온체인 해시 → Explorer)
- BNB/NEAR: 각 2-4분

### Ludium 포털 제출 (4/16 23:59 KST)
- 프로젝트 설명, 데모 링크, GitHub README
