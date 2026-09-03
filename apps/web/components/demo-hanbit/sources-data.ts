/**
 * 실제 구독 중인 정보원 — Notion "퍼올 Data Sources" DB 실데이터 기반.
 * (Twitter 140 · LinkedIn 62 · Substack 94 · YouTube 15 · 커뮤니티·기관 35 ·
 *  Reddit 10 · 뉴스레터 4 · 개인 블로그 다수)
 * 데모 표시용으로 대표 계정만 노출.
 */

export type SourceGroup = {
  key: string
  name: string
  emoji: string
  count: number
  nature: string
  value: string
  color: string
  soft: string
  representatives: { name: string; sub?: string; why?: string }[]
}

export const SOURCE_GROUPS: SourceGroup[] = [
  {
    key: "twitter",
    name: "Twitter / X",
    emoji: "🐦",
    count: 140,
    nature: "실시간 신호",
    value:
      "가장 빠른 초기 신호. 모델 드롭, 벤치마크 주장, 실무자 반응이 뉴스레터보다 수 시간~수일 먼저 올라온다. 노이즈가 많아 전 건 AI 스코어링 → 사람 리뷰로 걸러낸다.",
    color: "#4A90D9",
    soft: "#EEF5FD",
    representatives: [
      { name: "Sam Altman", sub: "@sama" },
      { name: "Yann LeCun", sub: "@ylecun" },
      { name: "Andrew Ng", sub: "@AndrewYNg" },
      { name: "Fei-Fei Li", sub: "@drfeifei" },
      { name: "Andrej Karpathy 계열", sub: "@karpathy" },
      { name: "Lilian Weng", sub: "@lilianweng" },
      { name: "Jim Fan", sub: "@DrJimFan" },
      { name: "Ilya Sutskever", sub: "@ilyasut" },
      { name: "Geoffrey Hinton", sub: "@geoffreyhinton" },
      { name: "Demis Hassabis", sub: "@demishassabis" },
      { name: "Clem Delangue (HF)", sub: "@ClementDelangue" },
      { name: "Yannic Kilcher", sub: "@ykilcher" },
      { name: "Ethan Mollick", sub: "@emollick" },
      { name: "swyx", sub: "@swyx" },
      { name: "Gary Marcus", sub: "@GaryMarcus" },
      { name: "Eliezer Yudkowsky", sub: "@ESYudkowsky" },
    ],
  },
  {
    key: "linkedin",
    name: "LinkedIn",
    emoji: "💼",
    count: 62,
    nature: "업계 실무자 인사이트",
    value:
      "기업 공식 발표와 실무자의 B2B 관점이 섞여 나오는 채널. 빅테크 전략, 도입 사례, 채용 시장 신호를 잡는 데 강하다.",
    color: "#2D7A5E",
    soft: "#EFF7F3",
    representatives: [
      { name: "Philipp Schmid", sub: "Hugging Face" },
      { name: "Jay Alammar", sub: "시각화로 유명" },
      { name: "Lewis Tunstall", sub: "HF alignment 팀" },
      { name: "Matt Dancho", sub: "Business Science" },
      { name: "Nathan Benaich", sub: "Air Street Capital" },
      { name: "Benedict Evans", sub: "거시 트렌드" },
      { name: "Sudalai Rajkumar (SRK)", sub: "Kaggle GM" },
      { name: "Petar Veličković", sub: "GNN 연구" },
      { name: "Aman Chadha", sub: "Nvidia · Stanford" },
      { name: "Christoph Molnar", sub: "해석 가능성" },
    ],
  },
  {
    key: "substack",
    name: "Substack / 뉴스레터",
    emoji: "✉️",
    count: 94,
    nature: "고밀도 에세이",
    value:
      "느리지만 신뢰도 높은 채널. 실무자의 깊이 있는 에세이와 기술 파헤치기가 오고, substack2markdown 파이프라인으로 깔끔한 마크다운으로 정제된다. 17개 태그로 자동 분류된다.",
    color: "#C94B6E",
    soft: "#FDF0F3",
    representatives: [
      { name: "Import AI", sub: "Jack Clark" },
      { name: "Latent.Space", sub: "swyx" },
      { name: "Interconnects", sub: "Nathan Lambert" },
      { name: "Ahead of AI", sub: "Sebastian Raschka" },
      { name: "One Useful Thing", sub: "Ethan Mollick" },
      { name: "The Pragmatic Engineer", sub: "Gergely Orosz" },
      { name: "AI Supremacy", sub: "Michael Spencer" },
      { name: "Dwarkesh Patel", sub: "롱폼 인터뷰" },
      { name: "The AI Edge", sub: "Damien Benveniste" },
      { name: "Maxime Labonne", sub: "LLM 엔지니어링" },
      { name: "Society's Backend", sub: "Ryan Berg" },
      { name: "The Decoder", sub: "Matthias Bastian" },
    ],
  },
  {
    key: "youtube",
    name: "YouTube",
    emoji: "▶️",
    count: 15,
    nature: "깊이 있는 대담 · 강의",
    value:
      "컨퍼런스 토크와 심층 인터뷰. 음성→텍스트 변환 후 책과 동일한 아이디어 추출 파이프라인을 탄다. 선도 엔지니어들이 실제로 어떻게 생각하는지 보는 최고의 소스.",
    color: "#D4854A",
    soft: "#FDF7EF",
    representatives: [
      { name: "Andrej Karpathy", sub: "제로부터 LLM 구축" },
      { name: "Dwarkesh Patel", sub: "AI 리서처 인터뷰" },
      { name: "Yannic Kilcher", sub: "논문 리뷰" },
      { name: "Two Minute Papers", sub: "연구 하이라이트" },
      { name: "Machine Learning Street Talk", sub: "Tim Scarfe" },
      { name: "팡요랩", sub: "한국어 논문 리뷰" },
      { name: "안될공학", sub: "한국어 AI 엔지니어링" },
      { name: "AI Tidbits", sub: "Sahar Mor" },
    ],
  },
  {
    key: "community",
    name: "기관 · 연구 블로그",
    emoji: "🏛",
    count: 35,
    nature: "공식 · 1차 소스",
    value:
      "OpenAI, DeepMind, NVIDIA, MS Research 등 공식 블로그와 arXiv, HF Papers. 발표 원문 그 자체 — 변형 없는 ground truth.",
    color: "#7B5EA7",
    soft: "#F3EFFA",
    representatives: [
      { name: "OpenAI Blog" },
      { name: "Google DeepMind" },
      { name: "Google Research" },
      { name: "Microsoft Research" },
      { name: "NVIDIA Developer" },
      { name: "HuggingFace Blog & Daily Papers" },
      { name: "BAIR (Berkeley AI Research)" },
      { name: "MIT News" },
      { name: "arXiv" },
      { name: "ACL Anthology" },
      { name: "NeurIPS" },
      { name: "CVF Open Access" },
    ],
  },
  {
    key: "personal",
    name: "개인 블로그 · 기술 에세이",
    emoji: "✍️",
    count: 12,
    nature: "실무 깊이",
    value:
      "Chip Huyen, Karpathy 블로그 등 실무자 개인 사이트. 책 수준의 깊이를 무료로 — 증거 레이어의 핵심 자료.",
    color: "#3D3652",
    soft: "#F5F3F9",
    representatives: [
      { name: "Chip Huyen", sub: "huyenchip.com" },
      { name: "Andrej Karpathy", sub: "karpathy.github.io" },
      { name: "Philipp Schmid", sub: "philschmid.de" },
      { name: "Nathan Lambert", sub: "natolambert.com" },
      { name: "ByteByteGo", sub: "시스템 디자인" },
      { name: "David Stutz" },
    ],
  },
  {
    key: "reddit",
    name: "Reddit · 커뮤니티",
    emoji: "🗨",
    count: 10,
    nature: "현장 목소리",
    value:
      "LocalLLaMA, r/MachineLearning 등. 실제 사용자들이 뭘 돌리고, 뭘 실패하는지 — 도입 사례의 진짜 목소리.",
    color: "#D4854A",
    soft: "#FDF7EF",
    representatives: [
      { name: "r/LocalLLaMA" },
      { name: "r/machinelearningnews" },
      { name: "r/AiBuilders" },
      { name: "r/LanguageTechnology" },
      { name: "r/OpenAI" },
    ],
  },
  {
    key: "notion",
    name: "Notion DB",
    emoji: "🗂",
    count: 0,
    nature: "내부 · 리뷰 레이어",
    value:
      "리뷰 워크플로우의 단일 진실 공급원. 후보·승인 소스·뉴스 DB가 여기 산다. 지식팀이 AI 출력을 그 자리에서 교정하므로 큐레이션 품질이 매주 복리로 쌓인다.",
    color: "#7B5EA7",
    soft: "#F3EFFA",
    representatives: [],
  },
  {
    key: "dashboard",
    name: "대시보드",
    emoji: "📊",
    count: 0,
    nature: "내부 · 운영",
    value:
      "큐레이션이 제품이 되는 곳: 발행 상태, 스코어링 통계, KPI 트렌드. 루프를 닫는다 — 팀이 여기서 리뷰·승인한 것이 사용자가 읽는 그것이다.",
    color: "#2D7A5E",
    soft: "#EFF7F3",
    representatives: [],
  },
]

/** 총 구독 소스 수 (내부 레이어 제외) */
export const TOTAL_EXTERNAL = SOURCE_GROUPS.reduce((s, g) => s + (g.key === "notion" || g.key === "dashboard" ? 0 : g.count), 0)
