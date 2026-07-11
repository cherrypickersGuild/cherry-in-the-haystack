# 기사 분류(Classification) 재설계 리포트

> 목적: 기존 `news_agent`(feat/agent-news)의 기사 분류 방식을 분석하고,
> **룰베이스 + 꼭 필요한 부분만 LLM** 으로 재설계하여 **browser-agent에 통합**하기 위한 설계 문서.
> 작성 기준 브랜치: `origin/feat/agent-news` (분석 대상), `feature/browser-agent` (통합 대상).

---

## 0. 한 줄 요약

기존 news_agent은 **기사 1건당 LLM 4회 호출(gpt-4.1)** + **본문 3중 전송**으로 토큰을 과하게 씁니다.
분류 로직에 필요한 **룰베이스 재료는 이미 대부분 구현**되어 있으므로, 이를 재사용해
**"룰이 확신하면 LLM 0회, 애매할 때만 Haiku 1회"** 구조로 바꾸면 토큰을 **수십 배** 절감하면서
별도 서비스 없이 browser-agent 안에서 처리할 수 있습니다.

---

## 1. 분류가 만들어야 하는 것 (cherry 데이터 모델)

수집된 기사(`article_raw`)를 cherry 페이지에 노출하려면 `curated_article` 행이 필요하고,
그 행이 요구하는 분류 결과는 다음과 같다:

| 필드 | 의미 | 결정 방법 |
|------|------|-----------|
| `tracked_entity_id` | 어떤 엔티티(48개 중) — **page는 이 엔티티의 placement로 자동 결정** | 룰 후보필터 → (애매하면) LLM |
| `side_category_id` | 글의 종류 (CASE_STUDY, APPLIED_RESEARCH…) | 키워드 룰 → (애매하면) LLM |
| `score` | 중요도 1–5 | 휴리스틱 → (고가치만) LLM |
| `summary` | AI 요약 1–2문장 | LLM (짧게) |
| `tags` | 태그 | 룰/LLM |

> 핵심: **page는 직접 고르지 않는다.** `tracked_entity` → `tracked_entity_placement.entity_page` 로 따라온다.

---

## 2. 기존 news_agent 동작 분석

### 2.1 실행 스택
- **Provider**: OpenAI Agents SDK (`from agents import Agent, Runner, OpenAIProvider`)
- **모델**: `gpt-4.1` (env `OPENAI_MODEL`, 기본값 하드코딩) — **모든 단계 동일 모델, 티어링 없음**
- **키**: `OPENAI_API_KEY`
- 진입점: `run_article_assessment_debug()` (`run_news_agent.py:1858`)
- 엔티티/카테고리 출처: 외부 HTTP API `https://api.solteti.site /api/agent/ask-evaluation` (`solteti_agent_api.py`)

### 2.2 4-에이전트 체인 (표준 모드 = LLM 4회)

| 순서 | 에이전트 | 하는 일 | 호출 위치 |
|------|----------|---------|-----------|
| 1 | `entity_classifier` | allowed_entities 중 representative_entity + candidates + side_category 선택 | `:1948` |
| 2 | `content_scorer` | ai_summary, ai_score(1–5), 세부점수, snippets | `:1984` |
| 3 | `evidence_extractor` | tags, evidence_items, 구조화 추출 (grounding_chunks 사용) | `:1985` |
| 4 | `assessment_qa` | 위 3단계 출력 + 본문 + 엔티티목록을 **전부 받아** 최종 계약 JSON 생성 | `:2000` |

- 실제 API 호출: `runner.run_sync(agent, request_json)` (`:1807`)
- **재시도**: 단계별 검증 실패 2회 + 429 재시도 3회 → 최악 **기사당 4–8회**
- compact 모드(짧은 기사): scorer·evidence를 파이썬 휴리스틱으로 대체 → **LLM 2회** (`:1969-1982`)

### 2.3 🔴 토큰 낭비 지점 (측정 근거)

