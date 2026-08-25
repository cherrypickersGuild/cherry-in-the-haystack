#!/usr/bin/env node
/* Advanced 온톨로지 변경 — 적용 (🔴 쓰기 · 단일 트랜잭션 · 재실행 안전)
   계획 정의: scripts/advanced/plan.cjs   롤백: scripts/advanced/rollback-ontology.cjs
   승인: D1~D10 (2026-08-25) · 기획: apps/docs/advanced/2-implementation-guide.md §2

   하는 일
     ① 개념 5건 삽입      meta_json.origin = 'cherry-authored'
     ② 관계 1건 해제      LoRA --SUBTOPIC--> Finetuning  (DELETE 아님 · revoked_at)
     ③ 관계 22건 삽입     origin = 'cherry-authored'
     ④ 별칭 18건 삽입

   ⚠️ 기존 305 개념 · 310 관계 · 7 별칭 · 3,054 문단은 건드리지 않는다.
   ⚠️ 트랜잭션 안에서 기대값을 확인하고, 어긋나면 스스로 전량 롤백한다.
   사용: node scripts/advanced/apply-ontology.cjs --confirm */
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "../..");
const P = require("./plan.cjs");

if (!process.argv.includes("--confirm")) {
  console.error("안전장치: --confirm 이 필요합니다.");
  console.error("  🔴 로컬·프로덕션이 같은 DB 를 씁니다.");
  console.error("  먼저 node scripts/advanced/precheck.cjs 가 통과했는지 확인하세요.");
  process.exit(1);
}
const { Client } = require(path.join(ROOT, "apps/api/node_modules/pg"));
const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, "apps/api/.env"), "utf8").split("\n")
    .filter((l) => /^[A-Z_0-9]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));

const COUNTS = `SELECT
  (SELECT count(*)::int FROM handbook.concept          WHERE revoked_at IS NULL) concepts,
  (SELECT count(*)::int FROM handbook.concept_relation WHERE revoked_at IS NULL) relations,
  (SELECT count(*)::int FROM handbook.concept_alias    WHERE revoked_at IS NULL) aliases,
  (SELECT count(*)::int FROM handbook.paragraph_chunk  WHERE revoked_at IS NULL) chunks,
  (SELECT count(*)::int FROM handbook.paragraph_concept_link WHERE revoked_at IS NULL) links,
  (SELECT count(*)::int FROM content.concept_page) pages`;

