# Install Skill — 구현 가이드

이 문서는 `1-work-guidelines.md` §9 타임라인을 Day 단위 Step으로 분해. 각 Step은 **작업 → 기대 결과 → 검증 명령** 순.

---

## Day 0 — 기획 확정 (30 min)

**담당**: 사용자+AI

### STEP 0.1 — 문서 읽기
- `1-work-guidelines.md` §3 ~ §7 읽고 스코프·API 스펙 확인
- 비목표 리스트 (§3-3) 동의 여부 체크

### STEP 0.2 — 재활용 가정 검증
```bash
grep -n "save_skill_request\|save_skill_ack\|submit_self_report\|scanSavedSkills\|isAgentConnected" \
  apps/api/src/modules/kaas/kaas-ws.gateway.ts \
  apps/api/src/mcp-server.ts

# delete_skill 은 신규 구현 대상이므로 없음을 확인
grep -rn "delete_skill" apps/api apps/web/public/cherry-agent.js
```
**기대 결과**:
- 위 5개 키워드 모두 hit (`isAgentConnected` 는 gateway line 253 부근)
- `delete_skill` 은 apps 전체에서 **매치 0건** — Day 1.5 에서 신규 추가 대상 확정
- 5개 중 미검출 있으면 `1-work-guidelines.md` §5 재활용 섹션 수정 후 재개

### STEP 0.3 — Workshop localStorage 샘플 확인
브라우저 콘솔:
```js
JSON.parse(localStorage.getItem("cherry_workshop_state_v9"))?.builds ?? "EMPTY"
```
**기대 결과**: `[{id:"build-a", ...}, {id:"build-b", ...}, {id:"build-c", ...}]` **또는** `"EMPTY"` (처음 사용자). Empty 일 때 Workshop 한번 들어가서 `defaultWorkshopState` 초기화 트리거 후 다시 확인.

### STEP 0.4 — Claude Code skills 로딩 타이밍 확인
에이전트 실행 상태에서:
1. `~/.claude/skills/cherry-test-manual/SKILL.md` 수동 생성 (name/description frontmatter + 짧은 body)
2. 현재 열려있는 `claude` 세션에서 `/skills` 입력 → 새 스킬 인식 여부 확인
3. 세션 종료 → 재실행 → `/skills` 재확인

**기대 결과 (둘 중 하나)**:
- (a) 재시작 없이 인식 → UX 경고 불필요
- (b) 재시작 필요 → `1-work-guidelines.md` §3-3 "Claude Code 핫 리로드 불가" 전제 확정, side panel 경고 노출

**수동 테스트 실패 시**: Day 7 문서 업데이트 + 릴리즈 노트에 제약 명시.

---

## Day 1 — 카드 직렬화 (90 min)

**담당**: AI

### STEP 1.1 — `serialize.ts` 신규 (20 min)
파일: `apps/api/src/modules/bench/cards/serialize.ts`

함수 시그니처:
```ts
export interface SkillFile {
  dir: string          // "cherry-p-oracle"
  file: string         // "SKILL.md"
  content: string      // 전체 YAML frontmatter + body
  cardId: string
  slot: SlotKey
}

export interface BuildContext {
  buildId: string
  buildName: string
  agentId: string
  installedAt: string
}

export function cardToSkillFile(
  slot: SlotKey,
  cardId: string | null,
  ctx: BuildContext,
): SkillFile | null
```

규칙 (`1-work-guidelines.md` §4 적용):
- `slot === 'mcp'` → 항상 `null` 반환 (파일 생성 안 함, 호출자는 `skipped[]` 에 기록)
- `slot === 'orchestration' || slot === 'memory'` → 항상 `null` (build-meta SKILL.md 로 별도 처리)
- 카드 타입이 prompt/skill 일 때만 SkillFile 반환
- **디렉토리 이름**: `short = cardId.replace(/^inv-[pms]-/, '')` → `dir = 'cherry-p-' + short` (또는 `-s-`)

### STEP 1.2 — `buildMetaSkillFile(equipped, ctx)` (15 min)
같은 파일에 추가 (JSON 이 아닌 **SKILL.md** 생성):
```ts
export function buildMetaSkillFile(
  equipped: AgentBuildInput,
  ctx: BuildContext,
): SkillFile                    // 항상 반환 (메타는 빈 빌드 외에는 항상 생성)
```
- `dir = "cherry-build-meta"`, `file = "SKILL.md"`
- frontmatter: `name: Build meta` + `description: "Workshop build installed ${date} · ${buildName} · ${N} slots equipped."`
- body: `<!-- cherry-workshop build-meta ... -->` 주석 블록에 7슬롯 전체 + orchestration_id + memory_mode + memory_max_iterations 기록 (`1-work-guidelines.md §4-3` 포맷)

