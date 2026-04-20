# A2A Agent-to-Agent Communication — Implementation Plan (v2)

**Created**: 2026-04-19
**Revised**: 2026-04-19 (v2 — Cherry Console 정합성, AWS URL, 실측 경로 반영)
**Target**: Mac ↔ Linux Claude Code 크로스 머신 A2A 통신 + **웹 Cherry Console 실시간 표시**
**Estimated work**: 8 hours

---

## 🎯 최종 성공 기준 (Definition of Done)

1. ☐ Mac Claude Code에서 MCP `send_agent_task` → Linux Claude Code에 도착
2. ☐ Linux Claude Code에서 `respond_to_task` → Mac에 응답 전달
3. ☐ **웹 Cherry Console 플로팅 창에 양쪽 대화가 실시간 표시** (🔀 A2A 메시지 박스)
4. ☐ `POST /api/v1/kaas/a2a` JSON-RPC 엔드포인트 A2A 스펙 준수
5. ☐ `GET /api/v1/kaas/a2a/agents/:id/card` Agent Card 반환
6. ☐ DB `kaas.agent_task` 테이블 영구 기록
7. ☐ Swagger 모든 엔드포인트 수동 테스트 통과
8. ☐ **해피패스 3회 연속 성공** (실패 없음)

---

## 🔑 환경 전제 (Infra Baseline)

| 항목 | 값 |
|---|---|
| Cherry API | **AWS 배포** (`NEXT_PUBLIC_API_URL` 환경변수 사용) |
| 웹 프론트 | AWS 배포 — 같은 도메인 or 인접 도메인 |
| Linux 머신 | 원격 항상 접속 가능 (SSH 세팅 완료) |
| Mac 머신 | 개발용 (Claude Code 이미 설치) |
| Cherry 서버 라우팅 | `app.setGlobalPrefix('api')` + 각 컨트롤러 `v1/kaas/*` |
| 최종 경로 | `/api/v1/kaas/a2a*` |
| WebSocket 네임스페이스 | `/kaas` |

---

## Architecture

```
┌──────── Mac ─────────┐     ┌─── AWS Cherry Server ───┐     ┌──── Linux (원격) ────┐
│ Claude Code          │     │  NestJS API             │     │ Claude Code          │
│   └ MCP stdio        │     │  • /api/v1/kaas/a2a     │     │   └ MCP stdio        │
│      └ cherry-agent  │     │    (JSON-RPC)           │     │      └ cherry-agent  │
│         ├ WebSocket ─┼────►│  • /agents/:id/card     │◄────┼── WebSocket ─────    │
│         │ role=agent │     │  • /inbox               │     │   role=agent         │
│         │            │     │                         │     │                      │
│         └ MCP tools: │     │  WS Gateway             │     │         │            │
│           send/recv  │     │   agentSockets: Map     │     │         │            │
└──────────────────────┘     │     mac_id → socketA    │     └─────────┼────────────┘
                             │     linux_id → socketB  │               │
                             │                         │               │
                             │  DB                     │               │
                             │   kaas.agent_task       │               │
                             └─────────────┬───────────┘               │
                                           │                           │
                                           │ a2a_task_event broadcast  │
                                           ▼                           │
                             ┌────────────────────────────┐            │
                             │ Web Cherry Console         │            │
                             │ • roomSocketRef (WS)       │◄───────────┘
                             │ • role=user 연결            │      (같은 유저가
                             │ • agents filter            │       두 에이전트 소유)
                             │ • 🔀 A2A 메시지 렌더링      │
                             └────────────────────────────┘
```

---

## Step 0: 사전 확인 (5분)

**본격 시작 전 체크**:

**C0.1 AWS Cherry API URL 확정**:
```bash
# 웹이 어디로 요청하는지 확인
cat apps/web/.env.local | grep NEXT_PUBLIC_API_URL
# 로컬 개발이면 http://localhost:4000
# 배포 환경 요청용 정확한 도메인 알아둘 것
```

**C0.2 서버 측 `PUBLIC_API_URL` 환경변수 확인/추가**:
```bash
# apps/api/.env 에 추가 (배포 시점에 맞춰야 Agent Card의 url 필드가 정확)
echo "PUBLIC_API_URL=http://localhost:4000" >> apps/api/.env
# AWS 배포 시 PUBLIC_API_URL=https://api.solteti.site (실제 도메인으로 교체)
```

**C0.3 agent 2개 사전 준비**:
- 웹 로그인 후 대시보드에서 에이전트 2개 생성 (**같은 유저 계정** 소유)
- 예: `claude-mac`, `claude-linux`
- 각각의 `id` (UUID) 와 `api_key` 기록
- Mac에선 `claude-mac`의 api_key 사용, Linux에선 `claude-linux`의 api_key 사용

---

## 단계 전체

