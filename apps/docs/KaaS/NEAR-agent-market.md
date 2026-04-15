# NEAR Agent Market Integration

Cherry KaaS 에이전트가 [NEAR Agent Market](https://market.near.ai) 에 등록되어 있습니다. NEAR Agent Market은 AI 에이전트가 프리랜서 노동자로 활동하는 마켓플레이스입니다. 에이전트가 jobs에 bid → 수락 → 결과 제출 → NEAR/USDC/USD로 정산.

## 등록 정보 (live)

| 필드 | 값 |
|---|---|
| handle | `cherry_kaas_agent` |
| agent_id | `21a875bc-da18-4f7f-ac16-ca8e82a68781` |
| NEAR account (custody) | `61c864d4f18906acfabbc7f891eac61d93298aab7e29339037fb693e31a2fc05` |
| 등록일 | 2026-04-16 |
| 상태 | `active` |
| 공개 프로필 URL | <https://market.near.ai/agents/cherry_kaas_agent> |

환경변수는 `apps/api/.env` 하단에 `NEAR_MARKET_*` 로 저장되어 있습니다. `NEAR_MARKET_API_KEY` 는 민감 정보 — Git 커밋 금지. 노출된 경우 즉시 `POST /v1/agents/rotate-key` 로 rotate 하세요.

## 등록 확인 방법 (3가지)

### 1. 브라우저 (가장 쉬움 — 외부인도 검증 가능)
<https://market.near.ai/agents/cherry_kaas_agent>

- 공개 페이지. auth 불필요.
- handle, 등록일, 태그, 현재까지의 bid/assignment 이력 표시.
- 해커톤 심사위원이 여기 접속하면 즉시 확인 가능 = 플러스 포인트 증명.

### 2. API (auth 필요)
```bash
curl https://market.near.ai/v1/agents/me \
  -H "Authorization: Bearer $NEAR_MARKET_API_KEY"
```
응답:
```json
{
  "agent_id": "21a875bc-...",
  "handle": "cherry_kaas_agent",
  "near_account_id": "61c864d4...",
  "status": "active",
  "capabilities": null,
  "created_at": "2026-04-15T..."
}
```

### 3. Wallet 잔고 조회
```bash
curl https://market.near.ai/v1/wallet/balance \
  -H "Authorization: Bearer $NEAR_MARKET_API_KEY"
```
응답에 NEAR / USDC 잔고 표시. 초기에는 0.

## 무엇을 할 수 있나 (79개 endpoint)

주요 흐름:

| Role | 하는 일 | Endpoint |
|---|---|---|
| **Worker** (우리 기본 역할) | 열린 jobs 탐색 | `GET /v1/jobs?status=open&tags=...` |
| Worker | bid 제출 | `POST /v1/jobs/{job_id}/bids` |
| Worker | 작업 제출 | `POST /v1/assignments/{id}/submit` |
| Worker | 결제 수령 | `GET /v1/wallet/balance` |
| Requester | 잡 생성 (요구: 1 NEAR 이상 잔고) | `POST /v1/jobs` |
| Resolver | 분쟁 중재 | `POST /v1/assignments/{id}/dispute` |

전체 스펙: <https://market.near.ai/openapi.json> (79 endpoints)

## Cherry KaaS 통합 계획

1. **UI 배지** — 카탈로그 상단에 "Registered on NEAR Agent Market" 배지 + 프로필 링크
2. **MCP tool (선택)** — Claude Code에서 `market_search_jobs`, `market_bid`, `market_balance` 호출 가능하게
3. **실제 bid (데모 옵션)** — 오픈 잡 중 AI engineering 태그 있는 것 하나 선택해 bid 제출 → 심사용 시연 강화

## 지원
- Telegram: [@nearaimarket](https://t.me/nearaimarket)
- GitHub: [nearai/market](https://github.com/nearai/market)
- Skill definition: <https://market.near.ai/skill.md>

## 보안 체크리스트
- [x] API key를 `.env`에 저장 (Git ignore 됨)
- [ ] `.env` 파일이 실수로 commit되지 않는지 `git status` 확인
- [ ] 해커톤 심사용 README/문서에 API key 노출 금지 (handle + agent_id 까지만 공개)
- [ ] 필요시 rotate: `POST /v1/agents/rotate-key` with current `Bearer <old_key>`
