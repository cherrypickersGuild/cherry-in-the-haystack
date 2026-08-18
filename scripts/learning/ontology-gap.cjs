#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────
   Learning 개념 온톨로지 — 구현 준비도 + 갭 리포트 생성기

   단순 diff 가 아니라 "구현문서" 다. 개념 페이지 1장마다:
     ① 그 페이지 자체를 만들 수 있나
     ② 하위 개념 각각을 GraphDB + handbook 에서 전수 조사해
        "그 하위 개념으로 화면을 만들 수 있나 / 뭐가 모자라나"
     ③ 그래서 무엇을 보완해야 하나 (갭)
     ④ 무엇을 하면 화면이 되나 (작업 목록)

   정본 A = apps/web/public/learning/concepts/<slug>.json   (화면 정본)
   정본 B = 라이브 GraphDB (llm-ontology)                    (온톨로지 현실)
   정본 C = Supabase handbook.paragraph_chunk               (Cherries 재료)  ※ 읽기 전용
   출력   = apps/docs/learning/ontology-gap/index.html       [생성물]
   판정   = apps/docs/learning/ontology-gap/decisions.json   [사람이 남김 · 보존]

   사용: node scripts/learning/ontology-gap.cjs [slug ...]
        SKIP_EVIDENCE=1 이면 handbook 조회 생략
───────────────────────────────────────────────────────────── */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "../..");
const CONCEPT_DIR = path.join(ROOT, "apps/web/public/learning/concepts");
const OUT_DIR = path.join(ROOT, "apps/docs/learning/ontology-gap");
const OUT_HTML = path.join(OUT_DIR, "index.html");
const DECISIONS = path.join(OUT_DIR, "decisions.json");
const ENDPOINT = process.env.GRAPHDB_URL || "http://localhost:7200";
const REPO = process.env.GRAPHDB_REPO || "llm-ontology";
const MIN_EVIDENCE_FOR_FULL = 3;

/* ══════════ GraphDB ══════════ */
function sparql(query) {
  const tmp = path.join(os.tmpdir(), `gap-${process.pid}.rq`);
  fs.writeFileSync(tmp, query);
  try {
    const out = execFileSync("curl", ["-s", "-G",
      "--data-urlencode", `query@${tmp}`, "--data-urlencode", "infer=false",
      "-H", "Accept: application/sparql-results+json",
      `${ENDPOINT}/repositories/${REPO}`], { maxBuffer: 1 << 28 }).toString();
    return JSON.parse(out).results.bindings;
  } catch (e) {
    throw new Error(`GraphDB 질의 실패 (${ENDPOINT}/repositories/${REPO}). ` +
      `로컬 기동: docker compose up -d graphdb (조사문서 §7-7). 원인: ${e.message}`);
  } finally { try { fs.unlinkSync(tmp); } catch {} }
}

function loadGraph() {
  const P = `PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX llm: <http://example.org/llm-ontology#>`;
  const nodes = sparql(`${P}
SELECT ?s ?l ?d WHERE { ?s a owl:Class ; rdfs:label ?l . OPTIONAL { ?s llm:description ?d } }`)
    .map(b => ({ id: b.s.value.split("#").pop(), label: b.l.value, desc: b.d?.value ?? null }));
  const edges = sparql(`${P}
SELECT ?c ?p WHERE { ?ch rdfs:subClassOf ?pa . ?ch rdfs:label ?c . ?pa rdfs:label ?p }`)
    .map(b => ({ child: b.c.value, parent: b.p.value }));

  const byLabel = new Map();
  nodes.forEach(n => { if (!byLabel.has(n.label.toLowerCase())) byLabel.set(n.label.toLowerCase(), n); });
  const childrenOf = (label) => edges.filter(e => e.parent.toLowerCase() === label.toLowerCase()).map(e => e.child);
  const parentsOf = (label) => edges.filter(e => e.child.toLowerCase() === label.toLowerCase()).map(e => e.parent);

  const perId = {};
  nodes.forEach(n => { (perId[n.id] = perId[n.id] || []).push(n.label); });
  const dupLabels = Object.entries(perId).filter(([, l]) => l.length > 1).map(([id, l]) => ({ id, labels: l }));
  const withDesc = nodes.filter(n => n.desc);
  return {
    nodes, edges, byLabel, childrenOf, parentsOf, dupLabels,
    koCount: withDesc.filter(n => /[가-힣]/.test(n.desc)).length,
    descCount: withDesc.length,
    classCount: new Set(nodes.map(n => n.id)).size,
  };
}

