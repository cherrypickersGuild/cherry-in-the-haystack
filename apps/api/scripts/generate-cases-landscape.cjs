#!/usr/bin/env node
/**
 * Cases Best landscape 생성 (Engineering의 Frameworks Best와 동일 패턴)
 * 입력: apps/web/public/cases/entities.json
 * 출력: DATA_DIR/<category>/<category>-landscape.json  (category = case-studies|domain-applications|product-discovery)
 *   → 카테고리별로 상위 8 도메인 카드 × 최신 5개. LandscapeSection이 그대로 읽는다.
 * 기획서: apps/docs/cases-data-and-page-plan.md
 */
const fs = require('fs')
const path = require('path')

const REPO = path.resolve(__dirname, '..', '..', '..')
const SRC = process.env.CASES_PATH || path.join(REPO, 'apps/web/public/cases/entities.json')
const DATA_DIR = process.env.DATA_DIR || path.join(REPO, 'apps/api/storage')

const CATS = ['case-studies', 'domain-applications', 'product-discovery']
/* 카드별로 다른 색 (Engineering Frameworks Best와 동일 팔레트). 8 도메인 카드에 순서대로 배정. */
const PALETTE = [
  { c: '#4B78F0', bg: '#EEF2FD' }, // blue
  { c: '#2E8B6F', bg: '#E7F4EF' }, // green
  { c: '#7C3AED', bg: '#F3EFFA' }, // purple
  { c: '#0194E2', bg: '#E6F4FD' }, // cyan
  { c: '#D4854A', bg: '#FEF3E2' }, // orange
  { c: '#5B3D87', bg: '#F3EFFA' }, // dark purple
  { c: '#C94B6E', bg: '#FDF0F3' }, // cherry
  { c: '#DC2626', bg: '#FDECEC' }, // red
]
const TOP_DOMAINS = 8
const PER_DOMAIN = 5

/* 프론트 nd-cases-page.tsx와 동일한 도메인 테마 이모지 풀 */
const THEME_POOLS = [
  [/health|medic|clinical|patient|pharma|biotech|diagnos/, ['🏥', '💊', '🩺', '🧬', '🩻', '🧪', '🫀', '🦠']],
  [/financ|fintech|bank|trading|invest|insurance|payment|credit/, ['💰', '💳', '📈', '🏦', '💵', '🪙', '📊', '🧾']],
  [/educat|learn|academia|tutor|school|student|course/, ['🎓', '📚', '✏️', '🧑‍🏫', '📖', '🧮', '🖍', '📝']],
  [/legal|\blaw\b|compliance|privacy|contract|court/, ['⚖️', '📜', '🏛', '🔏', '📝', '🗂', '👨‍⚖️']],
  [/agricultur|farm|crop|harvest/, ['🌾', '🚜', '🌱', '🥕', '🐄', '🍃', '☀️']],
  [/energy|grid|power|electric|solar/, ['⚡', '🔋', '🌞', '💡', '🔌', '🏭', '🌬']],
  [/manufactur|factory|industrial|production/, ['🏭', '⚙️', '🔧', '🛠', '📦', '🤖', '🔩']],
  [/e-?commerce|retail|shopping|store/, ['🛒', '🛍', '🏬', '💳', '📦', '🏷', '🧾']],
  [/deliver|mobility|transport|logistic|supply|driving|route|fleet/, ['🚚', '📦', '🗺', '🛵', '🚛', '🧭', '📍']],
  [/social|network|community|feed/, ['💬', '👥', '📱', '❤️', '🔔', '📢', '🫂']],
  [/media|streaming|entertain|content/, ['🎬', '📺', '🍿', '🎞', '📸', '🎙', '🎭']],
  [/gaming|game|player/, ['🎮', '🕹', '👾', '🎲', '🏆', '🎯']],
  [/travel|hospitality|tourism|hotel/, ['✈️', '🏨', '🗺', '🧳', '🏖', '🗽', '🧭']],
  [/security|cyber|threat|fraud/, ['🔒', '🛡', '🔑', '🚨', '🕵️', '🔐', '⚠️']],
  [/customer service|support|helpdesk/, ['🎧', '💬', '📞', '🤝', '🛎', '✉️']],
  [/human resource|recruit|\bhr\b|career|hiring|job/, ['👥', '📋', '🧑‍💼', '🤝', '📄', '🎯']],
  [/real estate|property|housing/, ['🏠', '🏢', '🔑', '📍', '🏘', '📐']],
  [/marketing/, ['📣', '📊', '🎯', '📈', '✍️', '🪧']],
  [/information retrieval|search|knowledge/, ['🔍', '📚', '🗂', '🧠', '📇']],
  [/workflow|orchestrat|automation|process/, ['🔄', '⚙️', '🧩', '🛠', '📋']],
  [/writing|copywrit|content generat/, ['✍️', '📝', '📄', '✒️', '📰', '🖋']],
  [/image|design|graphic/, ['🎨', '🖼', '🖌', '✨', '📐', '🖍']],
  [/video/, ['🎥', '🎞', '📹', '🎬', '📽', '🎦']],
  [/audio|voice|speech|music/, ['🎙', '🔊', '🗣', '🎧', '🎵', '🎹']],
  [/productivity/, ['📋', '✅', '🗓', '📌', '⏱', '🧷']],
  [/chatbot|assistant|conversation/, ['🤖', '💬', '🧠', '✨', '🗨', '💡']],
  [/software|\btech\b|developer|engineering|code/, ['💻', '⌨️', '🖥', '🔌', '🧑‍💻', '🧩', '🛠']],
]
const CAT_POOL = {
  'case-studies': ['📄', '📊', '🔬', '🧩', '💡', '📈', '🗂', '🧠'],
  'domain-applications': ['🧩', '🌐', '🎯', '🛠', '💡', '📌', '🧭'],
  'product-discovery': ['✨', '🚀', '💡', '🧩', '🪄', '🎁', '🌟'],
}
function poolFor(domain, category) {
  const d = domain.toLowerCase()
  for (const [re, p] of THEME_POOLS) if (re.test(d)) return p
  return CAT_POOL[category] || ['•']
}
function hashPick(name, pool) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return pool[h % pool.length]
}
const normDomain = (d) => (d.split(',')[0].trim() || d)
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const cut = (s, n) => (s.length <= n ? s : s.slice(0, s.lastIndexOf(' ', n) > n * 0.6 ? s.lastIndexOf(' ', n) : n).replace(/[,;:\s]+$/, '') + '…')

