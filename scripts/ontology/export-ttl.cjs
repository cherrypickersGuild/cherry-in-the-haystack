#!/usr/bin/env node
/* Postgres → TTL (🔵 읽기 전용) — 온톨로지 정본 파일 생성
   기획: apps/docs/advanced/2-implementation-guide.md §2-B

   ⭐ 전체를 내보낸다. 원본 305개를 포함한 **완전한 병합본**이어야
      GraphDB 를 다시 세울 때 파일 하나로 복원된다. 델타만 내면 복원이 안 된다.
   ⭐ delta 파일을 따로 낸다(D10-A) — RDF 는 트리플 하나에 메타데이터를 못 붙이므로,
      "우리가 넣은 관계"를 구분하려면 파일을 나누는 수밖에 없다.

   사용: node scripts/ontology/export-ttl.cjs [출력디렉터리] */
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "../..");
const { Client } = require(path.join(ROOT, "apps/api/node_modules/pg"));
const OUTDIR = process.argv[2] || path.join(ROOT, "python_services/packages/idea_to_graph_ontology/data");
const STAMP = "2026-08-25";
const ORIGIN = "cherry-authored";

const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, "apps/api/.env"), "utf8").split("\n")
    .filter((l) => /^[A-Z_0-9]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));

/* 관계 타입 → RDF 술어. CONTRADICTS 는 원본에 없던 술어라 새로 만든다. */
const PRED = {
  SUBTOPIC: "rdfs:subClassOf", PREREQUISITE: "llm:isPrerequisiteOf",
  EXTENDS: "llm:extends", RELATED: "llm:relatedTo", CONTRADICTS: "llm:contradicts",
};

/* Turtle 3중따옴표 리터럴 이스케이프.
   ⚠️ 역슬래시가 먼저다 — 나중에 하면 우리가 넣은 이스케이프까지 다시 이스케이프된다.
   실측: 설명 8건에 LaTeX 수식이 있다 (ALiBi · BPC · GELU · Planning · ReLU · RMSNorm · SwiGLU · TreeSearch).
   \(d\) 를 그대로 쓰면 Turtle 파서가 \( 를 이스케이프 시퀀스로 읽어 깨진다. */