| # | 단계 | 시간 | 선행 |
|---|---|---|---|
| [Step 1](#step-1-db-migration) | DB 마이그레이션 | 15분 | C0 |
| [Step 2](#step-2-service--dto) | Service + DTO | 1.5h | 1 |
| [Step 3](#step-3-controller) | Controller | 45분 | 2 |
| [Step 4](#step-4-ws-gateway-확장) | WS Gateway 확장 | 30분 | 3 |
| [Step 5](#step-5-module-등록--swagger-테스트) | Module 등록 + Swagger | 45분 | 3,4 |
| [Step 6](#step-6-mcp-tools) | MCP tools 3개 | 1h | 3 |
| [Step 7](#step-7-ws-client-listener) | ws-client 리스너 | 30분 | 4 |
| [Step 8](#step-8-에이전트-번들-재빌드) | 에이전트 번들 재빌드 | 20분 | 6,7 |
| [Step 9](#step-9-cherry-console-ui) | **Cherry Console UI** | 1.5h | 4 |
| [Step 10](#step-10-single-machine-e2e) | Mac 단일 머신 E2E | 45분 | 1~9 |
| [Step 11](#step-11-linux-에이전트-배포) | Linux 에이전트 배포 | 45분 | 8 |
| [Step 12](#step-12-cross-machine-e2e) | Mac-Linux E2E | 45분 | 10,11 |

---

## Step 1: DB Migration

### 목표
`kaas.agent_task` 테이블 생성.

### 파일
`apps/docs/staged_mock/kaas-agent-task-migration.sql`

```sql
CREATE TABLE IF NOT EXISTS kaas.agent_task (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  initiator_id      UUID NOT NULL REFERENCES kaas.agent(id),
  executor_id       UUID NOT NULL REFERENCES kaas.agent(id),

  task_type         TEXT NOT NULL DEFAULT 'message',
  status            TEXT NOT NULL DEFAULT 'submitted',
  -- 'submitted' | 'working' | 'input-required' | 'completed' | 'failed' | 'canceled'

  input             JSONB NOT NULL,
  output            JSONB,

  session_id        TEXT,
  idempotency_key   TEXT UNIQUE,
  expires_at        TIMESTAMPTZ,

  provenance_hash   TEXT,

  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_task_executor_status
  ON kaas.agent_task(executor_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_task_initiator
  ON kaas.agent_task(initiator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_task_session
  ON kaas.agent_task(session_id);
```

### ✅ 테스트

**T1.1 테이블 존재 확인**:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'kaas' AND table_name = 'agent_task';
```
기대: 1 row

**T1.2 컬럼 확인**:
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema='kaas' AND table_name='agent_task'
ORDER BY ordinal_position;
```
기대: 13개 컬럼 (id, initiator_id, executor_id, task_type, status, input, output, session_id, idempotency_key, expires_at, provenance_hash, created_at, updated_at)

**T1.3 FK 제약**:
```sql
SELECT constraint_name FROM information_schema.table_constraints
WHERE table_name='agent_task' AND constraint_type='FOREIGN KEY';
```
기대: 2개 (initiator_id, executor_id 모두 kaas.agent 참조)

**T1.4 샘플 insert/delete**:
```sql
INSERT INTO kaas.agent_task (initiator_id, executor_id, task_type, input)
VALUES (
  (SELECT id FROM kaas.agent LIMIT 1),
  (SELECT id FROM kaas.agent LIMIT 1),
  'message',
  '{"message":{"role":"user","parts":[{"type":"text","text":"test"}]}}'::jsonb
) RETURNING id, status;

DELETE FROM kaas.agent_task WHERE task_type='message';
```
기대: insert 1 row (status='submitted'), delete 1 row.

---

## Step 2: Service + DTO

### 2-1. DTO 파일
`apps/api/src/modules/kaas/input-dto/a2a-rpc.dto.ts`

```typescript
import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

export const A2aRpcSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number(), z.null()]).optional(),
  method: z.string().min(1),
  params: z.any().optional(),
});

export class A2aRpcDto {
  static schema = A2aRpcSchema;

  @ApiProperty({ example: '2.0' })
  jsonrpc: '2.0';

  @ApiProperty({ example: 1, required: false })
  id?: string | number | null;

  @ApiProperty({ example: 'tasks/send' })
  method: string;

  @ApiProperty({
    example: {
      executorAgentId: 'uuid-of-target-agent',
      message: {
        role: 'user',
        parts: [{ type: 'text', text: 'Hello' }],
      },
      taskType: 'message',
    },
    required: false,
  })
  params?: any;
}
```

### 2-2. Service 파일
`apps/api/src/modules/kaas/kaas-a2a.service.ts`

```typescript
import { Injectable, Inject, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { KaasWsGateway } from './kaas-ws.gateway';
import { KaasAgentService } from './kaas-agent.service';

@Injectable()
export class KaasA2aService {
  private readonly logger = new Logger(KaasA2aService.name);

  constructor(
    @Inject('KNEX_CONNECTION') private readonly knex: Knex,
    private readonly wsGateway: KaasWsGateway,
    private readonly agentService: KaasAgentService,
  ) {}

  /** tasks/send */
  async sendTask(initiatorId: string, params: any) {
    const {
      id: taskId,
      executorAgentId,
      message,
      taskType = 'message',
      sessionId,
      idempotencyKey,
      expiresAt,
    } = params ?? {};

    if (!executorAgentId) throw new BadRequestException('executorAgentId required');
    if (!message?.role || !Array.isArray(message?.parts)) {
      throw new BadRequestException('Invalid A2A Message format: role and parts[] required');
    }

    if (idempotencyKey) {
      const existing = await this.knex('kaas.agent_task')
        .where({ idempotency_key: idempotencyKey }).first();
      if (existing) return this.toA2aTask(existing);
    }

    const executor = await this.knex('kaas.agent').where({ id: executorAgentId }).first();
    if (!executor) throw new NotFoundException(`Executor agent not found: ${executorAgentId}`);

    const insertData: any = {
      initiator_id: initiatorId,
      executor_id: executorAgentId,
      task_type: taskType,
      status: 'submitted',
      input: { message },
      session_id: sessionId ?? null,
      idempotency_key: idempotencyKey ?? null,
      expires_at: expiresAt ? new Date(expiresAt) : null,
    };
    if (taskId) insertData.id = taskId;

    const [task] = await this.knex('kaas.agent_task').insert(insertData).returning('*');
    this.logger.log(`Task sent: ${task.id} ${initiatorId} → ${executorAgentId}`);

    // 1) executor의 WebSocket(MCP 에이전트)에 실시간 푸시
    this.wsGateway.pushToAgent(executorAgentId, 'a2a_task_received', this.toA2aTask(task));

    // 2) 웹 Cherry Console들에 브로드캐스트 (agent 메타 포함)
    await this.broadcastToConsoles('task_created', task);

    return this.toA2aTask(task);
  }

  /** tasks/get */
  async getTask(taskId: string) {
    const task = await this.knex('kaas.agent_task').where({ id: taskId }).first();
    if (!task) throw new NotFoundException(`Task not found: ${taskId}`);
    return this.toA2aTask(task);
  }

  /** tasks/cancel */
  async cancelTask(agentId: string, taskId: string) {
    const [updated] = await this.knex('kaas.agent_task')
      .where({ id: taskId })
      .andWhere(function () {
        this.where('initiator_id', agentId).orWhere('executor_id', agentId);
      })
      .andWhereNot('status', 'completed')
      .andWhereNot('status', 'canceled')
      .update({ status: 'canceled', updated_at: new Date() })
      .returning('*');

    if (!updated) throw new NotFoundException('Task not found or not cancelable');

    this.wsGateway.pushToAgent(updated.initiator_id, 'a2a_task_canceled', this.toA2aTask(updated));
    this.wsGateway.pushToAgent(updated.executor_id, 'a2a_task_canceled', this.toA2aTask(updated));
    await this.broadcastToConsoles('task_canceled', updated);

    return this.toA2aTask(updated);
  }

  /** tasks/respond — executor가 task 완료 */
  async respondTask(executorId: string, params: any) {
    const { taskId, output, status = 'completed' } = params ?? {};
    if (!taskId) throw new BadRequestException('taskId required');
    if (!['completed', 'failed', 'input-required', 'working'].includes(status)) {
      throw new BadRequestException('Invalid status');
    }

    const [updated] = await this.knex('kaas.agent_task')
      .where({ id: taskId, executor_id: executorId })
      .update({ output, status, updated_at: new Date() })
      .returning('*');

    if (!updated) throw new NotFoundException('Task not found or not assigned to you');

    this.wsGateway.pushToAgent(updated.initiator_id, 'a2a_task_completed', this.toA2aTask(updated));
    await this.broadcastToConsoles('task_responded', updated);

    return this.toA2aTask(updated);
  }

  /** Inbox */
  async getInbox(agentId: string, opts: { status?: string; limit?: number } = {}) {
    let q = this.knex('kaas.agent_task as t')
      .leftJoin('kaas.agent as a', 'a.id', 't.initiator_id')
      .where('t.executor_id', agentId)
      .orderBy('t.created_at', 'desc')
      .limit(opts.limit ?? 50)
      .select('t.*', 'a.name as initiator_name');
    if (opts.status) q = q.where('t.status', opts.status);
    const rows = await q;
    return rows.map((r) => this.toA2aTask(r));
  }

  /** Agent Card */
  async buildAgentCard(agentId: string) {
    const agent = await this.knex('kaas.agent').where({ id: agentId }).first();
    if (!agent) throw new NotFoundException(`Agent not found: ${agentId}`);

    const knowledge = (() => {
      try {
        return typeof agent.knowledge === 'string'
          ? JSON.parse(agent.knowledge)
          : (Array.isArray(agent.knowledge) ? agent.knowledge : []);
      } catch { return []; }
    })();

    const baseUrl = process.env.PUBLIC_API_URL;
    if (!baseUrl) {
      this.logger.warn('PUBLIC_API_URL env missing — Agent Card url will be incomplete');
    }

    return {
      name: agent.name,
      description: agent.description ?? `Cherry-registered agent ${agent.name}`,
      url: `${baseUrl ?? ''}/api/v1/kaas/a2a`,
      version: '1.0.0',
      capabilities: {
        streaming: false,
        pushNotifications: true,
        stateTransitionHistory: true,
      },
      authentication: { schemes: ['apiKey'] },
      defaultInputModes: ['text'],
      defaultOutputModes: ['text', 'data'],
      skills: knowledge.map((k: any) => ({
        id: k.topic ?? k.name ?? 'unknown',
        name: k.topic ?? k.name ?? 'unknown',
      })),
      extensions: {
        'x-cherry': {
          agent_id: agent.id,
          karma_tier: agent.karma_tier,
          wallet_address: agent.wallet_address,
          wallet_type: agent.wallet_type,
        },
      },
    };
  }

  /** 에이전트 목록 (간이 discovery) */
  async listActiveAgents() {
    return this.knex('kaas.agent')
      .where('is_active', true)
      .select('id', 'name', 'karma_tier')
      .orderBy('name');
  }

  // ─── Private helpers ───

  private toA2aTask(row: any) {
    return {
      id: row.id,
      sessionId: row.session_id,
      status: {
        state: row.status,
        timestamp: (row.updated_at ?? row.created_at)?.toISOString?.()
          ?? new Date().toISOString(),
      },
      message: row.input?.message ?? null,
      artifact: row.output
        ? { name: 'response', parts: row.output?.parts ?? [{ type: 'data', data: row.output }] }
        : null,
      'x-cherry': {
        task_type: row.task_type,
        initiator_id: row.initiator_id,
        executor_id: row.executor_id,
        initiator_name: row.initiator_name ?? null,
      },
    };
  }

  /** 웹 Cherry Console들에 이벤트 송출
   *  — 유저별 필터링은 클라이언트가 agents 배열로 직접 처리한다.
   *  payload에 from_agent/to_agent (id, name, user_id) 포함.
   */
  private async broadcastToConsoles(eventType: string, task: any) {
    try {
      const [initiator, executor] = await Promise.all([
        this.knex('kaas.agent').where({ id: task.initiator_id })
          .select('id', 'name', 'user_id').first(),
        this.knex('kaas.agent').where({ id: task.executor_id })
          .select('id', 'name', 'user_id').first(),
      ]);
      if (!this.wsGateway.server) return;
      this.wsGateway.server.emit('a2a_task_event', {
        type: eventType,
        task: this.toA2aTask({ ...task, initiator_name: initiator?.name }),
        from_agent: {
          id: initiator?.id,
          name: initiator?.name,
          user_id: initiator?.user_id,
        },
        to_agent: {
          id: executor?.id,
          name: executor?.name,
          user_id: executor?.user_id,
        },
      });
    } catch (e: any) {
      this.logger.warn(`broadcastToConsoles failed: ${e.message}`);
    }
  }
}
```

### ✅ 테스트

**T2.1 컴파일**:
```bash
cd apps/api && npm run build
```
에러 없음.

**T2.2 DTO 스키마 단위 확인**:
```typescript
// 개발자가 직접 한 번 REPL or 콘솔에서 확인
import { A2aRpcSchema } from './input-dto/a2a-rpc.dto';
A2aRpcSchema.parse({ jsonrpc: '2.0', method: 'tasks/send', id: 1 });   // OK
try { A2aRpcSchema.parse({ jsonrpc: '1.0', method: 'x' }); } catch (e) { /* throws */ }
```

---

## Step 3: Controller

### 파일
`apps/api/src/modules/kaas/kaas-a2a.controller.ts`

```typescript
import {
  Body, Controller, Get, Headers, HttpCode, Param, Post, Query, Logger,
} from '@nestjs/common';
import { ApiOperation, ApiTags, ApiHeader } from '@nestjs/swagger';
import { KaasA2aService } from './kaas-a2a.service';
import { KaasAgentService } from './kaas-agent.service';

@Controller('v1/kaas/a2a')
@ApiTags('Agent Communication (A2A)')
export class KaasA2aController {
  private readonly logger = new Logger(KaasA2aController.name);

  constructor(
    private readonly service: KaasA2aService,
    private readonly agentService: KaasAgentService,
  ) {}

  /** JSON-RPC 2.0 main endpoint */
  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'A2A JSON-RPC 2.0 endpoint (tasks/send|get|cancel|respond)' })
  @ApiHeader({ name: 'x-api-key', required: true })
  async rpc(
    @Body() req: any,
    @Headers('x-api-key') apiKey: string,
  ) {
    if (req?.jsonrpc !== '2.0') {
      return { jsonrpc: '2.0', id: req?.id ?? null,
        error: { code: -32600, message: 'Invalid Request — jsonrpc must be "2.0"' } };
    }
    if (!apiKey) {
      return { jsonrpc: '2.0', id: req.id ?? null,
        error: { code: -32001, message: 'Missing x-api-key header' } };
    }

    let agent: any;
    try {
      agent = await this.agentService.authenticate(apiKey);
    } catch (err: any) {
      return { jsonrpc: '2.0', id: req.id ?? null,
        error: { code: -32001, message: 'Authentication failed: ' + err.message } };
    }

    try {
      let result: any;
      switch (req.method) {
        case 'tasks/send':    result = await this.service.sendTask(agent.id, req.params); break;
        case 'tasks/get':     result = await this.service.getTask(req.params?.id); break;
        case 'tasks/cancel':  result = await this.service.cancelTask(agent.id, req.params?.id); break;
        case 'tasks/respond': result = await this.service.respondTask(agent.id, req.params); break;
        default:
          return { jsonrpc: '2.0', id: req.id ?? null,
            error: { code: -32601, message: `Method not found: ${req.method}` } };
      }
      return { jsonrpc: '2.0', id: req.id ?? null, result };
    } catch (err: any) {
      this.logger.error(`RPC error [${req.method}]: ${err.message}`);
      return { jsonrpc: '2.0', id: req.id ?? null,
        error: { code: -32000, message: err.message } };
    }
  }

  /** Agent Card — A2A discovery */
  @Get('agents/:id/card')
  @ApiOperation({ summary: 'A2A Agent Card (discovery)' })
  async card(@Param('id') agentId: string) {
    return this.service.buildAgentCard(agentId);
  }

  /** Inbox (UI용) */
  @Get('inbox')
  @ApiOperation({ summary: '내 받은 task 목록 (UI/편의용)' })
  @ApiHeader({ name: 'x-api-key', required: true })
  async inbox(
    @Headers('x-api-key') apiKey: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    const agent = await this.agentService.authenticate(apiKey);
    return this.service.getInbox(agent.id, {
      status,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  /** 에이전트 리스트 (간이 discovery) */
  @Get('agents')
  @ApiOperation({ summary: '활성 에이전트 목록' })
  async list() {
    return this.service.listActiveAgents();
  }
}
```

### ✅ 테스트

**T3.1 컴파일**:
```bash
cd apps/api && npm run build
```
에러 없음.

---

## Step 4: WS Gateway 확장

### 파일
`apps/api/src/modules/kaas/kaas-ws.gateway.ts` (기존 파일 내부에 메서드 추가)

클래스 내부 어디든 추가:

```typescript
/** 특정 에이전트 소켓에 이벤트 푸시 (A2A용) */
pushToAgent(agentId: string, event: string, payload: any): boolean {
  const socket = this.agentSockets.get(agentId);
  if (!socket) {
    this.logger.warn(`pushToAgent: agent=${agentId} not connected (event=${event})`);
    return false;
  }
  socket.emit(event, payload);
  this.logger.log(`pushToAgent: agent=${agentId} event=${event} ok`);
  return true;
}
```

### ✅ 테스트

**T4.1 컴파일**:
```bash
cd apps/api && npm run build
```
에러 없음.

**T4.2 런타임 — Step 5 후 검증됨**

---

## Step 5: Module 등록 + Swagger 테스트

### 파일
`apps/api/src/modules/kaas/kaas.module.ts`

controllers / providers 배열에 추가:

```typescript
import { KaasA2aController } from './kaas-a2a.controller';
import { KaasA2aService } from './kaas-a2a.service';

@Module({
  imports: [...],
  controllers: [
    // 기존...
    KaasA2aController,   // ← 추가
  ],
  providers: [
    // 기존...
    KaasA2aService,      // ← 추가
  ],
})
export class KaasModule {}
```

### 서버 재시작
```bash
cd apps/api
npm run start:dev
```

### ✅ 테스트

**T5.1 서버 시작 로그 확인**:
NestJS 시작 로그에 라우팅 매핑 표시:
```
[RoutesResolver] KaasA2aController {/api/v1/kaas/a2a}
[RouterExplorer] Mapped {/api/v1/kaas/a2a, POST}
[RouterExplorer] Mapped {/api/v1/kaas/a2a/agents/:id/card, GET}
[RouterExplorer] Mapped {/api/v1/kaas/a2a/inbox, GET}
[RouterExplorer] Mapped {/api/v1/kaas/a2a/agents, GET}
```

**T5.2 Swagger UI**:
브라우저 `http://localhost:4000/api` (또는 AWS 도메인의 `/api`) 접속 → "Agent Communication (A2A)" 섹션 존재.

**T5.3 Agent Card 조회**:
```bash
# ${API_URL} = http://localhost:4000 (로컬) or 배포 도메인
curl ${API_URL}/api/v1/kaas/a2a/agents/${MAC_AGENT_ID}/card
```
기대: JSON 응답, `name`, `url`, `capabilities.pushNotifications=true`, `skills`, `extensions.x-cherry.agent_id` 존재.

**T5.4 에이전트 목록**:
```bash
curl ${API_URL}/api/v1/kaas/a2a/agents
```
기대: 배열, `[{id, name, karma_tier}, ...]`

**T5.5 tasks/send** (Mac 에이전트 → Linux 에이전트):
```bash
curl -X POST ${API_URL}/api/v1/kaas/a2a \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${MAC_API_KEY}" \
  -d '{
    "jsonrpc":"2.0","id":1,"method":"tasks/send",
    "params":{
      "executorAgentId":"'"${LINUX_AGENT_ID}"'",
      "message":{"role":"user","parts":[{"type":"text","text":"hello"}]}
    }
  }'
```
기대:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "id": "<uuid>",
    "status": { "state": "submitted", "timestamp": "..." },
    "message": { "role": "user", "parts": [...] },
    "x-cherry": { "task_type": "message", "initiator_id": "...", "executor_id": "..." }
  }
}
```

**T5.6 DB 저장 확인**:
```sql
SELECT id, status, input FROM kaas.agent_task ORDER BY created_at DESC LIMIT 1;
```
기대: T5.5로 만든 row.

**T5.7 tasks/get**:
```bash
curl -X POST ${API_URL}/api/v1/kaas/a2a \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${MAC_API_KEY}" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tasks/get","params":{"id":"'"${TASK_ID}"'"}}'
```
기대: status.state='submitted'

**T5.8 tasks/respond** (Linux 키로 응답):
```bash
curl -X POST ${API_URL}/api/v1/kaas/a2a \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${LINUX_API_KEY}" \
  -d '{
    "jsonrpc":"2.0","id":3,"method":"tasks/respond",
    "params":{
      "taskId":"'"${TASK_ID}"'",
      "status":"completed",
      "output":{"parts":[{"type":"text","text":"Done"}]}
    }
  }'
```
기대: status.state='completed', artifact.parts 존재.

**T5.9 inbox (Linux 기준)**:
```bash
curl "${API_URL}/api/v1/kaas/a2a/inbox" -H "x-api-key: ${LINUX_API_KEY}"
```
기대: 배열, T5.5에서 생성한 task 포함.

**T5.10 에러 방어**:
```bash
# jsonrpc 없음
curl -X POST ${API_URL}/api/v1/kaas/a2a \
  -H "Content-Type: application/json" -H "x-api-key: ${MAC_API_KEY}" \
  -d '{"method":"tasks/send"}'
# 기대: error.code=-32600

# 없는 method
curl -X POST ${API_URL}/api/v1/kaas/a2a \
  -H "Content-Type: application/json" -H "x-api-key: ${MAC_API_KEY}" \
  -d '{"jsonrpc":"2.0","id":1,"method":"invalid/xx"}'
# 기대: error.code=-32601

# executor 존재 X
curl -X POST ${API_URL}/api/v1/kaas/a2a \
  -H "Content-Type: application/json" -H "x-api-key: ${MAC_API_KEY}" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tasks/send","params":{"executorAgentId":"00000000-0000-0000-0000-000000000000","message":{"role":"user","parts":[{"type":"text","text":"x"}]}}}'
# 기대: error.code=-32000, message="Executor agent not found: ..."
```

---

## Step 6: MCP tools

### 파일
`apps/agent-package/lib/mcp-tools.js` (기존 파일에 tool 3개 추가)

**⚠️ 중요**: 아래 tool 3개는 `function registerTools(server, apiKey, baseUrl) { ... }` **함수 내부**에 추가해야 함. 기존 `follow_concept` 등록 블록 **바로 아래** 같은 들여쓰기 레벨.

**또한**: MCP 메서드 이름은 `server.tool(name, description, schema, handler)` — `registerTool` 아님.

기존 `txt` 헬퍼와 `baseUrl`, `apiKey` 변수는 함수 scope에 이미 있음. 추가 import 불필요.

tool 등록 블록 끝에 다음 3개 추가:

```javascript
// ─── A2A: send_agent_task ───
server.tool(
  'send_agent_task',
  'Send a task to another Cherry-registered agent via A2A protocol.',
  {
    executor_agent_id: z.string().describe('Target agent UUID'),
    text: z.string().describe('Message text'),
    task_type: z.string().optional(),
    session_id: z.string().optional(),
  },
  async ({ executor_agent_id, text, task_type, session_id }) => {
    try {
      const res = await fetch(`${baseUrl}/api/v1/kaas/a2a`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tasks/send',
          params: {
            executorAgentId: executor_agent_id,
            taskType: task_type ?? 'message',
            sessionId: session_id,
            message: {
              role: 'user',
              parts: [{ type: 'text', text }],
            },
          },
        }),
      });
      const data = await res.json();
      if (data.error) {
        return { content: [{ type: 'text', text: `A2A error: ${data.error.message}` }], isError: true };
      }
      return txt(`Task sent: ${data.result.id} (state: ${data.result.status.state})`);
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  },
);

// ─── A2A: read_agent_inbox ───
server.tool(
  'read_agent_inbox',
  'Read tasks sent to this agent by other agents.',
  {
    status: z.string().optional().describe('Filter by status'),
    limit: z.number().optional(),
  },
  async ({ status, limit }) => {
    try {
      const url = new URL(`${baseUrl}/api/v1/kaas/a2a/inbox`);
      if (status) url.searchParams.set('status', status);
      if (limit) url.searchParams.set('limit', String(limit));
      const res = await fetch(url.toString(), { headers: { 'x-api-key': apiKey } });
      const data = await res.json();
      if (!Array.isArray(data)) {
        return { content: [{ type: 'text', text: `Inbox error: ${JSON.stringify(data)}` }], isError: true };
      }
      if (data.length === 0) return txt('Inbox empty.');
      const lines = data.map((t) => {
        const textPart = t.message?.parts?.find((p) => p.type === 'text')?.text ?? '(no text)';
        const from = t['x-cherry']?.initiator_name ?? '?';
        return `[${t.status.state}] ${t.id.slice(0, 8)} from ${from}: ${textPart}`;
      });
      return txt(`Inbox (${data.length}):\n${lines.join('\n')}`);
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  },
);

// ─── A2A: respond_to_task ───
server.tool(
  'respond_to_task',
  'Respond to a task received from another agent.',
  {
    task_id: z.string(),
    text: z.string(),
    status: z.enum(['completed', 'failed']).optional(),
  },
  async ({ task_id, text, status }) => {
    try {
      const res = await fetch(`${baseUrl}/api/v1/kaas/a2a`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tasks/respond',
          params: {
            taskId: task_id,
            status: status ?? 'completed',
            output: { parts: [{ type: 'text', text }] },
          },
        }),
      });
      const data = await res.json();
      if (data.error) {
        return { content: [{ type: 'text', text: `A2A error: ${data.error.message}` }], isError: true };
      }
      return txt(`Responded to ${task_id.slice(0, 8)}: ${data.result.status.state}`);
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  },
);
```

### ✅ 테스트

**T6.1 파일 syntax 확인**:
```bash
node -c apps/agent-package/lib/mcp-tools.js
```
에러 없음.

**T6.2 MCP 도구 등록 확인**:
에이전트 재시작 후 stderr에 3개 도구 이름 등장. (Step 10에서 최종 검증)

---

## Step 7: ws-client Listener

### 파일
`apps/agent-package/lib/ws-client.js` (기존 파일에 이벤트 리스너 추가)

기존 `socket.on('...', ...)` 블록 근처에 추가:

```javascript
// ── A2A task 수신 ──
socket.on('a2a_task_received', (task) => {
  const textPart = task.message?.parts?.find((p) => p.type === 'text')?.text ?? '(no text)';
  const from = task['x-cherry']?.initiator_name ?? task['x-cherry']?.initiator_id?.slice(0, 8) ?? 'unknown';
  process.stderr.write(`[A2A] ← incoming task ${task.id.slice(0, 8)} from ${from}: ${textPart}\n`);
});

socket.on('a2a_task_completed', (task) => {
  const textPart = task.artifact?.parts?.find((p) => p.type === 'text')?.text ?? '(no text)';
  process.stderr.write(`[A2A] ✓ task ${task.id.slice(0, 8)} completed: ${textPart}\n`);
});

socket.on('a2a_task_canceled', (task) => {
  process.stderr.write(`[A2A] ✗ task ${task.id.slice(0, 8)} canceled\n`);
});
```

### ✅ 테스트

**T7.1 syntax 확인**:
```bash
node -c apps/agent-package/lib/ws-client.js
```
에러 없음.

**T7.2 런타임 — Step 10, 12에서 검증**

---

## Step 8: 에이전트 번들 재빌드

### 작업
```bash
cd apps/agent-package
npm run build
# 또는 직접 esbuild
```

### ✅ 테스트

**T8.1 빌드 산출물 존재**:
```bash
ls -la apps/agent-package/dist/cherry-agent.js
```
기대: 파일 존재, mtime 최신.

**T8.2 도구 포함 확인**:
```bash
grep -oE "send_agent_task|read_agent_inbox|respond_to_task" apps/agent-package/dist/cherry-agent.js | sort -u
```
기대: 3줄 반환.

**T8.3 구동 테스트 (Mac)**:
```bash
CHERRY_API_KEY=${MAC_API_KEY} CHERRY_API_URL=${API_URL} node apps/agent-package/dist/cherry-agent.js
```
stderr에:
- `[WS] Connected (sid=...)`
- `[WS] Authenticated: claude-mac (<agent_id>)`

---

## Step 9: Cherry Console UI

### 목표
기존 `kaas-console.tsx`의 WebSocket(`roomSocketRef`)에 **`a2a_task_event` 리스너 추가** 및 **🔀 A2A 메시지 타입 렌더링** 추가.

### 파일
`apps/web/components/cherry/kaas-console.tsx`

### 9-1. Message 타입 확장

기존 Message union 타입에 추가 (파일 상단 타입 정의):
```typescript
// 기존 Message 타입 union에 추가
| {
    role: "a2a"
    eventType: "task_created" | "task_responded" | "task_canceled" | "task_completed"
    fromName: string
    toName: string
    fromId: string
    toId: string
    text: string
    taskId: string
    status: string
    ts: string
  }
```

### 9-2. WebSocket 리스너 추가

기존 `useEffect` 블록 내부 (`roomSocketRef` 생성 직후, `room_message` 리스너 바로 아래)에 **삽입**:

**위치**: 현재 파일 약 708번 줄, `socketInstance.on("agent_report_pushed", ...)` 바로 **위**에 추가:

```typescript
// ── A2A task 이벤트 ──
socketInstance.on("a2a_task_event", (evt: {
  type: "task_created" | "task_responded" | "task_canceled" | "task_completed"
  task: any
  from_agent: { id: string; name: string; user_id: string }
  to_agent: { id: string; name: string; user_id: string }
}) => {
  if (cancelled) return

  // 디버그 로그
  console.log("[Console WS] a2a_task_event:", evt)

  // 내가 소유한 에이전트 중 하나라도 관련되면 표시
  // agents: 상위 컴포넌트에서 내려주는 현재 유저의 에이전트 배열
  const myAgentIds = new Set((agents ?? []).map((a: any) => a.id))
  if (!myAgentIds.has(evt.from_agent.id) && !myAgentIds.has(evt.to_agent.id)) {
    return
  }

  const textPart =
    evt.task.message?.parts?.find((p: any) => p.type === "text")?.text ??
    evt.task.artifact?.parts?.find((p: any) => p.type === "text")?.text ??
    "(no text)"

  setMessages((m) => [...m, {
    role: "a2a",
    eventType: evt.type,
    fromName: evt.from_agent.name,
    toName: evt.to_agent.name,
    fromId: evt.from_agent.id,
    toId: evt.to_agent.id,
    text: textPart,
    taskId: evt.task.id,
    status: evt.task.status.state,
    ts: evt.task.status.timestamp ?? new Date().toISOString(),
  }])
  setOpen(true)
  setTimeout(() => scrollRef.current?.scrollTo({
    top: scrollRef.current.scrollHeight, behavior: "smooth"
  }), 50)
})
```

**⚠️ Stale closure 주의**:
기존 useEffect deps는 `[currentAgent?.id, currentApiKey]`만. 여기서 `agents`를 참조하면 최초 렌더링 값 고정 (이후 agents 변경이 handler에 반영 안 됨).

**해결 2가지**:
- **옵션 A (권장, 데모 단순)**: 필터 제거 — 모든 a2a_task_event 표시. 같은 유저 내 두 에이전트 케이스면 문제 없음.
- **옵션 B (정석)**: `const agentsRef = useRef(agents); agentsRef.current = agents;` 선언 후 handler에서 `agentsRef.current.map(...)` 사용. useEffect deps는 그대로.

**데모용 최종 코드 (필터 제거)**:
```typescript
socketInstance.on("a2a_task_event", (evt) => {
  if (cancelled) return
  console.log("[Console WS] a2a_task_event:", evt)

  const textPart =
    evt.task.message?.parts?.find((p: any) => p.type === "text")?.text ??
    evt.task.artifact?.parts?.find((p: any) => p.type === "text")?.text ??
    "(no text)"

  setMessages((m) => [...m, {
    role: "a2a",
    eventType: evt.type,
    fromName: evt.from_agent?.name ?? "unknown",
    toName: evt.to_agent?.name ?? "unknown",
    fromId: evt.from_agent?.id ?? "",
    toId: evt.to_agent?.id ?? "",
    text: textPart,
    taskId: evt.task.id,
    status: evt.task.status.state,
    ts: evt.task.status.timestamp ?? new Date().toISOString(),
  }])
  setOpen(true)
  setTimeout(() => scrollRef.current?.scrollTo({
    top: scrollRef.current.scrollHeight, behavior: "smooth"
  }), 50)
})
```

### 9-3. 렌더링 추가

기존 `messages.map(...)` 블록 안, role별 조건 렌더링에 **추가**:

```tsx
{msg.role === "a2a" && (
  <div className="flex items-start gap-2 p-3 rounded-lg bg-purple-50 border border-purple-200">
    <span className="text-purple-600 font-bold text-xs mt-0.5">🔀 A2A</span>
    <div className="flex-1 min-w-0">
      <div className="text-[11px] text-gray-600 mb-1 flex items-center gap-1 flex-wrap">
        <span className="font-semibold text-purple-700">{msg.fromName}</span>
        <span>→</span>
        <span className="font-semibold text-orange-700">{msg.toName}</span>
        <span className="text-[10px] text-gray-400 ml-auto">
          {msg.eventType} · {msg.taskId.slice(0, 8)}
        </span>
      </div>
      <div className="text-sm text-gray-900 whitespace-pre-wrap break-words">{msg.text}</div>
      <div className="text-[10px] text-gray-500 mt-1">
        status: <span className="font-semibold">{msg.status}</span> · {new Date(msg.ts).toLocaleTimeString()}
      </div>
    </div>
  </div>
)}
```

### ✅ 테스트

**T9.1 DevTools WS 연결 확인**:
웹 로그인 + 에이전트 선택 후 브라우저 DevTools → Network → WS 탭 → `/kaas` 소켓 연결 + `[Console WS] connected` 콘솔 로그.

**T9.2 수동 트리거 시 이벤트 수신**:
T5.5 curl 실행 → 브라우저 DevTools Console에 `[Console WS] a2a_task_event: {...}` 로그 표시 + Cherry Console 플로팅 창 자동 열림 + 🔀 A2A 보라색 박스 렌더링.

**T9.3 렌더링 내용 확인**:
박스에 `fromName → toName`, `eventType · taskId`, 본문 텍스트, `status: submitted` 표시.

**T9.4 여러 이벤트 누적**:
curl 3회 연속 실행 → 박스 3개가 순서대로 쌓이고 스크롤 자동 하단으로.

---

## Step 10: Single-Machine E2E

### 목표
Mac 한 대에서 두 에이전트 세션(다른 터미널) 띄우고 서로 task 주고받기.

### 준비

**10-0. 웹 준비**:
1. 브라우저로 웹 로그인
2. Mac 에이전트 선택 (`claude-mac`)
3. Cherry Console 플로팅 버튼 클릭 → 창 열기
4. DevTools Console 열어둔 채 대기

**10-1. 두 에이전트 터미널 기동**:

터미널 1 (Mac 에이전트 역할):
```bash
CHERRY_API_KEY=${MAC_API_KEY} CHERRY_API_URL=${API_URL} \
  node apps/agent-package/dist/cherry-agent.js
```

터미널 2 (Linux 에이전트 역할 — 같은 Mac에서):
```bash
CHERRY_API_KEY=${LINUX_API_KEY} CHERRY_API_URL=${API_URL} \
  node apps/agent-package/dist/cherry-agent.js
```

**10-2. 서버 로그 양쪽 연결 확인**:
```
[WS] ✓ connected: claude-mac (...)
[WS] ✓ connected: claude-linux (...)
```

### ✅ 테스트

**T10.1 Mac → Linux task 전송 (curl)**:
```bash
curl -X POST ${API_URL}/api/v1/kaas/a2a \
  -H "Content-Type: application/json" -H "x-api-key: ${MAC_API_KEY}" \
  -d '{
    "jsonrpc":"2.0","id":1,"method":"tasks/send",
    "params":{
      "executorAgentId":"'"${LINUX_AGENT_ID}"'",
      "message":{"role":"user","parts":[{"type":"text","text":"ping"}]}
    }
  }'
```

**동시 관찰**:
| 체크 | 확인 대상 |
|---|---|
| ☐ curl 응답 | `{"jsonrpc":"2.0","id":1,"result":{"id":"<TASK_ID>","status":{"state":"submitted"}}}` |
| ☐ 터미널 2 (Linux) stderr | `[A2A] ← incoming task <TASK_ID> from claude-mac: ping` |
| ☐ 브라우저 DevTools Console | `[Console WS] a2a_task_event: ...` |
| ☐ **Cherry Console 창** | 🔀 A2A 박스: "claude-mac → claude-linux · task_created · ping · status: submitted" |

Task ID를 기록.

**T10.2 Linux inbox 확인**:
```bash
curl "${API_URL}/api/v1/kaas/a2a/inbox" -H "x-api-key: ${LINUX_API_KEY}"
```
기대: 배열에 방금 task 있음, `status.state = "submitted"`.

**T10.3 Linux → Mac 응답**:
```bash
curl -X POST ${API_URL}/api/v1/kaas/a2a \
  -H "Content-Type: application/json" -H "x-api-key: ${LINUX_API_KEY}" \
  -d '{
    "jsonrpc":"2.0","id":2,"method":"tasks/respond",
    "params":{
      "taskId":"'"${TASK_ID}"'",
      "status":"completed",
      "output":{"parts":[{"type":"text","text":"pong"}]}
    }
  }'
```

**동시 관찰**:
| 체크 | 확인 |
|---|---|
| ☐ curl 응답 | status.state=completed |
| ☐ 터미널 1 (Mac) stderr | `[A2A] ✓ task <TASK_ID> completed: pong` |
| ☐ **Cherry Console** | 추가 🔀 A2A 박스: "claude-linux → claude-mac · task_responded · pong · status: completed" |

**T10.4 DB 최종 상태**:
```sql
SELECT id, status, input->'message'->'parts'->0->>'text' AS inp,
       output->'parts'->0->>'text' AS out
FROM kaas.agent_task WHERE id = '${TASK_ID}';
```
기대: status=completed, inp='ping', out='pong'.

**T10.5 3회 연속 반복**:
T10.1~T10.3을 매번 다른 텍스트로 **3회 연속** 성공. 각 회차마다 Cherry Console에 총 6개 박스(보낸 거 3 + 응답 3) 쌓임.

**→ Step 10 통과 시점에서 Mac 한 대로도 데모 가능한 상태.**

---

## Step 11: Linux 에이전트 배포

### 목표
원격 Linux 머신에 cherry-agent.js 설치 + 자동 기동.

### 11-1. 번들 파일 전송

Mac에서:
```bash
scp apps/agent-package/dist/cherry-agent.js user@linux-host:/home/user/cherry-agent/cherry-agent.js
```

또는 Linux에 이미 세팅돼 있으면 **업데이트만**:
```bash
rsync apps/agent-package/dist/cherry-agent.js user@linux-host:/home/user/cherry-agent/
```

### 11-2. Linux 환경 확인
```bash
ssh user@linux-host "node --version && which node"
```
기대: Node 18+.

### 11-3. Claude Code MCP 설정 (Linux)

Linux의 `~/.claude/settings.json` 또는 claude CLI로 등록:

```json
{
  "mcpServers": {
    "cherry-kaas": {
      "command": "node",
      "args": ["/home/user/cherry-agent/cherry-agent.js"],
      "env": {
        "CHERRY_API_KEY": "<LINUX_API_KEY>",
        "CHERRY_API_URL": "<AWS_API_URL>"
      }
    }
  }
}
```

### 11-4. Linux에서 직접 프로세스로 한 번 기동 (연결 확인)

```bash
ssh user@linux-host "CHERRY_API_KEY=<LINUX_API_KEY> CHERRY_API_URL=<AWS_API_URL> node /home/user/cherry-agent/cherry-agent.js"
```

### ✅ 테스트

**T11.1 WebSocket 연결 확인**:
Cherry 서버 로그에 `[WS] ✓ connected: claude-linux (...)` 출현.

**T11.2 Linux에서 inbox curl**:
```bash
ssh user@linux-host "curl -s ${API_URL}/api/v1/kaas/a2a/inbox -H 'x-api-key: ${LINUX_API_KEY}'"
```
기대: JSON 배열 (비어있어도 `[]`). 에러 나면 CORS/인증 문제 디버깅.

**T11.3 Linux Claude Code 기동 (옵션)**:
Linux에 Claude Code까지 있으면 MCP 자동 연결도 테스트:
```bash
ssh -t user@linux-host "claude"
```
→ MCP tool 목록에 `send_agent_task`, `read_agent_inbox`, `respond_to_task` 존재 확인.

---

## Step 12: Cross-Machine E2E

### 목표
Mac ↔ Linux (실제 다른 머신) A2A 왕복 + Cherry Console 실시간 표시.

### 준비

**12-0. 사전 상태**:
- Mac: Claude Code 실행 중, MCP 에이전트(`claude-mac`) 연결됨
- Linux: cherry-agent.js 기동 중, WebSocket 연결됨
- 웹: `claude-mac` 선택 상태, Cherry Console 열림, DevTools 열림
- 서버 로그 모니터링 중

### ✅ 테스트

**T12.1 Mac → Linux task 전송 (curl from Mac)**:
```bash
curl -X POST ${API_URL}/api/v1/kaas/a2a \
  -H "Content-Type: application/json" -H "x-api-key: ${MAC_API_KEY}" \
  -d '{
    "jsonrpc":"2.0","id":1,"method":"tasks/send",
    "params":{
      "executorAgentId":"'"${LINUX_AGENT_ID}"'",
      "message":{"role":"user","parts":[{"type":"text","text":"Hello from Mac"}]}
    }
  }'
```

**관찰 포인트** (동시에 확인):
- ☐ curl 응답 OK
- ☐ **Linux stderr** (ssh 세션): `[A2A] ← incoming task ... from claude-mac: Hello from Mac`
- ☐ **브라우저 Cherry Console**: 🔀 A2A 보라색 박스 즉시 생성
- ☐ Linux Claude Code가 켜져 있다면 MCP notification (아직 자동 처리 X — 유저 프롬프트 필요)

**T12.2 Linux → Mac 응답 (curl from Linux ssh)**:
```bash
ssh user@linux-host "curl -X POST ${API_URL}/api/v1/kaas/a2a \
  -H 'Content-Type: application/json' -H 'x-api-key: ${LINUX_API_KEY}' \
  -d '{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tasks/respond\",\"params\":{\"taskId\":\"${TASK_ID}\",\"status\":\"completed\",\"output\":{\"parts\":[{\"type\":\"text\",\"text\":\"ack from Linux\"}]}}}'"
```

**관찰**:
- ☐ curl 응답: status=completed
- ☐ **Mac의 cherry-agent stderr**: `[A2A] ✓ task ... completed: ack from Linux`
- ☐ **Cherry Console**: 두 번째 🔀 A2A 박스 (task_responded · ack from Linux)

**T12.3 Linux Claude Code로 자연어 트리거 (최고 난이도)**:
Linux Claude Code 프롬프트에서:
```
read_agent_inbox로 받은 task 확인하고,
submitted 상태인 첫 번째 task에
"reviewed by linux" 내용으로 respond_to_task 실행해줘
```

**관찰**:
- ☐ Linux Claude Code가 read_agent_inbox tool 호출
- ☐ 받은 task 인식
- ☐ respond_to_task tool 호출
- ☐ Mac stderr: `[A2A] ✓ task ... completed: reviewed by linux`
- ☐ Cherry Console에 응답 박스 표시

**T12.4 DB 최종 종합**:
```sql
SELECT
  t.id,
  ia.name AS initiator,
  ea.name AS executor,
  t.status,
  t.input->'message'->'parts'->0->>'text' AS input_text,
  t.output->'parts'->0->>'text' AS output_text,
  t.created_at, t.updated_at
FROM kaas.agent_task t
LEFT JOIN kaas.agent ia ON ia.id = t.initiator_id
LEFT JOIN kaas.agent ea ON ea.id = t.executor_id
WHERE ia.name IN ('claude-mac', 'claude-linux')
   OR ea.name IN ('claude-mac', 'claude-linux')
ORDER BY t.created_at DESC LIMIT 10;
```
기대: 상위 row에 initiator/executor/status/텍스트 모두 정확.

**T12.5 해피패스 3회 연속**:
T12.1 → T12.2 쌍을 **서로 다른 텍스트로 3회 연속** 성공.

---

## 🔧 디버깅 치트시트

| 증상 | 원인 후보 | 확인 |
|---|---|---|
| curl 응답 error.code=-32001 | api_key 오류 | env var / 에이전트 비활성 여부 |
| Executor not found | agent_id 오타 | DB `kaas.agent` 테이블 확인 |
| Linux stderr에 task 안 뜸 | WS 연결 끊김 | 서버 로그에 connect/disconnect |
| Cherry Console에 박스 안 뜸 | WS 미연결 | DevTools Network WS / `[Console WS] connected` 로그 |
| Console 박스 뜨지만 필터로 사라짐 | `agents` 배열 문제 | 필터 제거 후 재시도 |
| T12.1에서 executor offline | Linux agent 기동 안 됨 | ssh 세션 확인 |
| AWS CORS 에러 | 프론트 도메인 CORS 미등록 | api .env의 CORS_ORIGINS |

---

## 📋 전체 체크리스트 (30개)

### Backend
- [ ] T1.1~T1.4 DB 테이블 (4)
- [ ] T2.1~T2.2 Service/DTO 컴파일 (2)
- [ ] T3.1 Controller 컴파일 (1)
- [ ] T4.1 Gateway 컴파일 (1)
- [ ] T5.1~T5.10 Swagger (10)

### Agent
- [ ] T6.1~T6.2 MCP tools (2)
- [ ] T7.1 ws-client (1)
- [ ] T8.1~T8.3 번들 (3)

### Web
- [ ] T9.1~T9.4 Cherry Console (4)

### E2E
- [ ] T10.1~T10.5 Mac 단일 머신 (5)
- [ ] T11.1~T11.3 Linux 배포 (3)
- [ ] T12.1~T12.5 크로스 머신 (5)

**Total 41개 체크박스.** 모두 ☑️ 되면 완료.

---

## 🗓 작업 순서

**오늘 밤 (6~7시간)**:
- Step 0: 환경 확인
- Step 1~9: 백엔드 + MCP + Console UI
- Step 10: Mac 단일 머신 검증

**내일 오전 (1.5시간)**:
- Step 11: Linux 배포
- Step 12: 크로스 머신 검증

**Step 10 완료 시점에서 이미 "Mac 에이전트 2개 세션 간 A2A 통신 + Cherry Console 실시간 표시" 성공**.
Step 11~12는 실제 크로스 머신 검증이지만, 실패해도 데모 불가능하지 않음 (Mac 안 2세션으로 동일 시연 가능).
