---
name: todo-manager
description: "Morning task planning workflow. Pulls weekly goals and tasks from Notion (깃잔심, 결AI, Life Dashboard), guides MoSCoW prioritization in batches of 3, syncs top 3 Must-haves to Todoist, integrates Google Calendar for time blocking, and surfaces delegation/dependency insights. Use whenever the user asks about tasks, todos, what to do today, planning their day or week, or says things like '오늘 할 일 알려줘', '오늘 뭐 해야 해?', '할 일 정리해줘', 'my tasks', 'what's on my plate', '오늘의 할 일', 'morning routine', 'plan my day', 'let's prioritize'. Even if the user just says '오늘' or '할 일' in passing, this skill should activate."
---

# Todo Manager — Morning Planning Workflow

## Overview

A conversational morning planning ritual. Notion holds the plans and relationships; Todoist holds today's execution. This skill walks through priorities step by step so the user starts the day with clarity, not overwhelm.

**Core principle:**
- **Notion** = planning, tracking, relationships (깃잔심, 결AI, Life Dashboard)
- **Todoist** = daily execution, max 3 items
- **Google Calendar** = time blocking around commitments
- Don't mix these boundaries.

---

## Workflow (7 steps)

```
Step 1 → Weekly goals (layer 2 iceberg)
          ↓ if missing → quarterly goals → ask user
Step 2 → MoSCoW prioritization (batches of 3 from Notion dashboards)
Step 3 → Sync top 3 Must-haves → Todoist
Step 4 → Google Calendar time blocking
Step 5 → PM view: delegate list from 담당자
Step 6 → Dependency check: what's blocked, what needs attention
Step 7 → Close: one life goal line
```

Each step should feel like a natural conversation turn, not a wall of output. Pause after each step. Let the user respond before moving on.

---

## Step 1: Weekly Goals (Opener)

Start the conversation by surfacing this week's goals — the "layer 2" of the iceberg (beneath daily tasks, above quarterly targets).

### Data source: Weekly Goals
- Look for a Notion page or database tracking weekly goals/OKRs for the current week
- If no weekly goals exist, fall back to **quarterly goals** and ask: "이번 주 목표가 아직 없는데, 분기 목표 기준으로 이번 주에 집중할 걸 정해볼까요?"

### Output format:
```
🎯 이번 주 목표

1. [Goal 1]
2. [Goal 2]
3. [Goal 3]

이 목표들 맞아요? 수정할 거 있으면 알려주세요.
```

Wait for user confirmation or edits before proceeding.

---

## Step 2: MoSCoW Prioritization

Pull all active tasks from Notion dashboards and present them in **batches of 3**. For each batch, the user assigns a MoSCoW category.

### Data sources (query all in parallel)

**First, get current sprint IDs:**

**결AI Sprints**
- Database ID: `180f199e-df7c-8027-bd8e-e1f8b4ac435b`
- Filter: `스프린트 상태 = 현재` (current sprint only)

**깃잔심 Sprints**
- Database ID: `188f199e-df7c-8037-aaee-d08bd245fc38`
- Filter: `스프린트 상태 = 현재` (current sprint only)

**Then query tasks using sprint IDs:**

**깃잔심 Tasks**
- Database ID: `11bf199e-df7c-80e8-8b93-d30b231a56b6`
- Filter: `Status = In progress OR Not started` AND `Sprint contains current sprint ID`
- Properties: Name, Status, 팀, Assign (담당자), Deadline, Sprint
- **Display 담당자 in output**

**결AI Tasks**
- Database ID: `17df199e-df7c-80b5-a11a-c4522931226d`
- Filter: `상태 = 진행 중 OR 시작 전` (Korean status names!) AND `스프린트 contains current sprint ID`
- Properties: 이름, 상태, 분류, priority, 마감일, Sprint, 담당자
- **Display 담당자 in output**

**Life Tasks**
- Database ID: `699578d9-a829-466a-9b1d-6fa2be68df61`
- Filter: `Status != Done`
- Properties: Task, Context, Status, Due

**Also fetch active epics for context:**

**깃잔심 Epics**
- Database ID: `1f8f199e-df7c-8084-b033-cb4ed1f2bf8b`
- Filter: `상태 = In progress` (English status name!)

**결AI Epics**
- Database ID: `253f199e-df7c-809f-93a4-f973c58631ad`
- Filter: `Status = In progress` (English status name!)

**Life Epics**
- Database ID: `9ef13c69-838f-4246-9922-198c9e536cb2`
- Filter: `Status != Done`

### MoSCoW Categories

| Category | Meaning | Emoji |
|----------|---------|-------|
| **Must** | 오늘 꼭 끝내야 함 | 🔴 |
| **Should** | 오늘 하면 좋고, 이번 주엔 꼭 | 🟠 |
| **Could** | 시간 남으면 | 🟡 |
| **Won't** | 오늘은 패스 | ⚪ |

### Batch interaction:

Present 3 tasks at a time, grouped by project where possible:

```
📋 Batch 1/4 — 결AI

1. 301 지난번에 못 한 것 (한결) — 진행 중
2. MCP 사례 찾기 — 진행 중
3. 딥 리서치: 강의 시장 — 진행 중

MoSCoW 카테고리를 정해주세요 (M/S/C/W)
예: 1-M 2-S 3-W
```

