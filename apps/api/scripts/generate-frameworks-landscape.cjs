#!/usr/bin/env node
/**
 * Landscape 자동 생성 (Frameworks Best / Prompting Best 공용)
 *
 * 입력: 빌딩블락스 서빙본(apps/web/public/building-blocks/entities.json)
 * 출력: DATA_DIR/<page>/<page>-landscape.json  (page = frameworks | prompting)
 *
 * 카드 = 셀렉터(entity_type[, topic]) 목록. 카드당 복합점수 top5.
 *   정렬 = stars → vendor권위 → verified → 설명길이 → 원본순
 * 식별자(entityKey) = "<entity_type>|<name>"
 *
 * 재생성 '병합': source:"admin" 카드는 선택 유지(표시데이터만 갱신), source:"auto"만 재계산.
 * 기획서: apps/docs/frameworks-landscape-admin-curation-plan.md
 */
const fs = require('fs')
const path = require('path')

const REPO = path.resolve(__dirname, '..', '..', '..')
const BB_SRC = process.env.BUILDING_BLOCKS_PATH
  || path.join(REPO, 'apps/web/public/building-blocks/entities.json')
const DATA_DIR = process.env.DATA_DIR || path.join(REPO, 'apps/api/storage')

const TOP_N = 5

/* ── 페이지 정의 ──
   카드.sel = [{ type, topic? }] — topic 생략 시 모든 topic에서 해당 type. */
const PAGES = [
  {
    page: 'frameworks',
    cards: [
      { key: 'framework',    label: 'Framework',       sel: [{ type: 'framework' }] },
      { key: 'library',      label: 'Library',         sel: [{ type: 'library' }] },
      { key: 'client_sdk',   label: 'Client SDK',      sel: [{ type: 'client_sdk' }] },
      { key: 'server',       label: 'Server',          sel: [{ type: 'server' }] },
      { key: 'platform',     label: 'Platform',        sel: [{ type: 'platform' }] },
      { key: 'tool',         label: 'Tool',            sel: [{ type: 'tool' }] },
      { key: 'product',      label: 'Product',         sel: [{ type: 'product' }] },
      { key: 'spec_registry',label: 'Spec & Registry', sel: [{ type: 'spec' }, { type: 'registry' }] },
    ],
  },
  {
    page: 'prompting',
    cards: [
      { key: 'techniques',        label: 'Techniques',         sel: [{ topic: 'prompt', type: 'technique' }] },
      { key: 'guides',            label: 'Guides',             sel: [{ topic: 'prompt', type: 'guide' }, { topic: 'skill', type: 'guide' }] },
      { key: 'prompt_tools',      label: 'Prompt Tools',       sel: [{ topic: 'prompt', type: 'tool' }] },
      { key: 'prompt_libraries',  label: 'Prompt Libraries',   sel: [{ topic: 'prompt', type: 'library' }] },
      { key: 'datasets',          label: 'Datasets',           sel: [{ topic: 'prompt', type: 'dataset' }] },
      { key: 'skills',            label: 'Skills',             sel: [{ topic: 'skill', type: 'skill' }] },
      { key: 'skill_marketplaces',label: 'Skill Marketplaces', sel: [{ topic: 'skill', type: 'marketplace' }] },
      { key: 'skill_specs',       label: 'Skill Specs',        sel: [{ topic: 'skill', type: 'spec' }] },
    ],
  },
]

/* 유명/공식 vendor (권위 가점) */
const KNOWN_VENDOR = /openai|microsoft|google|anthropic|meta|cloudflare|hugging|nvidia|amazon|aws|databricks|langchain|deepset|qdrant|weaviate|mlflow|zenml|arize|helicone|langfuse|nomic|unsloth|vllm|ollama/i

const isUsableUrl = (u) => typeof u === 'string' && /^https?:\/\//i.test(u)

/* ── 설명 정리: 접두어 제거 + 길이 컷 ── */
function cleanDesc(raw) {
  let s = (raw || '').trim()
  s = s.replace(/^verified\s+(from|via)\b[^:]*:\s*/i, '')
  s = s.replace(/^\s*[-–—]\s*/, '')
  if (s) s = s[0].toUpperCase() + s.slice(1)
  return s
}
function cut(s, max) {
  if (s.length <= max) return s
  const t = s.slice(0, max)
  const sp = t.lastIndexOf(' ')
  return (sp > max * 0.6 ? t.slice(0, sp) : t).replace(/[,;:\s]+$/, '') + '…'
}
function shortDesc(clean) {
  const first = clean.split(/(?<=[.!?])\s/)[0] || clean
  return cut(first, 90)
}

