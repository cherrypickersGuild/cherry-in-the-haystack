# Cherry Platform 데이터 아키텍처 변경 요약

> 비교 기준: `schema.md` (v1.10) → `data-architecture.md` (현행)
> 기술 파트너 공유용 — 2026-03-19

---

## 레이어 구조 한눈에 보기

| 레이어       | 이전 (v1.10)                 | 현행                                  |
| --------- | -------------------------- | ----------------------------------- |
| 테넌트 루트    | `company` + `user_account` | `user` 단일 테이블                       |
| 기사 파이프라인  | `company_*` prefix         | `user_*` prefix                     |
| 엔티티 레지스트리 | 없음                         | **신설** (`tracked_entities`)         |
| 개인화 레이어   | 없음                         | **신설** (follow/preference/evidence) |
| 웹앱 읽기 레이어 | 스냅샷 4종                     | 스냅샷 11종으로 확장                        |
| 뉴스레터 레이어  | 전사 공용                      | ENTERPRISE tier 전용으로 격리             |

---

## 주요 변경사항

### 1. 테넌트 모델 전환 (가장 큰 변경)

**`company` + `user_account` → `user` 단일 테이블로 통합**

이전에는 `company`가 최상위 테넌트였고 `user_account`가 그 하위 직원 계정이었습니다. 현행 구조에서는 `user` 하나가 테넌트 루트이며, `subscription_tier` (`FREE` | `PAID` | `ENTERPRISE`)로 기능을 게이팅합니다.

- Magic link 인증 컬럼이 `user_account`에서 `user`로 이동
- 모든 테이블의 `company_id` FK가 `user_id`로 교체됨
- **주의:** `company_source_follow_cfg` → `user_source_follow_cfg`, `company_article_state` → `user_article_state` 등 전반적인 테이블/컬럼명 변경

### 2. `source` 테이블에 헬스 트래킹 추가

이전 스키마에는 없었던 크롤러 상태 관리 컬럼이 `source` 테이블에 직접 추가되었습니다.

```
last_fetched_at, last_success_at, last_error_at, last_error_msg
consecutive_failures, total_fetches, total_failures, is_healthy
```

`consecutive_failures`가 임계값(예: 3)에 도달하면 `is_healthy = FALSE`로 전환됩니다. 어드민 UI에서 `WHERE is_healthy = FALSE`로 바로 조회 가능합니다.

또한 커뮤니티가 소스를 제안하는 `source_submission` 테이블이 신설되었습니다.

### 3. Entity Registries 레이어 신설 (완전 신규)

이전에는 없던 레이어입니다. KT가 추적하는 모든 대상(Model, Framework, Benchmark, Dataset, Tool, Agent, Prompt, MCP)을 `tracked_entities` 단일 테이블에 통합 관리합니다.

```sql
type CHECK (type IN ('Model','Framework','Benchmark','Dataset','Tool','Agent','Prompt','MCP'))
```

타입별 메타데이터는 `meta_json`으로 유연하게 처리하며, `is_spotlight` 플래그(타입당 최대 1개)로 스포트라이트 엔티티를 지정합니다.

통계 지원용 테이블도 함께 신설:
- `entity_stats_snapshot`: 엔티티별 일별 GitHub stars + 키워드 멘션 수
- `keyword_stats_snapshot`: 키워드 일별 빈도 스냅샷 (트렌딩 키워드, Rising Star 계산 원천)

### 4. Personalization 레이어 신설 (완전 신규)

PAID/ENTERPRISE 사용자 전용. 아래 5개 테이블이 신설되었습니다.

| 테이블                                                              | 역할                                              |
| ---------------------------------------------------------------- | ----------------------------------------------- |
| `user_entity_follow`                                             | 엔티티(모델, 프레임워크 등) 팔로우 및 가중치                      |
| `user_category_follow_cfg`                                       | 카테고리 그룹/카테고리 팔로우 및 가중치                          |
| `user_scoring_preference`                                        | 자연어 입력 → AI 해석 가중치 (`interpreted_weights_json`) |
| `user_digest_preference`                                         | Top N 표시 설정 (기본값 20)                            |
| `user_concept_evidence_selection` + `user_concept_evidence_item` | 개념 페이지 증거 큐레이션                                  |
|                                                                  |                                                 |

