<!-- agent-index start (수기 관리) -->

# 🔖 에이전트 필독 · 문서 인덱스 (작업 전 먼저 읽는다)

이 저장소(**Cherry in the Haystack**)에서 작업하는 에이전트는 **아래 순서로 먼저 읽는다**:

1. **규약/방법론** → `apps/docs/agent-read/에이전트-작업지침.md` (단계 S0~S6 · 게이트 · 권한 · 지시-데이터 경계 · 검토 렌즈 · 조기 관측 · cherry 고유 §7 주의표)
2. **현재 상태·인수인계** → `apps/docs/base-data/` 에 있음 (최신 인수인계 파일명은 위 작업지침 **§9 포인터**가 가리킨다 — 날짜를 여기 박지 않는다)
3. **해당 기능 상세** → `apps/docs/<feature>/` (`1-work-guidelines`·`2-implementation-guide`·`3-checklist-table` 번호식 3~4종)

**문서 지도 (어디에 무엇이):**

| 폴더 | 무엇이 | 성격 |
|---|---|---|
| `apps/docs/agent-read/` | 작업지침(규약) + `강화로그.md`(실패기록) | 안 변하는 규칙 |
| `apps/docs/base-data/` | 인수인계 · 현황(백엔드/프론트) · 자료조사 · 방법론 · 로컬실행 | 지금 상태 |
| `apps/docs/plan/` | 기획서 · 수정기획서 · 스펙 | 계획 |
| `apps/docs/legacy-docs/` | 과거·대체된 문서 | 역사 (삭제 아님) |
| `apps/docs/<feature>/` | agent-trade, KaaS_plan, arena_plan, bench, equip, shop-redesign, install-skill | 기능별 상세 |
| `apps/docs/` (자산) | mockups · seed_data · staged_mock · KaaS · publish | 산출 자산 |

> 이 인덱스는 **가리키기만** 한다. 규칙·상태의 정본은 각 문서이며, 여기와 다르면 원문이 정답.
> ⚠️ 작업지침 **§5(권한 규약)** 가 최우선: 읽기는 자유, **변경·커밋·배포·브랜치는 사용자 허락/지시 후.**

<!-- agent-index end -->

<!-- project overview start -->

## 프로젝트 개요

**Cherry in the Haystack** — AI 엔지니어용 지식 큐레이션 플랫폼. **두 서피스**:

| 서피스 | 경로 | 대상 | 내용 |
|--------|------|------|------|
| **개발자 앱** | `/` | 개발자·큐레이터 | Digest · Newly Discovered · Basics/Advanced · KaaS 지식 마켓 |
| **컨슈머 앱** | `/start/*` | 일반 사용자 | Workshop(카드 조립) → 벤치마크 → MCP 설치 → Shop |

- **모노레포(pnpm)**: `apps/api`(NestJS+Knex+Supabase PG+Redis+JWT, :4000) · `apps/web`(Next.js 16 App Router+React 19+Tailwind v4+shadcn, :3000) · `apps/agent-package`(MCP) · `apps/contracts`(Hardhat) · `apps/contracts-near` · `apps/docs` · `python_services/*`.
- **개발자 앱(`/`)은 URL 라우트가 아니라 상태 기반** — `app/page.tsx`가 `activeNav` id로 switch 렌더. 새 페이지 = `lib/nd-taxonomy.ts` + `page.tsx` case + 컴포넌트.

## 🔴 반드시 조심 (자세히: 작업지침 §7)

- **로컬·프로덕션이 같은 Supabase PostgreSQL 공유** — 로컬에서 DB 건드리면 프로덕션 반영. 마이그레이션·삭제 극도 주의.
- **`BENCH_KEY_SECRET` 절대 변경 금지** — 회원 Anthropic 키 암호화(AES-256-GCM) 키. 로컬·프로덕션 동일해야.
- **회원 API키·지갑·이메일 평문 노출 금지** (로그·응답·GA 어디에도).

## 배포

- **Dokploy 수동 배포**(web/api 각각 Redeploy) — **사용자가 직접**. 에이전트는 배포하지 않는다.
- `NEXT_PUBLIC_*`는 빌드타임 값 → 바꾸면 web 재빌드 필요.

## 로컬 실행

```bash
cd apps/api && pnpm start:dev     # 백엔드 :4000
cd apps/web && pnpm dev           # 프론트 :3000
npx tsc --noEmit                  # 타입 검증
redis-server --port 16379 --daemonize yes
```

<!-- project overview end -->
