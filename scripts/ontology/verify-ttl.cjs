#!/usr/bin/env node
/* TTL ↔ Postgres 라운드트립 검증 (🔵 읽기 전용)
   기획: apps/docs/advanced/2-implementation-guide.md §2-B 검증 S1~S7

   내보낸 TTL 을 다시 파싱해서 DB 와 글자 단위로 대조한다.
   ⚠️ 특히 역슬래시(LaTeX 수식 8건)가 이스케이프 → 복원 과정에서 살아남는지 본다.
   사용: node scripts/ontology/verify-ttl.cjs [ttl경로] */
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "../..");
const { Client } = require(path.join(ROOT, "apps/api/node_modules/pg"));
const STAMP = "2026-08-25";
const DATA = path.join(ROOT, "python_services/packages/idea_to_graph_ontology/data");
const TTL = process.argv[2] || path.join(DATA, `llm_ontology_v3-${STAMP}.ttl`);
const V2  = path.join(DATA, "llm_ontology_v2-2026-08-19.ttl");
const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, "apps/api/.env"), "utf8").split("\n")
    .filter((l) => /^[A-Z_0-9]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
let fail = 0;
const ok = (b, m) => { console.log(`   ${b ? "✅" : "❌"} ${m}`); if (!b) fail++; };

const PRED2TYPE = { "rdfs:subClassOf": "SUBTOPIC", "llm:isPrerequisiteOf": "PREREQUISITE",
  "llm:extends": "EXTENDS", "llm:relatedTo": "RELATED", "llm:contradicts": "CONTRADICTS" };
/* 이스케이프 복원 — 내보낼 때의 역순: """ 먼저, 역슬래시 나중 */
const unlit3 = (s) => s.replace(/\\"\\"\\"/g, '"""').replace(/\\\\/g, "\\");
const unlit1 = (s) => s.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");

/** 우리가 내보낸 형식만 읽는 파서. 임의 Turtle 을 다루지 않는다. */
function parse(text) {
  const concepts = new Map(), aliases = [], rels = [];
  const re = /^llm:([A-Za-z][A-Za-z0-9_]*) a owl:Class ;$/;
  const lines = text.split("\n");
  let cur = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(re);
    if (m) { cur = m[1]; concepts.set(cur, { node: cur, name: null, description: null, origin: null }); continue; }
    if (!cur) continue;
    let t = line.trim();
    if (!t) { cur = null; continue; }
    let mm;
    if ((mm = t.match(/^rdfs:label "((?:[^"\\]|\\.)*)"@en ;$/))) concepts.get(cur).name = unlit1(mm[1]);
    else if ((mm = t.match(/^skos:altLabel "((?:[^"\\]|\\.)*)" ;$/))) aliases.push({ node: cur, text: unlit1(mm[1]) });
    else if ((mm = t.match(/^llm:origin "([^"]*)" ;$/))) concepts.get(cur).origin = mm[1];
    else if ((mm = t.match(/^(rdfs:subClassOf|llm:isPrerequisiteOf|llm:extends|llm:relatedTo|llm:contradicts) llm:([A-Za-z][A-Za-z0-9_]*) ;$/)))
      rels.push({ from: cur, to: mm[2], type: PRED2TYPE[mm[1]] });
    else if (t.startsWith("llm:description ")) {
      /* 3중따옴표 리터럴 — 여러 줄일 수 있다.
         ⚠️ trim() 한 t 를 쓰면 안 된다. 설명 첫 줄 끝의 공백 2칸(마크다운 줄바꿈)이 날아가
            개행 있는 설명 23건이 전부 어긋난다. 원본 line 에서 앞쪽 들여쓰기만 벗긴다. */
      let buf = line.replace(/^\s*llm:description /, "");
      while (!/"""\s*\.$/.test(buf) && i + 1 < lines.length) buf += "\n" + lines[++i];
      const body = buf.replace(/^"""/, "").replace(/"""\s*\.$/, "");
      concepts.get(cur).description = unlit3(body);
      cur = null;
    }
  }
  return { concepts, aliases, rels };
}

(async () => {
ok(fs.existsSync(TTL), `TTL 존재: ${path.basename(TTL)}`);
ok(fs.existsSync(V2), `⚠️ v2 원본 보존됨: ${path.basename(V2)} (덮어쓰지 않았다)`);
const P = parse(fs.readFileSync(TTL, "utf8"));

const c = new Client({ host: env.LOCAL_DB_HOST, port: +env.LOCAL_DB_PORT, user: env.LOCAL_DB_USER,
  password: env.LOCAL_DB_PASSWORD, database: env.LOCAL_DB_NAME, ssl: { rejectUnauthorized: false } });
await c.connect();
const q = async (s) => (await c.query(s)).rows;

console.log("\n■ S1. 건수");
const dbC = await q(`SELECT ontology_node node, canonical_name name, description, meta_json->>'origin' origin
  FROM handbook.concept WHERE revoked_at IS NULL AND ontology_node IS NOT NULL`);
const dbA = await q(`SELECT c.ontology_node node, a.alias_text text FROM handbook.concept_alias a
  JOIN handbook.concept c ON c.id=a.concept_id AND c.revoked_at IS NULL WHERE a.revoked_at IS NULL`);
const dbR = await q(`SELECT a.ontology_node "from", b.ontology_node "to", r.relation_type::text type
  FROM handbook.concept_relation r
  JOIN handbook.concept a ON a.id=r.from_concept_id AND a.revoked_at IS NULL
  JOIN handbook.concept b ON b.id=r.to_concept_id   AND b.revoked_at IS NULL WHERE r.revoked_at IS NULL`);
ok(P.concepts.size === dbC.length, `개념 TTL ${P.concepts.size} = DB ${dbC.length}`);
ok(P.aliases.length === dbA.length, `별칭 TTL ${P.aliases.length} = DB ${dbA.length}`);
ok(P.rels.length === dbR.length, `관계 TTL ${P.rels.length} = DB ${dbR.length}`);

console.log("\n■ S2. 라운드트립 — 글자 단위 대조");
let mmC = [];
for (const d of dbC) {
  const t = P.concepts.get(d.node);
  if (!t) { mmC.push(`${d.node}: TTL 에 없음`); continue; }
  if (t.name !== d.canonical_name && t.name !== d.name) mmC.push(`${d.node}: 이름`);
  if ((t.description ?? null) !== (d.description ?? null)) mmC.push(`${d.node}: 설명`);
}
ok(mmC.length === 0, `개념 불일치 ${mmC.length}건${mmC.length ? ` (${mmC.slice(0,3).join(" / ")})` : ""}`);
const key = (x) => `${x.from}|${x.to}|${x.type}`;
const setR = new Set(P.rels.map(key)); const missR = dbR.filter((r) => !setR.has(key(r)));
ok(missR.length === 0, `관계 불일치 ${missR.length}건${missR.length ? ` (${missR.slice(0,3).map(key).join(" / ")})` : ""}`);
const setA = new Set(P.aliases.map((a) => `${a.node}|${a.text}`));
const missA = dbA.filter((a) => !setA.has(`${a.node}|${a.text}`));
ok(missA.length === 0, `별칭 불일치 ${missA.length}건${missA.length ? ` (${missA.slice(0,3).map((a)=>a.node+"/"+a.text).join(" / ")})` : ""}`);

console.log("\n■ S7. 역슬래시(LaTeX) 이스케이프 라운드트립");
const bs = dbC.filter((d) => d.description && d.description.includes("\\"));
let bsBad = bs.filter((d) => P.concepts.get(d.node)?.description !== d.description);
ok(bsBad.length === 0, `역슬래시 포함 ${bs.length}건 전부 원본 복원 (${bs.map((x)=>x.node).join(", ")})`);
const rawHasEsc = fs.readFileSync(TTL, "utf8").includes("\\\\(");
ok(rawHasEsc, "TTL 파일 안에서 실제로 \\\\ 로 이스케이프돼 있음");

console.log("\n■ S3. 원본 305개 무변경 (이관 스냅샷과 대조)");
/* v2 TTL 은 GraphDB 덤프라 들여쓰기·순서가 우리 출력과 다르다 — 파서를 하나 더 만들지 않고
   이관 시점에 고정한 스냅샷 JSON 과 대조한다. 스냅샷은 v2 TTL 에서 뽑은 것이므로 같은 것을 본다.
   ⚠️ 이전 판은 v2 를 파싱하려다 0개를 대조하고 "통과"라고 찍었다(헛통과). 그래서 0건이면 실패로 친다. */
const SNAP = JSON.parse(fs.readFileSync(path.join(ROOT, "apps/docs/ontology-migration/ontology-snapshot.json"), "utf8"));
let cmp = 0, diff = [];
for (const sc of SNAP.concepts) {
  const t = P.concepts.get(sc.node);
  if (!t) { diff.push(`${sc.node}: v3 에 없음`); continue; }
  cmp++;
  if (t.name !== sc.label) diff.push(`${sc.node}: 이름 "${t.name}"≠"${sc.label}"`);
  if ((t.description ?? null) !== (sc.description ?? null)) diff.push(`${sc.node}: 설명`);
}
ok(cmp === SNAP.concepts.length, `대조한 개념 ${cmp} = 스냅샷 ${SNAP.concepts.length} (0 이면 헛통과)`);
ok(diff.length === 0, `원본 불일치 ${diff.length}건${diff.length ? ` (${diff.slice(0,3).join(" / ")})` : ""}`);
const snapRel = new Set(SNAP.relations.map((r) => `${r.from}|${r.to}|${r.type}`));
const lost = [...snapRel].filter((k) => !setR.has(k));
ok(lost.length === 1 && lost[0] === "LoRA|Finetuning|SUBTOPIC",
   `원본 관계 중 빠진 것 = 계획된 해제 1건뿐 (${lost.join(", ") || "없음"})`);

console.log("\n■ S4. 해제된 관계가 빠졌나");
ok(!P.rels.some((r) => r.from === "LoRA" && r.to === "Finetuning"), "LoRA→Finetuning 이 v3 에 없음");
ok(P.rels.some((r) => r.from === "LoRA" && r.to === "ParameterEfficientFinetuning"), "LoRA→ParameterEfficientFinetuning 이 v3 에 있음");

console.log("\n■ S6. delta 파일");
const D = parse(fs.readFileSync(path.join(DATA, `llm_ontology_v3-delta-${STAMP}.ttl`), "utf8"));
ok(D.concepts.size === 5, `delta 개념 ${D.concepts.size}건 (기대 5)`);
ok([...D.concepts.values()].every((x) => x.origin === "cherry-authored"), "delta 개념 전부 origin 표기됨");

console.log(`\n${fail === 0 ? "✅ 라운드트립 검증 통과" : `❌ 실패 ${fail}건`}`);
await c.end(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("실패:", e.message); process.exit(1); });
