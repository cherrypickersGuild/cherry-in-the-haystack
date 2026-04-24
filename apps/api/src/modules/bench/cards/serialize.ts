/**
 * Workshop build → Claude Code SKILL.md serializer.
 *
 * Turns an `equipped` slot map (`{prompt, mcp, skillA, skillB, skillC,
 * orchestration, memory}` of card ids) into the payloads the WebSocket
 * save_skill_request flow already understands ([kaas-ws.gateway.ts:427]).
 *
 * Per `apps/docs/install-skill/1-work-guidelines.md`:
 *   - prompt / skill  cards → ~/.claude/skills/cherry-{p|s}-<short>/SKILL.md
 *   - mcp              card → no file (tool is activated via `claude mcp add`)
 *   - orchestration + memory → folded into cherry-build-meta/SKILL.md
 *   - Frontmatter is STRICTLY `name` + `description` (Claude Code compat).
 *     Custom metadata goes in a `<!-- cherry-workshop ... -->` comment block.
 */

import { CARD_REGISTRY } from './card-registry'
import type { AgentBuildInput } from './compose-runtime'
import type { SaveSkillRequestPayload } from '../../kaas/kaas-ws.gateway'
import { BENCH_SETS } from '../sets/set-definitions'

/** Extended slot key: regular equip slots + a synthetic `_meta` for the
 *  build summary SKILL.md. */
export type ExtSlotKey =
  | 'prompt'
  | 'mcp'
  | 'skillA'
  | 'skillB'
  | 'skillC'
  | 'orchestration'
  | 'memory'
  | '_meta'

export interface SkillFile {
  slot: ExtSlotKey
  /** Original card id (`inv-p-oracle`) or synthetic id for meta files. */
  cardId: string
  /** Directory relative to `~/.claude/skills/`, e.g. `cherry-p-oracle`. */
  dir: string
  /** Filename inside dir — always `SKILL.md` in this system. */
  file: string
  /** Frontmatter `name`. */
  name: string
  /** Frontmatter `description`. */
  description: string
  /** Body written after the frontmatter (includes `<!-- -->` meta comment). */
  body: string
}

export interface BuildContext {
  buildId: string
  buildName: string
  agentId: string
  installedAt: string
  runId: string
}

export interface SkipEntry {
  slot: string
  card_id: string | null
  reason: string
}

/** Card metadata — `name` + `description` used for SKILL.md frontmatter,
 *  `tag` is the mode trigger keyword (first set tag from workshop-mock).
 *  Duplicated from `apps/web/lib/workshop-mock.ts` — keep in sync manually. */
interface CardMeta {
  name: string
  description: string
  /** Primary set tag — becomes the `cherry <tag>` mode activator. */
  tag: string
}

const CARD_METADATA: Record<string, CardMeta> = {
  // prompts
  'inv-p-hunter': {
    name: 'Marketplace Hunter',
    description:
      "Activate when user says 'cherry hunter' or asks marketplace deal search. Strict JSON listings, no invention.",
    tag: 'hunter',
  },
  'inv-p-policy': {
    name: 'Policy Expert',
    description:
      "Activate when user says 'cherry policy' or asks Cherry docs questions. Cite doc IDs; abstain when missing.",
    tag: 'policy',
  },
  'inv-p-quant': {
    name: 'Quantitative Analyst',
    description:
      "Activate when user says 'cherry quant' or asks multi-asset crypto analysis. Strict JSON output, per-asset citations, step-by-step breakdown.",
    tag: 'quant',
  },
  'inv-p-grounded': {
    name: 'Grounded Researcher',
    description:
      "Activate when user says 'cherry grounded' or asks Cherry docs multi-hop research. Cite every fact, flag missing fields, never invent.",
    tag: 'grounded',
  },
  // skills — supporting rules, NOT independent modes
  'inv-s-decomp': {
    name: 'Multi-step Decomposition (supporting)',
    description:
      'Supporting rule for Cherry modes — break tasks into subtasks with a numeric "step" field per entity.',
    tag: '',
  },
  'inv-s-json-strict': {
    name: 'JSON Strict (supporting)',
    description:
      'Supporting rule for Cherry modes — output ONLY valid JSON, no prose, no fences.',
    tag: '',
  },
  'inv-s-citation': {
    name: 'Citation Discipline (supporting)',
    description:
      'Supporting rule for Cherry modes — every factual claim carries source + timestamp tag.',
    tag: '',
  },
  'inv-s-multihop': {
    name: 'Multi-hop Retrieval (supporting)',
    description:
      'Supporting rule for Cherry modes — one targeted search per sub-question, never a broad query.',
    tag: '',
  },
  'inv-s-abstention': {
    name: 'Abstention Discipline (supporting)',
    description:
      'Supporting rule for Cherry modes — flag missing fields explicitly, never invent.',
    tag: '',
  },
}