1. **본문 3중 전송** — article 객체에 본문이 세 벌 들어가고, **매 단계 입력에 통째로 포함** (`:1898-1900`):
   ```python
   "content_raw": model_content,          # 6000자 truncate
   "content_raw_full": cleaned_content,   # 전체 본문 (truncate 안 함)
   "content_raw_original": raw_content,   # 원본 HTML (truncate 안 함)
   ```
   → `content_raw_full`, `content_raw_original`이 truncate 없이 4단계 × 전송.
2. **assessment_qa 재전송** — 본문 + 앞 3단계 출력 JSON을 다시 전부 전송 (`:1987-1999`).
3. **allowed_entities** — 완화되어 있으나(§2.4) 여전히 page/category/id/name 4-튜플로 전달.
4. few-shot 예시는 없음 (지시문만).

### 2.4 이미 존재하는 룰베이스 (★ 재사용 대상)

news_agent은 순수 LLM이 아니라 **룰이 게이팅·사전필터·사후검증**을 하는 하이브리드다:

| 룰 로직 | 함수 | 위치 | 재사용 가치 |
|---------|------|------|:---:|
| 품질 판정(standard/compact/reject) | `build_article_quality_profile` | `:738` | ★★★ |
| 짧은 글 compact fast-path (LLM 2개 스킵) | `compact_fast_path` | `:1969` | ★★★ |
| 엔티티 후보 사전필터(≤12) | `entity_match_score`, `shrink_allowed_entities_for_article` | `:896`, `:925` | ★★★ |
| side_category 키워드 추론 | `infer_side_category_code` | `:1032` | ★★★ |
| 엔티티 환각 방지(allowed id 강제) | `resolve_representative_entity` | `:936` | ★★★ |
| grounding chunk 선택(토큰겹침) | `build_grounding_chunks` | `:847` | ★★ |
| 결과 결정론적 정규화/폴백 | `normalize_article_assessment_output` | `:1303` | ★★★ |
| 휴리스틱 점수 | `compact_heuristic_score` | `:1203` | ★★ |

> 결론: **"룰베이스 + 최소 LLM"의 부품은 이미 있다.** 문제는 표준 모드가 이 부품 위에
> 4-LLM 체인을 얹어서 무겁다는 것. 우리는 **부품만 가져오고 체인은 버린다.**

### 2.5 출력/검증
- 계약 v0.3 (`article_assessment_contract.py`): representative_entity(id는 allowed 필수), ai_score(1–5),
  ai_classification_json(final_path+candidates+decision_reason), side_category_code 등 11개 top-level key.
- LLM 출력은 **최종으로 신뢰하지 않음** — `normalize_article_assessment_output`이 전 필드를 재구성/클램프/폴백.

---

## 3. 재설계: 룰베이스 + 최소 LLM (browser-agent 통합안)

### 3.1 설계 원칙
1. **룰이 확신하면 LLM을 부르지 않는다** (known source, 지배적 엔티티 매칭, 명확한 side_category).
2. **LLM은 애매한 케이스에서 딱 1회** — Claude **Haiku**, 작은 페이로드.
3. **본문은 1회만, truncate해서** 전송 (3중 전송 폐기).
4. **엔티티는 shortlist(≤5)만, `{id, name}`만** 전송 (page/category는 결정론적으로 재부착).
5. **점수·요약을 제외한 대부분은 룰**로 처리, LLM 출력은 파이썬이 검증·정규화.

### 3.2 파이프라인 (제안)