(async () => {
const c = new Client({ host: env.LOCAL_DB_HOST, port: +env.LOCAL_DB_PORT, user: env.LOCAL_DB_USER,
  password: env.LOCAL_DB_PASSWORD, database: env.LOCAL_DB_NAME, ssl: { rejectUnauthorized: false },
  statement_timeout: 120000 });
await c.connect();

const before = (await c.query(COUNTS)).rows[0];
console.log("■ 실행 전:", JSON.stringify(before));

/* 기준선이 아니면 계획이 낡은 것 — 시작조차 하지 않는다 */
const drift = Object.keys(P.BASELINE).filter((k) => before[k] !== P.BASELINE[k]);
if (drift.length) {
  console.error("   ❌ 기준선 불일치 —", drift.map((k) => `${k} ${before[k]}≠${P.BASELINE[k]}`).join(" · "));
  console.error("      계획(plan.cjs)이 낡았거나 이미 적용됐습니다. precheck 를 먼저 돌리세요.");
  await c.end(); process.exit(2);
}

try {
  await c.query("BEGIN");

  /* ① 개념 — id 기본값이 없는 표라 직접 만들어 넣는다 */
  let ins = 0;
  for (const x of P.CONCEPTS) {
    const r = await c.query(
      `INSERT INTO handbook.concept
         (id, canonical_name, description, ontology_node, is_active, meta_json, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, true, $4::jsonb, now(), now())
       ON CONFLICT DO NOTHING`,
      [x.name, x.description, x.node,
       JSON.stringify({ origin: P.ORIGIN, addedAt: P.ADDED_AT, boundary: x.boundary })]);
    ins += r.rowCount;
  }
  console.log(`   ① 개념 삽입 ${ins} / ${P.CONCEPTS.length}`);

  /* ontology_node → id (살아있는 행만) */
  const map = new Map((await c.query(
    `SELECT ontology_node, id FROM handbook.concept
      WHERE ontology_node IS NOT NULL AND revoked_at IS NULL`)).rows.map((r) => [r.ontology_node, r.id]));

  /* ② 해제 — DELETE 하지 않는다 */
  let rev = 0;
  for (const r of P.REVOKE) {
    const res = await c.query(
      `UPDATE handbook.concept_relation rel SET revoked_at = now(), updated_at = now()
         FROM handbook.concept a, handbook.concept b
        WHERE rel.from_concept_id = a.id AND rel.to_concept_id = b.id
          AND a.ontology_node = $1 AND b.ontology_node = $2
          AND rel.relation_type = $3::handbook.concept_relation_enum
          AND rel.revoked_at IS NULL`, [r.from, r.to, r.type]);
    rev += res.rowCount;
  }
  console.log(`   ② 관계 해제 ${rev} / ${P.REVOKE.length}  (LoRA 를 PEFT 밑으로 옮기기 위함)`);

  /* ③ 관계 */
  let rel = 0, skipped = [];
  for (const r of P.RELATIONS) {
    const f = map.get(r.from), t = map.get(r.to);
    if (!f || !t) { skipped.push(`${r.from}→${r.to}`); continue; }
    const res = await c.query(
      `INSERT INTO handbook.concept_relation
         (id, from_concept_id, to_concept_id, relation_type, origin, note, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3::handbook.concept_relation_enum, $4, $5, now(), now())
       ON CONFLICT DO NOTHING`, [f, t, r.type, P.ORIGIN, r.note ?? null]);
    rel += res.rowCount;
  }
  console.log(`   ③ 관계 삽입 ${rel} / ${P.RELATIONS.length}` + (skipped.length ? `  ⚠️ 건너뜀 ${skipped.join(", ")}` : ""));

  /* ④ 별칭 */
  let al = 0;
  for (const a of P.ALIASES) {
    const id = map.get(a.node);
    if (!id) { console.log(`      ⚠️ 별칭 대상 없음: ${a.node}`); continue; }
    const res = await c.query(
      `INSERT INTO handbook.concept_alias
         (id, concept_id, alias_text, alias_type, locale, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3::handbook.concept_alias_type_enum, 'en', now(), now())
       ON CONFLICT DO NOTHING`, [id, a.text, a.type]);
    al += res.rowCount;
  }
  console.log(`   ④ 별칭 삽입 ${al} / ${P.ALIASES.length}`);

  /* ⑤ 기대값 확인 — 어긋나면 전량 롤백 */
  const now = (await c.query(COUNTS)).rows[0];
  const bad = Object.keys(P.EXPECTED).filter((k) => now[k] !== P.EXPECTED[k]);
  if (bad.length) throw new Error(`기대값 불일치 — ${bad.map((k) => `${k} ${now[k]}≠${P.EXPECTED[k]}`).join(" · ")}`);

  /* ⑥ 화면 하위 개수도 트랜잭션 안에서 확인 */
  for (const [node, exp] of Object.entries(P.EXPECTED_CHILDREN)) {
    const k = (await c.query(
      `SELECT count(*)::int n FROM handbook.concept_relation rel
         JOIN handbook.concept a ON a.id = rel.from_concept_id AND a.revoked_at IS NULL
         JOIN handbook.concept b ON b.id = rel.to_concept_id   AND b.revoked_at IS NULL
        WHERE b.ontology_node = $1 AND rel.revoked_at IS NULL`, [node])).rows[0].n;
    if (k !== exp) throw new Error(`${node} 하위 ${k} ≠ 기대 ${exp}`);
  }
  console.log("   ⑤⑥ 건수·하위개수 검증 통과");

  await c.query("COMMIT");
  console.log("   ✅ 커밋 완료");
} catch (e) {
  await c.query("ROLLBACK");
  console.error("   ❌ 실패 — 전부 롤백(DB 변경 없음):", e.message);
  await c.end(); process.exit(2);
}

const after = (await c.query(COUNTS)).rows[0];
console.log("■ 실행 후:", JSON.stringify(after));
console.log(`   개념 ${before.concepts}→${after.concepts} · 관계 ${before.relations}→${after.relations} · 별칭 ${before.aliases}→${after.aliases}`);
console.log(`   기존 데이터 유지 — chunk ${after.chunks} · link ${after.links} · page ${after.pages}`);
await c.end();
})().catch((e) => { console.error("실패:", e.message); process.exit(1); });