### STEP 1.3 — Unit test (45 min)
파일: `apps/api/src/modules/bench/cards/serialize.test.ts`

**기존 스타일 준수**: `compose-runtime.test.ts` 와 동일한 `section()` + `ok()` helper 패턴 사용.

테스트 케이스 (8):
1. prompt card (`inv-p-oracle`) → SkillFile dir=`cherry-p-oracle`, frontmatter `name: Market Oracle` + `description`
2. skillA card (`inv-s-decomp`) → dir=`cherry-s-decomp`, frontmatter 동일 형식
3. mcp slot (card 있음) → null
4. orchestration slot (card 있음) → null
5. memory slot (card 있음) → null
6. 존재하지 않는 카드 id (`inv-x-bogus`) → null
7. `buildMetaSkillFile` → dir=`cherry-build-meta`, file=`SKILL.md`, body 에 7슬롯 id 전부 포함
8. 경계: 모든 슬롯 null (빈 빌드) → buildMetaSkillFile 도 null 반환 (호출자가 400 처리)

**기대 결과**: `npx ts-node --transpile-only apps/api/src/modules/bench/cards/serialize.test.ts` → 8 케이스 모두 `ok` 통과.

---

## Day 1.5 — `delete_skill_request` 이벤트 신규 추가 (45 min)

**담당**: AI

**배경**: Day 0 STEP 0.2 에서 `delete_skill_request` 이벤트가 **기존 코드에 없음** 을 확인. Day 5 고아 정리 의존성이라 Day 1 직후에 확보.

### STEP 1.5.1 — gateway 측 (20 min)
파일: `apps/api/src/modules/kaas/kaas-ws.gateway.ts`

추가:
```ts
interface DeleteSkillRequestPayload {
  request_id: string
  target_dir: string              // 전체 경로. 예: `${os.homedir()}/.claude/skills/cherry-p-oracle`
}

interface DeleteSkillAck {
  request_id: string
  deleted: boolean
  removed_path?: string
  error_reason?: string
}

@Injectable()
export class KaasWsGateway {
  // ... 기존 ...

  async requestDeleteSkill(agentId: string, payload: DeleteSkillRequestPayload): Promise<DeleteSkillAck> {
    const socket = this.agentSockets.get(agentId)
    if (!socket) throw new Error(`agent ${agentId} not connected`)

    // 안전장치: target_dir 이 ~/.claude/skills/cherry-* 형식인지 검증
    if (!/\/\.claude\/skills\/cherry-[a-z0-9-]+$/.test(payload.target_dir)) {
      throw new Error(`delete_skill: unsafe target_dir ${payload.target_dir}`)
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('delete_skill timeout')), 10_000)

      socket.once(`delete_skill_ack:${payload.request_id}`, (ack: DeleteSkillAck) => {
        clearTimeout(timer)
        resolve(ack)
      })
      socket.emit('delete_skill_request', payload)
    })
  }
}
```

### STEP 1.5.2 — cherry-agent.js 측 (20 min)
파일: `apps/web/public/cherry-agent.js`

기존 `save_skill_request` 핸들러 근처에 추가:
```js
socket.on('delete_skill_request', ({ request_id, target_dir }) => {
  try {
    // 방어: target_dir 이 ~/.claude/skills/cherry-* 형식 확인
    const expected = path.join(os.homedir(), '.claude', 'skills')
    const resolved = path.resolve(target_dir)
    if (!resolved.startsWith(expected + path.sep) || !/cherry-[a-z0-9-]+$/.test(path.basename(resolved))) {
      socket.emit(`delete_skill_ack:${request_id}`, {
        request_id, deleted: false,
        error_reason: `unsafe target_dir ${target_dir}`,
      })
      return
    }

    if (fs.existsSync(resolved)) {
      fs.rmSync(resolved, { recursive: true, force: true })
      socket.emit(`delete_skill_ack:${request_id}`, {
        request_id, deleted: true, removed_path: resolved,
      })
    } else {
      socket.emit(`delete_skill_ack:${request_id}`, {
        request_id, deleted: false,
        error_reason: 'target_dir does not exist (already removed)',
      })
    }
  } catch (err) {
    socket.emit(`delete_skill_ack:${request_id}`, {
      request_id, deleted: false, error_reason: err.message,
    })
  }
})
```

