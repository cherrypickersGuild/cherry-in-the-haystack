#!/usr/bin/env node
/* 개념 페이지 콘텐츠 현황 리포트 (읽기 전용)
   기획: apps/docs/concept-quality/2-implementation-guide.md §3
   용법: node scripts/learning/content-status.cjs [출력경로]
         기준선(스냅샷)을 만들 때는 날짜 붙인 파일로 저장하고 고정한다. */
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "../..");
const { Client } = require(path.join(ROOT, "apps/api/node_modules/pg"));
const OUT = process.argv[2] || path.join(ROOT, "apps/docs/concept-quality/현재상태-live.md");

/* 사이드바 12개 토픽 → 온톨로지 노드 (apps/web/app/page.tsx 의 CONCEPT_NODE_BY_TOPIC 과 일치) */
/* UI 토픽 — 하드코딩하지 않는다. 정본은 apps/web/app/page.tsx 다(menu-map.cjs). */
const { topicRows } = require("./menu-map.cjs");
const TOPICS = topicRows();
if (!TOPICS) { console.error("중단: apps/web/app/page.tsx 의 CONCEPT_NODE_BY_TOPIC 을 읽지 못했습니다."); process.exit(1); }

const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, "apps/api/.env"), "utf8")
  .split("\n").filter(l => /^[A-Z_]+=/.test(l))
  .map(l => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));