/** Export — used by install-build.service to craft the user-facing activation
 *  message (e.g. "Say 'cherry quant' to activate this build"). */
export function getPrimaryTag(promptCardId: string | null): string {
  if (!promptCardId) return 'cherry'
  const meta = CARD_METADATA[promptCardId]
  return meta?.tag || 'cherry'
}

/** Look up the sample task for a prompt card by matching its tag to a bench
 *  SET (SET ids look like `set-N-<tag>`). Single source of truth = SET defs.
 *  Returns null if no SET matches — caller falls back to a generic prompt. */
function taskForPromptCard(promptCardId: string | null): string | null {
  if (!promptCardId) return null
  const tag = CARD_METADATA[promptCardId]?.tag
  if (!tag) return null
  const set = BENCH_SETS.find((s) => s.id.endsWith(`-${tag}`))
  return set?.task ?? null
}

/** Build the full "copy this into Claude Code" string for the given prompt
 *  card. Combines the mode trigger with the matching bench SET's task so
 *  the Install Log stays in sync with whatever the SET definition says. */
export function buildActivationPrompt(promptCardId: string | null): string {
  const tag = getPrimaryTag(promptCardId)
  const task = taskForPromptCard(promptCardId)
  if (!task) return `cherry ${tag} 로 ...`
  return `cherry ${tag} 로 ${task}`
}

const SLOT_DIR_PREFIX: Partial<Record<ExtSlotKey, string>> = {
  prompt: 'cherry-p-',
  skillA: 'cherry-s-',
  skillB: 'cherry-s-',
  skillC: 'cherry-s-',
}

const META_DIR = 'cherry-build-meta'

/** Strip the `inv-[pms]-` prefix. `inv-p-oracle` → `oracle`. */
function shortId(cardId: string): string {
  return cardId.replace(/^inv-[pms]-/, '')
}

/** Build a `<!-- cherry-workshop ... -->` block with simple YAML-ish key:val
 *  pairs. Claude Code frontmatter parser ignores HTML comments, so this is
 *  safe to ship alongside the body. */
function commentMeta(fields: Record<string, unknown>): string {
  const lines: string[] = []
  for (const [k, v] of Object.entries(fields)) {
    if (v === null || v === undefined) {
      lines.push(`${k}: null`)
    } else if (typeof v === 'object') {
      lines.push(`${k}:`)
      for (const [k2, v2] of Object.entries(v as Record<string, unknown>)) {
        lines.push(`  ${k2}: ${v2 === null || v2 === undefined ? 'null' : String(v2)}`)
      }
    } else {
      lines.push(`${k}: ${String(v)}`)
    }
  }
  return `<!-- cherry-workshop\n${lines.join('\n')}\n-->\n\n`
}

/**
 * Convert one equip slot + card id into a SkillFile.
 *
 * BMad-style mode trigger pattern:
 * - prompt slot → MONOLITHIC mode SKILL.md (role + skill rules + orch + memory)
 *   that activates when user says `cherry <tag>` or matching natural language
 * - skillA/B/C → supporting reference files (always loaded, but not the
 *   primary mode trigger — their description says so explicitly)
 * - mcp/orchestration/memory → null (handled by meta or claude mcp add)
 *
 * Needs the FULL `equipped` map to synthesize the prompt-slot mode body
 * (pulls in skill suffixes, orch id, memory maxIterations).
 */
export function cardToSkillFile(
  slot: 'prompt' | 'skillA' | 'skillB' | 'skillC' | 'mcp' | 'orchestration' | 'memory',
  cardId: string | null,
  equipped: AgentBuildInput,
  ctx: BuildContext,
): SkillFile | null {
  if (slot === 'mcp' || slot === 'orchestration' || slot === 'memory') return null
  if (!cardId) return null

  const card = CARD_REGISTRY[cardId]
  if (!card) return null

  const meta = CARD_METADATA[cardId]
  if (!meta) return null

  const prefix = SLOT_DIR_PREFIX[slot]
  if (!prefix) return null

  if (card.type === 'prompt' && slot === 'prompt') {
    return buildPromptModeFile(cardId, card.systemPrompt, meta, equipped, ctx)
  }
  if (card.type === 'skill' && slot !== 'prompt') {
    return buildSupportingSkillFile(slot, cardId, card.promptSuffix, meta, equipped, ctx)
  }
  return null
}

