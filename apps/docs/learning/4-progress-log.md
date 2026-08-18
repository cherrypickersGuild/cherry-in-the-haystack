# Learning 구현 — 진행 로그

> 개념 1개가 완료(`ontology-gap/README.md` §6 DoD 6단계)될 때마다 **한 줄**씩 남긴다.
> 상세는 각 갭 문서(`ontology-gap/<slug>.md`)에 있으므로 여기엔 요약만.

| 날짜 | 개념(slug) | 화면 | 갭 문서 | 주요 갭 | 비고 |
|---|---|---|---|---|---|
| 2026-08-19 | `rag` | 목업 + 실화면(JSON 구동) | `ontology-gap/index.html` | MISSING_NODE 3(Reranking·Contextual Retrieval·GraphRAG) · LABEL_ALIAS 3 | 체리 7 · 하위 9 · 참고 4 |
| 2026-08-19 | `embeddings` | 목업 + 실화면(JSON 구동) | `ontology-gap/index.html` | MISSING_NODE 1(Reranking **2회차**) · MISSING_RELATION 3 | 체리 5 · 하위 9 · 참고 4 |

---

## 방향 전환·결정 이력

| 날짜 | 내용 |
|---|---|
| 2026-08-16 | Learning 기획 폴더 개설(번호식 3종) — **정방향**(DB→화면) 전제 |
| 2026-08-19 | GraphDB 호스팅 부재 확인(작성자 정한결) · 로컬 기동 검증 성공(302개, 트리플 1,220) · handbook evidence 0행 확인 |
| 2026-08-19 | **방향 전환 — 역순**(화면·콘텐츠 → 퍼블리싱 → DB 역주입). 조건 C1~C6 확립 |
| 2026-08-19 | 갈림길 결정: G1 `infer=false`(직속만) · G2 JSON `ontologyNode` 매핑만 · G3 `.env` 전용 정리 · G4 AI 초안 + 담당자 검수 |
| 2026-08-19 | **목표 ② 추가** — GraphDB 보완 명세서 산출을 화면 퍼블리싱과 **동등한 목표**로 격상. 갭 문서 생성을 C6로 강제 |
