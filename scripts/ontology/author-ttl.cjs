#!/usr/bin/env node
/* 정본 TTL 편집 — v3 + 2차 계획 → v4 (🔵 파일만 씀 · DB 안 건드림)
   순서: **TTL → JSON → DB**. 파일이 먼저 바뀌고, DB 가 그 파일을 따라간다.

   기획: apps/docs/advanced/2-implementation-guide.md §2-B
   계획: scripts/advanced/plan2.cjs
   사용: node scripts/ontology/author-ttl.cjs */
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "../..");
const io = require("./ttl-io.cjs");
const planArg = (process.argv.find((a) => a.startsWith("--plan=")) || "").split("=")[1] || "plan2.cjs";
const P = require(path.join(ROOT, "scripts/advanced", planArg));
const DATA = path.join(ROOT, "python_services/packages/idea_to_graph_ontology/data");
const srcArg = (process.argv.find((a) => a.startsWith("--src=")) || "").split("=")[1];
const outArg = (process.argv.find((a) => a.startsWith("--out=")) || "").split("=")[1];
const SRC = srcArg ? path.join(DATA, srcArg) : path.join(DATA, "llm_ontology_v3-2026-08-25.ttl");
const OUT = outArg ? path.join(DATA, outArg) : path.join(DATA, "llm_ontology_v4-2026-08-25.ttl");
const DELTA = OUT.replace(/\.ttl$/, "-delta.ttl");

const doc = io.parse(fs.readFileSync(SRC, "utf8"));
const before = { c: doc.concepts.size, a: doc.aliases.length, r: doc.rels.length };
console.log("■ 입력 " + path.basename(SRC) + ":", JSON.stringify(before));

let log = [];
/* ① 신설 개념 */
for (const x of P.CONCEPTS) {
  if (doc.concepts.has(x.node)) { console.error(`중단: ${x.node} 가 이미 있습니다`); process.exit(1); }
  doc.concepts.set(x.node, { node: x.node, name: x.name, description: x.description, origin: P.ORIGIN });
  log.push(`+개념 ${x.node}`);
}
/* ② 이름 정정 — 1차에서 노드명을 그대로 넣었던 것 */
for (const r of P.RENAME) {
  const c = doc.concepts.get(r.node);
  if (!c) { console.error(`중단: ${r.node} 없음`); process.exit(1); }
  if (c.name !== r.name) { log.push(`~이름 ${r.node}: "${c.name}" → "${r.name}"`); c.name = r.name; }
}
/* ③ 관계 해제 — 파일에서 지운다(정본이므로 '없는 것'이 곧 해제다) */
const relKey = (r) => `${r.from}|${r.to}|${r.type}`;
const kill = new Set(P.REVOKE.map(relKey));
const keptRels = doc.rels.filter((r) => !kill.has(relKey(r)));
if (doc.rels.length - keptRels.length !== P.REVOKE.length) {
  console.error(`중단: 해제 대상 ${P.REVOKE.length}건 중 ${doc.rels.length - keptRels.length}건만 찾음`);
  process.exit(1);
}
P.REVOKE.forEach((r) => log.push(`-관계 ${r.from} --${r.type}--> ${r.to}`));
doc.rels = keptRels;
/* ④ 관계 삽입 */
const have = new Set(doc.rels.map(relKey));
for (const r of P.RELATIONS) {
  if (have.has(relKey(r))) { console.error(`중단: ${relKey(r)} 이 이미 있습니다`); process.exit(1); }
  doc.rels.push({ from: r.from, to: r.to, type: r.type });
  log.push(`+관계 ${r.from} --${r.type}--> ${r.to}`);
}
/* ⑤ 별칭 해제 · 삽입 */
const aKey = (a) => `${a.node}|${a.text}`;
const killA = new Set(P.REVOKE_ALIASES.map(aKey));
const keptA = doc.aliases.filter((a) => !killA.has(aKey(a)));
if (doc.aliases.length - keptA.length !== P.REVOKE_ALIASES.length) {
  console.error("중단: 해제할 별칭을 다 찾지 못했습니다"); process.exit(1);
}
P.REVOKE_ALIASES.forEach((a) => log.push(`-별칭 "${a.text}" @ ${a.node}`));
doc.aliases = keptA;
for (const a of P.ALIASES) { doc.aliases.push({ node: a.node, text: a.text }); log.push(`+별칭 "${a.text}" @ ${a.node}`); }

