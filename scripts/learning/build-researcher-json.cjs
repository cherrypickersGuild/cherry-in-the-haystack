#!/usr/bin/env node
/* 리서처 작업용 JSON 생성 (읽기 전용)
   목적: DB 를 직접 못 만지는 리서처가 "무엇이 비었고 어떤 형식으로 채울지"를 한 파일로 파악
   출력: apps/docs/concept-quality/researcher-package/concepts-to-fill.json
   기획: apps/docs/concept-quality/2-implementation-guide.md */
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "../..");
const { Client } = require(path.join(ROOT, "apps/api/node_modules/pg"));
const OUT = path.join(ROOT, "apps/docs/concept-quality/researcher-package/concepts-to-fill.json");

/* 사이드바 12개 토픽 (apps/web/app/page.tsx CONCEPT_NODE_BY_TOPIC 과 일치) */
const MENU = {
  PromptEngineering: ["BASICS", "Prompt Engineering"],
  RAG: ["BASICS", "RAG"],
  Finetuning: ["BASICS", "Fine-tuning"],
  AgentArchitecture: ["BASICS", "Agents"],
  Embedding: ["BASICS", "Embeddings"],
  EvaluationMetric: ["BASICS", "Evaluation"],
  AdvancedPrompting: ["ADVANCED", "Advanced Prompting"],
  HybridRetrieval: ["ADVANCED", "Multi-hop RAG"],
  ParameterEfficientFinetuning: ["ADVANCED", "PEFT / LoRA / QLoRA"],
  MultiAgentSystem: ["ADVANCED", "Multi-agent Orchestration"],
  RedTeaming: ["ADVANCED", "Adversarial Evaluation"],
};

/* 개념명 → 책 검색어
   ⚠️ 주의: 예전 방식(마지막 낱말만 뽑기)은 `MultiAgentSystem` → "system" 이 되어
   무관한 문단 631개가 걸렸다. 약어(RAG)는 4글자 미만이라 아예 빠졌다.
   → 전체 구(句)와 단수형만 쓰고, 약어는 낱말 경계로 정확히 찾는다. */
/* 발행된 Overview 는 마크다운 한 덩어리로 저장돼 있다. 모든 개념이 같은 모양을 갖도록
   definition / whyItMatters / context 3필드로 되돌린다. */
function splitOverview(md) {
  if (!md) return { definition: "", whyItMatters: "", context: "" };
  const paras = md.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean);
  const strip = (t) => t.replace(/^\*\*[^*]+:\*\*\s*/, "");
  return {
    definition: strip(paras[0] || ""),
    whyItMatters: strip(paras[1] || ""),
    context: strip(paras[2] || ""),
  };
}

const ACRONYM = (l) => /^[A-Z][A-Za-z]{1,5}$/.test(l) && l.replace(/[^A-Z]/g, "").length >= 2;

/** 이름 하나 → 검색 패턴들 */
function patternsFor(label) {
  const raw = String(label).trim();
  if (ACRONYM(raw)) return [{ text: raw, re: `\\m${raw}\\M` }];   // RAG, PAL, PEFT …
  const s = raw.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[\/]/g, " ").toLowerCase().trim();
  const set = new Set([s]);
  if (s.endsWith("s")) set.add(s.slice(0, -1));
  return [...set]
    .map((t) => t.replace(/[^a-z0-9 ]/g, "").trim())
    .filter((t) => t.length >= 4)
    .map((t) => ({ text: raw, re: t.replace(/ /g, "[ -]?") }));
}

/** 개념명 + 하위 개념명으로 검색어를 만든다.
    ⚠️ 개념명만 쓰면 실제보다 훨씬 적게 잡힌다 — 책은 상위 개념어를 잘 안 쓰기 때문.
    실측: "Advanced Prompting" 개념명만 0건 → 하위(ChainOfThought·PAL·ReAct…) 포함 80건. */
const terms = (label, childLabels = []) => {
  const out = [], seen = new Set();
  for (const nm of [label, ...childLabels]) {
    for (const p of patternsFor(nm)) {
      if (seen.has(p.re)) continue;
      seen.add(p.re); out.push(p);
    }
  }
  return out;
};

const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, "apps/api/.env"), "utf8")
  .split("\n").filter((l) => /^[A-Z_]+=/.test(l))
  .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));

