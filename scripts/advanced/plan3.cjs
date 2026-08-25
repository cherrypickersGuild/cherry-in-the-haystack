/* Advanced — 3차 온톨로지 변경: Multi-hop RAG 의 고유 하위 개념
   문제: MultiHopRAG 의 하위 5개가 전부 RELATED 라 로드맵의 "GO DEEPER" 밴드가 비어 있다.
         6개 메뉴 중 유일하게 자기 고유 기법이 없다.
   근거: research/2-multi-hop-rag.md §4 신설 후보 · 4축 프레임워크 arXiv:2601.00536 (원문 확인) */
const ORIGIN = "cherry-authored";
const ADDED_AT = "2026-08-25";

const CONCEPTS = [
  { node: "IterativeRetrieval", name: "Iterative Retrieval",
    description:
      "Iterative retrieval runs the retriever more than once for a single question, feeding what it found back in to form the next query. It is the mechanism that separates multi-hop RAG from single-shot RAG: the loop, not the index, is what lets an answer be assembled from pieces that no one passage holds together.",
    boundary: "IterativeRetrieval is the loop itself. QueryDecomposition decides what to ask on each pass; StoppingCriterion decides when the loop ends." },
  { node: "QueryDecomposition", name: "Query Decomposition",
    description:
      "Query decomposition breaks a compound question into sub-questions that can each be answered by one retrieval. Plan-then-execute systems decompose up front; interleaved systems such as Self-Ask and IRCoT generate the next sub-question only after seeing the previous answer.",
    boundary: "QueryDecomposition splits one question into several. QueryExpansion rewrites one question several ways to hedge against the retriever — different problems." },
  { node: "StoppingCriterion", name: "Stopping Criterion",
    description:
      "A stopping criterion decides when an iterative retrieval loop has enough. The published options are a resource budget (hop, token or latency limits), a confidence threshold, an explicit verifier, or a learned value function. This is the axis that has no counterpart in single-shot RAG, and the one where cost and correctness trade against each other most directly.",
    boundary: "StoppingCriterion governs when the loop ends. It is specific to iterative retrieval; a single-shot RAG pipeline has no such decision to make." },
];

const REVOKE = [];
const RELATIONS = [
  { from: "IterativeRetrieval",  to: "MultiHopRAG", type: "SUBTOPIC",
    note: "4축 프레임워크 축 A — Interleaved 실행계획" },
  { from: "QueryDecomposition",  to: "MultiHopRAG", type: "SUBTOPIC",
    note: "4축 프레임워크 축 A — Plan-then-Execute · Self-Ask" },
  { from: "StoppingCriterion",   to: "MultiHopRAG", type: "SUBTOPIC",
    note: "4축 프레임워크 축 D — 이 주제의 고유 난제" },
];
/* ⚠️ "Iterative Retrieval" 은 2차에서 MultiHopRAG 의 별칭으로 넣었는데, 그때 검토에서
      "동의어가 아니라 그 안의 기법"이라고 짚었다. 이제 별도 개념이 됐으므로 떼어낸다.
      DB 의 uq_concept_alias_text_ci_active 가 대소문자 무시 유니크라 그대로 두면 충돌한다. */
const REVOKE_ALIASES = [
  { node: "MultiHopRAG", text: "Iterative Retrieval" },
];
const ALIASES = [
  { node: "IterativeRetrieval", text: "Iterative Retrieval", type: "SYNONYM" },
];

const BASELINE = { concepts: 315, relations: 337, aliases: 27, chunks: 3054, links: 7, pages: 2 };
const EXPECTED = {
  concepts: BASELINE.concepts + CONCEPTS.length,                    // 318
  relations: BASELINE.relations + RELATIONS.length - REVOKE.length, // 340
  aliases: BASELINE.aliases + ALIASES.length - REVOKE_ALIASES.length, // 28
  chunks: BASELINE.chunks, links: BASELINE.links, pages: BASELINE.pages,
};
module.exports = { ORIGIN, ADDED_AT, CONCEPTS, RENAME: [], REVOKE, RELATIONS,
                   REVOKE_ALIASES, ALIASES, MENU_CHANGES: [], BASELINE, EXPECTED,
                   EXPECTED_CHILDREN: {}, BORROWED_CHILDREN_ALLOWED: [] };
