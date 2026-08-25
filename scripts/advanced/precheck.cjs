#!/usr/bin/env node
/* Advanced 온톨로지 변경 — 사전 점검 (🔵 읽기 전용 · SELECT 만 · 쓰기 없음)
   계획 정의: scripts/advanced/plan.cjs  (precheck/apply/rollback 공용)
   기획: apps/docs/advanced/2-implementation-guide.md · 3-checklist-table.md §1

   하나라도 실패하면 종료코드 1. 이 상태로 apply 를 돌리면 안 된다.
   사용: node scripts/advanced/precheck.cjs */
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "../..");
const { Client } = require(path.join(ROOT, "apps/api/node_modules/pg"));
const P = require("./plan.cjs");

const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, "apps/api/.env"), "utf8").split("\n")
    .filter((l) => /^[A-Z_0-9]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));

let fail = 0, warn = 0;
const ok = (b, m) => { console.log(`   ${b ? "✅" : "❌"} ${m}`); if (!b) fail++; };
const wk = (b, m) => { console.log(`   ${b ? "✅" : "⚠️ "} ${m}`); if (!b) warn++; };

(async () => {
const c = new Client({ host: env.LOCAL_DB_HOST, port: +env.LOCAL_DB_PORT, user: env.LOCAL_DB_USER,
  password: env.LOCAL_DB_PASSWORD, database: env.LOCAL_DB_NAME, ssl: { rejectUnauthorized: false } });
await c.connect();
const q = async (s, p) => (await c.query(s, p)).rows;

console.log("■ 0. 접속 · 읽기 전용 확인");
console.log(`   host ${env.LOCAL_DB_HOST} · db ${env.LOCAL_DB_NAME}`);
console.log("   이 스크립트는 SELECT 만 실행한다.\n");

/* ── 1. 기준선 ─────────────────────────────────────────────── */
console.log("■ 1. 기준선 (다르면 계획이 낡은 것 — 즉시 중단)");
const n = (await q(`SELECT
  (SELECT count(*)::int FROM handbook.concept          WHERE revoked_at IS NULL) concepts,
  (SELECT count(*)::int FROM handbook.concept_relation WHERE revoked_at IS NULL) relations,
  (SELECT count(*)::int FROM handbook.concept_alias    WHERE revoked_at IS NULL) aliases,
  (SELECT count(*)::int FROM handbook.paragraph_chunk  WHERE revoked_at IS NULL) chunks,
  (SELECT count(*)::int FROM handbook.paragraph_concept_link WHERE revoked_at IS NULL) links,
  (SELECT count(*)::int FROM content.concept_page) pages`))[0];
for (const k of Object.keys(P.BASELINE)) ok(n[k] === P.BASELINE[k], `${k} ${n[k]} = 기준선 ${P.BASELINE[k]}`);

/* ── 2. 신설 개념 ──────────────────────────────────────────── */
console.log("\n■ 2. 신설 개념 5개");
const newNodes = P.CONCEPTS.map((x) => x.node);
const dup = (await q(`SELECT ontology_node n FROM handbook.concept WHERE ontology_node = ANY($1) AND revoked_at IS NULL`, [newNodes])).map((r) => r.n);
ok(dup.length === 0, `활성 이름 충돌 없음${dup.length ? ` (충돌: ${dup.join(", ")})` : ""}`);
/* 롤백을 한 뒤 다시 적용하는 경우, 해제된 행이 남아 있는 것은 정상이다.
   uq_concept_ontology_node_active 가 활성 행에만 걸리므로 재삽입을 막지 않는다. */
const revoked = (await q(`SELECT ontology_node n FROM handbook.concept WHERE ontology_node = ANY($1) AND revoked_at IS NOT NULL`, [newNodes])).map((r) => r.n);
if (revoked.length) console.log(`   ℹ️  해제된 동명 행 ${revoked.length}건 (${revoked.join(", ")}) — 이전 롤백의 흔적. 재삽입을 막지 않는다`);
const nameDup = (await q(`SELECT canonical_name n FROM handbook.concept WHERE canonical_name = ANY($1) AND revoked_at IS NULL`, [P.CONCEPTS.map((x) => x.name)])).map((r) => r.n);
ok(nameDup.length === 0, `canonical_name 충돌 없음${nameDup.length ? ` (${nameDup.join(", ")})` : ""}`);
ok(P.CONCEPTS.every((x) => /^[A-Za-z][A-Za-z0-9_]*$/.test(x.node)), "노드명이 IRI 로 안전 (^[A-Za-z][A-Za-z0-9_]*$)");
ok(P.CONCEPTS.every((x) => x.description && x.description.length > 100), "설명이 전부 있음 (100자 초과)");
ok(P.CONCEPTS.every((x) => x.boundary && x.boundary.length > 30), "형제와의 경계 문장이 전부 있음 (원칙 1)");
ok(P.CONCEPTS.every((x) => !/[가-힣]/.test(x.description)), "새 설명에 한글 없음 (D7 — 영어로)");

/* ── 3. 참조 무결성 ────────────────────────────────────────── */
console.log("\n■ 3. 계획이 참조하는 기존 개념이 실재하나");
const refs = [...new Set([...P.RELATIONS.flatMap((r) => [r.from, r.to]),
                          ...P.REVOKE.flatMap((r) => [r.from, r.to]),
                          ...P.ALIASES.map((a) => a.node)])].filter((x) => !newNodes.includes(x));
const have = (await q(`SELECT ontology_node n FROM handbook.concept WHERE ontology_node = ANY($1) AND revoked_at IS NULL`, [refs])).map((r) => r.n);
const missing = refs.filter((x) => !have.includes(x));
ok(missing.length === 0, `참조 개념 ${refs.length}개 전부 실재${missing.length ? ` (없음: ${missing.join(", ")})` : ""}`);

/* ── 4. 관계 ───────────────────────────────────────────────── */
console.log("\n■ 4. 관계");
ok(P.RELATIONS.every((r) => r.from !== r.to), "자기 자신을 가리키는 관계 없음");
const seen = new Set(); let inDup = [];
for (const r of P.RELATIONS) { const k = `${r.from}|${r.to}|${r.type}`; if (seen.has(k)) inDup.push(k); seen.add(k); }
ok(inDup.length === 0, `계획 안에 중복 없음${inDup.length ? ` (${inDup.join(", ")})` : ""}`);
let already = [];
for (const r of P.RELATIONS) {
  if (newNodes.includes(r.from) || newNodes.includes(r.to)) continue;
  const hit = await q(`SELECT 1 FROM handbook.concept_relation rel
     JOIN handbook.concept a ON a.id = rel.from_concept_id
     JOIN handbook.concept b ON b.id = rel.to_concept_id
    WHERE a.ontology_node = $1 AND b.ontology_node = $2 AND rel.relation_type = $3::handbook.concept_relation_enum
      AND rel.revoked_at IS NULL`, [r.from, r.to, r.type]);
  if (hit.length) already.push(`${r.from}→${r.to}`);
}
ok(already.length === 0, `DB 에 이미 있는 관계 없음${already.length ? ` (${already.join(", ")})` : ""}`);
for (const r of P.REVOKE) {
  const hit = await q(`SELECT 1 FROM handbook.concept_relation rel
     JOIN handbook.concept a ON a.id = rel.from_concept_id
     JOIN handbook.concept b ON b.id = rel.to_concept_id
    WHERE a.ontology_node = $1 AND b.ontology_node = $2 AND rel.relation_type = $3::handbook.concept_relation_enum
      AND rel.revoked_at IS NULL`, [r.from, r.to, r.type]);
  ok(hit.length === 1, `해제 대상이 정확히 1건 존재: ${r.from}→${r.to} (${hit.length}건)`);
}
const enums = (await q(`SELECT unnest(enum_range(NULL::handbook.concept_relation_enum))::text t`)).map((r) => r.t);
ok(P.RELATIONS.every((r) => enums.includes(r.type)), `relation_type 이 전부 ENUM 안에 있음 (${enums.join(" · ")})`);

/* ── 5. 별칭 ───────────────────────────────────────────────── */
console.log("\n■ 5. 별칭");
const atypes = (await q(`SELECT unnest(enum_range(NULL::handbook.concept_alias_type_enum))::text t`)).map((r) => r.t);
ok(P.ALIASES.every((a) => atypes.includes(a.type)), `alias_type 이 전부 ENUM 안에 있음 (${atypes.join(" · ")})`);
const aDup = (await q(`SELECT alias_text t FROM handbook.concept_alias WHERE alias_text = ANY($1) AND revoked_at IS NULL`,
  [P.ALIASES.map((a) => a.text)])).map((r) => r.t);
ok(aDup.length === 0, `기존 별칭과 충돌 없음${aDup.length ? ` (${aDup.join(", ")})` : ""}`);
const aSelf = P.ALIASES.filter((a) => a.text === a.node);
ok(aSelf.length === 0, `별칭이 노드명과 같은 경우 없음${aSelf.length ? ` (${aSelf.map((a) => a.text).join(", ")})` : ""}`);
const aInDup = P.ALIASES.map((a) => a.text).filter((t, i, arr) => arr.indexOf(t) !== i);
ok(aInDup.length === 0, `계획 안 별칭 중복 없음${aInDup.length ? ` (${aInDup.join(", ")})` : ""}`);
ok(P.ALIASES.every((a) => !/["\\]/.test(a.text)), "별칭에 따옴표·역슬래시 없음 (TTL 직렬화 안전)");

/* ── 6. 순환 ───────────────────────────────────────────────── */
console.log("\n■ 6. 순환 (적용 후 SUBTOPIC 그래프)");
const revokeKey = new Set(P.REVOKE.map((r) => `${r.from}|${r.to}|${r.type}`));
const edges = (await q(`SELECT a.ontology_node f, b.ontology_node t, rel.relation_type::text ty
   FROM handbook.concept_relation rel
   JOIN handbook.concept a ON a.id = rel.from_concept_id JOIN handbook.concept b ON b.id = rel.to_concept_id
  WHERE rel.revoked_at IS NULL AND rel.relation_type = 'SUBTOPIC'`))
  .filter((r) => !revokeKey.has(`${r.f}|${r.t}|${r.ty}`)).map((r) => [r.f, r.t])
  .concat(P.RELATIONS.filter((r) => r.type === "SUBTOPIC").map((r) => [r.from, r.to]));
const g = {}; edges.forEach(([f, t]) => (g[f] = g[f] || []).push(t));
const state = {}; let cyc = null;
const dfs = (u, stk) => { if (cyc) return; state[u] = 1;
  for (const v of g[u] || []) { if (state[v] === 1) { cyc = [...stk, u, v].slice(-6).join(" → "); return; } if (!state[v]) dfs(v, [...stk, u]); }
  state[u] = 2; };
Object.keys(g).forEach((k) => { if (!state[k]) dfs(k, []); });
ok(!cyc, `SUBTOPIC 순환 없음${cyc ? ` (${cyc})` : ""}`);

/* ── 7. 화면 영향 ──────────────────────────────────────────── */
console.log("\n■ 7. 화면 — 03 Child Concepts (적용 후 예상)");
const kidsOf = async (node) => (await q(`SELECT a.ontology_node k FROM handbook.concept_relation rel
   JOIN handbook.concept a ON a.id = rel.from_concept_id AND a.revoked_at IS NULL
   JOIN handbook.concept b ON b.id = rel.to_concept_id   AND b.revoked_at IS NULL
  WHERE b.ontology_node = $1 AND rel.revoked_at IS NULL`, [node])).map((r) => r.k);
for (const [node, exp] of Object.entries(P.EXPECTED_CHILDREN)) {
  const after = [...new Set([...(await kidsOf(node)), ...P.RELATIONS.filter((r) => r.to === node).map((r) => r.from)])];
  ok(after.length === exp && after.length >= 3, `${node}: ${after.length}개 (기대 ${exp}, 최소 3)`);
}
/* 빼는 것과 더하는 것을 둘 다 센다. 빼는 쪽만 세면 틀린다(E9). */
const ftBase = (await kidsOf("Finetuning")).filter((x) => !P.REVOKE.some((r) => r.from === x && r.to === "Finetuning"));
const ftAfter = [...new Set([...ftBase, ...P.RELATIONS.filter((r) => r.to === "Finetuning").map((r) => r.from)])];
wk(ftAfter.length === 6, `⚠️ Basics 영향 — Finetuning 하위 6 → ${ftAfter.length}: LoRA 가 PEFT 밑으로 내려가고 CustomEmbedding 이 RELATED 로 붙는다 (D4·D2 승인 사항)`);
console.log(`      적용 후: ${ftAfter.sort().join(" · ")}`);

/* ── 8. TTL 직렬화 안전성 (Phase 1-B 대비) ─────────────────── */
console.log("\n■ 8. TTL 직렬화 안전성");
const badNode = (await q(`SELECT ontology_node n FROM handbook.concept
   WHERE revoked_at IS NULL AND ontology_node !~ '^[A-Za-z][A-Za-z0-9_]*$'`)).map((r) => r.n);
ok(badNode.length === 0, `기존 노드명 전부 IRI 안전${badNode.length ? ` (${badNode.slice(0, 5).join(", ")})` : ""}`);
const q3 = (await q(`SELECT count(*)::int n FROM handbook.concept
   WHERE revoked_at IS NULL AND position('\"\"\"' in description) > 0`))[0].n;
ok(q3 === 0, `설명에 3중따옴표 없음 (${q3}건)`);
/* ⚠️ 역슬래시는 apply 를 막지 않는다 — TTL 을 쓸 때(Phase 1-B) 이스케이프하면 된다.
   실측: 지식팀이 쓴 LaTeX 수식 8건. Turtle 리터럴 안에서 역슬래시는 이스케이프 문자라
   \\( 처럼 그대로 쓰면 파싱이 깨진다. export-ttl.cjs 가 \\ 로 바꿔 써야 한다. */
const bs = (await q(`SELECT ontology_node n FROM handbook.concept
   WHERE revoked_at IS NULL AND position('\\' in description) > 0 ORDER BY 1`)).map((r) => r.n);
wk(bs.length === 0, `설명에 역슬래시 ${bs.length}건 — TTL 작성 시 \\\\ 로 이스케이프 필수 (${bs.join(", ")})`);
const nl = (await q(`SELECT count(*)::int n FROM handbook.concept WHERE revoked_at IS NULL AND description ~ '\n'`))[0].n;
console.log(`   ℹ️  개행 포함 설명 ${nl}건 → TTL 은 3중따옴표 리터럴로 써야 한다`);

/* ── 9. 요약 ───────────────────────────────────────────────── */
console.log("\n■ 9. apply 가 하게 될 일");
console.log(`   개념 삽입 ${P.CONCEPTS.length} · 관계 삽입 ${P.RELATIONS.length} · 관계 해제 ${P.REVOKE.length} · 별칭 ${P.ALIASES.length}`);
console.log(`   ${n.concepts} → ${P.EXPECTED.concepts} 개념 · ${n.relations} → ${P.EXPECTED.relations} 관계 · ${n.aliases} → ${P.EXPECTED.aliases} 별칭`);
console.log(`   기존 데이터는 건드리지 않는다 — chunk ${n.chunks} · link ${n.links} · page ${n.pages} 유지`);

console.log(`\n${fail === 0 ? "✅ 사전 점검 통과" : `❌ 실패 ${fail}건 — apply 를 돌리지 말 것`}` + (warn ? ` · 확인 필요 ${warn}건` : ""));
await c.end();
process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("실패:", e.message); process.exit(1); });