/* ── 이모지: 타입 테마 풀 + 유명 오버라이드 ── */
const TYPE_EMOJI = {
  framework:  ['🧩', '🕸', '🔗', '⚙️', '🧠', '🤖', '🐝', '🪄', '🛠', '📦'],
  library:    ['📚', '📖', '🧰', '🔤', '📐', '🧮'],
  client_sdk: ['🔌', '🧩', '💻', '🖱', '⌨️'],
  server:     ['🖥', '🗄', '📡', '🧱', '⚡', '🔩'],
  platform:   ['🏗', '🌐', '🧭', '🏙', '🚀', '🛰'],
  tool:       ['🔧', '🛠', '🧰', '🔨', '⚗️', '📊'],
  product:    ['📦', '🎁', '🛒', '💡', '🚀', '🧴'],
  spec:       ['📐', '📜', '📋'],
  registry:   ['📇', '🗂', '📒'],
  technique:  ['🔬', '🧪', '💡', '🎯', '🧠', '✨'],
  guide:      ['📘', '📖', '📚', '🗺', '🧭'],
  dataset:    ['🗂', '📊', '🧾', '🔢', '📁'],
  skill:      ['⚡', '🎓', '🧠', '🛠', '✨', '🎯'],
  marketplace:['🛒', '🏬', '🧩', '🔖', '🏪'],
}
const EMOJI_OVERRIDE = {
  'LangChain': '🔗', 'LangGraph': '🕸', 'CrewAI': '👥', 'AutoGen': '🧠', 'Mem0': '🧠',
  'Ollama': '🦙', 'vLLM': '⚡', 'DSPy': '⚙️', 'Guidance': '🧭', 'Langfuse': '🔭',
  'LangSmith': '🧪', 'Phoenix': '🐦', 'Helicone': '🍯', 'MarkItDown': '📄',
}
function pickEmoji(name, type) {
  if (EMOJI_OVERRIDE[name]) return EMOJI_OVERRIDE[name]
  const pool = TYPE_EMOJI[type] || ['•']
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return pool[h % pool.length]
}

/** 서빙본 → [{e, type, topic}] (usable url만) */
function loadAll(src) {
  const all = []
  for (const t of src.topics || []) {
    for (const g of t.groups || []) {
      for (const e of g.items || []) {
        if (isUsableUrl(e.u)) all.push({ e, type: g.t, topic: t.k })
      }
    }
  }
  return all
}

function toItem({ e, type }) {
  const clean = cleanDesc(e.d)
  return {
    entityKey: `${type}|${e.n}`,
    name: e.n,
    desc: shortDesc(clean),
    detail: cut(clean, 300),
    url: e.u,
    stars: e.s ?? null,
    emoji: pickEmoji(e.n, type),
    icon: e.i || null,
    verified: e.vf === 1,
    vendor: e.v || null,
  }
}

function rank(pool) {
  return pool
    .map((x, i) => ({ x, i }))
    .sort((a, b) => {
      const A = a.x.e, B = b.x.e
      const sa = A.s ?? -1, sb = B.s ?? -1
      if (sb !== sa) return sb - sa
      const va = KNOWN_VENDOR.test(A.v || '') ? 1 : 0
      const vb = KNOWN_VENDOR.test(B.v || '') ? 1 : 0
      if (vb !== va) return vb - va
      const fa = A.vf === 1 ? 1 : 0, fb = B.vf === 1 ? 1 : 0
      if (fb !== fa) return fb - fa
      const da = (A.d || '').length, db = (B.d || '').length
      if (db !== da) return db - da
      return a.i - b.i
    })
    .map((o) => o.x)
}

function matchSel(entry, sel) {
  return sel.some((s) => entry.type === s.type && (s.topic == null || entry.topic === s.topic))
}