최종 점수 계산 공식이 변경되었습니다:

> **이전:** `final_score = ai_score × source_weight`
> **현행:** `final_score = ai_score × source_weight × entity_weight`

### 5. `paragraph_chunks`의 개념 연결 구조 변경 (1:1 → 1:N)

이전에는 `paragraph_chunks`에 `idea_group_id`, `extracted_concept`, `extraction_confidence` 컬럼이 직접 존재했습니다(하나의 단락에 개념 1개).

현행에서는 해당 컬럼들이 `paragraph_chunks`에서 제거되고 `paragraph_concept_links` 별도 테이블로 분리되었습니다. 하나의 단락에 여러 개념을 연결할 수 있으며, `is_primary` 플래그로 주 개념과 부 개념을 구분합니다.

**Writer Agent 쿼리 패턴 변경 필수:**
- 기존: `paragraph_chunks WHERE extracted_concept = ?`
- 현행: `paragraph_concept_links WHERE extracted_concept = ? → JOIN paragraph_chunks`

### 6. `prompt_template`의 scope 값 변경

| 이전        | 현행         |
| --------- | ---------- |
| `HQ`      | `PLATFORM` |
| `COMPANY` | `USER`     |

이전에는 NULL 처리 우회용 computed column `company_id_key`가 존재했으나 제거되었습니다.

### 7. Weekly Stat Snapshot이 플랫폼/개인으로 분리

이전의 `highlight_weekly_stat_snapshot`은 고객사(company) 단위였습니다. 현행에서는 두 가지로 분리됩니다:

- `platform_weekly_stat_snapshot`: 플랫폼 전체 기준, 공개 Newly Discovered 페이지용 (신설)
- `highlight_weekly_stat_snapshot`: 개인(user) 단위, PAID 사용자 대시보드용

### 8. `model_update_weekly_stat_snapshot` 컬럼명 수정

| 이전                          | 현행                       |
| --------------------------- | ------------------------ |
| `lanked_category_json` (오타) | `ranked_category_json`   |
| `tracked_company_count`     | `tracked_category_count` |
| `rising_star_json`          | `spotlight_json`         |

### 9. Webapp Read Layer에 신규 테이블 추가

| 테이블                                        | 역할                                                  |
| ------------------------------------------ | --------------------------------------------------- |
| `curated_articles`                         | KT 리뷰 기사 (Notion 동기화, 웹앱 콘텐츠 원천)                    |
| `newly_discovered_category_snapshot`       | 커뮤니티 Newly Discovered 페이지 스냅샷                       |
| `user_newly_discovered_page`               | 개인화 Newly Discovered 페이지 (Writer Agent 없음, 필터+리랭크만) |
| `concept_pages` + `concept_page_changelog` | Writer Agent 생성 개념 페이지 및 변경 이력                      |
| `user_concept_page`                        | 개인화 개념 페이지 (PAID, evidence selection 기반)            |

### 10. `recipient` 테이블이 Newsletter 레이어로 이동

이전에는 `company` / `user_account`와 동급으로 상단부에 위치했습니다. 현행에서는 Newsletter/Distribution 레이어 안으로 이동하고 ENTERPRISE tier 전용으로 명시적으로 격리되었습니다.

---

## 개발 시 반드시 확인할 크로스 레이어 연결 포인트

| 연결                                                                                                      | 방향                       |
| ------------------------------------------------------------------------------------------------------- | ------------------------ |
| GraphDB `rdfs:label` = `idea_groups.canonical_idea_text` = `paragraph_concept_links.extracted_concept`  | GraphDB ↔ Postgres 핵심 연결 |
| `curated_articles.score >= 4` 만 웹앱에 노출 (`review_status = 'Published'`도 동시 충족 필요)                        | Notion ↔ Webapp          |
| Webapp Read Layer는 배치 잡이 쓰고, 웹앱은 읽기만 함. 웹앱 write path 없음                                                | 읽기/쓰기 책임 분리              |
| `discovered_at`(≠ `published_at`)이 모든 KPI의 기준                                                           | 통계 집계 기준                 |
| `user_concept_evidence_item`은 `paragraph_chunks`(Books 파이프라인)와 `user_article_state`(News 파이프라인) 두 곳을 참조 | 증거 큐레이션                  |
