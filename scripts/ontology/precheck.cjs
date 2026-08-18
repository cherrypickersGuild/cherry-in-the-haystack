#!/usr/bin/env node
/* 이관 사전 점검 — 읽기 전용(dry-run). 쓰기 없음.
   기획: apps/docs/ontology-migration/2-implementation-guide.md §3-2 */
const fs = require("fs"), os = require("os"), path = require("path");
const { execFileSync } = require("child_process");
const ROOT = path.resolve(__dirname, "../..");
const EP = process.env.GRAPHDB_URL || "http://localhost:7200";
const REPO = process.env.GRAPHDB_REPO || "llm-ontology";

function sparql(q) {
  const tmp = path.join(os.tmpdir(), `pre-${process.pid}.rq`);
  fs.writeFileSync(tmp, q);
  try {
    return JSON.parse(execFileSync("curl", ["-s", "-G", "--data-urlencode", `query@${tmp}`,
      "--data-urlencode", "infer=false", "-H", "Accept: application/sparql-results+json",
      `${EP}/repositories/${REPO}`], { maxBuffer: 1 << 28 }).toString()).results.bindings;
  } finally { try { fs.unlinkSync(tmp) } catch {} }
}
const P = `PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX llm: <http://example.org/llm-ontology#>`;

(async () => {
  /* ── 1. 스냅샷 추출 ── */
  const rows = sparql(`${P}\nSELECT ?s ?l ?d WHERE { ?s a owl:Class ; rdfs:label ?l . OPTIONAL { ?s llm:description ?d } }`);
  const edges = sparql(`${P}\nSELECT ?c ?p WHERE { ?ch rdfs:subClassOf ?pa . ?ch rdfs:label ?c . ?pa rdfs:label ?p }`)
    .map(b => ({ from: b.c.value, to: b.p.value }));

  const byId = new Map();
  for (const b of rows) {
    const id = b.s.value.split("#").pop();
    if (!byId.has(id)) byId.set(id, { id, labels: [], desc: null });
    const n = byId.get(id);
    n.labels.push(b.l.value);
    if (b.d && !n.desc) n.desc = b.d.value;
  }
  const nodes = [...byId.values()];
  console.log(`■ 스냅샷: 클래스 ${nodes.length} · 라벨 ${rows.length} · subClassOf ${edges.length}`);

  const fail = [];
  const warn = [];

  /* ── 2. 라벨 2개 이상인 클래스 (R4) ── */
  const multi = nodes.filter(n => n.labels.length > 1);
  console.log(`\n■ 라벨 2개 이상 클래스: ${multi.length}건`);
  multi.forEach(n => console.log(`   ${n.id}: ${n.labels.join(" / ")}  → canonical 선택 필요`));

  /* ── 3. canonical_name 대소문자 무시 중복 (R3) ── */
  const canonical = new Map();   // lower(label) -> [ids]
  nodes.forEach(n => {
    const c = n.labels[0].toLowerCase();
    if (!canonical.has(c)) canonical.set(c, []);
    canonical.get(c).push(n.id);
  });
  const dupCanon = [...canonical.entries()].filter(([, v]) => v.length > 1);
  console.log(`\n■ canonical_name 충돌(대소문자 무시): ${dupCanon.length}건`);
  dupCanon.forEach(([k, v]) => { console.log(`   "${k}" ← ${v.join(", ")}`); fail.push(`canonical 중복: ${k}`); });

  /* ── 4. ⭐ alias 전역 유니크 충돌 (R2) ── */
  // 별칭 후보 = ①라벨 2개 클래스의 나머지 라벨 ②화면 라벨(개념 JSON) 중 온톨로지 라벨과 다른 것
  const aliasCand = [];
  multi.forEach(n => n.labels.slice(1).forEach(l => aliasCand.push({ text: l, owner: n.id, src: "라벨2개" })));

  const CDIR = path.join(ROOT, "apps/web/public/learning/concepts");
  if (fs.existsSync(CDIR)) {
    for (const f of fs.readdirSync(CDIR).filter(x => x.endsWith(".json"))) {
      const doc = JSON.parse(fs.readFileSync(path.join(CDIR, f), "utf8"));
      for (const c of doc.childConcepts || []) {
        if (c.ontologyNode && c.label && c.label.toLowerCase() !== c.ontologyNode.toLowerCase())
          aliasCand.push({ text: c.label, owner: c.ontologyNode, src: `화면(${doc.slug})` });
      }
      if (doc.ontology?.node && doc.menuLabel && doc.menuLabel.toLowerCase() !== doc.ontology.node.toLowerCase())
        aliasCand.push({ text: doc.menuLabel, owner: doc.ontology.node, src: `화면(${doc.slug})` });
    }
  }
  // 중복 후보 정리
  const seen = new Map();
  aliasCand.forEach(a => {
    const k = `${a.text.toLowerCase()}::${a.owner}`;
    if (!seen.has(k)) seen.set(k, a);
  });
  const cands = [...seen.values()];
  console.log(`\n■ 별칭 후보: ${cands.length}건`);

  // 충돌 ①: 별칭이 다른 개념의 canonical 과 겹침
  const vsCanon = cands.filter(a => {
    const owners = canonical.get(a.text.toLowerCase());
    return owners && !owners.includes(a.owner);
  });
  // 충돌 ②: 서로 다른 개념이 같은 별칭을 원함
  const byText = new Map();
  cands.forEach(a => { const k = a.text.toLowerCase(); if (!byText.has(k)) byText.set(k, new Set()); byText.get(k).add(a.owner); });
  const vsEach = [...byText.entries()].filter(([, s]) => s.size > 1);

  console.log(`   ⓐ 다른 개념의 이름과 충돌: ${vsCanon.length}건`);
  vsCanon.forEach(a => { console.log(`      "${a.text}" (${a.owner} 용) ↔ 기존 개념 ${canonical.get(a.text.toLowerCase()).join(",")}`); fail.push(`alias vs canonical: ${a.text}`); });
  console.log(`   ⓑ 여러 개념이 같은 별칭 요구: ${vsEach.length}건`);
  vsEach.forEach(([t, s]) => { console.log(`      "${t}" ← ${[...s].join(", ")}`); fail.push(`alias 경합: ${t}`); });

  /* ── 5. 관계 양끝 존재 (R) ── */
  const labelSet = new Set(nodes.flatMap(n => n.labels.map(l => l.toLowerCase())));
  const orphan = edges.filter(e => !labelSet.has(e.from.toLowerCase()) || !labelSet.has(e.to.toLowerCase()));
  console.log(`\n■ 양끝 개념 누락 관계: ${orphan.length}건`);
  orphan.slice(0, 5).forEach(e => console.log(`   ${e.from} → ${e.to}`));
  if (orphan.length) fail.push(`관계 끝 누락 ${orphan.length}`);

  /* ── 6. 사이클 (R9) ── */
  const parentOf = new Map();
  edges.forEach(e => { if (!parentOf.has(e.from)) parentOf.set(e.from, []); parentOf.get(e.from).push(e.to); });
  let cycles = 0;
  for (const start of parentOf.keys()) {
    const seenN = new Set([start]); let cur = [start], depth = 0;
    while (cur.length && depth++ < 30) {
      const next = cur.flatMap(x => parentOf.get(x) || []);
      if (next.some(n => seenN.has(n))) { cycles++; break; }
      next.forEach(n => seenN.add(n)); cur = next;
    }
  }
  console.log(`\n■ 사이클: ${cycles}건`);
  if (cycles) fail.push(`사이클 ${cycles}`);

  /* ── 7. 자기 참조 ── */
  const self = edges.filter(e => e.from.toLowerCase() === e.to.toLowerCase());
  console.log(`■ 자기 참조 관계: ${self.length}건`);
  if (self.length) fail.push(`자기참조 ${self.length}`);

  /* ── 8. 삽입 예정 건수 ── */
  console.log(`\n■ 삽입 예정`);
  console.log(`   handbook.concept          ${nodes.length} 행`);
  console.log(`   handbook.concept_alias    ${cands.length - vsCanon.length - vsEach.reduce((s,[,x])=>s+x.size,0)} 행 (충돌 제외)`);
  console.log(`   handbook.concept_relation ${edges.length} 행 (전부 SUBTOPIC)`);
  console.log(`   설명 보유                  ${nodes.filter(n => n.desc).length} / ${nodes.length}`);

  console.log(`\n${"═".repeat(60)}`);
  if (fail.length) { console.log(`❌ 차단 사유 ${fail.length}건 — 이관 중단\n   ${fail.join("\n   ")}`); process.exit(2); }
  console.log(`✅ 차단 사유 없음 — 이관 가능`);
})().catch(e => { console.error("실패:", e.message); process.exit(1); });
