#!/usr/bin/env node
/* 리서처 JSON 계약 검증 (읽기 전용 · DB 불필요)
   목적: 형식이 어긋난 채로 넘어와 "조용히 누락"되는 것을 막는다. 어기면 종료코드 1.
   기획: apps/docs/concept-quality/1-work-guidelines.md §4 (Q1~Q6)

   사용:
     node scripts/learning/validate-researcher-json.cjs [파일]
     node scripts/learning/validate-researcher-json.cjs [파일] --baseline <기준본>
     node scripts/learning/validate-researcher-json.cjs [파일] --cross <다른파일>
     node scripts/learning/validate-researcher-json.cjs --compare <a.json> <b.json>

   두 종류의 파일을 같은 규칙으로 검사한다.
     · main         concepts-to-fill.json          — 항목마다 node(온톨로지 노드명)가 있다
     · supplemental concepts-to-fill-supplemental.json — node === null (identity 미결)
   항목별로 node 유무를 보고 규칙을 나눈다.

   ⚠️ 규칙은 "현재 계약으로 근거가 확인되는 것"만 강제한다. 각 규칙에 근거를 적어 둔다. */
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "../..");
const PKG = path.join(ROOT, "apps/docs/concept-quality/researcher-package");
const DEFAULT_IN = path.join(PKG, "concepts-to-fill.json");

/* 생성 시각은 의도적으로 매번 달라진다 — 재현성 비교에서만 제외한다(생성기는 바꾸지 않는다). */
const VOLATILE = ["generatedAt"];

/* 리서처가 고치면 안 되는 자동 생성 메타.
   근거: concepts-to-fill.json rules[0]·rules[3] · 작업안내.md §5-A "수정 금지" 표.
   ⚠️ toFillCount·toFillList 는 내용이 채워지면 당연히 변하므로 여기 넣지 않는다. */
const FROZEN = ["node", "name", "priority", "menuSection", "menuLabel", "pageType",
  "depthFromMenu", "reachableFromMenus", "shownAsCardOn",
  "bookParagraphsAvailable", "bookSearchTerms", "ontologyDescription", "childConcepts"];

/* 근거: scripts/learning/build-researcher-json.cjs EMPTY_REF · 작업안내.md §5-A */
const STAGES = ["START HERE", "NEXT →", "THEN →", "DEEP DIVE →"];
/* 근거: 작업안내.md §5-A "허용되는 source 값" 표 — 문서 근거만 있고 코드에 열거가 없어 경고로만 쓴다 */
const SOURCES = ["Building Applications with AI Agents", "AI Engineering",
  "LLM Engineers Handbook", "Reflexion"];
/* 근거: docs/architecture/concept-page-contributor-2026-08-19.sql 의 ck_cpc_role CHECK 제약 */
const ROLES = ["Author", "Evidence sourcing", "Lead reviewer", "Concept mapping"];
/* supplemental 전용 */
const ONTOLOGY_STATUS = ["ABSENT", "APPROXIMATE_ONLY"];

const errs = [], warns = [];
const err = (rule, where, msg) => errs.push({ rule, where, msg });
const warn = (rule, where, msg) => warns.push({ rule, where, msg });
const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const stripVolatile = (o) => { const c = { ...o }; VOLATILE.forEach((k) => delete c[k]); return c; };
const text = (v) => String(v == null ? "" : v).trim();

/* ── 재현성 비교: 의도적 volatile 필드만 제외하고 나머지를 대조 ── */
function compare(a, b) {
  const A = JSON.stringify(stripVolatile(read(a)), null, 2);
  const B = JSON.stringify(stripVolatile(read(b)), null, 2);
  if (A === B) { console.log(`✅ 재현성 OK — ${VOLATILE.join("·")} 제외 시 동일`); return 0; }
  console.error(`❌ 재현성 실패 — ${VOLATILE.join("·")} 를 제외해도 산출물이 다릅니다.`);
  const la = A.split("\n"), lb = B.split("\n");
  let shown = 0;
  for (let i = 0; i < Math.max(la.length, lb.length) && shown < 10; i++) {
    if (la[i] !== lb[i]) { console.error(`   L${i + 1}\n     a: ${la[i]}\n     b: ${lb[i]}`); shown++; }
  }
  return 1;
}

