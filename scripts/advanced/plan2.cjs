/* Advanced — 2차 온톨로지 변경 계획 (공유 정의)
   1차(plan.cjs)에서 남은 문제 두 가지를 푼다.

   ① 메뉴 6개 중 2개가 여전히 **다른 개념**을 가리킨다
        Adversarial Evaluation  →  RedTeaming          (찾는 활동 ≠ 재는 활동)
        Multi-agent Orchestration → MultiAgentSystem   (조율 계층 ≠ 시스템 자체)
      1차 때 "신설하지 말고 붙이자"고 판단했으나, 그 판단이 자료조사 결론과 어긋났다.
      근거: research/6-adversarial-evaluation.md §2 · research/4-multi-agent-orchestration.md §5
            ACL TrustNLP 2025 (aclanthology 2025.trustnlp-main.23) · arXiv:2601.13671

   ② 1차에서 신설한 5개의 canonical_name 을 **노드명과 똑같이** 넣었다
      화면 제목이 "MultiHopRAG" 처럼 뜬다. canonical_name 은 사람이 읽는 이름이어야 한다.

   ⚠️ 기존 305개는 건드리지 않는다. 고치는 것은 전부 우리가 넣은 것(origin='cherry-authored')뿐이다. */

const ORIGIN = "cherry-authored";
const ADDED_AT = "2026-08-25";

/** 신설 개념 2개 — 메뉴 6개가 전부 자기 개념을 갖게 된다 */
const CONCEPTS = [
  {
    node: "AdversarialEvaluation",
    name: "Adversarial Evaluation",
    description:
      "Adversarial evaluation measures how a model holds up under inputs designed to break it. It is the measuring half of a pair: red teaming searches adaptively for new failure modes, and adversarial evaluation scores a system against a fixed set of them — attack success rate, severity, coverage, reproducibility. Standardized suites such as HarmBench and JailbreakBench exist so that numbers from different papers mean the same thing. The catch is symmetric to red teaming's: a benchmark can only measure the attacks it already contains.",
    boundary:
      "AdversarialEvaluation measures robustness against a fixed adversarial test set; RedTeaming adaptively discovers new failure modes. Discovery feeds measurement, and measurement cannot see what discovery has not yet found.",
  },
  {
    node: "MultiAgentOrchestration",
    name: "Multi-agent Orchestration",
    description:
      "Multi-agent orchestration is the control layer that sits above a set of agents and decides which one acts, when, on what state, and with what authority. It covers planning, policy enforcement, state management, and quality operations, and it is where the interesting failures live — loops that never terminate, cost that grows with every hand-off, and state that two agents disagree about. A multi-agent system is the set of agents; orchestration is how that set is run.",
    boundary:
      "MultiAgentSystem is the set of agents and their structure. MultiAgentOrchestration is the control layer over them — planning, policy, state, quality (arXiv:2601.13671).",
  },
  {
    node: "MatryoshkaEmbedding",
    name: "Matryoshka Embedding",
    description:
      "Matryoshka representation learning trains an embedding so that a prefix of the vector is still usable on its own. One model then serves many storage and latency budgets: keep 1024 dimensions where accuracy matters, truncate to 256 where it does not, with no retraining. The original work reports 14x smaller embeddings at comparable ImageNet-1K accuracy.",
    boundary:
      "MatryoshkaEmbedding is about the shape of the trained vector (truncatable), not about which pairs the model is trained on.",
  },
  {
    node: "PrefixTuning",
    name: "Prefix Tuning",
    description:
      "Prefix tuning prepends a small set of trainable vectors to the input or to each layer's hidden states and trains only those. The base model stays frozen, so one copy of the weights can serve many tasks by swapping prefixes. In the PEFT taxonomy it sits in the additive family alongside adapters, as opposed to the reparameterized family where LoRA lives.",
    boundary:
      "PrefixTuning adds trainable soft prompts; AdapterTuning inserts trainable modules; LoRA re-expresses existing weights in low rank. Three different additive/reparameterized strategies.",
  },
  {
    node: "AttackSuccessRate",
    name: "Attack Success Rate",
    description:
      "Attack success rate is the headline number of adversarial evaluation: the share of attempts that produced the disallowed behaviour, as scored by some judge. It is also the field's most misread number. Recent work argues that ASRs from different papers are frequently not comparable at all — the underlying estimands differ (one-shot versus best-of-N), and the judges used have different true positive rates across the systems being compared.",
    boundary:
      "AttackSuccessRate is the metric produced by AdversarialEvaluation. RedTeaming produces the attempts that the metric is computed over.",
  },
];