const lit3 = (s) => String(s).replace(/\\/g, "\\\\").replace(/"""/g, '\\"\\"\\"');
/** 한 줄 리터럴 — 따옴표·역슬래시·개행 */
const lit1 = (s) => String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");

const PREFIX = [
  "@prefix owl:  <http://www.w3.org/2002/07/owl#> .",
  "@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .",
  "@prefix skos: <http://www.w3.org/2004/02/skos/core#> .",
  "@prefix llm:  <http://example.org/llm-ontology#> .",
  "",
];

function block(cpt, aliases, rels) {
  const L = [`llm:${cpt.node} a owl:Class ;`];
  L.push(`    rdfs:label "${lit1(cpt.name)}"@en ;`);
  for (const a of aliases) L.push(`    skos:altLabel "${lit1(a)}" ;`);
  for (const r of rels) L.push(`    ${PRED[r.type]} llm:${r.to} ;`);
  if (cpt.origin === ORIGIN) L.push(`    llm:origin "${ORIGIN}" ;`);
  if (cpt.description) {
    L.push(`    llm:description """${lit3(cpt.description)}""" .`);
  } else {
    L[L.length - 1] = L[L.length - 1].replace(/ ;$/, " .");
  }
  return L.join("\n");
}

(async () => {
const c = new Client({ host: env.LOCAL_DB_HOST, port: +env.LOCAL_DB_PORT, user: env.LOCAL_DB_USER,
  password: env.LOCAL_DB_PASSWORD, database: env.LOCAL_DB_NAME, ssl: { rejectUnauthorized: false } });
await c.connect();
const q = async (s) => (await c.query(s)).rows;

const concepts = await q(`SELECT ontology_node node, canonical_name name, description,
    meta_json->>'origin' origin
  FROM handbook.concept WHERE revoked_at IS NULL AND ontology_node IS NOT NULL
  ORDER BY ontology_node`);
const aliases = await q(`SELECT c.ontology_node node, a.alias_text t
  FROM handbook.concept_alias a JOIN handbook.concept c ON c.id=a.concept_id AND c.revoked_at IS NULL
  WHERE a.revoked_at IS NULL ORDER BY 1,2`);
const rels = await q(`SELECT a.ontology_node "from", b.ontology_node "to",
    r.relation_type::text type, r.origin
  FROM handbook.concept_relation r
  JOIN handbook.concept a ON a.id=r.from_concept_id AND a.revoked_at IS NULL
  JOIN handbook.concept b ON b.id=r.to_concept_id   AND b.revoked_at IS NULL
  WHERE r.revoked_at IS NULL ORDER BY 1,3,2`);

const aliOf = {}; aliases.forEach((a) => (aliOf[a.node] = aliOf[a.node] || []).push(a.t));
const relOf = {}; rels.forEach((r) => (relOf[r.from] = relOf[r.from] || []).push(r));

/* ── 전체 ─────────────────────────────────────────────────── */
const full = [
  `# LLM 온톨로지 — Postgres 정본 내보내기 (${STAMP})`,
  `# 개념 ${concepts.length} · 관계 ${rels.length} · 별칭 ${aliases.length}`,
  `# 원본 온톨로지 + 2026-08-25 Advanced 작업분을 합친 **임시 병합본**이다.`,
  `# GraphDB 를 다시 세울 때 이 파일 하나로 복원된다. 델타만으로는 복원되지 않는다.`,
  `# 우리가 넣은 개념에는 llm:origin "${ORIGIN}" 이 붙어 있다.`,
  `# 관계의 출처는 트리플에 붙일 수 없어 delta 파일이 담는다(D10-A).`,
  `# ⚠️ 페이지 콘텐츠(Overview·체리·References)는 여기 없다 — Postgres 에만 있다.`,
  "", ...PREFIX,
];
for (const cpt of concepts) full.push(block(cpt, aliOf[cpt.node] || [], relOf[cpt.node] || []), "");
const fullPath = path.join(OUTDIR, `llm_ontology_v3-${STAMP}.ttl`);
fs.writeFileSync(fullPath, full.join("\n"));

/* ── delta — 우리가 넣은 것만 ──────────────────────────────── */
const dConcepts = concepts.filter((x) => x.origin === ORIGIN);
const dRels = rels.filter((r) => r.origin === ORIGIN);
const dNodes = new Set(dConcepts.map((x) => x.node));
const dAli = aliases.filter((a) => dNodes.has(a.node) || !!(a.__ = null));
const delta = [
  `# 2026-08-25 Advanced 작업분만 (delta)`,
  `# 전체는 llm_ontology_v3-${STAMP}.ttl 에 있다. 이 파일만으로는 복원되지 않는다.`,
  `# 용도: 원본과 우리 것을 나중에 구분하기 위함(D10-A).`,
  "", ...PREFIX,
  `# ── 신설 개념 ${dConcepts.length}건 ──`, "",
];
for (const cpt of dConcepts) delta.push(block(cpt, aliOf[cpt.node] || [], relOf[cpt.node] || []), "");
delta.push(`# ── 삽입 관계 ${dRels.length}건 (신설 개념이 주어인 것 포함) ──`, "");
for (const r of dRels) delta.push(`llm:${r.from} ${PRED[r.type]} llm:${r.to} .`);
delta.push("");
const deltaPath = path.join(OUTDIR, `llm_ontology_v3-delta-${STAMP}.ttl`);
fs.writeFileSync(deltaPath, delta.join("\n"));

console.log("✅ 전체 :", fullPath);
console.log(`   개념 ${concepts.length} · 관계 ${rels.length} · 별칭 ${aliases.length} · ${(fs.statSync(fullPath).size/1024).toFixed(0)} KB`);
console.log("✅ delta:", deltaPath);
console.log(`   개념 ${dConcepts.length} · 관계 ${dRels.length}`);
const bs = concepts.filter((x) => x.description && x.description.includes("\\"));
console.log(`   역슬래시 포함 설명 ${bs.length}건 이스케이프 처리 (${bs.map((x)=>x.node).join(", ")})`);
await c.end();
})().catch((e) => { console.error("실패:", e.message); process.exit(1); });