/* ══════════ handbook (evidence 재료 · 읽기 전용) ══════════ */
function loadPg() {
  if (process.env.SKIP_EVIDENCE) return null;
  try {
    const { Client } = require(path.join(ROOT, "apps/api/node_modules/pg"));
    const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, "apps/api/.env"), "utf8")
      .split("\n").filter(l => /^[A-Z_]+=/.test(l))
      .map(l => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
    return new Client({ host: env.LOCAL_DB_HOST, port: +env.LOCAL_DB_PORT, user: env.LOCAL_DB_USER,
      password: env.LOCAL_DB_PASSWORD, database: env.LOCAL_DB_NAME, ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000 });
  } catch { return null; }
}

/* 라벨 → 검색어(정규식). camelCase 분해 + 화면 라벨 병용 */
function searchTerms(screenLabel, ontLabel) {
  const split = (s) => String(s || "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[\/]/g, " ").trim();
  const cand = new Set();
  for (const raw of [screenLabel, ontLabel]) {
    const s = split(raw).toLowerCase();
    if (!s) continue;
    cand.add(s);
    cand.add(s.replace(/s$/, ""));              // 복수 → 단수
    if (s.includes(" ")) cand.add(s.split(" ").slice(-1)[0]); // 마지막 낱말
  }
  return [...cand].filter(t => t.length >= 4)
    .map(t => t.replace(/[^a-z0-9 ]/g, "").trim()).filter(Boolean);
}

async function evidenceCount(pg, terms) {
  if (!pg || !terms.length) return null;
  const re = `(${terms.map(t => t.replace(/ /g, "[ -]?")).join("|")})`;
  const r = await pg.query(
    `SELECT count(*)::int n FROM handbook.paragraph_chunk
     WHERE body_text ~* $1 AND char_length(body_text) >= 300`, [re]);
  return r.rows[0].n;
}

/* ══════════ 하위 개념 1개 조사 ══════════ */
async function probeChild(c, parentLabel, G, pg) {
  const node = (c.ontologyNode && G.byLabel.get(c.ontologyNode.toLowerCase()))
            || G.byLabel.get(String(c.label).toLowerCase()) || null;
  const terms = searchTerms(c.label, c.ontologyNode);
  const ev = await evidenceCount(pg, terms);

  const out = {
    label: c.label, relation: c.relation, declaredStatus: c.pageStatus,
    node: node ? node.label : null,
    descLen: node?.desc ? node.desc.length : 0,
    descLang: node?.desc ? (/[가-힣]/.test(node.desc) ? "KO" : "EN") : null,
    ownChildren: node ? G.childrenOf(node.label).length : 0,
    parents: node ? G.parentsOf(node.label) : [],
    linkedToParent: false,
    evidence: ev,
    missing: [],
    verdict: "",
  };

  if (node && parentLabel) {
    out.linkedToParent = G.edges.some(e =>
      (e.child.toLowerCase() === node.label.toLowerCase() && e.parent.toLowerCase() === parentLabel.toLowerCase()) ||
      (e.parent.toLowerCase() === node.label.toLowerCase() && e.child.toLowerCase() === parentLabel.toLowerCase()));
  }

  /* 판정 — 이 하위 개념으로 화면을 만들 수 있나 */
  if (!node) {
    out.verdict = "불가";
    out.missing.push("온톨로지 노드 신설");
    if (ev !== null && ev > 0) out.missing.push(`(단, 책에 ${ev}개 문단 있음 — 근거는 확보 가능)`);
  } else if (!node.desc) {
    out.verdict = "빈 페이지";
    out.missing.push("llm:description 보강 (01 Overview 가 빈 채로 뜸)");
  } else {
    out.verdict = "OUTLINE 가능";
    if (out.ownChildren === 0) out.missing.push("자기 하위 개념 0 → 03 Child Concepts 빈 섹션");
    if (!out.linkedToParent) out.missing.push(`상위(${parentLabel})와 관계 없음 → 트리플 추가`);
    if (ev !== null && ev >= MIN_EVIDENCE_FOR_FULL) out.verdict = "FULL 후보";
    else if (ev !== null) out.missing.push(`evidence 문단 ${ev}개 (FULL 기준 ${MIN_EVIDENCE_FOR_FULL}개 미만)`);
  }
  if (out.descLang === "KO") out.missing.push("설명이 한글 — 영문 사이트 노출 정책 확인");
  return out;
}

/* ══════════ 개념 페이지 1장 조사 ══════════ */
async function analyze(doc, G, pg) {
  const selfNode = doc.ontology?.node ? G.byLabel.get(doc.ontology.node.toLowerCase()) : null;
  const children = [];
  for (const c of doc.childConcepts || []) children.push(await probeChild(c, selfNode?.label, G, pg));

  const gaps = [];
  const add = (type, subject, fact, proposal) => gaps.push({ type, subject, fact, proposal });

  if (!selfNode) {
    add("MISSING_NODE", doc.title, `개념 노드 <code>${doc.ontology?.node ?? "(미지정)"}</code> 없음`,
      `신설 — 상위 후보 ${(doc.ontology?.parents || []).join(", ") || "미정"}`);
  } else if (G.parentsOf(selfNode.label).length === 0) {
    add("HIERARCHY_MISMATCH", selfNode.label, "상위 개념 없음(루트 직속)", "학습 위계상 상위 지정 검토");
  }

  for (const ch of children) {
    if (!ch.node) {
      add("MISSING_NODE", ch.label, "온톨로지에 <b>없음</b>",
        `<code>${selfNode?.label ?? doc.slug}</code> 의 하위로 신설` +
        (ch.evidence ? ` · 책 문단 ${ch.evidence}개 확보됨` : ""));
      continue;
    }
    if (ch.node.toLowerCase() !== ch.label.toLowerCase())
      add("LABEL_ALIAS", ch.label, `온톨로지 라벨 <code>${ch.node}</code>`, `별칭 <code>${ch.label}</code> 추가`);
    if (!ch.linkedToParent && selfNode)
      add("MISSING_RELATION", `${selfNode.label} ↔ ${ch.node}`, "두 노드는 있으나 <b>연결 없음</b>",
        `<code>${ch.relation}</code> 관계 추가`);
    if (!ch.descLen)
      add("WEAK_DESCRIPTION", ch.node, "<code>llm:description</code> 없음", "설명 보강 — 없으면 OUTLINE 페이지가 빔");
    if (ch.relation && ch.relation !== "SUBTOPIC")
      add("RELATION_TYPE_GAP", `${ch.label} (${ch.relation})`,
        `<code>rdfs:subClassOf</code> 뿐 — <code>${ch.relation}</code> 표현 불가`,
        `Phase 5 에서 <code>llm:${ch.relation.toLowerCase()}</code> 추가`);
  }
  return { doc, selfNode, children, gaps };
}

/* ══════════ main ══════════ */
(async () => {
  const only = process.argv.slice(2);
  const files = fs.readdirSync(CONCEPT_DIR).filter(f => f.endsWith(".json"))
    .filter(f => !only.length || only.includes(path.basename(f, ".json")));
  if (!files.length) { console.error("대상 개념 JSON 없음"); process.exit(1); }

  const G = loadGraph();
  const pg = loadPg();
  if (pg) { try { await pg.connect(); } catch { console.warn("⚠️ handbook 접속 실패 — evidence 열 생략"); } }

  const reports = [];
  for (const f of files) {
    const doc = JSON.parse(fs.readFileSync(path.join(CONCEPT_DIR, f), "utf8"));
    reports.push(await analyze(doc, G, pg));
  }
  if (pg) { try { await pg.end(); } catch {} }

  const decisions = fs.existsSync(DECISIONS) ? JSON.parse(fs.readFileSync(DECISIONS, "utf8")) : {};
  const referenced = new Set();
  reports.forEach(r => {
    if (r.doc.ontology?.node) referenced.add(r.doc.ontology.node.toLowerCase());
    (r.doc.childConcepts || []).forEach(c => c.ontologyNode && referenced.add(c.ontologyNode.toLowerCase()));
  });
  const missingCounts = {};
  reports.forEach(r => r.gaps.filter(g => g.type === "MISSING_NODE")
    .forEach(g => { missingCounts[g.subject] = (missingCounts[g.subject] || 0) + 1; }));

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_HTML, render(reports, G, decisions, referenced, missingCounts, !!pg));

  const totalGaps = reports.reduce((s, r) => s + r.gaps.length, 0);
  const kids = reports.flatMap(r => r.children);
  const tally = kids.reduce((m, c) => (m[c.verdict] = (m[c.verdict] || 0) + 1, m), {});
  console.log(`✅ ${OUT_HTML}`);
  console.log(`   개념 ${reports.length}장 · 하위개념 ${kids.length}개 · 갭 ${totalGaps}건 · 커버리지 ${referenced.size}/${G.classCount}`);
  console.log(`   하위개념 판정: ${Object.entries(tally).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
  const rep = Object.entries(missingCounts).filter(([, n]) => n > 1);
  if (rep.length) console.log(`   ⚠️ 중복 도출(우선순위↑): ${rep.map(([k, n]) => `${k}×${n}`).join(", ")}`);
})().catch(e => { console.error("실패:", e.message); process.exit(1); });

/* ══════════ HTML ══════════ */
const TYPE_CLASS = { MISSING_NODE: "miss", LABEL_ALIAS: "alias", MISSING_RELATION: "rel",
  RELATION_TYPE_GAP: "gaptype", HIERARCHY_MISMATCH: "gaptype", WEAK_DESCRIPTION: "warn", DATA_QUALITY: "warn" };
const VERDICT_CLASS = { "FULL 후보": "ok", "OUTLINE 가능": "rel", "빈 페이지": "warn", "불가": "miss" };
const esc = (s) => String(s ?? "");

function render(reports, G, decisions, referenced, missingCounts, hasEv) {
  const counts = {};
  reports.forEach(r => r.gaps.forEach(g => { counts[g.type] = (counts[g.type] || 0) + 1; }));
  const totalGaps = Object.values(counts).reduce((a, b) => a + b, 0);
  const kids = reports.flatMap(r => r.children);
  const tally = kids.reduce((m, c) => (m[c.verdict] = (m[c.verdict] || 0) + 1, m), {});

  const cards = reports.map(r => {
    const childRows = r.children.map(c => `<tr>
      <td><b>${esc(c.label)}</b><br><span class="note-s">${esc(c.relation)}</span></td>
      <td>${c.node ? `<code>${esc(c.node)}</code>` : `<span class="tag miss">없음</span>`}</td>
      <td>${c.descLen ? `${c.descLen}자 <span class="tag ${c.descLang === "KO" ? "alias" : "ok"}">${c.descLang}</span>` : `<span class="tag warn">없음</span>`}</td>
      <td style="text-align:center">${c.node ? c.ownChildren : "—"}</td>
      <td style="text-align:center">${hasEv ? (c.evidence ?? "—") : "<span class='note-s'>생략</span>"}</td>
      <td><span class="tag ${VERDICT_CLASS[c.verdict] || "warn"}">${esc(c.verdict)}</span></td>
      <td>${c.missing.length ? c.missing.map(m => `· ${esc(m)}`).join("<br>") : "<span class='note-s'>없음</span>"}</td>
    </tr>`).join("\n");

    const gapRows = r.gaps.map(g => {
      const key = `${r.doc.slug}::${g.type}::${g.subject}`;
      const d = decisions[key];
      const verdict = d
        ? `<span class="tag ${d.status === "승인" ? "ok" : d.status === "반려" ? "miss" : "warn"}">${esc(d.status)}</span>${d.note ? `<br><span class="note-s">${esc(d.note)}</span>` : ""}`
        : `<span class="tag pend">미검토</span>`;
      return `<tr><td>${esc(g.subject)}</td><td><span class="tag ${TYPE_CLASS[g.type] || "warn"}">${g.type}</span></td>
        <td>${g.fact}</td><td>${g.proposal}</td><td>${verdict}</td></tr>`;
    }).join("\n");

    /* 작업 목록 — 조사 결과에서 파생 */
    const todo = [];
    r.children.filter(c => c.verdict === "불가").forEach(c =>
      todo.push(`<b>${esc(c.label)}</b> 온톨로지 신설 — 안 하면 이 카드는 계속 <code>SOON</code>(클릭 불가)`));
    r.children.filter(c => c.verdict === "빈 페이지").forEach(c =>
      todo.push(`<b>${esc(c.label)}</b> 설명 보강 — 지금 열면 Overview 가 빔`));
    const outlineReady = r.children.filter(c => c.verdict === "OUTLINE 가능" || c.verdict === "FULL 후보");
    if (outlineReady.length) todo.push(`OUTLINE JSON 생성 <b>${outlineReady.length}개</b> — 데이터는 이미 있음, 생성만 하면 링크가 열림: ${outlineReady.map(c => esc(c.label)).join(", ")}`);
    const fullCand = r.children.filter(c => c.verdict === "FULL 후보");
    if (fullCand.length) todo.push(`FULL 승격 후보 <b>${fullCand.length}개</b>(evidence ${MIN_EVIDENCE_FOR_FULL}개 이상): ${fullCand.map(c => `${esc(c.label)}(${c.evidence})`).join(", ")}`);
    const norel = r.children.filter(c => c.node && !c.linkedToParent);
    if (norel.length) todo.push(`상위-하위 관계 트리플 추가 <b>${norel.length}건</b>: ${norel.map(c => esc(c.node)).join(", ")}`);

    const repeat = r.gaps.filter(g => g.type === "MISSING_NODE" && missingCounts[g.subject] > 1)
      .map(g => `${g.subject}×${missingCounts[g.subject]}`);

    return `<section class="card">
  <h2>${esc(r.doc.title)} <span class="slug">${esc(r.doc.slug)}</span>
      <span class="cnt">하위 ${r.children.length} · 갭 ${r.gaps.length}</span></h2>
  <p class="meta">ontology <code>${esc(r.selfNode?.label ?? "없음")}</code> ·
     상위 ${r.selfNode ? (G.parentsOf(r.selfNode.label).join(", ") || "루트 직속") : "—"} ·
     cherries ${r.doc.cherries?.length ?? 0}
     ${repeat.length ? `· <b class="hot">중복 도출: ${repeat.join(", ")}</b>` : ""}</p>

  <h3>① 하위 개념 구현 준비도 <span class="note-s">— 이 개념으로 화면을 만들 수 있나</span></h3>
  <div class="scroll"><table>
    <tr><th>하위 개념</th><th>온톨로지 노드</th><th>설명</th><th>자기<br>하위</th><th>책<br>문단</th><th>판정</th><th>부족한 것</th></tr>
    ${childRows || `<tr><td colspan="7">하위 개념 없음</td></tr>`}
  </table></div>

  <h3>② 보완해야 할 갭</h3>
  <div class="scroll"><table>
    <tr><th>대상</th><th>유형</th><th>사실 (기계 판정)</th><th>제안 (미확정)</th><th>판정</th></tr>
    ${gapRows || `<tr><td colspan="5">갭 없음</td></tr>`}
  </table></div>

  <h3>③ 이 페이지를 완성하려면</h3>
  <ol class="todo">${todo.map(t => `<li>${t}</li>`).join("") || "<li>추가 작업 없음</li>"}</ol>
</section>`;
  }).join("\n");

  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Learning 개념 구현 준비도 &amp; 갭 리포트</title>
<!-- 생성물: 직접 수정 금지 (scripts/learning/ontology-gap.cjs) -->
<style>
:root{--card:#fff;--secondary:#F2F0F7;--border:#E4E1EE;--cherry:#C94B6E;--cherry-soft:#FDF0F3;--cherry-border:#F2C4CE;
--violet:#7B5EA7;--violet-soft:#F3EFFA;--violet-border:#C7B8E8;--tp:#1A1626;--ts:#6B6480;--tm:#9E97B3;--green:#2D7A5E}
*{box-sizing:border-box;margin:0;padding:0}
body{background:#FAF9FC;color:#3D3652;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans KR",sans-serif;line-height:1.5;padding:24px 16px 60px}
.wrap{max-width:1240px;margin:0 auto}
h1{font-size:22px;color:var(--tp);margin-bottom:4px}
.sub{font-size:12px;color:var(--ts);margin-bottom:18px}
.banner{background:#FFF8E6;border:1px solid #F0D9A0;border-radius:10px;padding:12px 14px;font-size:12px;color:#7A5A16;margin-bottom:20px}
.sum{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:24px}
.kpi{background:#fff;border:1px solid var(--border);border-radius:10px;padding:12px 14px}
.kpi .n{font-size:22px;font-weight:800;color:var(--tp)}
.kpi .l{font-size:11px;color:var(--tm);margin-top:2px}
.card{background:var(--violet-soft);border:1px solid var(--violet-border);border-radius:12px;padding:18px;margin-bottom:18px}
.card h2{font-size:15px;color:var(--tp);display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.card h3{font-size:12px;color:var(--violet);margin:16px 0 6px;text-transform:uppercase;letter-spacing:.4px}
.slug{font-size:10px;font-weight:700;background:var(--secondary);color:var(--ts);padding:2px 6px;border-radius:5px}
.cnt{font-size:11px;color:var(--violet);font-weight:700}
.meta{font-size:11px;color:var(--ts);margin-top:4px}
.hot{color:var(--cherry)}
table{width:100%;border-collapse:collapse;font-size:12px;background:#fff;border-radius:8px;overflow:hidden}
th{background:#EDE8F5;color:var(--tp);text-align:left;padding:7px 9px;font-size:11px;white-space:nowrap}
td{padding:7px 9px;border-top:1px solid var(--border);color:var(--ts);vertical-align:top}
td code,.meta code{background:var(--secondary);padding:1px 5px;border-radius:4px;color:var(--tp);font-size:11px}
.scroll{overflow-x:auto}
.tag{display:inline-block;padding:2px 7px;border-radius:999px;font-size:10px;font-weight:700;white-space:nowrap}
.tag.miss{background:var(--cherry-soft);color:var(--cherry);border:1px solid var(--cherry-border)}
.tag.alias{background:#FFF4E5;color:#B26B22;border:1px solid #F0D0A6}
.tag.rel{background:#E8F0FB;color:#2C5FA8;border:1px solid #BDD3F0}
.tag.gaptype{background:#EDE8F5;color:var(--violet);border:1px solid var(--violet-border)}
.tag.warn{background:#F7F5FA;color:var(--ts);border:1px solid var(--border)}
.tag.ok{background:#E6F4EC;color:var(--green);border:1px solid #B8DFC9}
.tag.pend{background:#fff;color:var(--tm);border:1px dashed var(--border)}
.note-s{font-size:10px;color:var(--tm);font-weight:400}
.todo{margin:0;padding-left:20px;font-size:12px;color:var(--ts);background:#fff;border:1px solid var(--border);border-radius:8px;padding:12px 12px 12px 30px}
.todo li{margin-bottom:5px}
</style></head><body><div class="wrap">
<h1>Learning 개념 — 구현 준비도 &amp; 갭 리포트</h1>
<p class="sub">개념 JSON(화면 정본) ↔ 라이브 GraphDB ↔ handbook 원문 3자 대조. 하위 개념 <b>전수 조사</b>.</p>

<div class="banner">
  <b>이 파일은 <code>scripts/learning/ontology-gap.cjs</code> 가 생성합니다. 직접 수정하지 마세요.</b><br>
  · <b>①표</b> = 각 하위 개념으로 <b>화면을 만들 수 있는지</b> · <b>②표</b> = 보완할 갭 · <b>③</b> = 그래서 무엇을 할지<br>
  · 판정은 <code>decisions.json</code> 에 남기면 재생성해도 보존됩니다. <b>승인된 제안만</b> Phase 4 역주입 입력.
  · <b>책 문단</b> = <code>handbook.paragraph_chunk</code>(300자 이상) 매칭 수 = Cherries 재료. ${MIN_EVIDENCE_FOR_FULL}개 이상이면 FULL 후보.
</div>

<div class="sum">
  <div class="kpi"><div class="n">${reports.length}</div><div class="l">개념 페이지</div></div>
  <div class="kpi"><div class="n">${kids.length}</div><div class="l">하위 개념(조사 대상)</div></div>
  <div class="kpi"><div class="n">${tally["FULL 후보"] || 0}</div><div class="l">FULL 후보</div></div>
  <div class="kpi"><div class="n">${tally["OUTLINE 가능"] || 0}</div><div class="l">OUTLINE 가능</div></div>
  <div class="kpi"><div class="n">${(tally["불가"] || 0) + (tally["빈 페이지"] || 0)}</div><div class="l">보완 없이는 불가</div></div>
  <div class="kpi"><div class="n">${totalGaps}</div><div class="l">갭 총계</div></div>
  <div class="kpi"><div class="n">${referenced.size}/${G.classCount}</div><div class="l">COVERAGE</div></div>
</div>

${cards}

<section class="card">
  <h2>온톨로지 전역 품질 <span class="cnt">DATA_QUALITY</span></h2>
  <p class="meta">개념 JSON 과 무관하게 그래프 자체에서 관측된 항목</p>
  <div class="scroll"><table>
    <tr><th>대상</th><th>사실</th><th>제안 (미확정)</th></tr>
    <tr><td>설명 언어</td>
        <td>설명 ${G.descCount}개 중 <b>${G.koCount}개(${Math.round(G.koCount / G.descCount * 100)}%)가 한글 포함</b></td>
        <td>영문 사이트 정책 결정 — 그대로 노출 / 영문 병기 / 번역</td></tr>
    <tr><td>중복 라벨</td>
        <td>${G.dupLabels.length ? G.dupLabels.map(d => `<code>${esc(d.id)}</code>(${d.labels.length})`).join(", ") : "없음"}</td>
        <td>클래스당 라벨 1개로 정리</td></tr>
  </table></div>
</section>

</div></body></html>`;
}
