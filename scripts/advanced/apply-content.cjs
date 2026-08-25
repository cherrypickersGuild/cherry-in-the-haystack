#!/usr/bin/env node
/* Advanced 6개 페이지 콘텐츠 적용 (🔴 쓰기 · 단일 트랜잭션 · 재실행 안전)
   내용: scripts/advanced/content-1.cjs · content-2.cjs

   넣는 것
     content.concept_page              6행 — displayTitle · section · surface · content_md · progressive_refs
     handbook.paragraph_concept_link   31행 — chunkId + 우리가 쓴 insight

   ⚠️ TTL 은 온톨로지 전용이라 콘텐츠를 담지 않는다. 이 경로는 별개다.
   ⚠️ 기존 RAG 페이지(1행)와 체리(7건)는 건드리지 않는다.
   사용: node scripts/advanced/apply-content.cjs --confirm */
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "../..");
const PAGES = [...require("./content-1.cjs"), ...require("./content-2.cjs")];
const SECTION = "ADVANCED", SURFACE = "learning";

if (!process.argv.includes("--confirm")) {
  console.error("안전장치: --confirm 이 필요합니다. (🔴 로컬·프로덕션 공유 DB)");
  process.exit(1);
}
const { Client } = require(path.join(ROOT, "apps/api/node_modules/pg"));
const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, "apps/api/.env"), "utf8").split("\n")
    .filter((l) => /^[A-Z_0-9]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const COUNTS = `SELECT
  (SELECT count(*)::int FROM content.concept_page) pages,
  (SELECT count(*)::int FROM handbook.paragraph_concept_link WHERE revoked_at IS NULL) links,
  (SELECT count(*)::int FROM handbook.concept WHERE revoked_at IS NULL) concepts,
  (SELECT count(*)::int FROM handbook.paragraph_chunk WHERE revoked_at IS NULL) chunks`;

(async () => {
const c = new Client({ host: env.LOCAL_DB_HOST, port: +env.LOCAL_DB_PORT, user: env.LOCAL_DB_USER,
  password: env.LOCAL_DB_PASSWORD, database: env.LOCAL_DB_NAME, ssl: { rejectUnauthorized: false }, statement_timeout: 180000 });
await c.connect();
const q = async (s, p) => (await c.query(s, p)).rows;
const before = (await q(COUNTS))[0];
console.log("■ 실행 전:", JSON.stringify(before));

/* 사전 점검 — 개념과 문단이 전부 실재하나 */
let bad = [];
for (const p of PAGES) {
  const cc = await q(`SELECT id FROM handbook.concept WHERE ontology_node=$1 AND revoked_at IS NULL`, [p.node]);
  if (!cc.length) { bad.push(`개념 없음: ${p.node}`); continue; }
  for (const ch of p.cherries) {
    const pc = await q(`SELECT id FROM handbook.paragraph_chunk WHERE id=$1 AND revoked_at IS NULL`, [ch.chunk]);
    if (!pc.length) bad.push(`문단 없음: ${p.node} / ${ch.chunk}`);
  }
}
if (bad.length) { console.error("❌ 사전 점검 실패:\n   " + bad.join("\n   ")); await c.end(); process.exit(2); }
console.log(`   사전 점검 통과 — 개념 ${PAGES.length} · 문단 ${PAGES.reduce((n, p) => n + p.cherries.length, 0)}`);

try {
  await c.query("BEGIN");
  let np = 0, nc = 0;
  for (const p of PAGES) {
    const cid = (await q(`SELECT id FROM handbook.concept WHERE ontology_node=$1 AND revoked_at IS NULL`, [p.node]))[0].id;
    /* 페이지 — 있으면 갱신, 없으면 삽입. is_published=false: 아직 원문 대조 검수 전이다(V5). */
    const ex = await q(`SELECT id FROM content.concept_page WHERE ontology_node=$1 AND surface=$2`, [p.node, SURFACE]);
    if (ex.length) {
      await c.query(`UPDATE content.concept_page SET concept_name=$2, content_md=$3, progressive_refs=$4::jsonb,
          section=$5, updated_at=now() WHERE id=$1`,
        [ex[0].id, p.title, p.overview, JSON.stringify(p.references), SECTION]);
    } else {
      await c.query(`INSERT INTO content.concept_page
          (id, concept_slug, concept_name, content_md, is_published, related_concepts, progressive_refs,
           surface, ontology_node, section, created_at, updated_at)
        VALUES (gen_random_uuid(), $1, $2, $3, false, '[]'::jsonb, $4::jsonb, $5, $6, $7, now(), now())`,
        [slug(p.title), p.title, p.overview, JSON.stringify(p.references), SURFACE, p.node, SECTION]);
    }
    np++;
    /* 체리 — 이 개념에 우리가 넣은 것만 먼저 걷어내고 다시 넣는다(재실행 안전) */
    await c.query(`UPDATE handbook.paragraph_concept_link SET revoked_at=now(), updated_at=now()
       WHERE concept_id=$1 AND revoked_at IS NULL`, [cid]);
    for (const ch of p.cherries) {
      await c.query(`INSERT INTO handbook.paragraph_concept_link
          (id, paragraph_chunk_id, concept_id, is_primary, insight, created_at, updated_at)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, now(), now()) ON CONFLICT DO NOTHING`,
        [ch.chunk, cid, !!ch.primary, ch.insight]);
      nc++;
    }
  }
  console.log(`   페이지 ${np} · 체리 ${nc}`);
  const n = (await q(COUNTS))[0];
  if (n.concepts !== before.concepts || n.chunks !== before.chunks) throw new Error("건드리면 안 되는 표가 변했다");
  if (n.links !== before.links + nc) throw new Error(`체리 ${n.links} ≠ 기대 ${before.links + nc}`);
  await c.query("COMMIT");
  console.log("   ✅ 커밋 완료");
} catch (e) {
  await c.query("ROLLBACK");
  console.error("   ❌ 실패 — 전부 롤백:", e.message);
  await c.end(); process.exit(2);
}
console.log("■ 실행 후:", JSON.stringify((await q(COUNTS))[0]));
await c.end();
})().catch((e) => { console.error("실패:", e.message); process.exit(1); });
