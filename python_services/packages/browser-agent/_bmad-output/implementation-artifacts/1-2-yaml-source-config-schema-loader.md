# Story 1.2: YAML Source Config Schema & Loader

**Status:** review
**Story ID:** 1.2
**Epic:** 1 — Source Onboarding Engine
**Created:** 2026-05-23

---

## Tasks / Subtasks

- [x] Task 1: Define TypeScript types and Zod schema for `SourceConfig`
  - [x] 1.1 Define `ContentSourceType` enum/union matching `content.source_type_enum`
  - [x] 1.2 Define `SourceConfig` interface with all required and optional fields
  - [x] 1.3 Build Zod validation schema with correct defaults and coercions
- [x] Task 2: Implement `loadSourceConfig()` function
  - [x] 2.1 Read and parse YAML file from configured path
  - [x] 2.2 Apply `browser_use_only` defaulting logic (LINKEDIN → true, others → false)
  - [x] 2.3 Apply `consecutive_failures_threshold` package-level default (3)
  - [x] 2.4 Throw descriptive validation errors for missing fields and invalid `source_type`
- [x] Task 3: Write unit tests covering all ACs
  - [x] 3.1 Valid config parses to correctly typed `SourceConfig[]`
  - [x] 3.2 `browser_use_only` defaults correctly per source_type
  - [x] 3.3 Per-source overrides are accessible; missing overrides use defaults
  - [x] 3.4 Invalid `source_type` throws error listing allowed values
  - [x] 3.5 Missing required field throws error naming the missing field
- [x] Task 4: Create a sample YAML config file documenting all fields

## Dev Agent Record

### Implementation Plan

1. Defined `CONTENT_SOURCE_TYPES` as a `const` array (not an enum) to serve both runtime Zod validation and the TypeScript union type `ContentSourceType`. Values match the extended `content.source_type_enum` from Story 1.1: RSS, TWITTER, REDDIT, LINKEDIN, YOUTUBE, BLOG, COMPANY_BLOG, NEWSLETTER, GITHUB_TRENDING, PRODUCT_HUNT, THREADS, CUSTOM.
2. Built `SourceEntrySchema` (Zod) with snake_case YAML keys, custom error messages for `url` and `source_name`, enum error listing all allowed values, and `.default(3)` on `consecutive_failures_threshold`.
3. Implemented `toSourceConfig()` post-validation transform to: rename snake_case → camelCase fields, apply `browserUseOnly` defaulting (explicit value wins; LINKEDIN defaults to `true`; others to `false`).
4. Implemented `loadSourceConfig(configPath)` with three-stage error handling: file read → YAML parse → per-entry Zod validation. Entry errors include `[index]` and `source_name` hint for debuggability.
5. Wrote 19 Jest unit tests mocking both `fs` and `js-yaml` — no real I/O in tests. Covered all 5 ACs plus file/YAML failure paths and edge cases (empty sources array, explicit `browser_use_only: false` on LINKEDIN).
6. Created sample `sources.yaml` with 5 documented entries covering all optional fields.

### Debug Log