User responds with their categorization, then show next batch. Continue until all tasks are categorized.

After all batches, show the summary:

```
📊 MoSCoW 정리 완료

🔴 Must (3): task1, task2, task3
🟠 Should (2): task4, task5
🟡 Could (4): task6, task7, task8, task9
⚪ Won't (2): task10, task11
```

---

## Step 3: Todoist Sync (Top 3 Only)

Only the **top 3 Must-haves** sync to Todoist. This keeps the execution layer focused.

### Todoist Inbox
- Project ID: `6VmwcHpG8Jx8GrjM`

### Before syncing:
```
📥 Todoist에 들어갈 Top 3:

1. [Must task 1]
2. [Must task 2]
3. [Must task 3]

이 세 개로 확정할까요? 바꾸고 싶으면 말해주세요.
```

Wait for confirmation, then sync via Todoist API.

### Todoist API:
```
GET  https://api.todoist.com/api/v1/tasks?filter=today | overdue
POST https://api.todoist.com/api/v1/tasks
  { content, project_id: "6VmwcHpG8Jx8GrjM", priority: 4 }
```

Priority mapping for the 3 Must-haves: all get `priority: 4` (P1). If the user wants to distinguish within the 3, first item = P1 (4), second = P2 (3), third = P2 (3).

---

## Step 4: Google Calendar — Time Blocking

> **TODO: Fill in calendar credentials and API details.**

Read today's calendar events and suggest time blocks around them.

### Flow:
1. Fetch today's events from Google Calendar
2. Show existing commitments
3. Suggest time blocks for the 3 Must-haves

```
📅 오늘 캘린더

09:00-10:00  회의 (결AI 주간)
14:00-15:00  1on1 (김가영)
-- 빈 슬롯 --
10:00-12:00  [Must 1] 시간 제안
15:00-17:00  [Must 2] + [Must 3] 시간 제안

이 타임블록 괜찮아요?
```

### Google Calendar API (placeholder):
```
# TODO: Add credential path, calendar ID, and auth method
# Expected: service account or OAuth token
# Scope: read calendar events, create time blocks
```

---

## Step 5: PM View — Delegate List

Surface all tasks that have **담당자 (assignees)** — these are things delegated to others that need follow-up.

### From the same Notion task data already fetched:

```
👥 체크리스트 — 누가 뭘 하고 있나

결AI:
- 한결: 301 지난번에 못 한 것 (🔄 진행 중)
- 경재: 시장 조사 리뷰 (⏳ 시작 전)
- novelus: 시장 조사 리뷰 (⏳ 시작 전)

깃잔심:
- 김가영: 뉴스레터 작업 Agent (🔄 진행 중)
- 양규: RSS patchnote aggregator (🔄 진행 중)
- 경재: 데이터 소스 편입 (⏳ 시작 전)
- 한결: 데이터 소스 편입 (⏳ 시작 전)

오늘 체크해야 할 사람 있어요?
```

The point is to surface who needs a nudge, who might be blocked, and who to check in with.

---

## Step 6: Dependency Check

Look across all active tasks and epics for:
- **Blocked items** — tasks waiting on something/someone else
- **Risks** — deadlines approaching with no progress
- **Gaps** — important work with no one assigned

```
⚠️ 의존성 & 리스크

🚫 막힘:
- [task] — [reason it's blocked]

⏰ 마감 임박:
- [task] — due [date], status: [status]

❓ 담당자 없음:
- [task] — no assignee, might fall through

이 중에서 오늘 풀어야 할 거 있어요?
```

This step requires reading between the lines of the data — check if tasks with close deadlines are still "Not started", or if multiple tasks depend on the same person who might be overloaded.

---

## Step 7: Close — Life Goal

End with a single line from a life goals Notion page. Just one line, not a list.

> **TODO: Add Notion page ID for life goals source.**

```
🌟 [One meaningful line from life goals]
```

Rotate or randomly pick one if there are multiple. The point is to close with perspective, not pressure. Don't explain it or expand on it — just the line.

---

## API Reference

### Notion API (via MCP)

Use the Notion MCP tools available in the environment. Key operations:

```
# Query a database
mcp__notion__API-query-data-source
  data_source_id: "<database_id>"
  filter: { ... }

# Retrieve a page
mcp__notion__API-retrieve-a-page
  page_id: "<page_id>"
```

### Todoist API (via HTTP)

```
GET  /api/v1/tasks?filter=today | overdue
POST /api/v1/tasks
Headers: Authorization: Bearer $TODOIST_API_TOKEN
```

### Google Calendar API (placeholder)

```
# TODO: Add when credentials are configured
```

---

## Environment Variables

- `NOTION_API_TOKEN` — Notion API token (or use MCP)
- `TODOIST_API_TOKEN` — Todoist API token
- `GOOGLE_CALENDAR_*` — Calendar credentials (TODO)

---

## Output Rules

**Telegram compatibility:** Use code blocks or list format — markdown tables break in Telegram.

**Pacing:** Don't dump everything at once. Each step is a conversation turn. Present, pause, wait for user input, then proceed.

**Language:** Respond in Korean when the user speaks Korean. Mix English terms (MoSCoW, Must, Should) with Korean explanations naturally.

---

## Reference

Detailed source mapping: `references/task-sources-mapping.md`
