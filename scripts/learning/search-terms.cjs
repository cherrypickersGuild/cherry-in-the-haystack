/* 개념명 → 책 검색어 · 근거 문단 필터 (공유 모듈)
   `bookParagraphsAvailable` 을 세는 쪽(build-researcher-json.cjs)과
   실제 후보 문단을 뽑는 쪽(export-evidence-candidates.cjs)이 **같은 코드**를 써야
   "개수는 85인데 목록은 60개" 같은 어긋남이 구조적으로 생기지 않는다.

   ⚠️ 주의(이력): 예전 방식(마지막 낱말만 뽑기)은 `MultiAgentSystem` → "system" 이 되어
   무관한 문단이 대량으로 걸렸다. 약어(RAG)는 4글자 미만이라 아예 빠졌다.
   → 전체 구(句)와 단수형만 쓰고, 약어는 낱말 경계로 정확히 찾는다. */

/** 근거로 쓰기엔 너무 짧은 문단을 거른다. 세는 쪽과 뽑는 쪽이 반드시 같아야 한다. */
const MIN_BODY_CHARS = 300;

/** 문단 필터 (SQL 조각) — $1 은 정규식. 두 스크립트가 이 문자열을 공유한다. */
const PARAGRAPH_FILTER = `body_text ~* $1 AND char_length(body_text) >= ${MIN_BODY_CHARS} AND revoked_at IS NULL`;

const ACRONYM = (l) => /^[A-Z][A-Za-z]{1,5}$/.test(l) && l.replace(/[^A-Z]/g, "").length >= 2;

/** 이름 하나 → 검색 패턴들 */
function patternsFor(label) {
  const raw = String(label).trim();
  if (ACRONYM(raw)) return [{ text: raw, re: `\\m${raw}\\M` }];   // RAG, PAL, PEFT …
  const s = raw.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[/]/g, " ").toLowerCase().trim();
  const set = new Set([s]);
  if (s.endsWith("s")) set.add(s.slice(0, -1));
  return [...set]
    .map((t) => t.replace(/[^a-z0-9 ]/g, "").trim())
    .filter((t) => t.length >= 4)
    .map((t) => ({ text: raw, re: t.replace(/ /g, "[ -]?") }));
}

/** 개념명 + 하위 개념명 + **별칭**으로 검색어를 만든다.
    ⚠️ 개념명만 쓰면 실제보다 훨씬 적게 잡힌다 — 책은 상위 개념어를 잘 안 쓰기 때문.
    예: "Advanced Prompting" 은 책에 그 표현 자체가 나오지 않고 ChainOfThought·PAL·ReAct 같은
    개별 기법 이름으로 서술된다. 개념명만으로 세면 근거가 없는 것처럼 보인다.

    ⚠️ 별칭(2026-08-25 추가): 책이 쓰는 말과 온톨로지 이름이 다른 경우가 많다.
       실측 — MultiAgentSystem 은 0건이지만 별칭 "multiagent" 로는 71건,
              QuantizedLoRA 는 0건이지만 "QLoRA" 로는 14건이 잡힌다.
       별칭을 안 넣었을 때 실제로 이미 발행된 RAG 체리 1건("Hybrid search")을 놓친 적이 있다.
    (건수는 DB 상태에 따라 변하므로 여기 적지 않는다.) */
function terms(label, childLabels = [], aliasLabels = []) {
  const out = [], seen = new Set();
  for (const nm of [label, ...childLabels, ...aliasLabels]) {
    for (const p of patternsFor(nm)) {
      if (seen.has(p.re)) continue;
      seen.add(p.re); out.push(p);
    }
  }
  return out;
}

/** 패턴 목록 → 하나의 대안 정규식. 비면 null (검색어가 없으면 세지도 뽑지도 않는다). */
const toRegex = (list) => (list.length ? `(${list.map((x) => x.re).join("|")})` : null);

/** locator 는 리서처가 조립하지 않는다 — 여기서 정본 형식으로 만든다.
 *  형식: "챕터 › 절". 한쪽이 없으면 있는 쪽만. 둘 다 없으면 null. */
const canonicalLocator = (chapter, section) =>
  [chapter, section].map((x) => (x == null ? "" : String(x).trim())).filter(Boolean).join(" › ") || null;

/** 저자 표기 정리 — concept.service.ts findCherries 와 같은 규칙 */
const canonicalAuthor = (a) =>
  a && a !== "Unknown" ? String(a).replace(/;$/, "").trim() : null;

/** 개념 + 그 하위 개념들의 별칭을 한 번에 가져오는 SQL. $1 = ontology_node
 *  세는 쪽과 뽑는 쪽이 같은 별칭을 쓰도록 여기에 둔다. */
const ALIAS_SQL = `
  SELECT DISTINCT a.alias_text
    FROM handbook.concept_alias a
    JOIN handbook.concept c ON c.id = a.concept_id AND c.revoked_at IS NULL
   WHERE a.revoked_at IS NULL
     AND ( c.ontology_node = $1
        OR c.id IN ( SELECT r.from_concept_id
                       FROM handbook.concept_relation r
                       JOIN handbook.concept t ON t.id = r.to_concept_id
                      WHERE t.ontology_node = $1 AND r.revoked_at IS NULL ) )`;

module.exports = {
  MIN_BODY_CHARS, PARAGRAPH_FILTER, ACRONYM, patternsFor, terms, toRegex,
  canonicalLocator, canonicalAuthor, ALIAS_SQL,
};
