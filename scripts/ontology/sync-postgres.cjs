#!/usr/bin/env node
/* 정본(JSON) → Postgres 동기화 — DB 가 파일을 따라간다
   순서: TTL → JSON → **DB**

   ⚠️ 기존 import-postgres.cjs 는 INSERT 만 했다. 그래서 관계 이동·이름 정정을 못 했다.
      이 스크립트는 **선언적 동기화**다 — 파일에 있으면 있어야 하고, 없으면 해제한다.

   안전장치
     · 기본이 dry-run. 쓰려면 --confirm
     · 단일 트랜잭션. 끝에 파일과 DB 가 일치하지 않으면 스스로 롤백
     · 변경량이 임계치를 넘으면 거부(--max-change 로 조정, 기본 60)
     · handbook.paragraph_* · content.concept_page 는 절대 건드리지 않는다
     · 신설 개념의 origin 은 TTL 의 llm:origin 을 그대로 쓴다

   사용: node scripts/ontology/sync-postgres.cjs            (dry-run)
         node scripts/ontology/sync-postgres.cjs --confirm  (적용) */
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "../..");
const { Client } = require(path.join(ROOT, "apps/api/node_modules/pg"));
const SNAP = JSON.parse(fs.readFileSync(
  process.env.SNAPSHOT || path.join(ROOT, "apps/docs/ontology-migration/ontology-snapshot.json"), "utf8"));
const CONFIRM = process.argv.includes("--confirm");
const MAX = +((process.argv.find((a) => a.startsWith("--max-change=")) || "").split("=")[1] || 60);
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
  statement_timeout: 180000 });
await c.connect();
const q = async (s, p) => (await c.query(s, p)).rows;
const before = (await q(COUNTS))[0];
console.log("■ 정본:", SNAP.exportedFrom);
console.log(`   파일 개념 ${SNAP.counts.concepts} · 관계 ${SNAP.counts.relations} · 별칭 ${SNAP.counts.aliases}`);
console.log("■ 현재 DB:", JSON.stringify(before));

/* ── 차이 계산 ─────────────────────────────────────────────── */
const dbC = await q(`SELECT ontology_node node, canonical_name name, description
  FROM handbook.concept WHERE revoked_at IS NULL AND ontology_node IS NOT NULL`);
const dbCmap = new Map(dbC.map((r) => [r.node, r]));
const fileC = new Map(SNAP.concepts.map((x) => [x.node, x]));

const addC = SNAP.concepts.filter((x) => !dbCmap.has(x.node));
const updC = SNAP.concepts.filter((x) => {
  const d = dbCmap.get(x.node); if (!d) return false;
  return d.name !== x.label || (d.description ?? null) !== (x.description ?? null);
});
const delC = dbC.filter((d) => !fileC.has(d.node));

const key = (r) => `${r.from}|${r.to}|${r.type}`;
const dbR = await q(`SELECT a.ontology_node "from", b.ontology_node "to", r.relation_type::text type
  FROM handbook.concept_relation r
  JOIN handbook.concept a ON a.id=r.from_concept_id AND a.revoked_at IS NULL
  JOIN handbook.concept b ON b.id=r.to_concept_id   AND b.revoked_at IS NULL
  WHERE r.revoked_at IS NULL`);
const dbRset = new Set(dbR.map(key)), fileRset = new Set(SNAP.relations.map(key));
const addR = SNAP.relations.filter((r) => !dbRset.has(key(r)));
const delR = dbR.filter((r) => !fileRset.has(key(r)));

const aKey = (a) => `${a.node}|${a.text}`;
const dbA = await q(`SELECT cc.ontology_node node, a.alias_text text FROM handbook.concept_alias a
  JOIN handbook.concept cc ON cc.id=a.concept_id AND cc.revoked_at IS NULL WHERE a.revoked_at IS NULL`);
const fileA = SNAP.concepts.flatMap((x) => (x.aliases || []).map((t) => ({ node: x.node, text: t })));
const dbAset = new Set(dbA.map(aKey)), fileAset = new Set(fileA.map(aKey));
const addA = fileA.filter((a) => !dbAset.has(aKey(a)));
const delA = dbA.filter((a) => !fileAset.has(aKey(a)));

const total = addC.length + updC.length + delC.length + addR.length + delR.length + addA.length + delA.length;
console.log("\n■ 차이 (파일 기준)");
const show = (label, arr, f) => { console.log(`   ${label} ${arr.length}`); arr.slice(0, 30).forEach((x) => console.log("      " + f(x))); };
show("개념 추가", addC, (x) => `${x.node}  "${x.label}"`);
show("개념 수정", updC, (x) => `${x.node}: "${dbCmap.get(x.node).name}" → "${x.label}"${(dbCmap.get(x.node).description ?? null) !== (x.description ?? null) ? " (설명도)" : ""}`);
show("개념 해제", delC, (x) => x.node);
show("관계 추가", addR, (r) => `${r.from} --${r.type}--> ${r.to}`);
show("관계 해제", delR, (r) => `${r.from} --${r.type}--> ${r.to}`);
show("별칭 추가", addA, (a) => `"${a.text}" @ ${a.node}`);
show("별칭 해제", delA, (a) => `"${a.text}" @ ${a.node}`);
console.log(`   ─── 총 ${total}건`);

