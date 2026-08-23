/* Overview 의 정본 표현 — 구조화된 3필드 ⟷ content_md 마크다운
   결정 G2: 리서처 JSON 의 정본은 { definition, whyItMatters, context } 3필드다.
            `**Why it matters:**` 같은 표시용 라벨은 JSON 값 안에 넣지 않는다.
            content_md 를 만들 때 이 모듈의 serialize 가 라벨을 일관되게 다시 붙인다.

   ⚠️ 라벨 규약의 근거는 현재 발행된 유일한 페이지(RAG) 한 건이다.
      scripts/ontology/seed-rag-page.cjs 의 OVERVIEW 실측:
        para[0]  (라벨 없음)                      → definition
        para[1]  "**Why it matters:** …"          → whyItMatters
        para[2]  "**The shape of the work:** …"   → context
      필드 의미는 작업안내.md §3 과 일치한다
        (context = "실제로 뭘 하게 되는지 — 일의 모양" = the shape of the work).
      표본이 1건이므로, 두 번째 페이지를 발행할 때 이 규약을 재확인할 것.

   파서는 **해당 필드의 정해진 라벨만** 벗긴다. 아무 `**...:**` 나 벗기면
   본문이 우연히 그 모양일 때(예: "**Note:** …") 되돌릴 수 없게 된다. */

/** 필드 순서 = 문단 순서. label 이 null 이면 라벨 없이 쓴다. */
const FIELDS = [
  { key: "definition", label: null },
  { key: "whyItMatters", label: "**Why it matters:**" },
  { key: "context", label: "**The shape of the work:**" },
];

const EMPTY = () => ({ definition: "", whyItMatters: "", context: "" });

/** content_md → 3필드. 정해진 라벨만 제거하고 나머지 문자는 건드리지 않는다.
 *  @returns {{ overview: object, extraParagraphs: string[] }}
 *           extraParagraphs 는 3필드에 담기지 않은 4번째 이후 문단(호출자가 판단). */
function parseOverview(md) {
  if (!md) return { overview: EMPTY(), extraParagraphs: [] };
  const paras = String(md).replace(/\r\n/g, "\n").split(/\n{2,}/)
    .map((x) => x.trim()).filter(Boolean);
  const overview = EMPTY();
  FIELDS.forEach((f, i) => {
    let t = paras[i] || "";
    if (f.label && t.startsWith(f.label)) t = t.slice(f.label.length).replace(/^[ \t]+/, "");
    overview[f.key] = t;
  });
  return { overview, extraParagraphs: paras.slice(FIELDS.length) };
}

/** 3필드 → content_md. 값이 빈 필드는 문단 자체를 만들지 않는다(빈 라벨만 남기지 않기 위해). */
function serializeOverview(overview) {
  const o = overview || {};
  return FIELDS
    .map((f) => {
      const v = String(o[f.key] == null ? "" : o[f.key]).trim();
      if (!v) return null;
      return f.label ? `${f.label} ${v}` : v;
    })
    .filter(Boolean)
    .join("\n\n");
}

module.exports = { FIELDS, EMPTY, parseOverview, serializeOverview };
