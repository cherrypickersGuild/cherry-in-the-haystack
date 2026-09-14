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
const PAGES = [...require("./content-1.cjs"), ...require("./content-2.cjs"), ...require("./content-3.cjs")];
const SURFACE = "learning";
/* section 은 페이지마다 다르다 — 메뉴에 없는 개념은 null(뱃지 없음).
   ⚠️ 예전엔 상수 "ADVANCED" 를 전부에 박았다. Basics 개념까지 ADVANCED 로 표시된다. */
const sectionOf = (p) => (p.section === undefined ? "ADVANCED" : p.section);

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
  for (const ch of p.cherries || []) {
    const pc = await q(`SELECT id FROM handbook.paragraph_chunk WHERE id=$1 AND revoked_at IS NULL`, [ch.chunk]);
    if (!pc.length) bad.push(`문단 없음: ${p.node} / ${ch.chunk}`);
  }
}
if (bad.length) { console.error("❌ 사전 점검 실패:\n   " + bad.join("\n   ")); await c.end(); process.exit(2); }
console.log(`   사전 점검 통과 — 개념 ${PAGES.length} · 문단 ${PAGES.reduce((n, p) => n + (p.cherries || []).length, 0)}`);

try {
  await c.query("BEGIN");
  let np = 0, nc = 0;
  for (const p of PAGES) {
    const cid = (await q(`SELECT id FROM handbook.concept WHERE ontology_node=$1 AND revoked_at IS NULL`, [p.node]))[0].id;
    /* 페이지 — 있으면 갱신, 없으면 삽입. is_published=false: 아직 원문 대조 검수 전이다(V5). */
    const ex = await q(`SELECT id FROM content.concept_page WHERE ontology_node=$1 AND surface=$2`, [p.node, SURFACE]);
    if (ex.length) {
      /* keepOverview: 이미 발행된 본문을 덮어쓰지 않는다(RAG). References 만 규칙에 맞춘다. */
      if (p.keepOverview) {
        await c.query(`UPDATE content.concept_page SET progressive_refs=$2::jsonb, updated_at=now() WHERE id=$1`,
          [ex[0].id, JSON.stringify(p.references)]);
      } else {
        await c.query(`UPDATE content.concept_page SET concept_name=$2, content_md=$3, progressive_refs=$4::jsonb,
            section=$5, updated_at=now() WHERE id=$1`,
          [ex[0].id, p.title, p.overview, JSON.stringify(p.references), sectionOf(p)]);
      }
    } else {
      await c.query(`INSERT INTO content.concept_page
          (id, concept_slug, concept_name, content_md, is_published, related_concepts, progressive_refs,
           surface, ontology_node, section, created_at, updated_at)
        VALUES (gen_random_uuid(), $1, $2, $3, false, '[]'::jsonb, $4::jsonb, $5, $6, $7, now(), now())`,
        [slug(p.title), p.title, p.overview, JSON.stringify(p.references), SURFACE, p.node, sectionOf(p)]);
    }
    np++;
    /* 체리 — 재실행 안전하게.
       ⚠️ uq_pcl_paragraph_concept 가 (문단, 개념) 유니크인데 revoked_at 조건이 **없다**.
          해제 후 재삽입을 하면 남아 있는 해제 행 때문에 ON CONFLICT 로 조용히 건너뛴다.
          그래서 해제가 아니라 upsert 로 처리하고, 계획에 없는 것만 해제한다. */
    if (p.keepCherries) { continue; }   /* 체리를 건드리지 않는 페이지 */
    const want = p.cherries.map((x) => x.chunk);
    await c.query(`UPDATE handbook.paragraph_concept_link SET revoked_at=now(), updated_at=now()
       WHERE concept_id=$1 AND revoked_at IS NULL AND paragraph_chunk_id <> ALL($2::uuid[])`, [cid, want]);
    for (const ch of p.cherries) {
      await c.query(`INSERT INTO handbook.paragraph_concept_link
          (id, paragraph_chunk_id, concept_id, is_primary, insight, created_at, updated_at)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, now(), now())
        ON CONFLICT (paragraph_chunk_id, concept_id)
        DO UPDATE SET insight=EXCLUDED.insight, is_primary=EXCLUDED.is_primary,
                      revoked_at=NULL, updated_at=now()`,
        [ch.chunk, cid, !!ch.primary, ch.insight]);
      nc++;
    }
  }
  console.log(`   페이지 ${np} · 체리 ${nc}`);
  const n = (await q(COUNTS))[0];
  if (n.concepts !== before.concepts || n.chunks !== before.chunks) throw new Error("건드리면 안 되는 표가 변했다");
  /* 기대값은 "계획된 체리 + 계획에 없는 개념의 기존 체리(RAG 7건)" 다 */
  const planned = PAGES.reduce((a, x) => a + (x.keepCherries ? 0 : x.cherries.length), 0);
  const others = (await q(`SELECT count(*)::int n FROM handbook.paragraph_concept_link l
     JOIN handbook.concept cc ON cc.id=l.concept_id
    WHERE l.revoked_at IS NULL AND cc.ontology_node <> ALL($1::text[])`,
    /* keepCherries 페이지는 우리가 안 건드리므로 '그 외'로 센다 */
    [PAGES.filter((x) => !x.keepCherries).map((x) => x.node)]))[0].n;
  if (n.links !== planned + others) throw new Error(`체리 ${n.links} ≠ 기대 ${planned}(계획) + ${others}(그 외)`);
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