### STEP 1.5.3 — 수동 smoke (5 min)
nest 재시작 → 에이전트 `~/.claude/skills/cherry-test-xyz/SKILL.md` 수동 생성 → nest REPL / ad-hoc controller 에서:
```ts
await gateway.requestDeleteSkill(agentId, {
  request_id: 'test-1',
  target_dir: `${homedir}/.claude/skills/cherry-test-xyz`,
})
```
**기대 결과**: `{deleted: true, removed_path: '...'}` + `ls ~/.claude/skills/` 에 cherry-test-xyz 없음.

---

## Day 2 — Install 엔드포인트 (90 min)

**담당**: AI

### STEP 2.1 — `InstallBuildService` (45 min)
파일: `apps/api/src/modules/kaas/install-build.service.ts`

클래스 구조 (가드 전부 포함):
```ts
@Injectable()
export class InstallBuildService {
  private readonly logger = new Logger('InstallBuildService')
  /** agentId 별 진행 중 install Promise — 중복 클릭 방어 */
  private readonly inFlight = new Map<string, Promise<InstallBuildResponse>>()

  constructor(
    private readonly ws: KaasWsGateway,
    private readonly agents: AgentService,  // 소유권 확인용
  ) {}

  async install(userId: string, agentId: string, build: InstallBuildRequest) {
    // Gate 1 — in-flight lock
    const existing = this.inFlight.get(agentId)
    if (existing) return existing

    const run = (async () => {
      // Gate 2 — agent ownership
      const agent = await this.agents.findOwnedBy(userId, agentId)
      if (!agent) throw new HttpException('Agent not found or not owned', 404)

      // Gate 3 — MCP connection
      if (!this.ws.isAgentConnected(agentId)) {
        throw new HttpException(
          { code: 'AGENT_OFFLINE', message: "Agent not connected. Run 'claude' with the cherry-kaas MCP." },
          409,
        )
      }

      // Gate 4 — empty build
      const equippedCount = Object.values(build.equipped).filter(Boolean).length
      if (equippedCount === 0) {
        throw new HttpException('Build is empty — nothing to install.', 400)
      }

      const runId = nanoid(8)
      this.logger.log(`[install-build agent=${agentId.slice(0,8)} build=${build.build_id} run=${runId}] start · slots=${equippedCount}`)

      // 1. 각 슬롯 → SkillFile (null 제외). skipped 기록은 호출자가 모음
      const { files, skipped } = collectSkillFiles(build, { agentId, runId })
      const metaFile = buildMetaSkillFile(build, { agentId, runId })

      // 2. 병렬 save — 개별 10s timeout, 최대 3 동시
      //    files + metaFile 합쳐서 호출하되, 결과는 별도 분류
      const skillSaves = await limitedParallel(3, files, (f) =>
        this.ws.requestSaveSkill(agentId, toPayload(f, runId)).then(
          (ack) => ({ ok: true as const, file: f, ack }),
          (err) => ({ ok: false as const, file: f, error: err.message }),
        ),
      )
      const metaSave = await this.ws.requestSaveSkill(agentId, toPayload(metaFile, runId)).then(
        (ack) => ({ ok: true as const }),
        (err) => ({ ok: false as const, error: err.message }),
      )

      // 3. 집계 — installed 는 regular skill 만 (meta 제외)
      const installed = skillSaves.filter(s => s.ok).map(s => ({
        slot: s.file.slot,
        card_id: s.file.cardId,
        dir: s.file.dir,
        file: s.file.file,
        saved_path: s.ack.saved_path,
        size_bytes: s.ack.size_bytes,
      }))
      const failed = skillSaves.filter(s => !s.ok).map(s => ({
        slot: s.file.slot,
        card_id: s.file.cardId,
        error: s.error,
      }))
      // metaSave 실패 시 failed 에 별도 entry 로 추가
      if (!metaSave.ok) {
        failed.push({ slot: '_meta', card_id: 'cherry-build-meta', error: metaSave.error })
      }

      // 4. 전부 성공일 때만 고아 정리 (Day 5 구현, Day 1.5 의 requestDeleteSkill 사용)
      let orphans_removed: string[] = []
      if (failed.length === 0) {
        orphans_removed = await this.cleanupOrphans(
          agentId,
          files.map(f => f.dir).concat(metaFile.dir),
        )
      }

      // 5. self-report 재호출
      const report = await this.agents.fetchSelfReport(agentId).catch(() => null)

      this.logger.log(`[install-build agent=${agentId.slice(0,8)} build=${build.build_id} run=${runId}] done · installed=${installed.length} meta_written=${metaSave.ok} failed=${failed.length} orphans=${orphans_removed.length}`)

      return {
        installed,
        skipped,                              // mcp slot, orchestration/memory (merged into meta)
        failed,
        meta_written: metaSave.ok,
        orphans_removed,
        local_skills_after: report?.local_skills?.items ?? [],
        warnings: this.buildWarnings(),      // Day 0 STEP 0.4 결과에 따라 ["Restart..."] or []
      }
    })()
    this.inFlight.set(agentId, run)
    run.finally(() => this.inFlight.delete(agentId))
    return run
  }

  /** HTTP 상태 분기 헬퍼. controller 에서 response.status() 결정 시 참조. */
  classifyResult(r: InstallBuildResponse): number {
    if (r.failed.length === 0) return 200
    if (r.installed.length === 0 && r.failed.every(f => /timeout/i.test(f.error))) return 504
    return 207
  }

  private async cleanupOrphans(agentId: string, keep: string[]): Promise<string[]> {
    // 현재 ~/.claude/skills/cherry-* 중 keep 리스트에 없는 것 → delete
    // (Day 5 에서 구현)
    return []
  }
}
```