/* 페이지 구성 JSON(단일 소스)에서 도메인 정규화 맵을 읽어 온다. 여기에도 하드코딩하지 않는다. */
const PAGES = JSON.parse(fs.readFileSync(path.join(REPO, 'apps/web/public/cases/pages.json'), 'utf8'))

function buildCategory(cat, items, now) {
  // 랜드스케이프(도메인형)에는 kind === 'domain' 항목만. 기사(kind==='article')는 페이지 하단 기사 목록으로 따로.
  const inCat = items.filter((x) => x.category === cat && x.kind === 'domain')
  const cfg = PAGES[cat] || {}
  const map = cfg.domainMap || null
  const fb = (cfg.tabs && cfg.tabs.fallbackLabel) || 'Other'
  const sectorOf = (d) => { const s = normDomain(d); return map ? (map[s] || fb) : s }
  const text = (it) => it.summary || it.description || ''
  // 도메인별 그룹(정규화 맵 있으면 통합)
  const byDom = {}
  for (const it of inCat) {
    const dom = sectorOf(it.domain)
    ;(byDom[dom] = byDom[dom] || []).push(it)
  }
  // 상위 8 도메인 (개수순). 정규화 fallback 버킷('Other')은 실도메인 아니므로 카드에서 제외.
  const domains = Object.entries(byDom)
    .filter(([dom]) => !(map && dom === fb))
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, TOP_DOMAINS)

  const categories = domains.map(([domain, arr], idx) => {
    const pool = poolFor(domain, cat)
    // 최신순 top5
    const top = arr.slice().sort((a, b) => (Number(b.date) || 0) - (Number(a.date) || 0)).slice(0, PER_DOMAIN)
    return {
      key: slug(domain),
      label: domain,
      color: PALETTE[idx % PALETTE.length],   // 카드마다 다른 색 (Engineering과 동일)
      icon: hashPick(domain, pool),     // 섹션 대표 이모지(도메인 기준)
      items: top.map((it) => ({
        name: it.name,
        desc: cut(text(it), 90),
        detail: cut(text(it), 300),
        url: it.url,
        stars: null,
        emoji: hashPick(it.name, pool),
        meta: [it.company, it.date].filter(Boolean).join(' · '),
      })),
    }
  })
  return { page: cat, generatedAt: now, source: 'cases/entities.json', categories }
}

function main() {
  const data = JSON.parse(fs.readFileSync(SRC, 'utf8'))
  const now = new Date().toISOString()
  for (const cat of CATS) {
    const out = buildCategory(cat, data.items, now)
    if (out.categories.length === 0) { console.log(`[${cat}] domain 항목 없음 → 랜드스케이프 생략`); continue }
    const file = path.join(DATA_DIR, cat, `${cat}-landscape.json`)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(out, null, 2))
    console.log(`[${cat}] → ${path.relative(REPO, file)}  카드 ${out.categories.length} · ` +
      out.categories.map((c) => `${c.label}(${c.items.length})`).join(', '))
  }
}
main()
