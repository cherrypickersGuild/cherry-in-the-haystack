#!/usr/bin/env node
/* Advanced 온톨로지 변경 — 적용 후 검증 (🔵 읽기 전용)
   기획: apps/docs/advanced/3-checklist-table.md §2-E · §6
   사용: node scripts/advanced/verify.cjs */
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "../..");
const { Client } = require(path.join(ROOT, "apps/api/node_modules/pg"));
const P = require("./plan.cjs");
const SNAP = JSON.parse(fs.readFileSync(path.join(ROOT, "apps/docs/ontology-migration/ontology-snapshot.json"), "utf8"));
const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, "apps/api/.env"), "utf8").split("\n")
    .filter((l) => /^[A-Z_0-9]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
let fail = 0;
const ok = (b, m) => { console.log(`   ${b ? "✅" : "❌"} ${m}`); if (!b) fail++; };
(async () => {
const c = new Client({ host: env.LOCAL_DB_HOST, port: +env.LOCAL_DB_PORT, user: env.LOCAL_DB_USER,
  password: env.LOCAL_DB_PASSWORD, database: env.LOCAL_DB_NAME, ssl: { rejectUnauthorized: false } });
await c.connect();
const q = async (s, p) => (await c.query(s, p)).rows;

console.log("■ V1. 건수");
const n = (await q(`SELECT
  (SELECT count(*)::int FROM handbook.concept          WHERE revoked_at IS NULL) concepts,
  (SELECT count(*)::int FROM handbook.concept_relation WHERE revoked_at IS NULL) relations,
  (SELECT count(*)::int FROM handbook.concept_alias    WHERE revoked_at IS NULL) aliases,
  (SELECT count(*)::int FROM handbook.paragraph_chunk  WHERE revoked_at IS NULL) chunks,
  (SELECT count(*)::int FROM handbook.paragraph_concept_link WHERE revoked_at IS NULL) links,
  (SELECT count(*)::int FROM content.concept_page) pages`))[0];
for (const k of Object.keys(P.EXPECTED)) ok(n[k] === P.EXPECTED[k], `${k} ${n[k]} = 기대 ${P.EXPECTED[k]}`);

console.log("\n■ V3. 기존 305개 무변경 (이관 스냅샷과 글자 단위 대조)");
const rows = await q(`SELECT ontology_node, canonical_name, description FROM handbook.concept
  WHERE revoked_at IS NULL AND (meta_json->>'origin') IS DISTINCT FROM $1`, [P.ORIGIN]);
const db = new Map(rows.map((r) => [r.ontology_node, r]));
ok(rows.length === SNAP.concepts.length, `원본 개념 ${rows.length} = 스냅샷 ${SNAP.concepts.length}`);
let mm = [];
for (const s of SNAP.concepts) {
  const d = db.get(s.node);
  if (!d) { mm.push(`${s.node}: 없음`); continue; }
  if (d.canonical_name !== s.label) mm.push(`${s.node}: 이름`);
  if ((d.description ?? null) !== (s.description ?? null)) mm.push(`${s.node}: 설명`);
}
ok(mm.length === 0, `이름·설명 불일치 ${mm.length}건${mm.length ? ` (${mm.slice(0, 3).join(" / ")})` : ""}`);
const origRel = (await q(`SELECT count(*)::int n FROM handbook.concept_relation
  WHERE revoked_at IS NULL AND origin = 'graphdb-import'`))[0].n;
ok(origRel === SNAP.relations.length - P.REVOKE.length,
   `원본 관계 ${origRel} = 스냅샷 ${SNAP.relations.length} - 해제 ${P.REVOKE.length}`);

console.log("\n■ V2. 순환");
const edges = (await q(`SELECT a.ontology_node f, b.ontology_node t FROM handbook.concept_relation r
   JOIN handbook.concept a ON a.id = r.from_concept_id AND a.revoked_at IS NULL
   JOIN handbook.concept b ON b.id = r.to_concept_id   AND b.revoked_at IS NULL
  WHERE r.revoked_at IS NULL AND r.relation_type = 'SUBTOPIC'`)).map((r) => [r.f, r.t]);
const g = {}; edges.forEach(([f, t]) => (g[f] = g[f] || []).push(t));
const st = {}; let cyc = null;
const dfs = (u, stk) => { if (cyc) return; st[u] = 1;
  for (const v of g[u] || []) { if (st[v] === 1) { cyc = [...stk, u, v].slice(-6).join(" → "); return; } if (!st[v]) dfs(v, [...stk, u]); }
  st[u] = 2; };
Object.keys(g).forEach((k) => { if (!st[k]) dfs(k, []); });
ok(!cyc, `SUBTOPIC 순환 없음${cyc ? ` (${cyc})` : ""}`);

console.log("\n■ V7. 화면 03 Child Concepts");
const kidsOf = async (node) => (await q(`SELECT a.ontology_node k, r.relation_type::text ty
   FROM handbook.concept_relation r
   JOIN handbook.concept a ON a.id = r.from_concept_id AND a.revoked_at IS NULL
   JOIN handbook.concept b ON b.id = r.to_concept_id   AND b.revoked_at IS NULL
  WHERE b.ontology_node = $1 AND r.revoked_at IS NULL ORDER BY 1`, [node]));
for (const [node, exp] of Object.entries(P.EXPECTED_CHILDREN)) {
  const k = await kidsOf(node);
  ok(k.length === exp && k.length >= 3, `${node}: ${k.length}개 — ${k.map((x) => x.k).join(" · ")}`);
}

console.log("\n■ V11. Basics 영향 (D4)");
/* 6 → 6 이다. LoRA 가 빠지고(-1) CustomEmbedding 이 RELATED 로 붙는다(+1).
   기획 초안은 빼는 쪽만 세어 5 로 적었다 — 계산 착오(E9). */
const ft = await kidsOf("Finetuning");
ok(ft.length === 6, `Finetuning 하위 6 → ${ft.length} (LoRA 빠지고 CustomEmbedding 붙음) — ${ft.map((x) => x.k).join(" · ")}`);
ok(!ft.some((x) => x.k === "LoRA"), "LoRA 가 Finetuning 직계에서 빠짐");
ok(ft.some((x) => x.k === "CustomEmbedding"), "CustomEmbedding 이 Finetuning 과 RELATED 로 붙음");
const lora = await kidsOf("LoRA");
ok(lora.some((x) => x.k === "QuantizedLoRA"), `LoRA 하위에 QuantizedLoRA 유지 (${lora.map((x) => x.k).join(", ")})`);
const loraParents = (await q(`SELECT b.ontology_node p FROM handbook.concept_relation r
   JOIN handbook.concept a ON a.id = r.from_concept_id JOIN handbook.concept b ON b.id = r.to_concept_id
  WHERE a.ontology_node = 'LoRA' AND r.revoked_at IS NULL`)).map((r) => r.p);
ok(loraParents.length === 1 && loraParents[0] === "ParameterEfficientFinetuning",
   `LoRA 의 상위 = ${loraParents.join(", ") || "(없음)"} (Finetuning 이 아니어야 함)`);

console.log("\n■ 신설 개념 · 별칭");
const news = await q(`SELECT ontology_node n, meta_json->>'boundary' b FROM handbook.concept
  WHERE revoked_at IS NULL AND meta_json->>'origin' = $1 ORDER BY 1`, [P.ORIGIN]);
ok(news.length === P.CONCEPTS.length, `신설 개념 ${news.length}건 — ${news.map((x) => x.n).join(" · ")}`);
ok(news.every((x) => x.b && x.b.length > 30), "경계 문장이 meta_json 에 전부 보존됨");
const newAl = (await q(`SELECT count(*)::int n FROM handbook.concept_alias WHERE revoked_at IS NULL`))[0].n;
ok(newAl === P.EXPECTED.aliases, `별칭 ${newAl} = 기대 ${P.EXPECTED.aliases}`);
const ma = (await q(`SELECT a.alias_text t FROM handbook.concept_alias a
  JOIN handbook.concept cc ON cc.id = a.concept_id
 WHERE cc.ontology_node = 'MultiAgentSystem' AND a.revoked_at IS NULL ORDER BY 1`)).map((r) => r.t);
ok(ma.includes("multiagent"), `MultiAgentSystem 별칭: ${ma.join(" · ")}`);

console.log(`\n${fail === 0 ? "✅ 검증 통과" : `❌ 실패 ${fail}건`}`);
await c.end(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("실패:", e.message); process.exit(1); });