**핵심 주의사항**:
- `requestSaveSkill` 개별 timeout **10s** (gateway 기본 30s → 호출 시 override). 병렬 최대 3 동시 → 5 파일 × 10s / 3 ≈ 17s 최악
- 고아 정리는 **신규 save 전부 성공 이후**에만. 부분 실패 시 기존 스킬 보존 (atomicity)
- buildMetaSkillFile 도 SKILL.md 포맷 (JSON 아님). `1-work-guidelines.md §4-3` 참조
- `installed[]` 는 **regular skill 만** (prompt/skillA/B/C). meta 는 `meta_written: boolean` 으로 분리
- `mcp` 슬롯은 files 수집 단계에서 빠지고 응답 `skipped[]` 에 포함. 이유: `"mcp slot — referenced by id only"`
- `orchestration` / `memory` 슬롯도 `skipped[]` 에 포함. 이유: `"merged into build-meta"`
- `toPayload(file, runId)` 는 `1-work-guidelines.md §4-4` 에 따라 `SaveSkillRequestPayload` 기존 shape 로 변환. `concept_id = "cherry-workshop-" + file.cardId` (synthetic)
- 모든 로그에 `[install-build agent=... build=... run=...]` prefix (`§11` 규약)
- `buildWarnings()` 는 Day 0 STEP 0.4 수동 검증 결과에 따라 함수 구현 — 현재 기본값 `['Restart 'claude' to load the new build.']`, 만약 핫 리로드 확인되면 `[]` 반환

### STEP 2.2 — `InstallBuildController` (20 min)
파일: `apps/api/src/modules/kaas/install-build.controller.ts`

기존 컨트롤러의 guard 패턴 확인:
```bash
grep -n "@UseGuards\|@Controller" apps/api/src/modules/kaas/kaas-agent.controller.ts | head -5
```
→ 동일한 guard 적용.

```ts
@Controller('v1/kaas/agents')      // nest 전역 prefix 'api' 자동 부가 → /api/v1/kaas/agents/...
@UseGuards(JwtAuthGuard)            // 기존 agent.controller 와 동일
export class InstallBuildController {
  constructor(private readonly svc: InstallBuildService) {}

  @Post(':id/install-build')
  @HttpCode(200)                    // classifyResult 로 override 가능
  async install(
    @CurrentUser() user: User,      // 또는 @Req() req: Request 로 req.user 접근
    @Param('id') agentId: string,
    @Body() body: InstallBuildRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.svc.install(user.id, agentId, body)
    res.status(this.svc.classifyResult(result))  // 200/207/504
    return result
  }
}
```

**Module 등록** — `KaasModule` (`apps/api/src/modules/kaas/kaas.module.ts`):
- `providers`: `InstallBuildService` 추가
- `controllers`: `InstallBuildController` 추가
- `imports`: `JwtModule` / auth 모듈이 이미 포함됐는지 확인 (안 되어 있으면 추가)

