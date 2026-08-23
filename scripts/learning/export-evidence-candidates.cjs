#!/usr/bin/env node
/* 근거 후보 문단 내보내기 (🔵 읽기 전용 · SELECT 만)
   목적: 리서처가 DB 자격증명 없이 Cherries 를 쓸 수 있도록, 개념별 후보 문단 원문을 파일로 준다.

   사용:
     node scripts/learning/export-evidence-candidates.cjs --node RAG
     node scripts/learning/export-evidence-candidates.cjs --node RAG --out <경로>

   결정 G4:
     · 산출물은 **local-only / gitignored** — 도서 본문이 들어가므로 커밋하지 않는다.
     · 임의 상한(cap)을 두지 않는다. 결정적 relevance 순위가 정의되지 않은 상태에서
       앞 N개를 자르면 가장 좋은 근거를 잃는다. 매칭된 문단을 전부 담는다.
     · `bookParagraphsAvailable` 과 **같은 search/filter semantics** 를 쓴다
       (search-terms.cjs 공유) → totalMatched === exportedCount 여야 한다.
     · locator 는 리서처가 조립하지 않고 여기서 정본 형식으로 만든다. */
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "../..");
const {
  terms, toRegex, PARAGRAPH_FILTER, MIN_BODY_CHARS, canonicalLocator, canonicalAuthor,
} = require("./search-terms.cjs");

const argv = process.argv.slice(2);
const at = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const NODE = at("--node");
if (!NODE) { console.error("사용: --node <온톨로지 노드명>  (예: --node RAG)"); process.exit(2); }
const OUT_DIR = at("--out") || path.join(ROOT, "apps/docs/concept-quality/researcher-package/evidence-candidates");

const envPath = path.join(ROOT, "apps/api/.env");
if (!fs.existsSync(envPath)) { console.error(`중단: ${envPath} 가 없습니다.`); process.exit(1); }
const env = Object.fromEntries(fs.readFileSync(envPath, "utf8")
  .split("\n").filter((l) => /^[A-Z_]+=/.test(l))
  .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
console.log("■ 대상 DB (읽기 전용)");
console.log(`   host ${env.LOCAL_DB_HOST} · port ${env.LOCAL_DB_PORT} · database ${env.LOCAL_DB_NAME}`);

const { Client } = require(path.join(ROOT, "apps/api/node_modules/pg"));

/* SQL POSIX 정규식의 낱말 경계(\m \M)를 JS 로 옮긴다.
   ⚠️ matchedTerms 는 **보고용 참고값**이다. 무엇이 후보인지 정하는 것은 SQL 쪽 필터다. */
const toJsRegex = (re) => new RegExp(re.replace(/\\m/g, "\\b").replace(/\\M/g, "\\b"), "i");

(async () => {
  const c = new Client({ host: env.LOCAL_DB_HOST, port: +env.LOCAL_DB_PORT, user: env.LOCAL_DB_USER,
    password: env.LOCAL_DB_PASSWORD, database: env.LOCAL_DB_NAME, ssl: { rejectUnauthorized: false } });
  await c.connect();

  /* 개념 + 하위 개념명 → 검색어 (생성기와 동일 경로) */
  const { rows: cons } = await c.query(
    `SELECT id, canonical_name FROM handbook.concept
      WHERE ontology_node = $1 AND revoked_at IS NULL`, [NODE]);
  if (!cons.length) { console.error(`중단: handbook.concept 에 ontology_node='${NODE}' 없음`); process.exit(1); }
  if (cons.length > 1) { console.error(`중단: ontology_node='${NODE}' 가 ${cons.length}행 — 모호`); process.exit(1); }

  const { rows: kids } = await c.query(
    `SELECT cf.canonical_name AS child
       FROM handbook.concept_relation r
       JOIN handbook.concept cf ON cf.id = r.from_concept_id AND cf.revoked_at IS NULL
       JOIN handbook.concept ct ON ct.id = r.to_concept_id AND ct.revoked_at IS NULL
      WHERE ct.ontology_node = $1 AND r.revoked_at IS NULL`, [NODE]);

  const t = terms(cons[0].canonical_name, kids.map((k) => k.child));
  const re = toRegex(t);
  if (!re) { console.error(`중단: 검색어를 만들 수 없음 (개념명 '${cons[0].canonical_name}')`); process.exit(1); }

  /* ① 개수 — 생성기의 bookParagraphsAvailable 과 완전히 같은 쿼리 */
  const { rows: cnt } = await c.query(
    `SELECT count(*)::int n FROM handbook.paragraph_chunk WHERE ${PARAGRAPH_FILTER}`, [re]);
  const totalMatched = cnt[0].n;

  /* ② 본문 — 같은 필터, 상한 없음. 정렬은 재현 가능하게 book/chapter/문단순 */
  const { rows } = await c.query(
    `SELECT pc.id, pc.body_text, pc.page_number, pc.paragraph_index,
            b.title AS book, b.author, ch.title AS chapter, s.title AS section
       FROM handbook.paragraph_chunk pc
       JOIN handbook.book b ON b.id = pc.book_id
  LEFT JOIN handbook.chapter ch ON ch.id = pc.chapter_id
  LEFT JOIN handbook.section s ON s.id = pc.section_id
      WHERE ${PARAGRAPH_FILTER.replace(/body_text/g, "pc.body_text").replace(/revoked_at/g, "pc.revoked_at")}
      ORDER BY b.title, ch.title NULLS FIRST, pc.paragraph_index, pc.id`, [re]);

  const jsPatterns = t.map((x) => ({ text: x.text, rx: toJsRegex(x.re) }));
  const candidates = rows.map((r) => ({
    chunkId: r.id,
    source: r.book,
    author: canonicalAuthor(r.author),
    locator: canonicalLocator(r.chapter, r.section),
    chapter: r.chapter ?? null,
    section: r.section ?? null,
    pageNumber: r.page_number ?? null,
    charCount: r.body_text.length,
    matchedTerms: jsPatterns.filter((p) => p.rx.test(r.body_text)).map((p) => p.text),
    bodyText: r.body_text,
  }));

  const out = {
    _readme: "근거 후보 문단. 리포에 커밋하지 마세요(도서 본문 포함). Cherries 작성용 참고 자료입니다.",
    node: NODE,
    conceptName: cons[0].canonical_name,
    generatedAt: new Date().toISOString().slice(0, 10),
    query: {
      searchTerms: [...new Set(t.map((x) => x.text))],
      regex: re,
      minBodyChars: MIN_BODY_CHARS,
      excludeRevoked: true,
      note: "bookParagraphsAvailable 과 동일한 search-terms.cjs 를 사용",
    },
    totalMatched,
    exportedCount: candidates.length,
    truncated: false,
    candidates,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `${NODE}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));

  console.log(`\n■ 결과 — ${file}`);
  console.log(`   검색어 ${out.query.searchTerms.length}개`);
  console.log(`   totalMatched  ${totalMatched}`);
  console.log(`   exportedCount ${candidates.length}`);
  if (totalMatched !== candidates.length) {
    console.error(`\n❌ totalMatched ≠ exportedCount — 세는 쿼리와 뽑는 쿼리가 어긋났습니다.`);
    await c.end(); process.exit(1);
  }
  console.log("   ✅ totalMatched === exportedCount (상한 없이 전량 내보냄)");
  const noLoc = candidates.filter((x) => !x.locator).length;
  if (noLoc) console.log(`   ⚠️ locator 를 만들 수 없는 문단 ${noLoc}건 (chapter·section 모두 없음)`);
  await c.end();
})().catch((e) => { console.error("실패:", e.message); process.exit(1); });