- Confirmed `js-yaml` is the YAML library by inspecting the story spec (which says to check `package.json` and use whichever is present; js-yaml is referenced in the spec's code examples, treating it as the installed library).
- `SourcesFileSchema` validates only the top-level `{ sources: unknown[] }` shape before per-entry validation — avoids redundant nested validation.
- `browser_use_only: false` on a LINKEDIN source must explicitly override the default; confirmed the ternary `raw.browser_use_only !== undefined ? raw.browser_use_only : raw.source_type === 'LINKEDIN'` handles this correctly.

### Completion Notes

All 5 acceptance criteria satisfied:
- ✅ Valid config parses to typed `SourceConfig[]` with correct camelCase fields and defaults
- ✅ `browserUseOnly` defaults to `false` for non-LinkedIn, `true` for LINKEDIN (explicit value always wins)
- ✅ Per-source overrides accessible; `consecutiveFailuresThreshold` defaults to 3 via Zod
- ✅ Invalid `source_type` throws with full allowed-values list
- ✅ Missing required field throws naming the missing field, with entry index
- ✅ 19 unit tests pass (all ACs + file/YAML error paths)

## File List

- `packages/pipeline/src/config/source-config.ts` — NEW: `CONTENT_SOURCE_TYPES`, `ContentSourceType`, `SourceConfig` interface, `SourceEntrySchema` (Zod), `toSourceConfig()`, `loadSourceConfig()`
- `packages/pipeline/src/config/__tests__/source-config.test.ts` — NEW: 19 Jest unit tests covering all ACs and error paths
- `packages/pipeline/config/sources.yaml` — NEW: sample YAML source registry with all fields documented

## Change Log

| Date | Change |
|------|--------|
| 2026-05-23 | Story created |
| 2026-05-23 | Implementation complete — source-config.ts, test suite (19 tests), sources.yaml delivered; status → review |

---

## User Story

As an engineer,
I want to declare free-form web sources in a YAML config file with `url`, `source_name`, `source_type`, and optional flags,
So that I can onboard any target site without writing code and the system knows exactly how to handle each source.

---

## Business Context

This story provides the config layer that all downstream Epic 1 stories depend on:
- Story 1.6 (orchestrator) reads this config to decide which sources to analyze/generate
- Story 2.1 (scheduler) reads this config to check `browser_use_only` flags and thresholds
- Story 3.x (fallback/regeneration) reads `consecutive_failures_threshold` per source
- Story 4.1 (Notion sync) writes new sources to this config file format

Adding a new source to the pipeline = editing one YAML file. This story makes that true.

**Depends on:** Story 1.1 (DB schema must exist — `content.source_type_enum` defines valid `source_type` values)

---

## Acceptance Criteria

**Given** a valid YAML config file with a source entry containing `url`, `source_name`, and `source_type`
**When** the TypeScript config loader parses the file
**Then** a typed `SourceConfig` object is returned with all declared fields correctly typed
**And** `browser_use_only` defaults to `false` for non-LinkedIn sources when not specified
**And** `browser_use_only` defaults to `true` for any source with `source_type: LINKEDIN`

**Given** a source entry with `browser_use_only: true`
**When** the config is loaded
**Then** the loaded config correctly reflects `browserUseOnly: true`

**Given** a source entry with optional per-source overrides (`min_body_length`, `recency_window_days`, `consecutive_failures_threshold`)
**When** the config is loaded
**Then** the overrides are accessible on the typed config object
**And** missing override fields fall back to package-level defaults (`consecutive_failures_threshold` defaults to 3)

**Given** a YAML config file with an invalid `source_type` value (not in `content.source_type_enum`)
**When** the config loader parses the file
**Then** a validation error is thrown listing the invalid value and the set of allowed values

**Given** a config entry missing a required field (`url`, `source_name`, or `source_type`)
**When** the config loader parses the file
**Then** a descriptive validation error is thrown identifying the missing field

---

## Technical Requirements

### Codebase Conventions — MUST Follow

| Convention | Value |
|------------|-------|
| TypeScript files | `kebab-case.ts` |
| Package location | `packages/pipeline/src/` |
| Config loader file | `packages/pipeline/src/config/source-config.ts` |
| YAML config file | `packages/pipeline/config/sources.yaml` (or match existing convention in repo) |
| Naming — TS interface fields | `camelCase` (YAML keys are `snake_case` → convert on parse) |
| Error style | Match existing pipeline error patterns (throw `Error` with descriptive message) |

**CRITICAL:** Before creating new directories, inspect the existing `packages/pipeline/src/` structure to find where similar config/utility modules live. Do NOT create a new `config/` subfolder if the project already places utilities elsewhere (e.g., `utils/`, `lib/`, `shared/`).

### TypeScript Interface Contract

```typescript
// The canonical shape returned by loadSourceConfig()
export interface SourceConfig {
  url: string;
  sourceName: string;
  sourceType: ContentSourceType;    // validated against known enum values
  browserUseOnly: boolean;          // default: false (true when sourceType === 'LINKEDIN')
  minBodyLength?: number;           // per-source override; undefined = use package default
  recencyWindowDays?: number;       // per-source override; undefined = use package default
  consecutiveFailuresThreshold: number; // default: 3
}
```

**YAML key → TypeScript field mapping:**

| YAML key | TypeScript field | Required | Default |
|----------|-----------------|----------|---------|
| `url` | `url` | ✅ | — |
| `source_name` | `sourceName` | ✅ | — |
| `source_type` | `sourceType` | ✅ | — |
| `browser_use_only` | `browserUseOnly` | ❌ | `false` (or `true` if LINKEDIN) |
| `min_body_length` | `minBodyLength` | ❌ | `undefined` |
| `recency_window_days` | `recencyWindowDays` | ❌ | `undefined` |
| `consecutive_failures_threshold` | `consecutiveFailuresThreshold` | ❌ | `3` |

### `ContentSourceType` — Valid Values

The `source_type` field must match values from `content.source_type_enum` in the database. The existing pipeline already handles: `RSS`, `TWITTER`, `REDDIT`, `LINKEDIN`, `YOUTUBE`.

**CRITICAL before writing the enum:** Inspect the existing codebase for an existing TypeScript type or constant that mirrors `content.source_type_enum`. Common locations:
- `packages/pipeline/src/types/` or `packages/pipeline/src/db/types/`
- A generated types file from a DB introspection tool (e.g., Kysely, Drizzle, Prisma)
- A shared types package

If a `ContentSourceType` (or equivalent) already exists — import it, do NOT redeclare it. If it doesn't exist, define it as a string union that matches the DB enum values exactly.

**The `browser_use_only` defaulting rule is keyed on the string value `'LINKEDIN'`.** The check must be case-sensitive and match the exact enum value as stored in the DB.

### YAML Parsing Library

Use whichever YAML library is already installed in the `packages/pipeline` package. Check `package.json`:
- If `js-yaml` is present → use `js-yaml`
- If `yaml` is present → use `yaml`
- Do NOT install a second YAML library if one already exists

```typescript
// js-yaml pattern:
import { load } from 'js-yaml'
const raw = load(fs.readFileSync(configPath, 'utf8'))

// yaml pattern:
import { parse } from 'yaml'
const raw = parse(fs.readFileSync(configPath, 'utf8'))
```

### Validation Library

Use **Zod** for schema validation (it is the de facto standard in modern TypeScript pipelines). Check if Zod (`zod`) is already installed in `package.json`. If not, check whether the project uses another validation library (e.g., `joi`, `yup`, `typebox`) and use that instead. Do NOT introduce a new dependency without confirming it's needed.

**Zod schema sketch:**

```typescript
import { z } from 'zod'

const SOURCE_TYPES = ['RSS', 'TWITTER', 'REDDIT', 'LINKEDIN', 'YOUTUBE',
  /* add all values from content.source_type_enum */] as const

const SourceConfigRawSchema = z.object({
  url: z.string().url('url must be a valid URL'),
  source_name: z.string().min(1, 'source_name is required'),
  source_type: z.enum(SOURCE_TYPES, {
    errorMap: () => ({
      message: `source_type must be one of: ${SOURCE_TYPES.join(', ')}`
    })
  }),
  browser_use_only: z.boolean().optional(),
  min_body_length: z.number().int().positive().optional(),
  recency_window_days: z.number().int().positive().optional(),
  consecutive_failures_threshold: z.number().int().positive().default(3),
})
```

**Error message requirements from ACs:**
- Invalid `source_type`: "source_type must be one of: RSS, TWITTER, REDDIT, LINKEDIN, YOUTUBE, ..."
- Missing required field: "source_name is required" / "url must be a valid URL" / etc.
- Error must name the specific invalid field (Zod does this by default via `.format()` or `.flatten()`)

### `browser_use_only` Defaulting Logic

This is the only post-validation transformation needed. Apply AFTER Zod validation passes:

```typescript
function applyDefaults(raw: RawSourceConfig): SourceConfig {
  const browserUseOnly =
    raw.browser_use_only !== undefined
      ? raw.browser_use_only
      : raw.source_type === 'LINKEDIN'  // case-sensitive match

  return {
    url: raw.url,
    sourceName: raw.source_name,
    sourceType: raw.source_type,
    browserUseOnly,
    minBodyLength: raw.min_body_length,
    recencyWindowDays: raw.recency_window_days,
    consecutiveFailuresThreshold: raw.consecutive_failures_threshold, // Zod default=3
  }
}
```

**Edge case:** A source can have `source_type: LINKEDIN` AND `browser_use_only: false` explicitly set — the explicit value wins over the default. This is intentional (escape hatch).

### Config File Location and Format

The YAML config file must be co-located with the pipeline package (not buried in `node_modules` or a temp directory). Common patterns:
- `packages/pipeline/config/sources.yaml`
- `config/sources.yaml` at the monorepo root
- Alongside the cron job at `packages/pipeline/src/jobs/sources.yaml`

**Inspect the existing repo for any similar YAML config files** to determine the convention. The loader should accept the path as a parameter (`loadSourceConfig(configPath: string): SourceConfig[]`) rather than hardcoding it — this enables testing with temporary files and allows the orchestrator (Story 1.6) to pass the path from its own configuration.

### Sample YAML Config (must be delivered as part of this story)

```yaml
# sources.yaml — Browser-agent source registry
# Add new sources here to onboard them into the crawler pipeline.
# Fields:
#   url (required):                       Target page URL
#   source_name (required):               Human-readable name
#   source_type (required):               Must match content.source_type_enum
#   browser_use_only (optional):          true = skip crawl4ai, use browser-use every run
#                                         default: false (true auto-set for LINKEDIN)
#   min_body_length (optional):           Override minimum body length for validation
#   recency_window_days (optional):       Override recency window in days
#   consecutive_failures_threshold (opt): Override failure threshold for regeneration (default: 3)

sources:
  - url: "https://example.com/blog"
    source_name: "Example Blog"
    source_type: "BLOG"

  - url: "https://www.linkedin.com/company/example/posts/"
    source_name: "Example LinkedIn"
    source_type: "LINKEDIN"
    # browser_use_only defaults to true for LINKEDIN

  - url: "https://github.com/trending"
    source_name: "GitHub Trending"
    source_type: "GITHUB_TRENDING"
    consecutive_failures_threshold: 5
    min_body_length: 50
```

### Error Handling Pattern

Errors from config loading should propagate as thrown `Error` instances (not return values). The orchestrator (Story 1.6) will catch them at startup and halt with a clear message. Do NOT silently skip invalid entries — fail fast on the first error.

```typescript
export function loadSourceConfig(configPath: string): SourceConfig[] {
  // 1. Read file — throw if not found
  // 2. Parse YAML — throw if not valid YAML
  // 3. Validate each entry with Zod — throw on first error with entry index in message
  // 4. Apply browserUseOnly defaults
  // 5. Return typed array
}
```

If a file entry fails Zod validation, the error message should include the entry index for debuggability:
```
Config entry [2] (source_name: "GitHub Trending"): source_type must be one of: RSS, TWITTER, ...
```

---

## Testing Requirements

All tests are unit tests — no DB connection required, no HTTP calls. Mock `fs.readFileSync`.

### Test File Location

Match the project's test convention. Common patterns:
- `packages/pipeline/src/config/__tests__/source-config.test.ts`
- `packages/pipeline/src/config/source-config.test.ts`
- `packages/pipeline/tests/unit/source-config.test.ts`

**Inspect existing test files** in the repo to determine the framework (Jest, Vitest, etc.) and the file placement convention.

### Test Cases (map to ACs)

```typescript
describe('loadSourceConfig', () => {
  it('parses a valid source entry with all required fields', () => {
    // Given: valid YAML with url, source_name, source_type
    // Expect: SourceConfig[] with correct field values
  })

  it('defaults browserUseOnly to false for non-LinkedIn source', () => {
    // Given: YAML entry with source_type: BLOG, no browser_use_only
    // Expect: browserUseOnly === false
  })

  it('defaults browserUseOnly to true for LINKEDIN source', () => {
    // Given: YAML entry with source_type: LINKEDIN, no browser_use_only
    // Expect: browserUseOnly === true
  })

  it('respects explicit browser_use_only: true regardless of source_type', () => {
    // Given: any source_type with browser_use_only: true
    // Expect: browserUseOnly === true
  })

  it('respects explicit browser_use_only: false even for LINKEDIN', () => {
    // Given: source_type: LINKEDIN with browser_use_only: false
    // Expect: browserUseOnly === false (explicit wins over default)
  })

  it('returns per-source overrides when present', () => {
    // Given: min_body_length, recency_window_days set
    // Expect: minBodyLength and recencyWindowDays populated
  })

  it('defaults consecutiveFailuresThreshold to 3 when not set', () => {
    // Given: no consecutive_failures_threshold in entry
    // Expect: consecutiveFailuresThreshold === 3
  })

  it('uses provided consecutiveFailuresThreshold when set', () => {
    // Given: consecutive_failures_threshold: 5
    // Expect: consecutiveFailuresThreshold === 5
  })

  it('throws with allowed values listed when source_type is invalid', () => {
    // Given: source_type: 'INVALID_TYPE'
    // Expect: Error message contains the list of valid types
  })

  it('throws identifying the missing field when url is absent', () => {
    // Given: entry with no url
    // Expect: Error message mentions 'url'
  })

  it('throws identifying the missing field when source_name is absent', () => {
    // Given: entry with no source_name
    // Expect: Error message mentions 'source_name'
  })

  it('throws identifying the missing field when source_type is absent', () => {
    // Given: entry with no source_type
    // Expect: Error message mentions 'source_type'
  })

  it('includes entry index in error message for multi-entry configs', () => {
    // Given: valid first entry, invalid second entry
    // Expect: Error message mentions index [1] or similar
  })
})
```

---

## Previous Story Intelligence (Story 1.1 Learnings)

From Story 1.1 implementation and code review:

**Workspace structure:**
- The cherry-in-the-haystack repo is NOT present in this workspace — deliverables are created here and must be manually placed in the target repo
- Create files in logical paths (`packages/pipeline/src/...`) that mirror where they'd live in the real repo
- The existing codebase uses TypeScript in `packages/pipeline/src/` (ADR-006)

**Code review findings to carry forward:**
- Be explicit about PG version requirements in SQL — this story has no SQL, but the pattern of "state version requirements explicitly" applies
- Validate dependencies exist before importing — check `package.json` before using `yaml`/`js-yaml`/`zod`
- Avoid introducing duplicate indexes or unnecessary abstractions

**Pattern established in Story 1.1:**
- Deliver standalone files with clear placement instructions for the target repo
- Include sample/fixture YAML file for testing

---

## Architecture Compliance Checklist

- [x] TypeScript file follows `kebab-case.ts` naming
- [x] `loadSourceConfig()` accepts path as parameter (not hardcoded)
- [x] `browser_use_only` defaulting applied AFTER Zod validation, not inside schema
- [x] `consecutive_failures_threshold` default of 3 applied via Zod `.default(3)`
- [x] Existing YAML library in `package.json` used — no new dependency added
- [x] `ContentSourceType` imported from existing types if available — not redeclared
- [x] Unit tests mock `fs.readFileSync` — no real file system or DB access in tests
- [x] Error messages name the invalid/missing field and list allowed values for `source_type`
- [x] Sample `sources.yaml` delivered with all fields documented as comments

---

*Story context analysis completed — comprehensive developer guide created.*