### STEP 2.3 — 수동 curl 테스트 (25 min)
인증 헤더 포함 주의 (fetchWithAuth 에 맞춰):
```bash
# 전체 URL: /api/v1/... (nest 전역 prefix 'api' 포함)
curl -X POST http://localhost:4000/api/v1/kaas/agents/<agentId>/install-build \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "build_id": "build-a",
    "build_name": "Build A",
    "equipped": {
      "prompt": "inv-p-oracle",
      "mcp": "inv-m-crypto",
      "skillA": "inv-s-json-strict",
      "skillB": null,
      "skillC": null,
      "orchestration": "inv-o-plan-execute",
      "memory": "inv-me-short"
    }
  }'
```

**기대 결과 (에이전트 연결된 경우)**:
- `200` + `{installed: [2 items], skipped: [{slot:"mcp",...}], failed: [], meta_written: true, orphans_removed: [], local_skills_after: [3+ entries]}`
- 에이전트 터미널에 `[WS] save_skill_ack` 3번 찍힘 (prompt + skill + meta)
- `ls ~/.claude/skills/` → `cherry-p-oracle`, `cherry-s-json-strict`, `cherry-build-meta` 폴더 존재
- 각 폴더에 `SKILL.md` 파일 있고 frontmatter 가 `name:` + `description:` 로 시작

**기대 결과 (에이전트 미연결)**:
- `409` + `{code: "AGENT_OFFLINE", message: "Agent not connected..."}`
- 즉시 반환 (타임아웃 대기 없음)

**중복 클릭 테스트**:
같은 명령을 **< 1초 간격**으로 두 번 동시 실행 → 2번째는 첫 번째와 **동일한 응답** 반환 (in-flight lock 공유).

---

## Day 3 — Side Panel UI (60 min)

**담당**: AI

### STEP 3.1 — `InstallResultPanel` 컴포넌트 (40 min)
파일: `apps/web/components/cherry/install-result-panel.tsx`

Props:
```ts
interface Props {
  agentId: string
  lastResult: InstallBuildResponse | null
  running: boolean
}
```

섹션:
1. **Current install** — `last_install_at` + `build_name` (installs localStorage 기반)
2. **Latest install log** — installed(✓) / skipped(-) / failed(✗) 그룹별 리스트. dir 이름만, tooltip으로 full path
3. **Agent skills on disk** — `local_skills_after.items` 리스트

빈 상태:
- 설치 전 → "Pick a build and click Install to see the log here."

로딩 상태:
- `running === true` → 각 row 를 `⌛` + grayscale 처리

### STEP 3.2 — Connect 페이지 2-컬럼 레이아웃 (15 min)
Connect 페이지 `<section>` 내부를 `grid lg:grid-cols-[1fr_280px] gap-5` 로 래핑:
- 왼쪽: 기존 my-agents 목록 + Claude Code card + Install Skill card
- 오른쪽 (lg+): `<InstallResultPanel>` sticky `top-16`

Mobile(md-) 에서는 단일 컬럼 — side panel 이 Install Skill card 아래로 stack.

### STEP 3.3 — props drilling (5 min)
Connect 페이지 state 추가:
- `lastInstall: InstallBuildResponse | null`
- `installing: boolean`

`<InstallSkillSection>` 에 `onInstalled(response)` 콜백 추가 — 응답 받으면 Connect 상위 state 업데이트.

---

## Day 4 — 클라이언트 연결 (30 min)

**담당**: AI

### STEP 4.1 — `installBuild(agentId, build)` 추가 (10 min)
파일: `apps/web/lib/api.ts` 말미

```ts
export async function installBuild(
  agentId: string,
  build: InstallBuildRequest,
): Promise<InstallBuildResponse> {
  const res = await fetchWithAuth(
    `${KAAS_BASE}/agents/${agentId}/install-build`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(build),
    },
  )
  if (!res.ok) throw new Error(`installBuild ${res.status}`)
  return res.json()
}
```

### STEP 4.2 — `InstallSkillSection.install()` 교체 (15 min)
기존 `install()` 함수 내용:
```ts
// 현재 (localStorage only)
writeInstalls(nextMap)
setJustInstalled(true)
```

로 교체:
```ts
// 교체 후
setInstalling(true)
try {
  const resp = await installBuild(agent.id, {
    build_id: selectedBuildId,
    build_name: selectedBuild.name,
    equipped: selectedBuild.equipped,
  })
  onInstalled(resp)
  writeInstalls(next)          // UX-목적 로컬 기록은 유지
  setJustInstalled(true)
} catch (err) {
  setError(err.message)
} finally {
  setInstalling(false)
}
```

