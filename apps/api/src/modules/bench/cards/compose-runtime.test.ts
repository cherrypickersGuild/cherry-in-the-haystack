/**
 * composeRuntime — pure-function unit tests.
 *
 * No Claude API. No Nest bootstrap. Run with:
 *   cd apps/api && npx ts-node --transpile-only src/modules/bench/cards/compose-runtime.test.ts
 */

import { composeRuntime, type AgentBuildInput } from './compose-runtime'

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

function emptyBuild(): AgentBuildInput {
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

/* ══════════ Test 1: empty build ══════════ */
section('Test 1 — Empty build')
{
  const r = composeRuntime(emptyBuild())
  ok('systemPrompt is undefined', r.systemPrompt === undefined)
  ok('tools array empty', r.tools.length === 0)
  ok('no dispatcher', r.toolDispatcher === undefined)
  ok('maxIterations default 5', r.maxIterations === 5)
  ok('memoryMode default short', r.memoryMode === 'short')
  ok('orchestrationId default standard', r.orchestrationId === 'standard')
  ok('appliedSlots all false/0', !r.appliedSlots.prompt && !r.appliedSlots.mcp && !r.appliedSlots.memory)
  ok('skillsActive=0', r.appliedSlots.skillsActive === 0)
  ok('skillsIgnored=0 (backward compat)', r.appliedSlots.skillsIgnored === 0)
  ok('orchestrationActive=false', r.appliedSlots.orchestrationActive === false)
}

/* ══════════ Test 2: prompt only ══════════ */
section('Test 2 — Prompt only (oracle)')
{
  const r = composeRuntime({ ...emptyBuild(), prompt: 'inv-p-oracle' })
  ok('systemPrompt defined', r.systemPrompt !== undefined)
  ok('systemPrompt contains "crypto market analyst"', /crypto market analyst/i.test(r.systemPrompt ?? ''))
  ok('no skill suffix appended', !r.systemPrompt?.includes('\n\n'))
  ok('skillsActive=0', r.appliedSlots.skillsActive === 0)
  ok('prompt=true', r.appliedSlots.prompt === true)
}

/* ══════════ Test 3: prompt + skillA (json-strict) ══════════ */
section('Test 3 — Prompt + 1 skill')
{
  const r = composeRuntime({
    ...emptyBuild(),
    prompt: 'inv-p-oracle',
    skillA: 'inv-s-json-strict',
  })
  const p = r.systemPrompt ?? ''
  ok('systemPrompt has 2 sections (split by \\n\\n)', p.split('\n\n').length === 2)
  ok('contains base prompt', /crypto market analyst/i.test(p))
  ok('contains json-strict suffix', /ONLY valid JSON/i.test(p))
  ok('skillsActive=1', r.appliedSlots.skillsActive === 1)
}

/* ══════════ Test 4: prompt + skillA/B/C (3 suffixes) ══════════ */
section('Test 4 — Prompt + 3 skills (all different)')
{
  const r = composeRuntime({
    ...emptyBuild(),
    prompt: 'inv-p-quant',
    skillA: 'inv-s-decomp',
    skillB: 'inv-s-json-strict',
    skillC: 'inv-s-citation',
  })
  const p = r.systemPrompt ?? ''
  const sections = p.split('\n\n')
  ok('4 sections in systemPrompt (base + 3 skills)', sections.length === 4, `got ${sections.length}`)
  ok('section 0 = quant base', /quantitative crypto analyst/i.test(sections[0]))
  ok('has decomp clause', /subtasks/i.test(p))
  ok('has json-strict clause', /ONLY valid JSON/i.test(p))
  ok('has citation clause', /source or citation/i.test(p))
  ok('skillsActive=3', r.appliedSlots.skillsActive === 3)
}

/* ══════════ Test 5: dedup — same suffix equipped twice ══════════ */
section('Test 5 — Dedup same skill across 2 slots')
{
  const r = composeRuntime({
    ...emptyBuild(),
    prompt: 'inv-p-oracle',
    skillA: 'inv-s-citation',
    skillB: 'inv-s-citation', // same card
  })
  const p = r.systemPrompt ?? ''
  const sections = p.split('\n\n')
  ok('only 2 sections (dedup worked)', sections.length === 2, `got ${sections.length}`)
  ok('skillsActive=2 (count is raw, dedup is text-level)', r.appliedSlots.skillsActive === 2)
}

/* ══════════ Test 6: orchestration card → orchestrationId ══════════ */
section('Test 6 — Orchestration card selection')
{
  const std = composeRuntime({ ...emptyBuild(), orchestration: 'inv-o-standard' })
  ok('standard → orchestrationId=standard', std.orchestrationId === 'standard')
  ok('standard → orchestrationActive=false', std.appliedSlots.orchestrationActive === false)

  const plan = composeRuntime({ ...emptyBuild(), orchestration: 'inv-o-plan-execute' })
  ok('plan-execute → orchestrationId=plan-execute', plan.orchestrationId === 'plan-execute')
  ok('plan-execute → orchestrationActive=true', plan.appliedSlots.orchestrationActive === true)

  const rep = composeRuntime({ ...emptyBuild(), orchestration: 'inv-o-self-repair' })
  ok('self-repair → orchestrationId=self-repair', rep.orchestrationId === 'self-repair')
  ok('self-repair → orchestrationActive=true', rep.appliedSlots.orchestrationActive === true)
}

/* ══════════ Test 7: memory maxIterations mapping ══════════ */
section('Test 7 — Memory mode mapping')
{
  const none = composeRuntime({ ...emptyBuild(), memory: 'inv-me-none' })
  ok('none → maxIter=2', none.maxIterations === 2)
  const short = composeRuntime({ ...emptyBuild(), memory: 'inv-me-short' })
  ok('short → maxIter=5', short.maxIterations === 5)
  const retr = composeRuntime({ ...emptyBuild(), memory: 'inv-me-retrieval' })
  ok('retrieval → maxIter=10', retr.maxIterations === 10)
}

/* ══════════ Test 8: full 7-slot build ══════════ */
section('Test 8 — Full 7-slot build (SET 4 ideal)')
{
  const r = composeRuntime({
    prompt: 'inv-p-quant',
    mcp: 'inv-m-crypto',
    skillA: 'inv-s-decomp',
    skillB: 'inv-s-json-strict',
    skillC: 'inv-s-citation',
    orchestration: 'inv-o-plan-execute',
    memory: 'inv-me-short',
  })
  ok('prompt=true', r.appliedSlots.prompt === true)
  ok('mcp=true', r.appliedSlots.mcp === true)
  ok('memory=true', r.appliedSlots.memory === true)
  ok('skillsActive=3', r.appliedSlots.skillsActive === 3)
  ok('orchestrationActive=true', r.appliedSlots.orchestrationActive === true)
  ok('orchestrationId=plan-execute', r.orchestrationId === 'plan-execute')
  ok('1 tool registered', r.tools.length === 1)
  ok('tool name=get_crypto_price', r.tools[0]?.name === 'get_crypto_price')
  ok('maxIter=5 (short)', r.maxIterations === 5)
  ok('memoryMode=short', r.memoryMode === 'short')
  ok('systemPrompt has 4 sections', (r.systemPrompt ?? '').split('\n\n').length === 4)
}

/* ══════════ Report ══════════ */
console.log('\n' + '━'.repeat(70))
console.log(`RESULT: ${passed} passed · ${failed} failed`)
console.log('━'.repeat(70))
if (failed > 0) process.exit(1)
