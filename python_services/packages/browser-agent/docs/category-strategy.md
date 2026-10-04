# 카테고리 분류 전략 (Category Strategy)

> 목적: 수집한 기사를 cherry의 **page / entity / category** 에 배정하는 방식을,
> **LLM 최소화 · 룰 우선(site-based)** 으로 정리한 전략 문서.
> 관련: [classification-redesign.md](classification-redesign.md), [llm-provider-plan.md](llm-provider-plan.md)

---

## 0. 한 줄 요약

**page는 URL(사이트)로 룰 결정 → 그 page의 소수 후보 중 entity만 뽑으면 → category는 DB에서 자동 결정.**
대부분의 소스에서 **LLM 호출 0회**로 분류가 끝난다. 여러 page에 걸쳐 섞이는 소스는 **애초에 수집 대상에서 제외**한다.

---

## 1. cherry 데이터 모델 (전제)

```
tracked_entity (48)  ──placement──▶  entity_page + entity_category
     │
     └─ curated_article: article_raw_id + tracked_entity_id + side_category_id(옵션)
                          → page는 tracked_entity의 placement로 결정됨 (curated_article에 page 컬럼 없음)
```

- **entity_page** (9종): FRAMEWORKS, MODEL_UPDATES, CASE_STUDIES, THIS_WEEKS_POSTS, TOOLS, BIG_TECH_TRENDS, PAPER_BENCHMARK, SHARED_RESOURCES, REGULATIONS
- **entity_category**: 각 page 안의 세부 카테고리 (예: FRAMEWORKS → agent/rag/prompt-eng…)
- **side_category**: 글의 성격(CASE_STUDY / APPLIED_RESEARCH). **CASE_STUDIES page에서만 사용**, 다른 page는 미사용.

---

## 2. 핵심 검증 결과 (실측)

### 검증 ①: (entity, page) → category 유일
```sql
-- (entity, page)당 category가 2개 이상인 조합
→ 0건  →  ✅ 유일
```
**의미**: page가 고정되고 entity가 정해지면 **category는 결정론적 조회로 자동 확정**. 별도 분류 불필요.

### 검증 ②: page당 entity 후보 수 (page 고정 시 후보군)
| page | entity 후보 | category |
|------|:---:|:---:|
| FRAMEWORKS | 24 | 8 |
| CASE_STUDIES | 7 | 4 |
| MODEL_UPDATES | 7 | 7 |
| THIS_WEEKS_POSTS | 5 | 2 |
| TOOLS | 4 | 2 |
| PAPER_BENCHMARK | 4 | 3 |
| BIG_TECH_TRENDS | 4 | 1 |
| SHARED_RESOURCES | 3 | 2 |
| REGULATIONS | 2 | 1 |

**의미**: page를 URL로 고정하면 entity 후보가 **2~24개(대개 소수)** 로 줄어 → 룰 매칭만으로 거의 확정 가능.

---

## 3. 분류 전략

### 3.1 원칙
1. **page = URL(사이트) 기반 룰.** 사이트가 곧 page를 결정한다 (예: `crewai.com/case-studies` → CASE_STUDIES).
2. **entity 추출만이 유일한 실제 과제.** page가 고정되면 후보가 소수라 룰로 대부분 해결.
3. **category는 자동.** (entity, page) → entity_category 는 DB 조회.
4. **side_category는 CASE_STUDIES에서만.** 그 외 page는 null.
5. **여러 page에 걸쳐 섞이는 소스는 수집 제외.** site-based 룰이 항상 성립하도록.
6. **기존 news_agent의 무거운 가드레일/QA는 걷어냄.** "실수 방지" 중심이 아니라 "entity 정확 추출" 중심.

### 3.2 파이프라인
```
① url → page                      (source_meta_json의 site-based 룰)
② page == CASE_STUDIES 이면        → side_category 결정 (CASE_STUDY / APPLIED_RESEARCH)
   그 외                            → side_category = null
③ page → 후보 entity               (DB: 해당 page에 placement된 entity만, 2~24개)
④ article ↔ 후보 매칭              (entity_match_score 룰: 이름/토큰 겹침 점수)
     ├─ 1위 점수 압도적            → entity 확정            [LLM 0회]
     └─ 애매(점수 근접)            → 후보 소수만 Qwen에 전달 → 1개 선택  [작은 LLM 1회]
⑤ (entity, page) → entity_category (DB 조회, 자동)
⑥ curated_article 저장 (review_status='pending')
```