### STEP 4.3 — e2e smoke (5 min)
1. 브라우저: Workshop 에서 Build A 슬롯 채움
2. Connect → Install 클릭
3. side panel 에 실시간 로그 + 3 스킬 + agent confirmed 표시
4. 터미널: `ls ~/.claude/skills/` 확인

---

## Day 5 — 덮어쓰기 / 고아 정리 (45 min)

**담당**: AI

### STEP 5.1 — Day 1.5 이벤트 검증 (5 min)
Day 1.5 에서 이미 `delete_skill_request` + `cherry-agent.js` 핸들러 구현 완료. 재확인:
```bash
grep -n "requestDeleteSkill\|delete_skill_request\|delete_skill_ack" \
  apps/api/src/modules/kaas/kaas-ws.gateway.ts \
  apps/web/public/cherry-agent.js
```
**기대 결과**: 양쪽 파일에 관련 매치 각 1건 이상.

### STEP 5.2 — 덮어쓰기 구현 (25 min, atomic 순서)
InstallBuildService `cleanupOrphans()` 구현. **순서 중요**:

1. (이미 2단계에서) 신규 SkillFile save 전부 성공 확인
2. `getAgentLocalSkills(agentId)` — self-report 호출
3. `existing = local_skills.items.filter(i => i.dir.startsWith('cherry-'))`
4. `keepSet = new Set(neoFiles.map(f => f.dir).concat('cherry-build-meta'))`
5. `orphans = existing.filter(i => !keepSet.has(i.dir))`
6. 각 orphan → `delete_skill_request` (Day 5 STEP 5.1 확인된 이벤트명)
7. 삭제 실패 건은 로그 경고만 — 응답에는 `failed_orphan` 으로 분리 (throw 하지 않음)

**순서 핵심**: save 실패 시 **orphans 건드리지 않음**. 부분 성공은 기존 스킬 유지.

**기대 결과**:
- Build A (prompt+skillA) 설치 → `ls ~/.claude/skills/` = `cherry-p-oracle`, `cherry-s-json-strict`, `cherry-build-meta` (3개)
- Build B (prompt+skillC) 설치 → `ls` = `cherry-p-quant`, `cherry-s-citation`, `cherry-build-meta` (3개, A 잔재 없음)
- 응답의 `orphans_removed` = `['cherry-p-oracle', 'cherry-s-json-strict']`

**실패 경로 테스트**:
- Build B save 중 1건 실패 시 → orphans_removed = `[]`, Build A 잔존, failed = `[1 item]`

---

## Day 6 — 시나리오 리허설 (60 min)

**담당**: 사용자+AI

`1-work-guidelines.md` §8 의 4 시나리오 순차 실행:
1. Happy path (2-3 슬롯)
2. 부분 실패 (bogus card id)
3. 재설치 (A → B)
4. 오프라인 에이전트 (claude 프로세스 kill 후 Install)

각 항목 pass/fail 기록 → `3-checklist-table.md` 에 체크.

**기대 결과**: 4/4 통과. 1-2 실패 시 수정 후 재실행.

---

## Day 7 — 정리 (30 min)

**담당**: AI

### STEP 7.1 — `4-progress-log.md` 세션 기록 (10 min)
Day 1~6 각각 날짜/커밋 해시/테스트 결과 간단히.

### STEP 7.2 — `3-checklist-table.md` 최종 업데이트 (5 min)

### STEP 7.3 — 루트 `README.md` Install Skill 섹션 추가 (10 min)
기능 소개 + 3-step 사용법.

### STEP 7.4 — git commit + PR 생성 (5 min)
커밋 메시지:
```
feat(install-skill): Workshop build → local agent skill files

- new POST /v1/kaas/agents/:id/install-build
- cardToSkillFile serializer (prompt/skill → SKILL.md)
- side panel for install log + agent confirmation
- reuses existing save_skill_request + self_report infra
```

---

## 공통 디버깅 팁

### nest 로그 실시간
```bash
tail -f /tmp/nest-4000.log | grep -E "save_skill|install-build|ECONN"
```

### 에이전트 스킬 디렉토리
```bash
ls -la ~/.claude/skills/ && \
for d in ~/.claude/skills/cherry-*/; do
  echo "=== $d ==="
  cat "$d/SKILL.md" 2>/dev/null | head -10
done
```

### WebSocket 연결 확인
```bash
curl http://localhost:4000/api/v1/kaas/agents/<id>/self-report | jq .ok
```