(async () => {
  const c = new Client({ host: env.LOCAL_DB_HOST, port: +env.LOCAL_DB_PORT, user: env.LOCAL_DB_USER,
    password: env.LOCAL_DB_PASSWORD, database: env.LOCAL_DB_NAME, ssl: { rejectUnauthorized: false } });
  await c.connect();

  /* 개념 + 발행본 */
  const { rows: concepts } = await c.query(`
    SELECT c.id, c.ontology_node node, c.canonical_name name, c.description ont_desc,
           p.content_md, p.progressive_refs, p.section, p.concept_slug,
           p.concept_name, p.is_published
      FROM handbook.concept c
 LEFT JOIN content.concept_page p ON p.ontology_node = c.ontology_node AND p.surface='learning'
     WHERE c.revoked_at IS NULL AND c.ontology_node IS NOT NULL
  ORDER BY c.canonical_name`);

  /* 하위 개념(자동 · 수정 대상 아님) */
  const { rows: rels } = await c.query(`
    SELECT ct.ontology_node parent, cf.canonical_name child, cf.ontology_node child_node,
           r.relation_type::text rel
      FROM handbook.concept_relation r
      JOIN handbook.concept cf ON cf.id=r.from_concept_id AND cf.revoked_at IS NULL
      JOIN handbook.concept ct ON ct.id=r.to_concept_id AND ct.revoked_at IS NULL
     WHERE r.revoked_at IS NULL`);
  const childrenOf = {};
  rels.forEach((r) => { (childrenOf[r.parent] = childrenOf[r.parent] || []).push(r); });

  /* 기존 체리 */
  const { rows: cher } = await c.query(`
    SELECT c.ontology_node node, b.title book, b.author, ch.title chapter, s.title section,
           l.insight, l.is_primary, l.paragraph_chunk_id
      FROM handbook.paragraph_concept_link l
      JOIN handbook.concept c ON c.id=l.concept_id AND c.revoked_at IS NULL
      JOIN handbook.paragraph_chunk pc ON pc.id=l.paragraph_chunk_id
      JOIN handbook.book b ON b.id=pc.book_id
 LEFT JOIN handbook.chapter ch ON ch.id=pc.chapter_id
 LEFT JOIN handbook.section s ON s.id=pc.section_id
     WHERE l.revoked_at IS NULL`);
  const cherriesOf = {};
  cher.forEach((x) => { (cherriesOf[x.node] = cherriesOf[x.node] || []).push(x); });

  /* 기여자 — 개념 페이지별. 연결 표가 아직 없어 현재는 전부 비어 있다.
     원본 화면(concept-reader-page.tsx)의 역할 3종 + Overview 작성용 Author. */
  const contribOf = {};
  try {
    const { rows } = await c.query(`
      SELECT cp.ontology_node node, k.name, k.expertise_area role
        FROM content.concept_page_contributor pc
        JOIN content.concept_page cp ON cp.id = pc.page_id
        JOIN handbook.knowledge_verification_contributor k ON k.id = pc.contributor_id
       WHERE k.revoked_at IS NULL`);
    rows.forEach((r) => { (contribOf[r.node] = contribOf[r.node] || []).push({ name: r.name, role: r.role }); });
  } catch { /* 연결 표 미생성 — 비어 있는 채로 진행 */ }

  /* 책에 근거 후보가 몇 개인가 (리서처가 제일 궁금한 것) */
  const evidence = {}, searchTerms = {};
  for (const row of concepts) {
    const kidNames = (childrenOf[row.node] || []).map((k) => k.child);
    const t = terms(row.name, kidNames);
    searchTerms[row.node] = [...new Set(t.map((x) => x.text))];
    if (!t.length) { evidence[row.node] = null; continue; }
    const re = `(${t.map((x) => x.re).join("|")})`;
    const { rows } = await c.query(
      `SELECT count(*)::int n FROM handbook.paragraph_chunk
        WHERE body_text ~* $1 AND char_length(body_text) >= 300 AND revoked_at IS NULL`, [re]);
    evidence[row.node] = rows[0].n;
  }
  await c.end();

  /* ── 페이지 구분: 메뉴에서 직접 가는가, 링크를 타야 가는가 ──
     화면에서 개념 X 페이지의 Child Concepts = "X 를 가리키는(→X) 개념들".
     따라서 X 에서 도달 가능한 곳 = X 로 들어오는 간선의 출발점들. */
  const inbound = {};                       // X → [X 를 가리키는 개념들]
  rels.forEach((r) => { (inbound[r.parent] = inbound[r.parent] || []).push(r.child_node); });

  const menuNodes = Object.keys(MENU);
  const depth = {}, via = {};               // 최단 깊이 · 어느 메뉴에서 왔나
  const queue = menuNodes.map((n) => ({ n, d: 0, root: n }));
  menuNodes.forEach((n) => { depth[n] = 0; via[n] = new Set([n]); });
  while (queue.length) {
    const { n, d, root } = queue.shift();
    if (d > 6) continue;                    // 안전장치
    for (const nx of inbound[n] || []) {
      if (depth[nx] === undefined || d + 1 < depth[nx]) {
        depth[nx] = d + 1;
        queue.push({ n: nx, d: d + 1, root });
      }
      (via[nx] = via[nx] || new Set()).add(root);
    }
  }
  /* 이 개념을 카드로 직접 보여주는 페이지들 (= 이 개념이 가리키는 대상) */
  const shownOn = {};
  rels.forEach((r) => { (shownOn[r.child_node] = shownOn[r.child_node] || []).push(r.parent); });

  /* JSON 조립 */
  const EMPTY_CHERRY = () => ({ source: "", locator: "", chunkId: "", insight: "" });
  /* 역할은 원본 화면의 3종 + Author. 다른 값은 쓰지 않는다. */
  const EMPTY_CONTRIBUTORS = () => ([
    { name: "", role: "Author" },            // Overview 를 쓴 사람
    { name: "", role: "Evidence sourcing" }, // Cherries 를 찾은 사람
  ]);
  const EMPTY_REF = (order, stage) => ({
    order, stage, title: "", url: "", inLibrary: true, byline: "", teaches: "", addsOverPrevious: "",
  });

  const items = concepts.map((r) => {
    const menu = MENU[r.node];
    const kids = (childrenOf[r.node] || []).map((k) => ({ label: k.child, relation: k.rel }));
    const myCher = cherriesOf[r.node] || [];
    const refs = r.progressive_refs || [];
    const d = depth[r.node];
    const pageType = menu ? "MENU" : d === undefined ? "UNREACHABLE" : "LINKED";
    const priority = pageType === "MENU" ? "A" : d === 1 ? "B" : pageType === "LINKED" ? "C" : "D";

    /* 채워야 할 것 — 자동 생성되는 childConcepts 는 넣지 않는다 */
    const toFillList = [];
    if (!r.concept_name) toFillList.push("displayTitle");
    const ov = splitOverview(r.content_md);
    if (!ov.definition) toFillList.push("overview.definition");
    if (!ov.whyItMatters) toFillList.push("overview.whyItMatters");
    if (!ov.context) toFillList.push("overview.context");
    if (!myCher.length) toFillList.push("cherries");
    if (!refs.length) toFillList.push("references");
    const myContrib = (contribOf[r.node] || []).filter((x) => x.name);
    if (!myContrib.length) toFillList.push("contributors");

    return {
      /* ── 식별 (수정 금지) ── */
      node: r.node,
      name: r.name,
      priority,                       // A · B · C · D
      toFillCount: toFillList.length, // 아직 채워야 할 필드 수. 0 이면 완료
      toFillList,                     // ← 이 필드들을 채워주세요

      /* ── 이 페이지가 어떻게 보이나 (읽기용) ── */
      menuSection: menu ? menu[0] : null,     // BASICS | ADVANCED | null
      menuLabel: menu ? menu[1] : null,
      pageType,                                // MENU | LINKED | UNREACHABLE
      depthFromMenu: d ?? null,
      reachableFromMenus: [...(via[r.node] || [])]
        .filter((n) => n !== r.node)                       // 자기 자신 제외
        .map((n) => (MENU[n] ? MENU[n][1] : n)).sort(),
      shownAsCardOn: (shownOn[r.node] || []).sort(),

      /* ── 참고 정보 (읽기용 · 자동) ── */
      bookParagraphsAvailable: evidence[r.node],
      /* 위 숫자를 셀 때 쓴 검색어. 책에서 근거를 찾을 때 이 단어들로 찾으세요.
         개념명이 책에 안 나오는 경우가 많아 하위 개념명까지 포함돼 있습니다. */
      bookSearchTerms: searchTerms[r.node] || [],
      ontologyDescription: r.ont_desc,          // 지금 화면에 자동으로 뜨는 설명
      childConcepts: kids,                      // 03 섹션 — 자동 생성. 채울 필요 없음

      /* ── 아래부터 작성 대상. 모든 개념이 같은 모양이다 ── */
      displayTitle: r.concept_name || "",       // 화면 제목. 비었으면 채워주세요
      overview: ov,                             // 3문단
      cherries: myCher.length
        ? myCher.map((x) => ({
            source: x.book,
            locator: [x.chapter, x.section].filter(Boolean).join(" › "),
            chunkId: x.paragraph_chunk_id,      // 원문 문단 id (채워진 것만 있음)
            insight: x.insight,
          }))
        : [EMPTY_CHERRY(), EMPTY_CHERRY(), EMPTY_CHERRY(), EMPTY_CHERRY(), EMPTY_CHERRY()],
      references: refs.length
        ? refs
        : [EMPTY_REF(1, "START HERE"), EMPTY_REF(2, "NEXT →"),
           EMPTY_REF(3, "THEN →"), EMPTY_REF(4, "DEEP DIVE →")],
      contributors: myContrib.length ? myContrib : EMPTY_CONTRIBUTORS(),
    };
  });

  const byPriority = (p) => items.filter((x) => x.priority === p).length;
  const out = {
    _readme: "작업 안내는 같은 폴더의 작업안내.md 를 먼저 읽어주세요.",
    generatedAt: new Date().toISOString().slice(0, 10),
    rules: [
      "node 값은 절대 수정하지 마세요 — DB 연결 식별자입니다.",
      "toFillList 에 적힌 필드를 채워주세요. toFillCount 가 0 이면 이미 완료된 개념입니다.",
      "모든 개념이 같은 필드 구조를 갖습니다. 값이 비어 있으면(\"\") 채울 곳, 값이 있으면 이미 채워진 것입니다.",
      "childConcepts / ontologyDescription / bookParagraphsAvailable 는 자동 생성된 참고 정보입니다. 수정하지 마세요.",
      "근거 없는 내용은 쓰지 마세요. 못 찾으면 빈 채로 두세요.",
      "cherries 는 반드시 source(책·자료명)와 locator(챕터/절)를 함께 적어주세요.",
      "본문 언어는 영어입니다.",
      "bookSearchTerms 는 책에서 근거를 찾을 때 쓸 검색어입니다. 개념명이 책에 안 나오는 경우가 많습니다.",
      "pageType 을 보세요 — MENU=메뉴에서 바로 열리는 페이지(급함) · LINKED=링크를 타고 가는 페이지 · UNREACHABLE=지금은 화면에 안 뜸.",
    ],
    summary: {
      total: items.length,
      byPageType: {
        MENU: items.filter((x) => x.pageType === "MENU").length,
        LINKED: items.filter((x) => x.pageType === "LINKED").length,
        UNREACHABLE: items.filter((x) => x.pageType === "UNREACHABLE").length,
      },
      priorityA: byPriority("A"), priorityB: byPriority("B"),
      priorityC: byPriority("C"), priorityD: byPriority("D"),
      overviewFilled: items.filter((x) => !x.toFillList.some((f) => f.startsWith("overview"))).length,
      cherriesFilled: items.filter((x) => !x.toFillList.includes("cherries")).length,
      referencesFilled: items.filter((x) => !x.toFillList.includes("references")).length,
      contributorsFilled: items.filter((x) => !x.toFillList.includes("contributors")).length,
      done: items.filter((x) => x.toFillCount === 0).length,
      totalFieldsToFill: items.reduce((a, x) => a + x.toFillCount, 0),
    },
    items,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log(`✅ ${OUT}`);
  console.log(`   ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB · 항목 ${items.length}`);
  console.log(`   우선순위 A ${out.summary.priorityA} · B ${out.summary.priorityB} · C ${out.summary.priorityC}`);
  console.log(`   채워진 것 — Overview ${out.summary.overviewFilled} · Cherries ${out.summary.cherriesFilled} · References ${out.summary.referencesFilled}`);
  console.log(`   완료된 개념 ${out.summary.done}개 · 남은 필드 총 ${out.summary.totalFieldsToFill}개`);
})().catch((e) => { console.error("실패:", e.message); process.exit(1); });
