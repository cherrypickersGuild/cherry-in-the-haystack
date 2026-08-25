/* Advanced 6개 페이지 — 온톨로지 변경 계획 (공유 정의 · 단일 정본)
   precheck / apply / rollback 이 **이 파일 하나**만 본다.
   세 스크립트가 각자 목록을 들고 있으면 반드시 어긋난다.

   승인: D1~D10 (2026-08-25)
   기획: apps/docs/advanced/2-implementation-guide.md §2 · §2-3A · §2-4 · §2-5 */

/** 우리가 넣는 것임을 나중에도 구분하기 위한 표식. 롤백의 기준이기도 하다. */
const ORIGIN = "cherry-authored";
const ADDED_AT = "2026-08-25";

/** 신설 개념 5개 — D1 · D2 · D9 */
const CONCEPTS = [
  {
    node: "MultiHopRAG",
    name: "MultiHopRAG",
    description:
      "Multi-hop RAG answers questions that a single retrieval cannot: the result of one search becomes the input to the next. A router or planner decomposes the question, retrieves evidence for the first hop, uses what it found to form the next query, and repeats. The hard problem is not finding — it is knowing when to stop: retrieve too long and cost explodes, stop too early and the answer is wrong.",
    /** 형제와 겹치지 않음을 한 문장으로 못 박는다(원칙 1). 못 쓰면 만들지 않는다. */
    boundary:
      "MultiHopRAG = RAG where the result of one retrieval becomes the input to the next. GraphRAG is an index structure; HybridRetrieval is a ranking method. Different axes.",
  },
  {
    node: "CustomEmbedding",
    name: "CustomEmbedding",
    description:
      "Custom embeddings adapt a general-purpose embedding model to one domain. General models handle everyday language well but miss the distinctions that matter inside law, medicine, or a single company's documents. Contrastive fine-tuning pulls matching pairs together and pushes mismatched ones apart; the quality of that training rests almost entirely on which wrong answers you choose to teach with.",
    boundary:
      "CustomEmbedding = retraining a general embedding model for a specific domain. The Basics concept Embedding covers what an embedding is and why it is used.",
  },
  {
    node: "AdapterTuning",
    name: "AdapterTuning",
    description:
      "Adapter tuning inserts a small trainable module into each layer of a frozen pre-trained model. Only the adapters are updated, so a single base model can serve many tasks by swapping adapters instead of keeping a full fine-tuned copy of the model for each one.",
    boundary:
      "AdapterTuning is the Additive branch of PEFT: it adds new modules. LoRA is the Reparameterized branch: it re-expresses existing weights in low rank.",
  },
  {
    node: "ContrastiveFinetuning",
    name: "ContrastiveFinetuning",
    description:
      "Contrastive fine-tuning trains an embedding model by pulling matching pairs closer together and pushing mismatched pairs apart. It is the standard way to adapt a general embedding model to a specific domain — and recent work reports that the conventional InfoNCE objective can reduce effectiveness in state-of-the-art models, where listwise distillation from a cross-encoder improves retrieval more consistently.",
    boundary:
      "Named ContrastiveFinetuning, not ContrastiveLearning: contrastive learning in general is broader than embeddings, and placing the general under the specific would invert the hierarchy.",
  },
  {
    node: "HardNegativeMining",
    name: "HardNegativeMining",
    description:
      "Hard negative mining chooses the wrong answers used in contrastive training — passages that look close to the query but are not the answer. It drives embedding quality more than any other single choice. It also carries the sharpest trap in the field: on MS-MARCO roughly 70% of the passages most similar to a query turn out to deserve a positive label, so mining naively teaches the model that correct answers are wrong.",
    boundary:
      "HardNegativeMining is the negative-selection step inside ContrastiveFinetuning, kept as its own concept because it is where embedding quality is won or lost.",
  },
];

/** 해제할 관계 1건 — D4. DELETE 가 아니라 revoked_at 으로 끈다(원칙 5). */
const REVOKE = [
  { from: "LoRA", to: "Finetuning", type: "SUBTOPIC",
    why: "학계 분류상 LoRA 는 PEFT 의 Reparameterized 갈래다. Finetuning 의 형제가 아니라 PEFT 의 하위가 맞다." },
];

