/* Advanced — 4차: 교체된 개념들의 하위 채우기
   메뉴에서 교체된 뒤에도 이 개념들은 '링크 타고 들어가는 페이지'로 남는다.
   HybridRetrieval 과 RedTeaming 은 GO DEEPER 밴드가 비어 있었다.

   ⚠️ 숫자를 채우려고 형제를 끌어내리지 않는다(2차 검토 교훈).
      SparseRetrieval · DenseRetrieval 은 hybrid 가 **문자 그대로 합친 두 가지**라 하위가 맞다. */
const ORIGIN = "cherry-authored";
const ADDED_AT = "2026-08-25";

const CONCEPTS = [
  { node: "Jailbreak", name: "Jailbreak",
    description:
      "A jailbreak is a prompt that talks a model out of its own safety rules — typically by assigning it a persona that is defined as having no rules, then insisting the persona is maintained. The DAN family (\"do anything now\") is the archetype. Jailbreaks are what red teaming produces and what adversarial benchmarks score, which is why the same prompt shows up as an attack in one paper and as a test case in the next.",
    boundary: "Jailbreak targets the model's own refusal behaviour. PromptInjection targets the instructions the application put around the model." },
];
const REVOKE = [
  { from: "PromptInjection", to: "RedTeaming", type: "RELATED",
    why: "공격 기법이므로 RELATED 가 아니라 SUBTOPIC 이 맞다 — GO DEEPER 밴드에 떠야 한다" },
];
const RELATIONS = [
  { from: "SparseRetrieval", to: "HybridRetrieval", type: "SUBTOPIC",
    note: "하이브리드 검색이 합치는 두 가지 중 키워드 쪽" },
  { from: "DenseRetrieval",  to: "HybridRetrieval", type: "SUBTOPIC",
    note: "하이브리드 검색이 합치는 두 가지 중 벡터 쪽" },
  { from: "Jailbreak",       to: "RedTeaming",      type: "SUBTOPIC" },
  { from: "PromptInjection", to: "RedTeaming",      type: "SUBTOPIC",
    note: "RELATED 에서 승격 — 공격 기법이다" },
];
const REVOKE_ALIASES = [];
const ALIASES = [
  { node: "Jailbreak", text: "jailbreaking", type: "VARIANT" },
];
const BASELINE = { concepts: 318, relations: 340, aliases: 27, chunks: 3054, links: 38, pages: 8 };
const EXPECTED = {
  concepts: BASELINE.concepts + CONCEPTS.length,                      // 319
  relations: BASELINE.relations + RELATIONS.length - REVOKE.length,   // 343
  aliases: BASELINE.aliases + ALIASES.length - REVOKE_ALIASES.length, // 28
  chunks: BASELINE.chunks, links: BASELINE.links, pages: BASELINE.pages,
};
module.exports = { ORIGIN, ADDED_AT, CONCEPTS, RENAME: [], REVOKE, RELATIONS,
                   REVOKE_ALIASES, ALIASES, MENU_CHANGES: [], BASELINE, EXPECTED,
                   EXPECTED_CHILDREN: {}, BORROWED_CHILDREN_ALLOWED: [] };