/** Prompt-slot SKILL.md — the MONOLITHIC mode file. When Claude sees its
 *  description trigger, this body guides the whole build's behavior. */
function buildPromptModeFile(
  cardId: string,
  systemPrompt: string,
  meta: CardMeta,
  equipped: AgentBuildInput,
  ctx: BuildContext,
): SkillFile {
  const tag = meta.tag || 'cherry'
  const dir = `cherry-p-${shortId(cardId)}`

  // Collect companion skill rules — inline into the mode body
  const skillBodies: { title: string; body: string }[] = []
  for (const slot of ['skillA', 'skillB', 'skillC'] as const) {
    const sid = equipped[slot]
    if (!sid) continue
    const sCard = CARD_REGISTRY[sid]
    const sMeta = CARD_METADATA[sid]
    if (sCard?.type === 'skill' && sMeta) {
      skillBodies.push({ title: sMeta.name.replace(/ \(supporting\)$/, ''), body: sCard.promptSuffix })
    }
  }

  // Orchestration — append the process hint if plan-execute
  const orchCard = equipped.orchestration ? CARD_REGISTRY[equipped.orchestration] : null
  const orchId =
    orchCard?.type === 'orchestration' ? orchCard.orchId : null
  const orchSection =
    orchId === 'plan-execute'
      ? [
          '## Process — Plan-and-Execute',
          'Before answering, produce a numbered plan (`Step 1:`, `Step 2:`, ...). Then execute each step with tools. End your response with the literal field `plan_steps_executed: [1, 2, 3, ...]` listing the numbers you completed.',
        ].join('\n')
      : null

  // Memory — just note iteration budget
  const memCard = equipped.memory ? CARD_REGISTRY[equipped.memory] : null
  const memMode = memCard?.type === 'memory' ? memCard.mode : null
  const memMaxIter = memCard?.type === 'memory' ? memCard.maxIterations : null
  const memSection = memCard
    ? `## Memory: ${memMode} (maxIterations=${memMaxIter})`
    : null

  const header = commentMeta({
    type: 'cherry-mode',
    card_id: cardId,
    slot: 'prompt',
    tag,
    build_id: ctx.buildId,
    agent_id: ctx.agentId,
    installed_at: ctx.installedAt,
    run_id: ctx.runId,
  })

  const sections: string[] = []
  sections.push(`# Cherry ${capitalize(tag)} Mode`)
  sections.push('')

  sections.push('## Activation triggers')
  sections.push(`Switch into this mode when the user says any of:`)
  sections.push(`- "cherry ${tag}"`)
  sections.push(`- "${tag} 모드로 ..."`)
  sections.push(`- Or clearly asks a task matching the description above.`)
  sections.push(
    'When activated, follow every rule below strictly — do NOT paraphrase or relax the output format.',
  )
  sections.push('')

  sections.push('## Strict rules (non-negotiable)')
  sections.push('### Role')
  sections.push(systemPrompt)
  if (skillBodies.length > 0) {
    for (const s of skillBodies) {
      sections.push('')
      sections.push(`### ${s.title}`)
      sections.push(s.body)
    }
  }
  sections.push('')

  if (orchSection) {
    sections.push(orchSection)
    sections.push('')
  }
  if (memSection) {
    sections.push(memSection)
  }

  return {
    slot: 'prompt',
    cardId,
    dir,
    file: 'SKILL.md',
    name: meta.name,
    description: meta.description,
    body: header + sections.join('\n'),
  }
}