(async () => {
  const c = new Client({ host: env.LOCAL_DB_HOST, port: +env.LOCAL_DB_PORT, user: env.LOCAL_DB_USER,
    password: env.LOCAL_DB_PASSWORD, database: env.LOCAL_DB_NAME, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const one = async (node) => {
    const { rows } = await c.query(`
      SELECT c.ontology_node n, c.canonical_name nm,
             coalesce(length(c.description),0) desc_len,
             (c.description ~ '[가-힣]') desc_ko,
             (SELECT count(*)::int FROM handbook.concept_relation r
               WHERE r.to_concept_id=c.id AND r.revoked_at IS NULL) children,
             (SELECT count(*)::int FROM handbook.concept_relation r
               WHERE r.from_concept_id=c.id AND r.revoked_at IS NULL) parents,
             (SELECT count(*)::int FROM handbook.paragraph_concept_link l
               WHERE l.concept_id=c.id AND l.revoked_at IS NULL) cherries,
             (SELECT count(*)::int FROM handbook.paragraph_concept_link l
               WHERE l.concept_id=c.id AND l.revoked_at IS NULL AND l.insight IS NOT NULL) cherries_curated,
             p.concept_slug, coalesce(length(p.content_md),0) md_len,
             coalesce(jsonb_array_length(p.progressive_refs),0) refs,
             p.is_published
        FROM handbook.concept c
   LEFT JOIN content.concept_page p
          ON p.ontology_node=c.ontology_node AND p.surface='learning'
       WHERE c.ontology_node=$1 AND c.revoked_at IS NULL LIMIT 1`, [node]);
    return rows[0] ?? null;
  };

  const rowsOut = [];
  for (const [sec, menu, topicId, node] of TOPICS) {
    const r = await one(node);
    rowsOut.push({ sec, menu, topicId, node, ...(r || {}) });
  }

  /* 링크 실태 — References 의 url 유무 */
  const { rows: refRows } = await c.query(
    `SELECT ontology_node, progressive_refs FROM content.concept_page WHERE surface='learning'`);
  const linkStat = refRows.flatMap(r => (r.progressive_refs || []).map(x => ({
    node: r.ontology_node, title: x.title, url: x.url, inLibrary: x.inLibrary })));

  /* 전체 305개 요약 */
  const { rows: [tot] } = await c.query(`
    SELECT count(*)::int total,
           count(*) FILTER (WHERE description IS NOT NULL)::int with_desc,
           (SELECT count(*)::int FROM content.concept_page WHERE surface='learning') published,
           (SELECT count(DISTINCT concept_id)::int FROM handbook.paragraph_concept_link
             WHERE revoked_at IS NULL) with_cherry
      FROM handbook.concept WHERE revoked_at IS NULL AND ontology_node IS NOT NULL`);

  const yn = (v) => (v ? "O" : "—");
  const md = [];
  md.push(`<!-- 생성물: scripts/learning/content-status.cjs -->`);
  md.push(`# 개념 페이지 콘텐츠 현황`, ``);
  md.push(`> 4섹션(Overview·Cherries·Child Concepts·References)이 각 페이지에서 얼마나 채워졌는지.`);
  md.push(`> **지금은 DB에서 자동 생성**되므로, 사람이 채운 것과 온톨로지에서 자동으로 온 것을 구분한다.`, ``);
  md.push(`## 전체 (온톨로지 ${tot.total}개)`, ``);
  md.push(`| 항목 | 채워짐 | 비율 |`, `|---|---:|---:|`);
  md.push(`| 설명(Overview 자동 생성 가능) | ${tot.with_desc} / ${tot.total} | ${Math.round(tot.with_desc/tot.total*100)}% |`);
  md.push(`| 발행 페이지(사람이 쓴 Overview·References) | ${tot.published} / ${tot.total} | ${Math.round(tot.published/tot.total*100)}% |`);
  md.push(`| Cherries 연결 | ${tot.with_cherry} / ${tot.total} | ${Math.round(tot.with_cherry/tot.total*100)}% |`, ``);

  md.push(`## Learning 12개 토픽`, ``);
  md.push(`| 섹션 | 메뉴 | 온톨로지 노드 | ①Overview | ②Cherries | ③Child | ④Refs | 비어있는 것 |`);
  md.push(`|---|---|---|---|---:|---:|---:|---|`);
  for (const r of rowsOut) {
    const miss = [];
    if (!r.md_len) miss.push("Overview(발행본)");
    if (!r.cherries) miss.push("Cherries");
    if (!r.children) miss.push("Child Concepts");
    if (!r.refs) miss.push("References");
    const ov = r.md_len ? `발행 ${r.md_len}자` : (r.desc_len ? `자동 ${r.desc_len}자${r.desc_ko ? " (한글)" : ""}` : "없음");
    md.push(`| ${r.sec} | ${r.menu} | \`${r.node}\` | ${ov} | ${r.cherries ?? 0} | ${r.children ?? 0} | ${r.refs ?? 0} | ${miss.join(" · ") || "—"} |`);
  }
  md.push(``);
  md.push(`## References 링크 실태`, ``);
  if (!linkStat.length) md.push(`(발행된 References 없음)`);
  else {
    md.push(`| 개념 | 자료 | 링크 |`, `|---|---|---|`);
    linkStat.forEach(l => md.push(`| \`${l.node}\` | ${l.title} | ${l.url ? l.url : (l.inLibrary ? "**없음 — 소장 도서, 가리킬 화면 미정**" : "**없음**")} |`));
  }
  md.push(``, `## 읽는 법`, ``);
  md.push(`- **①Overview** \`발행\` = 사람이 쓴 산문 · \`자동\` = 온톨로지 설명 그대로(한글일 수 있음)`);
  md.push(`- **②Cherries** = 책 문단과 연결된 근거 수. 0이면 02 섹션이 빈다`);
  md.push(`- **③Child** = 온톨로지 관계 수. 0이면 03 섹션이 빈다`);
  md.push(`- **④Refs** = 발행된 학습 경로 수. 0이면 04 섹션이 빈다`);

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, md.join("\n") + "\n");
  console.log(`✅ ${OUT}`);
  console.log(`   전체 ${tot.total} · 발행 ${tot.published} · 체리연결 ${tot.with_cherry} · 설명 ${tot.with_desc}`);
  const empty = rowsOut.filter(r => !r.md_len || !r.cherries || !r.children || !r.refs).length;
  console.log(`   12개 토픽 중 빈 섹션이 있는 페이지: ${empty}개`);
  await c.end();
})().catch(e => { console.error("실패:", e.message); process.exit(1); });