function autoCard(card, all) {
  let pool = all.filter((x) => matchSel(x, card.sel))
  const seen = new Set()
  pool = pool.filter((x) => {
    const k = `${x.type}|${x.e.n.toLowerCase()}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  return rank(pool).slice(0, TOP_N).map(toItem)
}

function generatePage(def, all, now) {
  const OUT = path.join(DATA_DIR, def.page, `${def.page}-landscape.json`)
  let prev = null
  if (fs.existsSync(OUT)) { try { prev = JSON.parse(fs.readFileSync(OUT, 'utf8')) } catch { prev = null } }
  const prevByKey = {}
  for (const c of prev?.categories || []) prevByKey[c.key] = c

  const freshByKey = {}
  for (const x of all) freshByKey[`${x.type}|${x.e.n}`] = toItem(x)

  const categories = def.cards.map((card) => {
    const old = prevByKey[card.key]
    if (old && old.source === 'admin') {
      const items = []
      for (const it of old.items || []) {
        const fresh = freshByKey[it.entityKey]
        if (fresh) items.push(fresh)
        else console.warn(`  · [${def.page}/${card.key}] 소멸 항목 제거: ${it.entityKey}`)
      }
      return { key: card.key, label: card.label, sel: card.sel, source: 'admin', updatedAt: old.updatedAt, updatedBy: old.updatedBy, items }
    }
    return { key: card.key, label: card.label, sel: card.sel, source: 'auto', updatedAt: now, updatedBy: null, items: autoCard(card, all) }
  })

  const out = { page: def.page, generatedAt: now, source: 'building-blocks/entities.json', categories }
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
  console.log(`\n[${def.page}] → ${path.relative(REPO, OUT)}`)
  for (const c of categories) {
    console.log(`  [${c.source}] ${c.label.padEnd(18)} ${c.items.length}개  ` +
      c.items.map((i) => i.name + (i.stars != null ? `(★${i.stars})` : '')).join(', '))
  }
}

/* ══════════════════════════════════════════════════════════════════
   Overview 구성 (App Store 편집형) — overview-config.json
   기획서: apps/docs/overview-builder-admin-plan.md
   현행 자동 로직(분야 섞기 · 스타순 · slice)을 config로 산출.
   ════════════════════════════════════════════════════════════════ */
function overviewItem(e, type, topicLabel) {
  const clean = cleanDesc(e.d)
  return {
    entityKey: `${type}|${e.n}`,
    name: e.n,
    desc: cut(clean, 200),
    url: e.u,
    stars: e.s ?? null,
    icon: e.i || null,
    topic: topicLabel,   // 표시용 토픽 라벨 (meta = topic · type)
    type,
  }
}

function generateOverview(src, now) {
  const OUT = path.join(DATA_DIR, 'overview', 'overview-config.json')

  // 토픽별 정렬 목록(스타 desc) + 라벨
  const byTopic = {}
  for (const t of src.topics || []) {
    const flat = (t.groups || [])
      .flatMap((g) => (g.items || []).filter((e) => isUsableUrl(e.u)).map((e) => overviewItem(e, g.t, t.l)))
      .sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0))
    byTopic[t.k] = flat
  }
  const pick = (k, from, to) => (byTopic[k] || []).slice(from, to)
  const skill = byTopic['skill'] || []

  // 자동 슬롯 산출 (현행 nd-overview-page.tsx와 동일)
  const autoHero = [skill[0], (byTopic['mcp'] || [])[0], (byTopic['agent'] || [])[0], skill[1], (byTopic['prompt'] || [])[0]].filter(Boolean)
  const autoSpotlight = skill.slice(2, 4)
  const autoJustAdded = skill.slice(4, 10)
  const autoBlocks = [
    { key: 'mcp', title: 'Pick an MCP Server', banner: pick('mcp', 1, 3), rows: pick('mcp', 3, 7) },
    { key: 'agent', title: 'Build Your Agent', banner: pick('agent', 1, 3), rows: pick('agent', 3, 7) },
    { key: 'prompt', title: 'Working with Prompts', banner: [], rows: pick('prompt', 1, 7) }, // 배너 없이 목록만
  ]

  // 최신 표시데이터 조회용(admin 슬롯 갱신)
  const freshByKey = {}
  for (const arr of Object.values(byTopic)) for (const it of arr) freshByKey[it.entityKey] = it
  const refresh = (items) => (items || []).map((it) => freshByKey[it.entityKey]).filter(Boolean)

  // 기존 파일 병합(admin 슬롯 보존)
  let prev = null
  if (fs.existsSync(OUT)) { try { prev = JSON.parse(fs.readFileSync(OUT, 'utf8')) } catch { prev = null } }

  const slotAuto = (extra, items) => ({ source: 'auto', updatedAt: now, updatedBy: null, ...extra, items })
  const mergeListSlot = (prevSlot, autoExtra, autoItems) => {
    if (prevSlot && prevSlot.source === 'admin') {
      return { ...prevSlot, items: refresh(prevSlot.items) }
    }
    return slotAuto(autoExtra, autoItems)
  }

  const title = prev?.title && prev.title.source === 'admin'
    ? prev.title
    : { source: 'auto', updatedAt: now, updatedBy: null, heading: 'Newly Discovered', subheading: "Editor's Choice" }

  const blocks = autoBlocks.map((b) => {
    const prevBlock = (prev?.blocks || []).find((x) => x.key === b.key)
    if (prevBlock && prevBlock.source === 'admin') {
      return { ...prevBlock, banner: refresh(prevBlock.banner), rows: refresh(prevBlock.rows) }
    }
    return { key: b.key, source: 'auto', updatedAt: now, updatedBy: null, title: b.title, banner: b.banner, rows: b.rows }
  })

  const config = {
    page: 'overview',
    generatedAt: now,
    source: 'building-blocks/entities.json',
    title,
    hero: mergeListSlot(prev?.hero, {}, autoHero),
    spotlight: mergeListSlot(prev?.spotlight, { label: 'Worth a Look', sub: 'Standouts this week' }, autoSpotlight),
    justAdded: mergeListSlot(prev?.justAdded, { label: 'Just Added', sub: 'Most recent updates' }, autoJustAdded),
    blocks,
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(config, null, 2))
  console.log(`\n[overview] → ${path.relative(REPO, OUT)}`)
  console.log(`  hero ${config.hero.items.length} · spotlight ${config.spotlight.items.length} · justAdded ${config.justAdded.items.length} · blocks ${blocks.length}`)
  console.log('  hero:', config.hero.items.map((i) => i.name).join(', '))
}

function main() {
  const src = JSON.parse(fs.readFileSync(BB_SRC, 'utf8'))
  const all = loadAll(src)
  const now = new Date().toISOString()
  for (const def of PAGES) generatePage(def, all, now)
  generateOverview(src, now)
}

main()