/** Skill-slot SKILL.md — supporting rule (NOT a mode trigger). */
function buildSupportingSkillFile(
  slot: 'skillA' | 'skillB' | 'skillC',
  cardId: string,
  promptSuffix: string,
  meta: CardMeta,
  equipped: AgentBuildInput,
  ctx: BuildContext,
): SkillFile {
  // Link back to the active mode trigger word
  const promptCardId = equipped.prompt
  const promptMeta = promptCardId ? CARD_METADATA[promptCardId] : null
  const parentTag = promptMeta?.tag || 'cherry'

  const header = commentMeta({
    type: 'supporting-skill',
    card_id: cardId,
    slot,
    parent_tag: parentTag,
    build_id: ctx.buildId,
    agent_id: ctx.agentId,
    installed_at: ctx.installedAt,
    run_id: ctx.runId,
  })
  const body =
    header +
    `# Supporting rule for Cherry ${capitalize(parentTag)} Mode\n\n` +
    `This rule is referenced by the \`cherry ${parentTag}\` mode — do NOT treat this as a standalone mode. It is loaded alongside the primary mode file.\n\n` +
    `## Rule\n${promptSuffix}\n`

  return {
    slot,
    cardId,
    dir: `cherry-s-${shortId(cardId)}`,
    file: 'SKILL.md',
    name: meta.name,
    description: meta.description,
    body,
  }
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

/** Assemble the synthetic `cherry-build-meta/SKILL.md` summarizing the whole
 *  build. Returns `null` if every slot is empty (caller should 400). */
export function buildMetaSkillFile(
  equipped: AgentBuildInput,
  ctx: BuildContext,
): SkillFile | null {
  const equippedCount = Object.values(equipped).filter(Boolean).length
  if (equippedCount === 0) return null

  const orchCard = equipped.orchestration ? CARD_REGISTRY[equipped.orchestration] : null
  const memCard = equipped.memory ? CARD_REGISTRY[equipped.memory] : null

  const orchestrationId =
    orchCard?.type === 'orchestration' ? orchCard.orchId : null
  const memoryMode = memCard?.type === 'memory' ? memCard.mode : null
  const memoryMaxIter = memCard?.type === 'memory' ? memCard.maxIterations : null

  const datePart = ctx.installedAt.slice(0, 10)
  const description = `Metadata only — do NOT activate as a mode. Records the ${ctx.buildName} build installed on ${datePart}.`

  const body =
    commentMeta({
      type: 'build-meta',
      build_id: ctx.buildId,
      build_name: ctx.buildName,
      agent_id: ctx.agentId,
      installed_at: ctx.installedAt,
      run_id: ctx.runId,
      slots: equipped as unknown as Record<string, unknown>,
      orchestration_id: orchestrationId,
      memory_mode: memoryMode,
      memory_max_iterations: memoryMaxIter,
    }) +
    'This skill file records which Workshop build was installed to this agent. Not a functional skill — metadata only.'

  return {
    slot: '_meta',
    cardId: `cherry-workshop-meta-${ctx.buildId}-${ctx.agentId.slice(0, 8)}`,
    dir: META_DIR,
    file: 'SKILL.md',
    name: 'Build meta',
    description,
    body,
  }
}

/** Walk the equip slots, collect SkillFiles for prompt/skillA/B/C, and
 *  record mcp/orchestration/memory as `skipped[]` entries with a reason. */
export function collectSkillFiles(
  equipped: AgentBuildInput,
  ctx: BuildContext,
): { files: SkillFile[]; skipped: SkipEntry[] } {
  const files: SkillFile[] = []
  const skipped: SkipEntry[] = []

  const slots: Array<'prompt' | 'skillA' | 'skillB' | 'skillC'> = [
    'prompt',
    'skillA',
    'skillB',
    'skillC',
  ]
  for (const slot of slots) {
    const cardId = equipped[slot]
    if (!cardId) continue // empty slot — neither saved nor skipped
    const file = cardToSkillFile(slot, cardId, equipped, ctx)
    if (file) files.push(file)
    // unknown card id → caller records in `failed[]` when this returns null
  }

  if (equipped.mcp) {
    skipped.push({
      slot: 'mcp',
      card_id: equipped.mcp,
      reason:
        'mcp slot — referenced by id only (tool activation handled by `claude mcp add`)',
    })
  }
  if (equipped.orchestration) {
    skipped.push({
      slot: 'orchestration',
      card_id: equipped.orchestration,
      reason: 'merged into the primary cherry mode SKILL.md (Process section)',
    })
  }
  if (equipped.memory) {
    skipped.push({
      slot: 'memory',
      card_id: equipped.memory,
      reason: 'merged into the primary cherry mode SKILL.md (Memory note)',
    })
  }

  return { files, skipped }
}

/** Convert a SkillFile to the payload shape `KaasWsGateway.requestSaveSkill`
 *  already expects ([kaas-ws.gateway.ts:427]). Synthetic `concept_id` per
 *  install-skill §4-4 so the existing DB record flow stays unchanged. */
export function toSavePayload(
  file: SkillFile,
  makeRequestId: () => string,
): SaveSkillRequestPayload {
  const conceptId =
    file.slot === '_meta'
      ? file.cardId // pre-computed: cherry-workshop-meta-<buildId>-<agentShort>
      : `cherry-workshop-${file.cardId}`
  const targetDir = `~/.claude/skills/${file.dir}`
  const targetFile = `${targetDir}/${file.file}`

  return {
    request_id: makeRequestId(),
    concept_id: conceptId,
    title: file.name,
    summary: file.description,
    content_md: file.body,
    target_dir: targetDir,
    target_file: targetFile,
  }
}