/* ── UI 토픽 정의는 코드에서 읽는다 (매핑 사본을 또 만들지 않는다) ── */
function uiTopics() {
  try {
    const src = fs.readFileSync(path.join(ROOT, "apps/web/app/page.tsx"), "utf8");
    const block = src.match(/const CONCEPT_NODE_BY_TOPIC[^{]*\{([\s\S]*?)\n\}/);
    if (!block) return null;
    const found = [...block[1].matchAll(/"([\w-]+)":\s*\{\s*node:\s*"(\w+)"/g)]
      .map((m) => ({ topic: m[1], node: m[2] }));
    return found.length ? found : null;
  } catch { return null; }
}

/* ── 항목 하나 검사 ── */
function checkItem(it, opts) {
  const supplemental = it.node === null || it.node === undefined;
  const at = supplemental ? (it.provisionalId || it.uiTopicId || "(supplemental 식별자 없음)") : it.node;

  /* V-STRUCT — 모든 항목이 같은 authoring 필드 모양을 갖는다. 근거: rules[2] */
  for (const k of ["overview", "cherries", "references", "contributors"]) {
    if (it[k] === undefined) err("V-STRUCT", at, `필드 누락: ${k}`);
  }

  if (supplemental) {
    /* ── S: supplemental identity 규칙 (결정 G5) ── */
    if (!text(it.provisionalId)) err("S1", at, "node 가 null 이면 provisionalId 가 필수");
    if (!text(it.uiTopicId)) err("S1", at, "node 가 null 이면 uiTopicId 가 필수");
    if (!ONTOLOGY_STATUS.includes(it.ontologyStatus))
      err("S1", at, `ontologyStatus 는 ${ONTOLOGY_STATUS.join(" | ")} 중 하나여야 함: ${JSON.stringify(it.ontologyStatus)}`);
    /* S4·S5 — 근사 노드에서 복사·발명 금지 */
    if (it.ontologyDescription !== null)
      err("S4", at, `ontologyDescription 은 null 이어야 함 (근사 노드에서 복사 금지): ${JSON.stringify(it.ontologyDescription)}`);
    if (!Array.isArray(it.childConcepts) || it.childConcepts.length)
      err("S5", at, "childConcepts 는 빈 배열이어야 함 (온톨로지 관계를 지어내지 않는다)");
    /* S7 — 실측하지 않은 개수는 null 유지. 측정 여부는 검사할 수 없어 경고로만 */
    if (it.bookParagraphsAvailable !== null && it.bookParagraphsAvailable !== undefined)
      warn("S7", at, `bookParagraphsAvailable 이 null 이 아님 (${it.bookParagraphsAvailable}) — ` +
        "handbook.paragraph_chunk 실측값인지 확인하세요. PDF/웹에서 센 수를 넣으면 main JSON 과 의미가 달라집니다.");
    /* S3 — uiTopicId 가 실제 UI 에 있는가 */
    if (opts.ui && text(it.uiTopicId) && !opts.ui.some((t) => t.topic === it.uiTopicId))
      err("S3", at, `uiTopicId '${it.uiTopicId}' 가 page.tsx 의 CONCEPT_NODE_BY_TOPIC 에 없음`);
  } else {
    /* main 전용 */
    if (opts.baseline && opts.baseline.has(it.node)) {
      const b = opts.baseline.get(it.node);
      for (const k of FROZEN) {
        if (JSON.stringify(it[k]) !== JSON.stringify(b[k]))
          err("V8", at, `읽기 전용 메타가 변경됨: ${k}`);
      }
    }
    /* V6 근거: 작업안내 §9 · rules[4] "근거 없는 내용은 쓰지 마세요"
       ⚠️ null(미측정)은 0(근거 없음)과 다르다 — null 이면 적용하지 않는다. */
    const filledCount = (it.cherries || []).filter((c) => c && text(c.insight)).length;
    if (it.bookParagraphsAvailable === 0 && filledCount)
      err("V6", at, `bookParagraphsAvailable=0 인데 체리 ${filledCount}건이 채워져 있음 (근거 없는 내용 의심)`);
  }

  /* ── references (공통) ── */
  (Array.isArray(it.references) ? it.references : []).forEach((r, i) => {
    const w = `${at}.references[${i}]`;
    if (!STAGES.includes(r.stage))
      err("V1", w, `stage 가 허용 4종이 아님: ${JSON.stringify(r.stage)}`);
    if (!(r.url === null || (typeof r.url === "string" && /^https?:\/\//.test(r.url))))
      err("V2", w, `url 은 null 또는 http(s) URL 이어야 함: ${JSON.stringify(r.url)}`);
    if (typeof r.inLibrary !== "boolean")
      err("V3", w, `inLibrary 는 불리언이어야 함: ${JSON.stringify(r.inLibrary)}`);
    if (!Number.isInteger(r.order) || r.order !== i + 1)
      err("V4", w, `order 는 1부터 연속된 정수여야 함: ${JSON.stringify(r.order)}`);
    if (text(r.title) && (!text(r.teaches) || !text(r.addsOverPrevious)))
      err("V4", w, "title 이 있으면 teaches·addsOverPrevious 도 필요");
    if (r.inLibrary === false && text(r.title) && r.url === null)
      warn("V2", w, "inLibrary=false 인데 url 이 null — 외부 자료면 주소가 필요합니다");
  });

  /* ── cherries (공통) ──
     ⚠️ chunkId 는 handoff contract 상 빈 문자열이 허용된다(작업안내 §5-A).
        빈 chunkId 자체는 오류가 아니다. 대신 insight 가 있으면 source·locator 는 반드시 있어야 한다. */
  const cher = Array.isArray(it.cherries) ? it.cherries : [];
  const seen = new Map();
  cher.forEach((c, i) => {
    const w = `${at}.cherries[${i}]`;
    const has = text(c && c.insight);
    if (has && !text(c.source)) err("V5", w, "insight 가 있는데 source 가 비었음");
    if (has && !text(c.locator)) err("V5", w, "insight 가 있는데 locator 가 비었음");
    if (has && text(c.source) && !SOURCES.includes(c.source))
      warn("V5", w, `source 가 문서에 열거된 4종이 아님: ${JSON.stringify(c.source)}`);
    const id = text(c && c.chunkId);
    if (id) {
      if (seen.has(id)) err("V7", w, `chunkId 중복 (앞선 위치 [${seen.get(id)}]): ${id}`);
      else seen.set(id, i);
    }
  });

  /* ── contributors (공통) ── */
  (Array.isArray(it.contributors) ? it.contributors : []).forEach((c, i) => {
    if (!ROLES.includes(c && c.role))
      err("V-ROLE", `${at}.contributors[${i}]`,
        `role 이 DB CHECK 제약과 다름 (${ROLES.join(" | ")}): ${JSON.stringify(c && c.role)}`);
  });

  return { supplemental, at };
}

function validate(file, baselineFile, crossFile) {
  const doc = read(file);
  if (!Array.isArray(doc.items)) { console.error("❌ items 배열이 없습니다."); return 1; }
  const baseline = baselineFile ? new Map(read(baselineFile).items.map((i) => [i.node, i])) : null;
  const ui = uiTopics();

  let supplementalCount = 0;
  const provisionalIds = new Map();
  const uiTopicHere = new Map();

  for (const it of doc.items) {
    const { supplemental, at } = checkItem(it, { baseline, ui });
    if (supplemental) {
      supplementalCount++;
      /* S2 — provisionalId 는 파일 안에서 유일해야 한다 */
      const pid = text(it.provisionalId);
      if (pid) {
        if (provisionalIds.has(pid)) err("S2", at, `provisionalId 중복: ${pid}`);
        else provisionalIds.set(pid, at);
      }
    }
    const ut = text(it.uiTopicId);
    if (ut) {
      if (uiTopicHere.has(ut)) err("S2", at, `같은 파일에서 uiTopicId 중복: ${ut}`);
      else uiTopicHere.set(ut, at);
    }
  }

  /* ── X1: 교차 파일 — 같은 UI 메뉴가 양쪽에 있으면 안 된다 ── */
  if (crossFile) {
    const other = read(crossFile);
    const otherTopics = new Map();
    (other.items || []).forEach((i) => {
      const ut = text(i.uiTopicId);
      /* ⚠️ 명시적으로 적힌 uiTopicId 만 비교한다.
         main 항목에는 uiTopicId 필드가 없고, page.tsx 매핑으로 유추하면
         '근사 매핑을 신뢰하지 않는다'는 결정과 모순된다(그 경우는 X2 경고가 담당). */
      if (ut) otherTopics.set(ut, i.provisionalId || i.node);
    });
    for (const [ut, who] of uiTopicHere) {
      if (otherTopics.has(ut))
        err("X1", who, `uiTopicId '${ut}' 가 다른 파일에도 있음 (${otherTopics.get(ut)}) — ` +
          "같은 메뉴가 main 과 supplemental 양쪽에 있으면 안 됩니다");
    }
    /* supplemental 이 근사 노드를 identity 로 되살렸는지 교차 확인 */
    for (const it of doc.items) {
      if (it.node) continue;
      const apx = text(it.approximateNode);
      if (apx && ui && ui.some((t) => t.topic === text(it.uiTopicId) && t.node === apx)) {
        warn("X2", it.provisionalId || "(?)",
          `approximateNode '${apx}' 가 page.tsx 에서 아직 이 토픽의 매핑 값입니다 — ` +
          "UI 매핑은 이번 범위에서 바꾸지 않으므로 정상이지만, identity 로 쓰지 않는지 확인하세요");
      }
    }
  }

  /* V9 — UI 토픽 커버리지. ⚠️ 경고로만. 매핑이 미해결이라 계약으로 굳히지 않는다. */
  if (!ui) {
    warn("V9", "menu", "page.tsx 의 CONCEPT_NODE_BY_TOPIC 을 읽지 못해 커버리지 검사를 건너뜀");
  } else if (!supplementalCount) {
    const menuNodes = new Set(doc.items.filter((i) => i.pageType === "MENU").map((i) => i.node));
    const missing = ui.filter((t) => !menuNodes.has(t.node));
    if (missing.length)
      warn("V9", "menu", `UI 토픽 ${ui.length}개 중 MENU 로 표현되지 않은 것: ${missing.map((t) => `${t.topic}→${t.node}`).join(", ")}`);
    const count = {};
    ui.forEach((t) => { count[t.node] = (count[t.node] || 0) + 1; });
    Object.entries(count).filter(([, n]) => n > 1).forEach(([node, n]) =>
      warn("V9", "menu", `노드 ${node} 가 UI 토픽 ${n}개에 중복 매핑됨 — 패키지에서는 1항목으로만 표현됨`));
  }

  /* ── 출력 ── */
  const group = (list) => list.reduce((m, e) => { (m[e.rule] = m[e.rule] || []).push(e); return m; }, {});
  const dump = (mark, list) => {
    const g = group(list);
    for (const rule of Object.keys(g).sort()) {
      console.log(`  ${mark} ${rule} — ${g[rule].length}건`);
      g[rule].slice(0, 5).forEach((e) => console.log(`      · ${e.where}: ${e.msg}`));
      if (g[rule].length > 5) console.log(`      … 외 ${g[rule].length - 5}건`);
    }
  };

  console.log(`검사 대상: ${file}`);
  console.log(`항목 ${doc.items.length}개 (supplemental ${supplementalCount})` +
    `${baselineFile ? ` · 기준본 ${path.basename(baselineFile)}` : ""}` +
    `${crossFile ? ` · 교차 ${path.basename(crossFile)}` : ""}`);
  if (warns.length) { console.log(`\n경고 ${warns.length}건 (실패로 치지 않음)`); dump("⚠️", warns); }
  if (errs.length) { console.log(`\n오류 ${errs.length}건`); dump("❌", errs); }
  else console.log("\n✅ 오류 없음");
  return errs.length ? 1 : 0;
}

const argv = process.argv.slice(2);
if (argv[0] === "--compare") {
  if (argv.length < 3) { console.error("사용: --compare <a.json> <b.json>"); process.exit(2); }
  process.exit(compare(argv[1], argv[2]));
}
const valOf = (flag) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : null; };
const baseline = valOf("--baseline");
const cross = valOf("--cross");
const consumed = new Set();
["--baseline", "--cross"].forEach((f) => { const i = argv.indexOf(f); if (i >= 0) consumed.add(i + 1); });
const target = argv.filter((a, i) => !a.startsWith("--") && !consumed.has(i))[0] || DEFAULT_IN;
process.exit(validate(target, baseline, cross));