/** 1차에서 잘못 넣은 canonical_name 정정 5건 (우리 개념만) */
const RENAME = [
  { node: "MultiHopRAG",           name: "Multi-hop RAG" },
  { node: "CustomEmbedding",       name: "Custom Embeddings" },
  { node: "AdapterTuning",         name: "Adapter Tuning" },
  { node: "ContrastiveFinetuning", name: "Contrastive Fine-tuning" },
  { node: "HardNegativeMining",    name: "Hard Negative Mining" },
];

/** 1차에서 붙인 관계 중 새 개념으로 옮길 것 — DELETE 아님, revoked_at */
const REVOKE = [
  { from: "Coordinator",             to: "MultiAgentSystem", type: "SUBTOPIC",
    why: "조율 부품이므로 Orchestration 밑이 맞다" },
  { from: "WorkflowAutomation",      to: "MultiAgentSystem", type: "RELATED",
    why: "워크플로 자동화는 조율 방식과 겹친다 → Orchestration 으로" },
  { from: "MultiAgentCollaboration", to: "MultiAgentSystem", type: "RELATED",
    why: "협업 방식은 조율의 문제 → Orchestration 으로" },
  { from: "RedTeaming",              to: "EvaluationMetric", type: "RELATED",
    why: "이 다리는 AdversarialEvaluation 이 대신한다 (그쪽이 평가 계열의 정식 구성원)" },
  /* 2차 검토에서 '화면 채우려고 붙인 관계'로 판정된 것 — 진짜 하위로 교체한다 */
  { from: "SemanticRepresentation",  to: "CustomEmbedding", type: "RELATED",
    why: "SemanticRepresentation 은 '임베딩이 무엇인가'에 속한다. '어떻게 재학습하는가' 밑에 두면 계층이 뒤집힌다 → MatryoshkaEmbedding 으로 교체" },
  { from: "QuantizedLoRA",           to: "ParameterEfficientFinetuning", type: "RELATED",
    why: "이미 QuantizedLoRA→LoRA→PEFT 로 이어져 의미상 중복인 지름길 간선 → PrefixTuning 으로 교체" },
];

/** 삽입할 관계 10건 */
const RELATIONS = [
  // 새 개념을 온톨로지에 붙인다
  { from: "AdversarialEvaluation",   to: "EvaluationMetric",        type: "SUBTOPIC" },
  { from: "MultiAgentOrchestration", to: "MultiAgentSystem",        type: "SUBTOPIC" },
  // AdversarialEvaluation 의 하위 — 재는 활동의 부품
  { from: "RedTeaming",              to: "AdversarialEvaluation",   type: "RELATED",
    note: "찾는 활동이 재는 활동에 테스트 케이스를 공급한다 (ACL TrustNLP 2025 파이프라인)" },
  { from: "BenchmarkDataset",        to: "AdversarialEvaluation",   type: "RELATED",
    note: "HarmBench · JailbreakBench · StrongREJECT 가 여기 해당" },
  { from: "AttackSuccessRate",       to: "AdversarialEvaluation",   type: "SUBTOPIC",
    note: "이 평가가 내놓는 지표. AutomaticMetric(형제)을 끌어내리는 대신 자기 하위를 만든다" },
  // MultiAgentOrchestration 의 하위 — 조율 계층의 부품
  { from: "Coordinator",             to: "MultiAgentOrchestration", type: "SUBTOPIC" },
  { from: "Planner",                 to: "MultiAgentOrchestration", type: "SUBTOPIC",
    note: "arXiv:2601.13671 의 planning" },
  { from: "Executor",                to: "MultiAgentOrchestration", type: "SUBTOPIC" },
  { from: "WorkflowAutomation",      to: "MultiAgentOrchestration", type: "RELATED" },
  { from: "MultiAgentCollaboration", to: "MultiAgentOrchestration", type: "RELATED" },
  // 진짜 하위 개념으로 교체 (2차 검토)
  { from: "MatryoshkaEmbedding",     to: "CustomEmbedding",              type: "SUBTOPIC",
    note: "SemanticRepresentation(빌려온 것)을 대신한다" },
  { from: "PrefixTuning",            to: "ParameterEfficientFinetuning", type: "SUBTOPIC",
    note: "QuantizedLoRA 지름길 간선을 대신한다 · PEFT Survey 의 Additive/Soft Prompt 갈래" },
];

