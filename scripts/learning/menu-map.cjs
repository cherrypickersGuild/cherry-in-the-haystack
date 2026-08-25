/* UI 메뉴 ↔ 온톨로지 노드 매핑 — 단일 정본 (공유 모듈)
   ⚠️ 이 매핑은 원래 4곳에 각자 하드코딩돼 있었다:
        apps/web/app/page.tsx · build-researcher-json.cjs · content-status.cjs · validate-researcher-json.cjs
      2026-08-25 에 프론트만 고쳤더니 나머지가 옛 노드(HybridRetrieval · Embedding)를 가리킨 채 남아
      리서처 JSON 의 pageType 이 틀리게 나왔다.

   → 정본은 **`apps/web/app/page.tsx` 의 CONCEPT_NODE_BY_TOPIC 하나**다.
     화면이 실제로 쓰는 것이 정본이어야 어긋날 수 없다. 여기서는 그것을 읽기만 한다.

   라벨은 사이드바(`components/cherry/sidebar.tsx`)에서 읽는다. */
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "../..");

/** page.tsx → [{ topic, node, section }] · 실패하면 null (호출부가 판단한다) */
function uiTopics() {
  try {
    const src = fs.readFileSync(path.join(ROOT, "apps/web/app/page.tsx"), "utf8");
    const block = src.match(/const CONCEPT_NODE_BY_TOPIC[^{]*\{([\s\S]*?)\n\}/);
    if (!block) return null;
    const found = [...block[1].matchAll(/"([\w-]+)":\s*\{\s*node:\s*"(\w+)",\s*section:\s*"(\w+)"/g)]
      .map((m) => ({ topic: m[1], node: m[2], section: m[3] }));
    return found.length ? found : null;
  } catch { return null; }
}

/** sidebar.tsx → { topicId: 라벨 } */
function uiLabels() {
  try {
    const src = fs.readFileSync(path.join(ROOT, "apps/web/components/cherry/sidebar.tsx"), "utf8");
    const out = {};
    for (const m of src.matchAll(/\{\s*id:\s*"([\w-]+)",\s*label:\s*"([^"]+)"\s*\}/g)) out[m[1]] = m[2];
    return out;
  } catch { return {}; }
}

/** 노드 → [section, 라벨] — build-researcher-json 의 MENU 상수를 대체한다 */
function menuByNode() {
  const ui = uiTopics(); if (!ui) return null;
  const labels = uiLabels();
  const out = {};
  for (const t of ui) out[t.node] = [t.section, labels[t.topic] || t.topic];
  return out;
}

/** [section, 라벨, topicId, node][] — content-status 의 TOPICS 상수를 대체한다 */
function topicRows() {
  const ui = uiTopics(); if (!ui) return null;
  const labels = uiLabels();
  return ui.map((t) => [t.section, labels[t.topic] || t.topic, t.topic, t.node]);
}

module.exports = { uiTopics, uiLabels, menuByNode, topicRows };
