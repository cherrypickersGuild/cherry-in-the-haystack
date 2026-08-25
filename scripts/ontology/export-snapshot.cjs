#!/usr/bin/env node
/* Postgres → ontology-snapshot.json (🔵 읽기 전용)
   기획: apps/docs/advanced/2-implementation-guide.md §2-B

   ⚠️ 정본이 GraphDB 에서 Postgres 로 옮겨졌으므로 exportedFrom 도 바뀐다.
      스키마는 이관 때와 동일하게 유지한다 — scripts/ontology/verify.cjs 가 이 형식을 읽는다.
   사용: node scripts/ontology/export-snapshot.cjs [출력경로] */
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "../..");
const { Client } = require(path.join(ROOT, "apps/api/node_modules/pg"));
const OUT = process.argv[2] || path.join(ROOT, "apps/docs/ontology-migration/ontology-snapshot.json");
const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, "apps/api/.env"), "utf8").split("\n")
    .filter((l) => /^[A-Z_0-9]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
(async () => {
const c = new Client({ host: env.LOCAL_DB_HOST, port: +env.LOCAL_DB_PORT, user: env.LOCAL_DB_USER,
  password: env.LOCAL_DB_PASSWORD, database: env.LOCAL_DB_NAME, ssl: { rejectUnauthorized: false } });
await c.connect();
const q = async (s) => (await c.query(s)).rows;
const rows = await q(`SELECT ontology_node node, canonical_name label, description
  FROM handbook.concept WHERE revoked_at IS NULL AND ontology_node IS NOT NULL ORDER BY ontology_node`);
const ali = await q(`SELECT c.ontology_node node, a.alias_text t FROM handbook.concept_alias a
  JOIN handbook.concept c ON c.id=a.concept_id AND c.revoked_at IS NULL
  WHERE a.revoked_at IS NULL ORDER BY 1,2`);
const rels = await q(`SELECT a.ontology_node "from", b.ontology_node "to", r.relation_type::text type
  FROM handbook.concept_relation r
  JOIN handbook.concept a ON a.id=r.from_concept_id AND a.revoked_at IS NULL
  JOIN handbook.concept b ON b.id=r.to_concept_id   AND b.revoked_at IS NULL
  WHERE r.revoked_at IS NULL ORDER BY 1,3,2`);
const aliOf = {}; ali.forEach((a) => (aliOf[a.node] = aliOf[a.node] || []).push(a.t));
const snap = {
  exportedFrom: "postgres://handbook (2026-08-25 병합본 — 원본 온톨로지 + Advanced 작업분)",
  infer: false,
  counts: { concepts: rows.length, relations: rels.length,
            aliases: ali.length, withDescription: rows.filter((r) => r.description).length },
  concepts: rows.map((r) => ({ node: r.node, label: r.label, description: r.description, aliases: aliOf[r.node] || [] })),
  relations: rels.map((r) => ({ from: r.from, to: r.to, type: r.type })),
};
fs.writeFileSync(OUT, JSON.stringify(snap, null, 1));
console.log("✅ 스냅샷:", OUT);
console.log(`   개념 ${snap.counts.concepts} · 관계 ${snap.counts.relations} · 별칭 ${snap.counts.aliases} · 설명보유 ${snap.counts.withDescription}`);
await c.end();
})().catch((e) => { console.error("실패:", e.message); process.exit(1); });