/** 삽입할 관계 22건 — D1 · D2 · D3 · D4 · D9 */
const RELATIONS = [
  // 신설 개념을 온톨로지에 붙인다
  { from: "MultiHopRAG",             to: "RAG",                          type: "SUBTOPIC" },
  { from: "CustomEmbedding",         to: "Embedding",                    type: "SUBTOPIC" },
  { from: "CustomEmbedding",         to: "Finetuning",                   type: "RELATED"  },
  { from: "AdapterTuning",           to: "ParameterEfficientFinetuning", type: "SUBTOPIC" },
  { from: "ContrastiveFinetuning",   to: "CustomEmbedding",              type: "SUBTOPIC" },
  { from: "HardNegativeMining",      to: "CustomEmbedding",              type: "SUBTOPIC" },
  // D4 — LoRA 를 PEFT 밑으로
  { from: "LoRA",                    to: "ParameterEfficientFinetuning", type: "SUBTOPIC" },
  // 끊겨 있던 기존 개념을 잇는다
  { from: "MultiAgentCollaboration", to: "MultiAgentSystem",             type: "RELATED"  },
  { from: "Coordinator",             to: "MultiAgentSystem",             type: "SUBTOPIC" },
  { from: "RedTeaming",              to: "EvaluationMetric",             type: "RELATED",
    note: "D3 — 메뉴는 '평가'인데 개념은 AlignmentMethod 밑에 있다. 두 가지를 잇는 다리." },
  { from: "PromptInjection",         to: "RedTeaming",                   type: "RELATED"  },
  { from: "Guardrails",              to: "RedTeaming",                   type: "RELATED"  },
  { from: "SafetyGuard",             to: "RedTeaming",                   type: "RELATED"  },
  { from: "QueryExpansion",          to: "MultiHopRAG",                  type: "RELATED"  },
  { from: "QueryProcessing",         to: "MultiHopRAG",                  type: "RELATED"  },
  // 화면의 03 Child Concepts 를 채우기 위한 연결 (2차 검토 §3-A)
  { from: "SelfAsk",                 to: "MultiHopRAG",                  type: "RELATED",
    note: "4축 프레임워크(arXiv:2601.00536)에서 Interleaved 실행계획으로 분류됨" },
  { from: "ReAct",                   to: "MultiHopRAG",                  type: "RELATED",
    note: "4축 프레임워크에서 Interleaved 실행계획으로 분류됨" },
  { from: "GraphRAG",                to: "MultiHopRAG",                  type: "RELATED",
    note: "4축 프레임워크의 축 B(색인 구조). MultiHopRAG 페이지에 노출하기 위해 이 방향으로 잡았다" },
  { from: "QuantizedLoRA",           to: "ParameterEfficientFinetuning", type: "RELATED",
    note: "⚠️ 표시용 지름길 간선 — 이미 QuantizedLoRA→LoRA→PEFT 로 이어져 있어 의미상 중복이다. 손자를 직계로도 노출하려는 목적." },
  { from: "PlannerExecutorAgent",    to: "MultiAgentSystem",             type: "RELATED"  },
  { from: "WorkflowAutomation",      to: "MultiAgentSystem",             type: "RELATED"  },
  { from: "SemanticRepresentation",  to: "CustomEmbedding",              type: "RELATED"  },
];

/** 등록할 별칭 18건 — 검색어가 온톨로지 이름만 쓰던 문제를 푼다
    ⚠️ D8(menuLabel 을 별칭에서 분리)이 먼저 적용돼야 화면 메뉴 이름이 안 깨진다. */
const ALIASES = [
  { node: "MultiAgentSystem",             text: "multiagent",                     type: "VARIANT",
    why: "책이 붙여 쓴다. 이것 하나가 후보 문단 0 → 71건을 가른다" },
  { node: "MultiAgentSystem",             text: "Multi-agent System",             type: "SYNONYM" },
  { node: "MultiAgentSystem",             text: "Multi-agent Orchestration",      type: "SYNONYM" },
  { node: "QuantizedLoRA",                text: "QLoRA",                          type: "ABBREVIATION" },
  { node: "ParameterEfficientFinetuning", text: "PEFT",                           type: "ABBREVIATION" },
  { node: "ParameterEfficientFinetuning", text: "Parameter-Efficient Fine-Tuning",type: "SYNONYM" },
  { node: "RedTeaming",                   text: "Red Teaming",                    type: "VARIANT" },
  { node: "RedTeaming",                   text: "Adversarial Evaluation",         type: "SYNONYM" },
  { node: "AdvancedPrompting",            text: "Advanced Prompting",             type: "VARIANT" },
  { node: "ChainOfThought",               text: "chain-of-thought",               type: "VARIANT" },
  { node: "ChainOfThought",               text: "CoT",                            type: "ABBREVIATION" },
  { node: "MultiHopRAG",                  text: "Multi-hop RAG",                  type: "SYNONYM" },
  { node: "MultiHopRAG",                  text: "Multi-hop Retrieval",            type: "SYNONYM" },
  { node: "MultiHopRAG",                  text: "Iterative Retrieval",            type: "SYNONYM" },
  { node: "MultiHopRAG",                  text: "multihop",                       type: "VARIANT" },
  { node: "CustomEmbedding",              text: "Custom Embeddings",              type: "SYNONYM" },
  { node: "CustomEmbedding",              text: "Domain-specific Embeddings",     type: "SYNONYM" },
  { node: "CustomEmbedding",              text: "Embedding Fine-tuning",          type: "SYNONYM" },
];

/** 적용 전 기준선 — 이 값과 다르면 즉시 중단한다(리스크 R6) */
const BASELINE = { concepts: 305, relations: 310, aliases: 7, chunks: 3054, links: 7, pages: 2 };

/** 적용 후 기대값 */
const EXPECTED = {
  concepts: BASELINE.concepts + CONCEPTS.length,                    // 310
  relations: BASELINE.relations + RELATIONS.length - REVOKE.length, // 331
  aliases: BASELINE.aliases + ALIASES.length,                       // 25
  chunks: BASELINE.chunks, links: BASELINE.links, pages: BASELINE.pages,
};

/** 화면 03 Child Concepts 기대 개수 — 적용 후 검증용 */
const EXPECTED_CHILDREN = {
  AdvancedPrompting: 11, MultiHopRAG: 5, ParameterEfficientFinetuning: 3,
  MultiAgentSystem: 4, CustomEmbedding: 3, RedTeaming: 3,
};

module.exports = { ORIGIN, ADDED_AT, CONCEPTS, REVOKE, RELATIONS, ALIASES,
                   BASELINE, EXPECTED, EXPECTED_CHILDREN };
