#!/usr/bin/env node
/**
 * Research 도메인형 랜드스케이프 생성 (방법론 준수).
 *  - kind === 'domain' 항목만 (model-updates=기관별, benchmarks-datasets=카테고리별). papers(article) 제외.
 *  - 상위 8 그룹 × best 5. 이모지/색은 research/icons.json 단일 소스에서.
 * 입력: apps/web/public/research/{entities,icons,pages}.json
 * 출력: DATA_DIR/<cat>/<cat>-landscape.json → GET /api/<cat>/landscape
 */
const fs = require('fs')
const path = require('path')

const REPO = path.resolve(__dirname, '..', '..', '..')
const PUB = path.join(REPO, 'apps/web/public/research')
const DATA_DIR = process.env.DATA_DIR || path.join(REPO, 'apps/api/storage')
const data = JSON.parse(fs.readFileSync(path.join(PUB, 'entities.json'), 'utf8'))
const ICONS = JSON.parse(fs.readFileSync(path.join(PUB, 'icons.json'), 'utf8'))
const PAGES = JSON.parse(fs.readFileSync(path.join(PUB, 'pages.json'), 'utf8'))

const CATS = ['model-updates', 'benchmarks-datasets'] // domain-form only
const TOP = 8, PER = 5
const POOLS = (ICONS.themePools || []).map((p) => [new RegExp(p.pattern, 'i'), p.emojis])
const FALLBACK = ['🔬', '🧠', '📈', '🧩', '📊', '✨', '📚', '🧪']
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const cut = (s, n) => { s = (s || '').trim(); return s.length <= n ? s : s.slice(0, n).replace(/\s+\S*$/, '') + '…' }
function emojiOf(name, group) {
  let pool = FALLBACK
  for (const [re, p] of POOLS) if (re.test(group)) { pool = p; break }
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return pool[h % pool.length]
}

function build(cat) {
  const inCat = data.items.filter((x) => x.category === cat && x.kind === 'domain')
  const by = {}
  for (const it of inCat) (by[it.domain] = by[it.domain] || []).push(it)
  const groups = Object.entries(by).sort((a, b) => b[1].length - a[1].length).slice(0, TOP)
  const categories = groups.map(([group, arr], idx) => ({
    key: slug(group),
    label: group,
    color: ICONS.palette[idx % ICONS.palette.length],
    icon: emojiOf(group, group),
    items: arr.slice(0, PER).map((it) => ({
      name: it.name,
      desc: cut(it.summary || it.description || '', 90),
      detail: cut(it.summary || it.description || '', 300),
      url: it.url,
      stars: null,
      emoji: emojiOf(it.name, group),
      meta: it.date || '',
    })),
  }))
  return { page: cat, generatedAt: new Date().toISOString(), source: 'research/entities.json', categories }
}

for (const cat of CATS) {
  const out = build(cat)
  if (out.categories.length === 0) { console.log(`[${cat}] domain 없음 → 생략`); continue }
  const file = path.join(DATA_DIR, cat, `${cat}-landscape.json`)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(out, null, 2))
  console.log(`[${cat}] → ${path.relative(REPO, file)}  카드 ${out.categories.length} · ` +
    out.categories.map((c) => `${c.label}(${c.items.length})`).join(', '))
}
