/**
 * serialize — pure-function unit tests for Workshop → SKILL.md conversion.
 *
 * No Claude API. No Nest bootstrap. No filesystem writes. Run with:
 *   cd apps/api && npx ts-node --transpile-only src/modules/bench/cards/serialize.test.ts
 */

import {
  cardToSkillFile,
  buildMetaSkillFile,
  collectSkillFiles,
  toSavePayload,
  type BuildContext,
} from './serialize'
import type { AgentBuildInput } from './compose-runtime'

let passed = 0
let failed = 0

function ok(label: string, cond: boolean, detail?: string) {
  if (cond) {
    passed++
    console.log('  ✓', label)
  } else {
    failed++
    console.log('  ✗', label, detail ? `— ${detail}` : '')
  }
}

function section(title: string) {
  console.log('\n' + '─'.repeat(70))
  console.log(title)
  console.log('─'.repeat(70))
}

function ctx(overrides: Partial<BuildContext> = {}): BuildContext {
  return {
    buildId: 'build-a',
    buildName: 'Build A',
    agentId: 'clx12345678',
    installedAt: '2026-04-24T06:30:00Z',
    runId: 'abc12345',
    ...overrides,
  }
}

function emptyEquipped(): AgentBuildInput {
  return {
    prompt: null,
    mcp: null,
    skillA: null,
    skillB: null,
    skillC: null,
    orchestration: null,
    memory: null,
  }
}

/* ══════════ Test 1: prompt card → SKILL.md (mode file) ══════════ */
section('Test 1 — prompt card (inv-p-hunter) becomes Cherry Hunter Mode')
{
  const equipped = { ...emptyEquipped(), prompt: 'inv-p-hunter' }
  const f = cardToSkillFile('prompt', 'inv-p-hunter', equipped, ctx())
  ok('returns SkillFile', f !== null)
  if (f) {
    ok('dir is cherry-p-hunter', f.dir === 'cherry-p-hunter')
    ok('file is SKILL.md', f.file === 'SKILL.md')
    ok('name is Marketplace Hunter', f.name === 'Marketplace Hunter')
    ok("description mentions 'cherry hunter' trigger", /cherry hunter/i.test(f.description))
    ok('body contains cherry-workshop comment', f.body.includes('<!-- cherry-workshop'))
    ok('body contains card_id', f.body.includes('card_id: inv-p-hunter'))
    ok('body contains slot', f.body.includes('slot: prompt'))
    ok('body contains Cherry Hunter Mode heading', f.body.includes('# Cherry Hunter Mode'))
    ok('body contains Activation triggers section', f.body.includes('## Activation triggers'))
    ok('body contains systemPrompt content', f.body.includes('deal-hunting'))
    ok('slot is prompt', f.slot === 'prompt')
    ok('cardId is inv-p-hunter', f.cardId === 'inv-p-hunter')
  }
}

/* ══════════ Test 2: skill card → supporting SKILL.md ══════════ */
section('Test 2 — skill card (inv-s-json-strict) in skillB slot')
{
  const equipped = {
    ...emptyEquipped(),
    prompt: 'inv-p-quant',
    skillB: 'inv-s-json-strict',
  }
  const f = cardToSkillFile('skillB', 'inv-s-json-strict', equipped, ctx())
  ok('returns SkillFile', f !== null)
  if (f) {
    ok('dir is cherry-s-json-strict', f.dir === 'cherry-s-json-strict')
    ok('name is JSON Strict (supporting)', f.name === 'JSON Strict (supporting)')
    ok('slot is skillB', f.slot === 'skillB')
    ok('body contains promptSuffix', /pure JSON/i.test(f.body))
    ok('body mentions parent mode', /Supporting rule for Cherry Quant Mode/.test(f.body))
    ok("description says 'Supporting rule'", /Supporting rule/i.test(f.description))
  }
}

/* ══════════ Test 3: mcp slot returns null ══════════ */
section('Test 3 — mcp slot always returns null')
{
  const f = cardToSkillFile('mcp', 'inv-m-crypto', emptyEquipped(), ctx())
  ok('returns null for mcp slot', f === null)
}

/* ══════════ Test 4: orchestration slot returns null ══════════ */
section('Test 4 — orchestration slot always returns null')
{
  const f = cardToSkillFile(
    'orchestration',
    'inv-o-plan-execute',
    emptyEquipped(),
    ctx(),
  )
  ok('returns null for orchestration slot', f === null)
}

/* ══════════ Test 5: memory slot returns null ══════════ */
section('Test 5 — memory slot always returns null')
{
  const f = cardToSkillFile('memory', 'inv-me-short', emptyEquipped(), ctx())
  ok('returns null for memory slot', f === null)
}

/* ══════════ Test 6: unknown card id returns null ══════════ */
section('Test 6 — unknown card id (inv-x-bogus)')
{
  const f = cardToSkillFile('prompt', 'inv-x-bogus', emptyEquipped(), ctx())
  ok('returns null for unknown card id', f === null)
}

