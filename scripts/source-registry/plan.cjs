/* 노션 → DB 이관 계획 (공유 정의 · 단일 정본)
   precheck / import / verify 가 **이 파일 하나**만 본다.
   셋이 각자 목록을 들고 있으면 반드시 어긋난다.

   기획: apps/docs/source-registry/1-work-guidelines.md §5
   결정: D9(값을 안 고친다) · D12(11개 표 전부) · D15(분류는 원본 그대로)
*/

/** 노션 내보내기 폴더. `--dir` 로 바꿀 수 있다. */
const DEFAULT_DIR = require("os").homedir() + "/Downloads";

/** 파일은 반드시 `_all.csv` 를 쓴다 — 아카이브가 9칼럼 vs 33칼럼으로 갈린다(기획 §5). */
const TABLES = [
  { key: "substack",   label: "서브스택",   file: "Data Sources (Substack)",  url_field: "substack" },
  { key: "candidates", label: "발굴 후보",  file: "Data Source Candidates",   url_field: "url" },
  { key: "twitter",    label: "트위터",     file: "Data Sources (Twitter)",   url_field: "twitter" },
  { key: "linkedin",   label: "링크드인",   file: "Data sources (Linkedin)",  url_field: "linkedin" },
  { key: "youtube",    label: "유튜브",     file: "Data sources (Youtube)",   url_field: "youtube" },
  { key: "etc",        label: "기타 크롤",  file: "Data sources (ETC Custom Crawl)", url_field: "url" },
  { key: "reddit",     label: "레딧",       file: "Data sources (Reddit)",    url_field: "reddit" },
  { key: "email",      label: "이메일 구독", file: "Data sources (Email-subscribed, non-substack)", url_field: "url" },
  { key: "threads",    label: "스레드",     file: "Data sources (Threads)",   url_field: "threads" },
  { key: "medium",     label: "미디엄",     file: "Data Sources (Medium)",    url_field: "medium" },
  { key: "archive",    label: "아카이브",   file: "Archive - Who to Follow in AI", url_field: "url" },
];

/**
 * 머리줄 → 칼럼 이름 대응표 (기획 §5).
 * 표기가 흔들리는 것(`Why I Follow` · `Why I follow` · `Why I follow `)을 여기서 하나로 모은다.
 *
 * ⚠️ 플랫폼 이름 칼럼(`Substack`·`LinkedIn`…)은 **합치지 않는다.**
 *    아카이브 표에는 그것들이 각각 따로 있다 — 합치면 칼럼 5개가 사라진다.
 */
const HEADER_MAP = {
  "name": "name", "website name": "name",
  "url": "url",
  "cherry category": "category",
  "why i follow": "why_follow",
  "reviewer notes": "reviewer_note", "review notes": "reviewer_note",
  "comment": "comment",
  "담당자": "owner",
  "created by": "created_by",
  "top audience": "audience",
  "follow": "follow",
  "twitter handle": "twitter", "twitter/x": "twitter",
  "subscribers (est.)": "subscribers",
  "discovered at": "discovered_at",
  "reviewed at": "reviewed_at",
  "reviewed by": "reviewed_by",
  "site last updated": "site_updated_at",
  "url (medium)": "medium",
  "sample content": "sample",
  "final score": "score",
  "targets": "audience",
};

/** ① 앞뒤 공백 떼고 소문자 ② 대응표 ③ 없으면 영숫자만 남기고 _ */
function fieldKey(header) {
  const k = String(header).trim().toLowerCase();
  if (HEADER_MAP[k]) return HEADER_MAP[k];
  return k.replace(/[^a-z0-9]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
}

/** 화면에 보이는 이름. 한글 머리줄은 그대로, 영문은 우리 말로 바꾼다. */
const LABEL = {
  name: "이름", url: "주소", category: "분류", why_follow: "왜 보나",
  reviewer_note: "검토 메모", comment: "코멘트", owner: "담당", created_by: "만든 사람",
  audience: "독자", follow: "수집", twitter: "트위터", subscribers: "구독자(추정)",
  discovered_at: "발굴 시각", reviewed_at: "검토 시각", reviewed_by: "검토자",
  site_updated_at: "사이트 갱신", medium: "미디엄", sample: "샘플 글", score: "점수",
  substack: "서브스택", linkedin: "링크드인", youtube: "유튜브", threads: "스레드",
  reddit: "레딧", website: "웹사이트", rss_feed: "RSS", status: "상태", priority: "우선순위",
  type: "종류", reason: "발굴 사유",
};

/** 칼럼 종류 (기획 D4 · 여섯 가지) */
const URLISH = ["url", "substack", "linkedin", "youtube", "threads", "reddit", "medium", "website", "rss_feed", "blog", "podcasts", "newsletters"];
const LONGISH = ["reviewer_note", "comment", "sample", "quote", "why_i_follow", "noteable_works"];
const DATEISH = ["discovered_at", "reviewed_at", "site_updated_at"];
const SELECTISH = ["follow", "status", "priority", "type", "owner", "created_by", "reviewed_by"];

function fieldKind(key) {
  if (key === "category") return "multi";     // 분류는 여러 개 붙는다 (D15)
  if (URLISH.includes(key)) return "url";
  if (LONGISH.includes(key)) return "long";
  if (DATEISH.includes(key)) return "date";
  if (SELECTISH.includes(key)) return "select";
  return "text";
}

/** 분류 선택지에 기본으로 깔아 둘 표준값 = 앱 메뉴 id (기획 §5 · D15) */
const STANDARD_CATEGORIES = [
  "model-updates", "papers", "benchmarks-datasets", "frameworks", "prompting", "dev-tools",
  "building-blocks", "case-studies", "domain-applications", "product-discovery",
  "insights-opinions", "big-tech-trends", "market-investment", "technical-deep-dives",
  "regulations-policy-compliance", "community",
];

module.exports = { DEFAULT_DIR, TABLES, HEADER_MAP, LABEL, fieldKey, fieldKind, STANDARD_CATEGORIES };