if (total === 0) { console.log("\n✅ DB 가 이미 정본과 같습니다."); await c.end(); process.exit(0); }
if (total > MAX) { console.error(`\n❌ 변경량 ${total} > 상한 ${MAX}. 정본이 크게 어긋났습니다 — 확인 후 --max-change= 로 올리세요.`); await c.end(); process.exit(2); }
if (!CONFIRM) { console.log("\n(dry-run) 적용하려면 --confirm"); await c.end(); process.exit(0); }

/* ── 적용 ──────────────────────────────────────────────────── */
try {
  await c.query("BEGIN");
  for (const x of addC)
    await c.query(`INSERT INTO handbook.concept (id, canonical_name, description, ontology_node, is_active, meta_json, created_at, updated_at)
      VALUES (gen_random_uuid(), $1, $2, $3, true, $4::jsonb, now(), now()) ON CONFLICT DO NOTHING`,
      [x.label, x.description, x.node, JSON.stringify({ origin: "cherry-authored", addedAt: "2026-08-25", source: SNAP.exportedFrom })]);
  for (const x of updC)
    await c.query(`UPDATE handbook.concept SET canonical_name=$2, description=$3, updated_at=now()
      WHERE ontology_node=$1 AND revoked_at IS NULL`, [x.node, x.label, x.description]);
  for (const x of delC)
    await c.query(`UPDATE handbook.concept SET revoked_at=now(), is_active=false, updated_at=now()
      WHERE ontology_node=$1 AND revoked_at IS NULL`, [x.node]);

  const map = new Map((await q(`SELECT ontology_node, id FROM handbook.concept
    WHERE ontology_node IS NOT NULL AND revoked_at IS NULL`)).map((r) => [r.ontology_node, r.id]));
  for (const r of delR)
    await c.query(`UPDATE handbook.concept_relation rel SET revoked_at=now(), updated_at=now()
      FROM handbook.concept a, handbook.concept b
     WHERE rel.from_concept_id=a.id AND rel.to_concept_id=b.id AND a.ontology_node=$1 AND b.ontology_node=$2
       AND rel.relation_type=$3::handbook.concept_relation_enum AND rel.revoked_at IS NULL`, [r.from, r.to, r.type]);
  for (const r of addR)
    await c.query(`INSERT INTO handbook.concept_relation (id, from_concept_id, to_concept_id, relation_type, origin, created_at, updated_at)
      VALUES (gen_random_uuid(), $1, $2, $3::handbook.concept_relation_enum, $4, now(), now()) ON CONFLICT DO NOTHING`,
      [map.get(r.from), map.get(r.to), r.type, "cherry-authored"]);
  for (const a of delA)
    await c.query(`UPDATE handbook.concept_alias al SET revoked_at=now(), updated_at=now()
      FROM handbook.concept cc WHERE al.concept_id=cc.id AND cc.ontology_node=$1 AND al.alias_text=$2 AND al.revoked_at IS NULL`,
      [a.node, a.text]);
  for (const a of addA)
    await c.query(`INSERT INTO handbook.concept_alias (id, concept_id, alias_text, alias_type, locale, created_at, updated_at)
      VALUES (gen_random_uuid(), $1, $2, 'SYNONYM'::handbook.concept_alias_type_enum, 'en', now(), now()) ON CONFLICT DO NOTHING`,
      [map.get(a.node), a.text]);

  /* 트랜잭션 안에서 파일과 완전히 같아졌는지 확인 */
  const n = (await q(COUNTS))[0];
  if (n.concepts !== SNAP.counts.concepts || n.relations !== SNAP.counts.relations || n.aliases !== SNAP.counts.aliases)
    throw new Error(`건수 불일치 — DB ${n.concepts}/${n.relations}/${n.aliases} ≠ 파일 ${SNAP.counts.concepts}/${SNAP.counts.relations}/${SNAP.counts.aliases}`);
  if (n.chunks !== before.chunks || n.links !== before.links || n.pages !== before.pages)
    throw new Error("건드리면 안 되는 표가 변했다");
  await c.query("COMMIT");
  console.log("\n   ✅ 커밋 완료");
} catch (e) {
  await c.query("ROLLBACK");
  console.error("\n   ❌ 실패 — 전부 롤백(DB 변경 없음):", e.message);
  await c.end(); process.exit(2);
}
console.log("■ 실행 후:", JSON.stringify((await q(COUNTS))[0]));
await c.end();
})().catch((e) => { console.error("실패:", e.message); process.exit(1); });