### 3.3 entity 매칭 룰 (news_agent에서 포팅)
`entity_match_score(article, entity)` — 순수 문자열/토큰 매칭:
```
name이 title에 포함        +20
name이 summary에 포함      +12
name이 content에 포함      +10
토큰겹침 name∩title ×4 / name∩summary ×3 / name∩content ×2
```
→ page 후보(소수)에 대해 점수 계산 → 1위와 2위 격차가 크면 룰 확정, 아니면 LLM.

---

## 4. 토큰 절감 효과

| | 기존 news_agent | 본 전략 |
|---|---|---|
| page 결정 | LLM(entity_classifier) | **URL 룰 (0토큰)** |
| entity 결정 | LLM (48개 중) | **룰 매칭 (page 후보 소수), 애매할 때만 LLM** |
| category 결정 | LLM | **DB 자동조회 (0토큰)** |
| LLM 호출/기사 | 4회 (gpt-4.1) | **0~1회 (Qwen 로컬, 무료)** |

→ 대부분 기사에서 **LLM 0회**. 섞임 소스 제외로 애매 케이스도 최소화.

---

## 5. 소스 → page 매핑 (테스트 URL 기준)

### ✅ 수집 대상 (사이트=page 하나)
| URL | page | side_category |
|-----|------|---------------|
| crewai.com/case-studies | CASE_STUDIES | CASE_STUDY |
| reddit r/PromptEngineering | THIS_WEEKS_POSTS (community) | — |
| reddit r/LocalLLaMA | THIS_WEEKS_POSTS (community) | — |
| importai.substack | THIS_WEEKS_POSTS (blog) | — |
| swyx.io/rss | THIS_WEEKS_POSTS (blog) | — |
| github langchain/discussions | THIS_WEEKS_POSTS (community) | — |
| modelcontextprotocol.io | FRAMEWORKS / SHARED_RESOURCES (확정 필요) | — |
| promptingguide.ai | SHARED_RESOURCES (tutorial) | — |

### ❌ 수집 제외 (여러 page에 걸쳐 섞임)
| URL | 제외 이유 |
|-----|-----------|
| hn.algolia (MCP 검색) | 모델·프레임워크·논문 등 여러 page 주제 혼재 |
| mdskills.ai | 구조 미상 → 확인 전 보류 |

---

## 6. 저장 방식

- URL→page 매핑은 **`content.source.source_meta_json`(jsonb)** 에 소스별로 저장:
  ```json
  { "entity_page": "CASE_STUDIES", "side_category": "CASE_STUDY" }
  ```
- 마이그레이션 불필요(기존 컬럼 활용). Notion 소스 동기화 시 함께 채움.

---

## 7. 열린 항목 (확정 필요)

1. **entity 매칭 임계값** — "1위 압도적"의 기준(예: 1위-2위 점수차 ≥ N, 또는 1위 ≥ M). 이 값에 따라 LLM 호출 빈도 결정.
2. **side_category 결정 방식** — CASE_STUDIES에서 CASE_STUDY vs APPLIED_RESEARCH를 룰(키워드)로 할지 소스 고정할지.
3. **일부 소스 page 확정** — modelcontextprotocol.io, promptingguide.ai (FRAMEWORKS vs SHARED_RESOURCES).
4. **Notion 카테고리 문서 반영** — `hkjeong.notion.site` Cherry Category 문서의 정의를 카테고리/키워드 룰에 반영.
5. **매칭 실패 시** — 후보 중 확신 없으면 `tracked_entity_id=null`로 pending (자동 생성 안 함).

---

## 8. 관련 문서
- [classification-redesign.md](classification-redesign.md) — 룰+최소LLM 재설계 (기존 news_agent 분석 포함)
- [llm-provider-plan.md](llm-provider-plan.md) — Claude/Qwen provider 선택 구조 (classify=Qwen 확정)