/** 1차에서 엉뚱한 개념에 붙인 별칭 2건을 뗀다 — 이제 새 개념의 정식 이름이다 */
const REVOKE_ALIASES = [
  { node: "RedTeaming",       text: "Adversarial Evaluation" },
  { node: "MultiAgentSystem", text: "Multi-agent Orchestration" },
];

/** 등록할 별칭 4건 */
const ALIASES = [
  { node: "AdversarialEvaluation",   text: "Adversarial Testing",  type: "SYNONYM" },
  { node: "AdversarialEvaluation",   text: "Safety Evaluation",    type: "SYNONYM" },
  { node: "MultiAgentOrchestration", text: "Agent Orchestration",  type: "SYNONYM" },
  { node: "MultiAgentOrchestration", text: "orchestrator",         type: "VARIANT",
    why: "책이 쓰는 표현 — orchestrator 15건" },
];

/** 프론트 매핑도 함께 바뀐다 (apps/web/app/page.tsx) */
const MENU_CHANGES = [
  { topic: "adversarial-eval",  from: "RedTeaming",       to: "AdversarialEvaluation" },
  { topic: "agent-topologies",  from: "MultiAgentSystem", to: "MultiAgentOrchestration" },
];

/** 1차 적용 후 상태 = 2차의 기준선 */
const BASELINE = { concepts: 310, relations: 331, aliases: 25, chunks: 3054, links: 7, pages: 2 };
const EXPECTED = {
  concepts: BASELINE.concepts + CONCEPTS.length,                              // 312
  relations: BASELINE.relations + RELATIONS.length - REVOKE.length,           // 337
  aliases: BASELINE.aliases + ALIASES.length - REVOKE_ALIASES.length,         // 27
  chunks: BASELINE.chunks, links: BASELINE.links, pages: BASELINE.pages,
};

/** 적용 후 메뉴 6개의 하위 개수 */
const EXPECTED_CHILDREN = {
  AdvancedPrompting: 11, MultiHopRAG: 5, ParameterEfficientFinetuning: 3,
  MultiAgentOrchestration: 5, CustomEmbedding: 3, AdversarialEvaluation: 3,
};
/* 하위가 전부 '자기 하위'인지 — 형제를 끌어내리거나 지름길로 채운 것이 없어야 한다 */
const BORROWED_CHILDREN_ALLOWED = ["RedTeaming", "BenchmarkDataset", "GraphRAG",
  "QueryExpansion", "QueryProcessing", "SelfAsk", "ReAct",
  "Coordinator", "Planner", "Executor", "WorkflowAutomation", "MultiAgentCollaboration"];

module.exports = { ORIGIN, ADDED_AT, CONCEPTS, RENAME, REVOKE, RELATIONS,
                   REVOKE_ALIASES, ALIASES, MENU_CHANGES, BASELINE, EXPECTED,
                   EXPECTED_CHILDREN, BORROWED_CHILDREN_ALLOWED };