/* ⑥ 참조 무결성 — 없는 개념을 가리키는 관계가 없어야 한다 */
const dangling = doc.rels.filter((r) => !doc.concepts.has(r.from) || !doc.concepts.has(r.to));
if (dangling.length) { console.error("중단: 끊어진 관계", dangling.slice(0, 3)); process.exit(1); }
const aDangling = doc.aliases.filter((a) => !doc.concepts.has(a.node));
if (aDangling.length) { console.error("중단: 주인 없는 별칭", aDangling.slice(0, 3)); process.exit(1); }

/* ⑦ 순환 검사 (SUBTOPIC) */
const g = {}; doc.rels.filter((r) => r.type === "SUBTOPIC").forEach((r) => (g[r.from] = g[r.from] || []).push(r.to));
const st = {}; let cyc = null;
const dfs = (u, stk) => { if (cyc) return; st[u] = 1;
  for (const v of g[u] || []) { if (st[v] === 1) { cyc = [...stk, u, v].slice(-6).join(" → "); return; } if (!st[v]) dfs(v, [...stk, u]); }
  st[u] = 2; };
Object.keys(g).forEach((k) => { if (!st[k]) dfs(k, []); });
if (cyc) { console.error("중단: 순환", cyc); process.exit(1); }

/* ⑧ 쓰기 */
const header = [
  `# LLM 온톨로지 v4 — 정본 (${P.ADDED_AT})`,
  `# 개념 ${doc.concepts.size} · 관계 ${doc.rels.length} · 별칭 ${doc.aliases.length}`,
  `# 이 파일이 정본이다. DB 는 sync-postgres.cjs 로 이 파일을 따라간다.`,
  `# v3 = 1차 병합본 · v2 = 원본 온톨로지. 둘 다 남겨둔다.`,
  `# 우리가 넣은 개념에는 llm:origin "${P.ORIGIN}" 이 붙어 있다.`,
  "",
];
fs.writeFileSync(OUT, io.serialize(doc, header));

/* delta — 우리가 넣은 것만 */
const ours = new Map([...doc.concepts].filter(([, v]) => v.origin === P.ORIGIN));
const ourNodes = new Set(ours.keys());
const dRels = doc.rels.filter((r) => ourNodes.has(r.from) || P.RELATIONS.some((x) => relKey(x) === relKey(r)));
fs.writeFileSync(DELTA, io.serialize(
  { concepts: ours, aliases: doc.aliases.filter((a) => ourNodes.has(a.node)), rels: dRels.filter((r) => ourNodes.has(r.from)) },
  [`# 우리가 넣은 개념만 (delta) — 전체는 llm_ontology_v4-${P.ADDED_AT}.ttl`,
   `# 관계는 RDF 트리플에 출처를 못 붙이므로 아래 목록으로 대신한다(D10-A)`, ""]
) + "\n# ── 우리가 넣은 관계 ──\n" +
  P.RELATIONS.map((r) => `llm:${r.from} ${io.PRED[r.type]} llm:${r.to} .`).join("\n") + "\n");

console.log("\n■ 변경 내역");
log.forEach((l) => console.log("   " + l));
console.log(`\n■ 결과 v4: 개념 ${doc.concepts.size} · 관계 ${doc.rels.length} · 별칭 ${doc.aliases.length}`);
console.log("   ✅", OUT);
console.log("   ✅", DELTA);
console.log("\n다음: node scripts/ontology/export-snapshot-from-ttl.cjs   (TTL → JSON)");
