/* TTL 읽기·쓰기 (공유 모듈) — 정본이 TTL 이므로 파서와 직렬화기가 한 파일에 있어야 한다.
   둘이 떨어져 있으면 이스케이프 규약이 어긋난다(실제로 한 번 어긋났다).

   다루는 형식은 우리가 쓰는 제한된 Turtle 뿐이다. 임의 Turtle 은 지원하지 않는다. */

const PRED = { SUBTOPIC: "rdfs:subClassOf", PREREQUISITE: "llm:isPrerequisiteOf",
  EXTENDS: "llm:extends", RELATED: "llm:relatedTo", CONTRADICTS: "llm:contradicts" };
const PRED2TYPE = Object.fromEntries(Object.entries(PRED).map(([k, v]) => [v, k]));

const PREFIX = [
  "@prefix owl:  <http://www.w3.org/2002/07/owl#> .",
  "@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .",
  "@prefix skos: <http://www.w3.org/2004/02/skos/core#> .",
  "@prefix llm:  <http://example.org/llm-ontology#> .",
  "",
];

/* ⚠️ 역슬래시가 먼저다. 나중에 하면 우리가 넣은 이스케이프까지 다시 이스케이프된다.
   실측: 설명 8건에 LaTeX 수식이 들어 있다 (ALiBi · BPC · GELU · Planning · ReLU · RMSNorm · SwiGLU · TreeSearch) */
const esc3 = (s) => String(s).replace(/\\/g, "\\\\").replace(/"""/g, '\\"\\"\\"');
const esc1 = (s) => String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
const un3  = (s) => s.replace(/\\"\\"\\"/g, '"""').replace(/\\\\/g, "\\");
const un1  = (s) => s.replace(/\\n/g, "\\u000a").replace(/\\"/g, '"').replace(/\\\\/g, "\\").replace(/\u000a/g, "\n");

/** 개념 하나 → TTL 블록 */
function block(cpt, aliases = [], rels = []) {
  const L = [`llm:${cpt.node} a owl:Class ;`];
  L.push(`    rdfs:label "${esc1(cpt.name)}"@en ;`);
  for (const a of [...aliases].sort()) L.push(`    skos:altLabel "${esc1(a)}" ;`);
  for (const r of rels) L.push(`    ${PRED[r.type]} llm:${r.to} ;`);
  if (cpt.origin) L.push(`    llm:origin "${cpt.origin}" ;`);
  if (cpt.description) L.push(`    llm:description """${esc3(cpt.description)}""" .`);
  else L[L.length - 1] = L[L.length - 1].replace(/ ;$/, " .");
  return L.join("\n");
}

/** TTL 전문 → { concepts:Map, aliases:[], rels:[] } */
function parse(text) {
  const concepts = new Map(), aliases = [], rels = [];
  const lines = text.split("\n");
  let cur = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^llm:([A-Za-z][A-Za-z0-9_]*) a owl:Class ;$/);
    if (m) { cur = m[1]; concepts.set(cur, { node: cur, name: null, description: null, origin: null }); continue; }
    if (!cur) continue;
    const t = line.trim();
    if (!t) { cur = null; continue; }
    let x;
    if ((x = t.match(/^rdfs:label "((?:[^"\\]|\\.)*)"@en ;$/))) concepts.get(cur).name = un1(x[1]);
    else if ((x = t.match(/^skos:altLabel "((?:[^"\\]|\\.)*)" ;$/))) aliases.push({ node: cur, text: un1(x[1]) });
    else if ((x = t.match(/^llm:origin "([^"]*)" ;$/))) concepts.get(cur).origin = x[1];
    else if ((x = t.match(/^(rdfs:subClassOf|llm:isPrerequisiteOf|llm:extends|llm:relatedTo|llm:contradicts) llm:([A-Za-z][A-Za-z0-9_]*) ;$/)))
      rels.push({ from: cur, to: x[2], type: PRED2TYPE[x[1]] });
    else if (t.startsWith("llm:description ")) {
      /* ⚠️ trim() 한 t 를 쓰면 안 된다 — 첫 줄 끝 공백 2칸(마크다운 줄바꿈)이 날아가
         개행 있는 설명 23건이 전부 어긋난다. 원본 line 에서 들여쓰기만 벗긴다. */
      let buf = line.replace(/^\s*llm:description /, "");
      while (!/"""\s*\.$/.test(buf) && i + 1 < lines.length) buf += "\n" + lines[++i];
      concepts.get(cur).description = un3(buf.replace(/^"""/, "").replace(/"""\s*\.$/, ""));
      cur = null;
    }
  }
  return { concepts, aliases, rels };
}

/** { concepts, aliases, rels } → TTL 전문 */
function serialize({ concepts, aliases, rels }, header = []) {
  const aliOf = {}; aliases.forEach((a) => (aliOf[a.node] = aliOf[a.node] || []).push(a.text));
  const relOf = {}; rels.forEach((r) => (relOf[r.from] = relOf[r.from] || []).push(r));
  const out = [...header, ...PREFIX];
  for (const node of [...concepts.keys()].sort()) {
    const rs = (relOf[node] || []).slice().sort((a, b) => (a.type + a.to).localeCompare(b.type + b.to));
    out.push(block(concepts.get(node), aliOf[node] || [], rs), "");
  }
  return out.join("\n");
}

module.exports = { PRED, PRED2TYPE, PREFIX, parse, serialize, block, esc1, esc3 };
