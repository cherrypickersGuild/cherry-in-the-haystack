# GraphDB 마이그레이션·동기화 — 진행 로그

| 날짜 | 단계 | 내용 | 결과 |
|---|---|---|---|
| 2026-08-19 | Phase 0 | 기획 폴더 개설, 지침·구현서·검수표 작성 | 착수 대기(갈림길 G1~G4 미결) |

## 결정 이력
| 날짜 | 내용 |
|---|---|
| 2026-08-19 | 관계 저장소 = **Postgres**(안 가) 채택. GraphDB 호스팅 부재가 근거 |
| 2026-08-19 | 3모드 전환 구조 + `CONCEPT_RELATION_SOURCE` env 채택(관리자 UI 는 후속) |
| 2026-08-19 | 온톨로지 id 를 `handbook.concept.meta_json` 에 보존하기로 — 전환 시 이름 매칭 불가(라벨 불일치 실측) |

## 실측 근거 (2026-08-19)
- GraphDB: 개념 302 · 관계(subClassOf) 301 · 설명 308행 · 트리플 1,220 · 단일 루트 `LLMConcept` · 최대 깊이 6
- Postgres: `handbook.concept`/`concept_alias`/`topic`/`subtopic`/`paragraph_concept_link` **전부 0행**, `paragraph_chunk` 3,054행
- ⚠️ `uq_concept_alias_text_ci_active` = `lower(alias_text)` **전역 유니크** (개념별 아님)
- ⚠️ 라벨 2개 보유 클래스: `Alignment`, `InferenceOptimization`