```
수집 item (title, body, url)                     [browser-agent가 이미 생산]
        │
[R1] 소스 기본값 룰
     source → 기본 page/side_category (예: CrewAI case-studies → CASE_STUDY)
        │
[R2] 엔티티 후보 사전필터 (룰)
     title+body ↔ 48개 tracked_entity 이름 토큰겹침 점수 → 상위 ≤5
        │
        ├─ 1위가 압도적(margin 큼) & side_category 키워드 명확 ──▶ [확정, LLM 0회]
        │
        └─ 애매함 ──▶ [L1] LLM 1회 (Haiku)
                       입력: title + 본문(truncate 1회) + 후보 ≤5개{id,name} + side_category 목록
                       출력: {entity_id, side_category_code, score, summary, tags, confidence}
        │
[R3] 결정론적 정규화 (룰)
     entity_id → allowed 검증 후 page/category 재부착, score 1–5 클램프, 폴백
        │
curated_article 저장 (review_status='pending')   [별도 단계]
```

### 3.3 LLM 호출 비교

| | 기존 news_agent | 재설계안 |
|---|---|---|
| Provider/모델 | OpenAI gpt-4.1 | Anthropic **Haiku** (기존 키 재사용) |
| 기사당 LLM 호출 | 4회 (재시도 시 4–8) | **0~1회** |
| 본문 전송 | 3중 × 4단계 | 1회 truncate |
| 엔티티 페이로드 | ≤12개 × 4-튜플 | ≤5개 × `{id,name}` |
| 별도 서비스 | 필요 (포트 8787 + solteti API) | **불필요** (browser-agent 내부) |

> 대략 추정: 기사당 토큰 **수십 배↓**, 룰 확신 케이스는 **LLM 비용 0**.
> (gpt-4.1 4회 → Haiku 0~1회이므로 provider 단가차까지 겹쳐 절감폭이 큼.)

### 3.4 browser-agent 통합 방법
- `run-all`에 옵션 단계 `classify`(기본 off) 또는 별도 엔드포인트 `POST /crawler/classify`.
- 참조 데이터는 **DB에서 직접** 조회 (이미 추가한 `get_curation_reference()` 활용) — solteti 외부 API 불필요.
- LLM은 기존 `ANTHROPIC_API_KEY` + Haiku 사용.
- 룰 함수들은 news_agent 로직을 **포팅**(참고)해 browser-agent에 경량 구현.

---

## 4. news_agent에서 "참고"할 것 vs "버릴 것"

| 가져온다 (참고) | 버린다 |
|---|---|
| 엔티티 사전필터(`entity_match_score`) | 4-에이전트 체인 |
| side_category 키워드 룰(`infer_side_category_code`) | assessment_qa 재전송 |
| 엔티티 환각방지/정규화(`resolve_*`, `normalize_*`) | 본문 3중 전송 |
| 품질 게이팅 / compact 아이디어 | OpenAI Agents SDK 의존 |
| 계약 필드 스키마(무엇을 채워야 하는지) | 외부 solteti API 의존 |

---

## 5. 열린 결정 (구현 전 확정 필요)

1. **점수(score)**: 완전 휴리스틱 vs LLM 1회에 포함? (권장: LLM 부를 때 같이 받고, 안 부르면 휴리스틱)
2. **엔티티 매칭 실패 시**: `tracked_entity_id=null`로 pending (권장) vs 신규 엔티티 자동생성(비권장).
3. **소스 기본값 저장 위치**: `sources.yaml`에 필드 추가 vs `content.source.source_meta_json` vs 별도 매핑 테이블.
4. **통합 지점**: `run-all`의 옵션 단계 vs 독립 엔드포인트 `POST /crawler/classify`.
5. **DB 저장**: 분류 결과를 우선 응답으로만 확인 vs 바로 `curated_article` INSERT.

---

## 6. 부록 — 근거 파일

- `python_services/packages/agent/news_agent/code/run_news_agent.py` (오케스트레이션, 2545줄)
- `.../code/article_assessment_contract.py` (계약 v0.3)
- `.../code/article_assessment_prompts.json` (4개 에이전트 프롬프트)
- `.../code/solteti_agent_api.py` (외부 엔티티 카탈로그 API)
- `docs/PRD/project-classification.md` (Stage 1 수집 → Stage 2 분류 파이프라인 정의)