/* ══════════ Test 6.5: prompt mode pulls in skill bodies + orch process ══════════ */
section('Test 6.5 — prompt mode monolithic body pulls in skill/orch/memory')
{
  const equipped: AgentBuildInput = {
    prompt: 'inv-p-quant',
    mcp: 'inv-m-crypto',
    skillA: 'inv-s-decomp',
    skillB: 'inv-s-json-strict',
    skillC: 'inv-s-citation',
    orchestration: 'inv-o-plan-execute',
    memory: 'inv-me-short',
  }
  const f = cardToSkillFile('prompt', 'inv-p-quant', equipped, ctx())
  ok('returns SkillFile', f !== null)
  if (f) {
    ok('body contains quant mode heading', /# Cherry Quant Mode/.test(f.body))
    ok('body contains activation trigger "cherry quant"', /"cherry quant"/.test(f.body))
    ok("body references 'quant 모드로'", /quant 모드로/.test(f.body))
    ok('body contains decomp skill rule', /"step" field/.test(f.body))
    ok('body contains json-strict skill rule', /pure JSON/i.test(f.body))
    ok('body contains citation skill rule', /source:/i.test(f.body))
    ok('body contains plan-execute process', /plan_steps_executed/.test(f.body))
    ok('body contains memory note', /maxIterations=5/.test(f.body))
  }
}

/* ══════════ Test 7: buildMetaSkillFile ══════════ */
section('Test 7 — buildMetaSkillFile with full equip')
{
  const equipped: AgentBuildInput = {
    prompt: 'inv-p-hunter',
    mcp: 'inv-m-crypto',
    skillA: 'inv-s-decomp',
    skillB: null,
    skillC: null,
    orchestration: 'inv-o-plan-execute',
    memory: 'inv-me-short',
  }
  const f = buildMetaSkillFile(equipped, ctx())
  ok('returns SkillFile', f !== null)
  if (f) {
    ok('dir is cherry-build-meta', f.dir === 'cherry-build-meta')
    ok('file is SKILL.md', f.file === 'SKILL.md')
    ok('name is Build meta', f.name === 'Build meta')
    ok('description mentions Build A', f.description.includes('Build A'))
    ok('description warns metadata-only', /Metadata only/.test(f.description))
    ok('body contains build_id', f.body.includes('build_id: build-a'))
    ok('body contains prompt slot id', f.body.includes('prompt: inv-p-hunter'))
    ok('body contains null skillB', f.body.includes('skillB: null'))
    ok('body contains orchestration_id', f.body.includes('orchestration_id: plan-execute'))
    ok('body contains memory_mode', f.body.includes('memory_mode: short'))
    ok('body contains memory_max_iterations', f.body.includes('memory_max_iterations: 5'))
    ok('slot is _meta', f.slot === '_meta')
  }
}

/* ══════════ Test 8: empty equipped → buildMetaSkillFile null ══════════ */
section('Test 8 — empty build → buildMetaSkillFile returns null')
{
  const f = buildMetaSkillFile(emptyEquipped(), ctx())
  ok('returns null for empty build', f === null)
}

/* ══════════ Bonus: collectSkillFiles happy path ══════════ */
section('Test 9 — collectSkillFiles aggregates correctly')
{
  const equipped: AgentBuildInput = {
    prompt: 'inv-p-hunter',
    mcp: 'inv-m-crypto',
    skillA: 'inv-s-decomp',
    skillB: 'inv-s-json-strict',
    skillC: null,
    orchestration: 'inv-o-plan-execute',
    memory: 'inv-me-short',
  }
  const r = collectSkillFiles(equipped, ctx())
  ok('files.length === 3 (prompt + 2 skills)', r.files.length === 3)
  ok('files[0].slot === prompt', r.files[0]?.slot === 'prompt')
  ok('files[1].slot === skillA', r.files[1]?.slot === 'skillA')
  ok('skipped.length === 3 (mcp + orch + memory)', r.skipped.length === 3)
  ok(
    'mcp reason mentions "claude mcp add"',
    r.skipped.find((s) => s.slot === 'mcp')?.reason.includes('claude mcp add') ?? false,
  )
  ok(
    'orchestration reason mentions merge into mode SKILL.md',
    /merged into/.test(r.skipped.find((s) => s.slot === 'orchestration')?.reason ?? ''),
  )
}

/* ══════════ Bonus: toSavePayload shape ══════════ */
section('Test 10 — toSavePayload produces gateway-compatible payload')
{
  const f = cardToSkillFile('prompt', 'inv-p-hunter', { ...emptyEquipped(), prompt: 'inv-p-hunter' }, ctx())
  if (!f) {
    ok('SkillFile created', false)
  } else {
    let counter = 0
    const makeRequestId = () => `req-${++counter}`
    const p = toSavePayload(f, makeRequestId)
    ok('request_id is req-1', p.request_id === 'req-1')
    ok('concept_id is cherry-workshop-inv-p-hunter', p.concept_id === 'cherry-workshop-inv-p-hunter')
    ok('title === name', p.title === 'Marketplace Hunter')
    ok('summary === description', p.summary === f.description)
    ok('content_md === body', p.content_md === f.body)
    ok('target_dir starts with ~/.claude/skills/', p.target_dir.startsWith('~/.claude/skills/'))
    ok('target_file ends with SKILL.md', p.target_file.endsWith('SKILL.md'))
  }
}

/* ══════════ Bonus: meta toSavePayload concept_id ══════════ */
section('Test 11 — toSavePayload for _meta uses pre-computed cardId as concept_id')
{
  const equipped: AgentBuildInput = {
    ...emptyEquipped(),
    prompt: 'inv-p-hunter',
  }
  const meta = buildMetaSkillFile(equipped, ctx())
  if (!meta) {
    ok('meta SkillFile created', false)
  } else {
    const p = toSavePayload(meta, () => 'req-meta')
    ok(
      'concept_id starts with cherry-workshop-meta-',
      p.concept_id.startsWith('cherry-workshop-meta-'),
    )
    ok('does NOT have double cherry-workshop- prefix', !p.concept_id.startsWith('cherry-workshop-cherry-'))
    ok('target_dir is ~/.claude/skills/cherry-build-meta', p.target_dir === '~/.claude/skills/cherry-build-meta')
  }
}

/* ══════════ Summary ══════════ */
console.log('\n' + '═'.repeat(70))
console.log(`  ${passed} passed · ${failed} failed`)
console.log('═'.repeat(70))
if (failed > 0) process.exit(1)
