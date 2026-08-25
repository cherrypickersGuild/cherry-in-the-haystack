#!/usr/bin/env node
/* 기준선 스냅샷 생성 (🔵 읽기 전용)
   변경 전 상태를 문서로 고정한다. 이후 "무엇이 바뀌었나"는 이것과의 차이로 판정한다.
   사용: node scripts/advanced/snapshot.cjs [출력경로] */
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "../..");
const { Client } = require(path.join(ROOT, "apps/api/node_modules/pg"));
const P = require("./plan.cjs");
const OUT = process.argv[2] || path.join(ROOT, "apps/docs/advanced/기준선-스냅샷-2026-08-25.md");
const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, "apps/api/.env"), "utf8").split("\n")
    .filter((l) => /^[A-Z_0-9]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
(async () => {
const c = new Client({ host: env.LOCAL_DB_HOST, port: +env.LOCAL_DB_PORT, user: env.LOCAL_DB_USER,
  password: env.LOCAL_DB_PASSWORD, database: env.LOCAL_DB_NAME, ssl: { rejectUnauthorized: false } });
await c.connect();
const q = async (s, p) => (await c.query(s, p)).rows;
const n = (await q(`SELECT
  (SELECT count(*)::int FROM handbook.concept          WHERE revoked_at IS NULL) concepts,
  (SELECT count(*)::int FROM handbook.concept_relation WHERE revoked_at IS NULL) relations,
  (SELECT count(*)::int FROM handbook.concept_alias    WHERE revoked_at IS NULL) aliases,
  (SELECT count(*)::int FROM handbook.paragraph_chunk  WHERE revoked_at IS NULL) chunks,
  (SELECT count(*)::int FROM handbook.paragraph_concept_link WHERE revoked_at IS NULL) links,
  (SELECT count(*)::int FROM content.concept_page) pages,
  (SELECT count(*)::int FROM content.concept_page_contributor) contributors,
  (SELECT count(*)::int FROM handbook.book WHERE revoked_at IS NULL) books`))[0];
const rel = await q(`SELECT relation_type::text t, origin, count(*)::int n FROM handbook.concept_relation
  WHERE revoked_at IS NULL GROUP BY 1,2 ORDER BY 3 DESC`);
const al = await q(`SELECT cc.ontology_node node, a.alias_text t, a.alias_type::text ty FROM handbook.concept_alias a
  JOIN handbook.concept cc ON cc.id = a.concept_id WHERE a.revoked_at IS NULL ORDER BY 1`);
const kids = {};
for (const node of Object.keys(P.EXPECTED_CHILDREN))
  kids[node] = (await q(`SELECT a.ontology_node k FROM handbook.concept_relation r
     JOIN handbook.concept a ON a.id = r.from_concept_id AND a.revoked_at IS NULL
     JOIN handbook.concept b ON b.id = r.to_concept_id   AND b.revoked_at IS NULL
    WHERE b.ontology_node = $1 AND r.revoked_at IS NULL ORDER BY 1`, [node])).map((r) => r.k);
const books = await q(`SELECT b.title, count(pc.id)::int chunks FROM handbook.book b
  LEFT JOIN handbook.chapter ch ON ch.book_id = b.id AND ch.revoked_at IS NULL
  LEFT JOIN handbook.section s ON s.chapter_id = ch.id AND s.revoked_at IS NULL
  LEFT JOIN handbook.paragraph_chunk pc ON pc.section_id = s.id AND pc.revoked_at IS NULL
  WHERE b.revoked_at IS NULL GROUP BY 1 ORDER BY 2 DESC`);

const L = [];
L.push("# Advanced 작업 — 기준선 스냅샷 (2026-08-25 · 고정)\n");
L.push("> **생성물이다. 직접 수정하지 않는다.** 재생성: `node scripts/advanced/snapshot.cjs`");
L.push("> 온톨로지를 바꾸기 **전** 상태다. 이후 \"무엇이 바뀌었나\"는 전부 이 값과의 차이로 판정한다.");
L.push("> 계획 정의: `scripts/advanced/plan.cjs` · 사전 점검: `scripts/advanced/precheck.cjs`\n");
L.push("---\n\n## 1. 건수\n");
L.push("```");
for (const [k, v] of Object.entries({ "handbook.concept": n.concepts, "handbook.concept_relation": n.relations,
  "handbook.concept_alias": n.aliases, "handbook.paragraph_chunk": n.chunks,
  "handbook.paragraph_concept_link": n.links, "content.concept_page": n.pages,
  "content.concept_page_contributor": n.contributors, "handbook.book": n.books }))
  L.push(`${k.padEnd(34)} ${String(v).padStart(6)}`);
L.push("```\n");
L.push("`plan.cjs` 의 `BASELINE` 과 일치해야 한다. 다르면 계획이 낡은 것이므로 즉시 중단한다.\n");
L.push("## 2. 관계 분포\n\n| 타입 | origin | 건수 |\n|---|---|---:|");
rel.forEach((r) => L.push(`| ${r.t} | \`${r.origin}\` | ${r.n} |`));
L.push("\n> `EXTENDS` · `CONTRADICTS` 는 0건이다. 원본 온톨로지에 해당 술어가 없었다.\n");
L.push("## 3. 별칭 " + n.aliases + "건\n\n```");
al.forEach((a) => L.push(`${a.node.padEnd(24)} → ${a.t}   (${a.ty})`));
L.push("```\n");
L.push("## 4. Advanced 6개 페이지의 `03 Child Concepts` — 변경 전\n");
L.push("| 노드 | 지금 | 적용 후(기대) | 하위 개념 |\n|---|---:|---:|---|");
for (const [node, exp] of Object.entries(P.EXPECTED_CHILDREN))
  L.push(`| \`${node}\` | **${kids[node].length}** | ${exp} | ${kids[node].join(" · ") || "(없음)"} |`);
L.push("\n> 6개 중 5개가 **0개**다. 화면에서 03 구획이 비어 있다는 뜻이다.\n");
L.push("## 5. 소장 도서\n\n| 도서 | 문단 |\n|---|---:|");
books.forEach((b) => L.push(`| ${b.title} | ${b.chunks} |`));
L.push("\n> `paper` · `Reflexion` 은 행만 있고 본문이 적재돼 있지 않다. 사실상 3권이다.\n");
L.push("## 6. 이 스냅샷이 담지 않는 것\n");
L.push("```\n체리 내용 · Overview 본문 · References — 개념 페이지 콘텐츠는 아직 RAG 한 장뿐이다\n```");
fs.writeFileSync(OUT, L.join("\n") + "\n");
console.log("✅ 스냅샷:", OUT);
console.log(`   개념 ${n.concepts} · 관계 ${n.relations} · 별칭 ${n.aliases} · 문단 ${n.chunks}`);
await c.end();
})().catch((e) => { console.error("실패:", e.message); process.exit(1); });
