#!/usr/bin/env node
/* Advanced 온톨로지 변경 — 롤백 (🔴 쓰기 · 단일 트랜잭션 · 재실행 안전)
   계획 정의: scripts/advanced/plan.cjs
   ⚠️ apply 보다 **먼저** 작성했다(원칙 6: 되돌릴 수 없는 변경은 하지 않는다).

   되돌리는 것 — 전부 우리가 넣은 것만 골라낸다
     · 관계 22건   origin = 'cherry-authored' 인 행을 revoked_at 으로 끈다
     · 해제 1건    LoRA --SUBTOPIC--> Finetuning 을 다시 살린다 (revoked_at = NULL)
     · 별칭 18건   plan.cjs 의 (개념, 텍스트) 조합만
     · 개념 5건    meta_json->>'origin' = 'cherry-authored' 인 것만

   ⚠️ 기존 305개 개념 · 310건 관계 · 7건 별칭은 **건드리지 않는다.**
   사용: node scripts/advanced/rollback-ontology.cjs --confirm */
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "../..");
const P = require("./plan.cjs");

if (!process.argv.includes("--confirm")) {
  console.error("안전장치: --confirm 이 필요합니다.");
  console.error("  이 스크립트는 DB 를 수정합니다(🔴 로컬·프로덕션 공유 DB).");
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

/* 손댈 것이 없으면 조용히 끝낸다(재실행 안전) */
const pending = (await c.query(
  `SELECT (SELECT count(*)::int FROM handbook.concept_relation WHERE origin = $1 AND revoked_at IS NULL) r,
          (SELECT count(*)::int FROM handbook.concept WHERE meta_json->>'origin' = $1 AND revoked_at IS NULL) c`,
  [P.ORIGIN])).rows[0];
if (pending.r === 0 && pending.c === 0) {
  console.log("   되돌릴 것이 없습니다 (origin='" + P.ORIGIN + "' 인 활성 행 0건). 종료.");
  await c.end(); process.exit(0);
}

try {
  await c.query("BEGIN");

  /* ① 관계 — 우리가 넣은 것만 끈다 */
  const r1 = await c.query(
    `UPDATE handbook.concept_relation SET revoked_at = now(), updated_at = now()
      WHERE origin = $1 AND revoked_at IS NULL`, [P.ORIGIN]);
  console.log(`   ① 관계 해제 ${r1.rowCount}건 (기대 ${P.RELATIONS.length})`);

  /* ② 해제했던 관계를 되살린다 */
  let restored = 0;
  for (const r of P.REVOKE) {
    const res = await c.query(
      `UPDATE handbook.concept_relation rel SET revoked_at = NULL, updated_at = now()
         FROM handbook.concept a, handbook.concept b
        WHERE rel.from_concept_id = a.id AND rel.to_concept_id = b.id
          AND a.ontology_node = $1 AND b.ontology_node = $2
          AND rel.relation_type = $3::handbook.concept_relation_enum
          AND rel.revoked_at IS NOT NULL`, [r.from, r.to, r.type]);
    restored += res.rowCount;
  }
  console.log(`   ② 해제했던 관계 복원 ${restored}건 (기대 ${P.REVOKE.length})`);

  /* ③ 별칭 — plan 에 적힌 (개념, 텍스트) 조합만 */
  let al = 0;
  for (const a of P.ALIASES) {
    const res = await c.query(
      `UPDATE handbook.concept_alias al SET revoked_at = now(), updated_at = now()
         FROM handbook.concept cc
        WHERE al.concept_id = cc.id AND cc.ontology_node = $1
          AND al.alias_text = $2 AND al.revoked_at IS NULL`, [a.node, a.text]);
    al += res.rowCount;
  }
  console.log(`   ③ 별칭 해제 ${al}건 (기대 ${P.ALIASES.length})`);

  /* ④ 개념 — meta_json 표식이 있는 것만 */
  const r4 = await c.query(
    `UPDATE handbook.concept SET revoked_at = now(), is_active = false, updated_at = now()
      WHERE meta_json->>'origin' = $1 AND revoked_at IS NULL`, [P.ORIGIN]);
  console.log(`   ④ 개념 해제 ${r4.rowCount}건 (기대 ${P.CONCEPTS.length})`);

  /* ⑤ 기준선으로 돌아왔는지 트랜잭션 안에서 확인 — 아니면 롤백 */
  const now = (await c.query(COUNTS)).rows[0];
  const diff = Object.keys(P.BASELINE).filter((k) => now[k] !== P.BASELINE[k]);
  if (diff.length) {
    throw new Error(`기준선 불일치 — ${diff.map((k) => `${k} ${now[k]}≠${P.BASELINE[k]}`).join(" · ")}`);
  }

  await c.query("COMMIT");
  console.log("   ✅ 커밋 — 기준선으로 복귀");
} catch (e) {
  await c.query("ROLLBACK");
  console.error("   ❌ 실패 — 전부 롤백(DB 변경 없음):", e.message);
  await c.end(); process.exit(2);
}

console.log("■ 실행 후:", JSON.stringify((await c.query(COUNTS)).rows[0]));
await c.end();
})().catch((e) => { console.error("실패:", e.message); process.exit(1); });
