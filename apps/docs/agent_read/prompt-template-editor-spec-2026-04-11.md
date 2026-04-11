# 프롬프트 템플릿 편집 화면 기획서

> 작성일: 2026-04-11  
> 관련 DDL: docs/architecture/ddl-v1.1.sql  
> 관련 테이블: `core.prompt_template`, `core.prompt_template_version`

---

## 1. 개요

에이전트가 아티클 요약·점수·평가 등을 수행할 때 사용하는 프롬프트 템플릿을  
**권한별로 생성·편집·버전 관리**할 수 있는 관리 화면.

DDL에 `prompt_template` / `prompt_template_version` 테이블이 이미 설계되어 있으며,  
이 화면은 해당 테이블을 조작하는 UI를 제공한다.

---

## 2. 기존 DDL 분석

### `core.prompt_template`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | UUID | PK |
| `user_id` | UUID \| NULL | NULL이면 PLATFORM 템플릿 |
| `scope` | ENUM | `PLATFORM` / `USER` |
| `type` | ENUM | `ARTICLE_AI` / `NEWSLETTER` / `CONCEPT_PAGE` |
| `code` | VARCHAR | 식별 코드 (예: `article_ai_default`) |
| `name` | VARCHAR | 표시 이름 |
| `description` | TEXT | 설명 |
| `tone_text` | TEXT | 톤·방향성 지시 (메인 프롬프트 지시문) |
| `cloned_from_template_id` | UUID \| NULL | 복사 원본 |
| `is_active` | BOOLEAN | 활성 여부 |
| `revoked_at` | TIMESTAMPTZ | 소프트 삭제 |

### `core.prompt_template_version`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | UUID | PK |
| `prompt_template_id` | UUID | FK → prompt_template |
| `version_no` | INT | 순번 (1, 2, 3...) |
| `version_tag` | VARCHAR | 태그 (예: `v1.0`, `stable`) |
| `prompt_text` | TEXT | 실제 프롬프트 본문 |
| `few_shot_examples` | TEXT | Few-shot 예시 |
| `parameters_json` | JSONB | 파라미터 설정값 |
| `change_note` | TEXT | 변경 내용 메모 |
| `cloned_from_version_id` | UUID \| NULL | 복사 원본 버전 |
| `revoked_at` | TIMESTAMPTZ | 소프트 삭제 |

### DDL 보완 필요 사항

현재 DDL에 **"활성 버전"을 명시하는 컬럼이 없음**.  
`prompt_template`에 `active_version_id` FK 컬럼 추가 필요.

```sql
-- 추가 마이그레이션
ALTER TABLE core.prompt_template
  ADD COLUMN active_version_id UUID REFERENCES core.prompt_template_version(id);
```

> 이 컬럼이 있어야 에이전트가 "어떤 버전을 사용할지" 명확하게 참조 가능.  
> `user_article_ai_state.prompt_template_version_id`에 기록됨 (이미 DDL에 존재).

---

## 3. 템플릿 타입별 용도

| Type | 에이전트 사용 시점 | 주요 지시 내용 |
|------|-------------------|----------------|
| `ARTICLE_AI` | Stage 4 — LLM 아티클 분석 | 요약, 점수(1-5), 분류, 태그, 근거 추출 |
| `NEWSLETTER` | 뉴스레터 생성 | 이슈별 문체, 길이, 독자 수준 |
| `CONCEPT_PAGE` | 핸드북 페이지 생성 | 개념 설명 방식, 깊이, 예시 포함 여부 |

---

## 4. 권한 매트릭스

| 액션 | ADMIN | MANAGER | GENERAL |
|------|:-----:|:-------:|:-------:|
| PLATFORM 템플릿 조회 | ✅ | ✅ | ✅ |
| PLATFORM 템플릿 생성 | ✅ | ✅ | ❌ |
| PLATFORM 템플릿 편집 | ✅ | ✅ | ❌ |
| PLATFORM 템플릿 비활성화 | ✅ | ❌ | ❌ |
| 내 USER 템플릿 조회 | ✅ | ✅ | ✅ |
| 전체 USER 템플릿 조회 | ✅ | ❌ | ❌ |
| USER 템플릿 생성 | ✅ | ✅ | ✅ |
| 내 USER 템플릿 편집 | ✅ | ✅ | ✅ |
| 타인 USER 템플릿 편집 | ✅ | ❌ | ❌ |
| PLATFORM → USER 복사(Clone) | ✅ | ✅ | ✅ |
| 버전 생성 | ✅ | ✅ (PLATFORM) / ✅ (내 것) | ✅ (내 것) |
| 활성 버전 지정 | ✅ | ✅ (PLATFORM) / ✅ (내 것) | ✅ (내 것) |

---

## 5. 화면 구성

### 5-1. 템플릿 목록 화면 `/templates`

```
┌─────────────────────────────────────────────────────┐
│  프롬프트 템플릿                     [+ 새 템플릿]   │
├─────────────────────────────────────────────────────┤
│  [전체] [ARTICLE_AI] [NEWSLETTER] [CONCEPT_PAGE]    │
│  [PLATFORM] [USER]           🔍 이름/코드 검색       │
├─────────────────────────────────────────────────────┤
│  이름              타입         범위    버전  상태    │
│  ─────────────────────────────────────────────────  │
│  기본 아티클 분석  ARTICLE_AI  PLATFORM  v3   활성   │
│  뉴스레터 기본     NEWSLETTER  PLATFORM  v1   활성   │
│  내 커스텀 분석    ARTICLE_AI  USER      v2   활성   │
│                                              [편집]  │
└─────────────────────────────────────────────────────┘
```

**기능**
- 탭 필터: 타입별 / 범위별
- 검색: `name`, `code` 기준
- 각 행 클릭 → 상세 화면
- ADMIN/MANAGER: [+ 새 템플릿] 버튼 표시
- GENERAL: PLATFORM 행에 [편집] 없음, [복사] 버튼만 표시

---

### 5-2. 템플릿 상세 화면 `/templates/[id]`

```
┌─────────────────────────────────────────────────────┐
│  ← 목록                                             │
│  기본 아티클 분석 템플릿                            │
│  ARTICLE_AI · PLATFORM · 활성                       │
├──────────────────┬──────────────────────────────────┤
│  기본 정보       │  버전 히스토리                    │
│                  │                                   │
│  이름: ...       │  v3 (현재 활성) · 2026-04-09     │
│  코드: ...       │  v2 · 2026-03-20                 │
│  설명: ...       │  v1 · 2026-03-01                 │
│  톤/방향: ...    │                                   │
│                  │  [+ 새 버전 만들기]               │
│  [편집] [복사]   │                                   │
└──────────────────┴──────────────────────────────────┘
│  현재 활성 버전 (v3) 내용 미리보기                  │
│  ─────────────────────────────────────────────────  │
│  프롬프트 본문: ...                                  │
│  Few-shot 예시: ...                                  │
│  파라미터: { "max_tokens": 1000, ... }              │
└─────────────────────────────────────────────────────┘
```

---

### 5-3. 템플릿 생성 화면 `/templates/new`

```
┌─────────────────────────────────────────────────────┐
│  새 템플릿 만들기                                    │
├─────────────────────────────────────────────────────┤
│  범위   ○ PLATFORM (관리자)   ● USER (개인)          │
│  타입   [ARTICLE_AI ▼]                              │
│                                                     │
│  코드   [article_ai_custom          ]               │
│  이름   [내 커스텀 분석 템플릿      ]               │
│  설명   [                           ]               │
│                                                     │
│  톤/방향 지시                                        │
│  ┌─────────────────────────────────────────────┐   │
│  │ 기술적이고 간결하게 요약하라. 독자는 ML 엔  │   │
│  │ 지니어이다. 점수는 실용적 가치 기준으로...  │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  복사 원본  [선택 안 함 ▼]  (PLATFORM 템플릿 목록)  │
│                                                     │
│           [취소]  [다음: 첫 버전 작성 →]            │
└─────────────────────────────────────────────────────┘
```

---

### 5-4. 버전 편집 화면 `/templates/[id]/versions/new`

```
┌─────────────────────────────────────────────────────┐
│  새 버전 작성 — 기본 아티클 분석 템플릿              │
│  v3 → v4                                            │
├─────────────────────────────────────────────────────┤
│  버전 태그  [v4                    ]                │
│  변경 메모  [few-shot 예시 3개 추가]                │
├─────────────────────────────────────────────────────┤
│  📝 프롬프트 본문                                    │
│  ┌─────────────────────────────────────────────┐   │
│  │ You are an expert AI analyst...             │   │
│  │                                             │   │
│  │ Given the article below, return a JSON...   │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  📚 Few-shot 예시                                    │
│  ┌─────────────────────────────────────────────┐   │
│  │ Example 1:                                  │   │
│  │ Input: ...                                  │   │
│  │ Output: { "ai_summary": "...", ... }        │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ⚙️ 파라미터 (JSON)                                  │
│  ┌─────────────────────────────────────────────┐   │
│  │ {                                           │   │
│  │   "max_tokens": 1000,                       │   │
│  │   "temperature": 0.3                        │   │
│  │ }                                           │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  [취소]  [저장 (비활성)]  [저장 + 활성 버전으로 지정] │
└─────────────────────────────────────────────────────┘
```

---

## 6. 필요 API 엔드포인트

### 템플릿 CRUD

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/api/prompt-templates` | 목록 조회 (필터: type, scope) | 전체 |
| POST | `/api/prompt-templates` | 템플릿 생성 | ADMIN, MANAGER, GENERAL(USER only) |
| GET | `/api/prompt-templates/:id` | 상세 조회 | 전체 |
| PATCH | `/api/prompt-templates/:id` | 메타 수정 (name, description, tone_text) | 권한 매트릭스 |
| DELETE | `/api/prompt-templates/:id` | 소프트 삭제 | ADMIN only |
| POST | `/api/prompt-templates/:id/clone` | 복사 → USER 템플릿 생성 | 전체 |

### 버전 관리

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/api/prompt-templates/:id/versions` | 버전 목록 | 전체 |
| POST | `/api/prompt-templates/:id/versions` | 새 버전 생성 | 권한 매트릭스 |
| GET | `/api/prompt-templates/:id/versions/:vid` | 버전 상세 | 전체 |
| PATCH | `/api/prompt-templates/:id/versions/:vid/activate` | 활성 버전 지정 | 권한 매트릭스 |
| DELETE | `/api/prompt-templates/:id/versions/:vid` | 버전 삭제 (revoke) | ADMIN, 본인 |

---

## 7. 라우트 구조 (Next.js App Router)

```
app/
└── templates/
    ├── page.tsx                          ← 목록
    ├── new/
    │   └── page.tsx                      ← 생성
    └── [id]/
        ├── page.tsx                      ← 상세
        ├── edit/
        │   └── page.tsx                  ← 메타 편집
        └── versions/
            ├── new/
            │   └── page.tsx              ← 버전 작성
            └── [vid]/
                └── page.tsx              ← 버전 상세
```

---

## 8. 구현 우선순위

### Phase 1 — 핵심
- [ ] DDL 마이그레이션: `active_version_id` 컬럼 추가
- [ ] API: 목록/조회/생성/버전 생성/활성 버전 지정
- [ ] 화면: 목록 + 상세 + 버전 편집

### Phase 2 — 권한 완성
- [ ] 권한 매트릭스 Guard 적용 (ADMIN/MANAGER/GENERAL 분기)
- [ ] PLATFORM 범위 선택 제한 (GENERAL 접근 차단)

### Phase 3 — UX 향상
- [ ] Clone 기능 (PLATFORM → 내 USER 템플릿)
- [ ] 버전 diff 뷰 (이전 버전과 변경 비교)
- [ ] 파라미터 JSON 유효성 검증 (스키마 기반)

---

## 9. 에이전트 연동 지점

에이전트가 `ARTICLE_AI` 타입 템플릿의 **활성 버전**을 읽어 프롬프트 구성:

```
GET /api/prompt-templates?type=ARTICLE_AI&scope=PLATFORM&active=true
→ active_version_id 기준으로 prompt_text + few_shot_examples + parameters_json 조합
→ 처리 완료 후 user_article_ai_state.prompt_template_version_id 에 기록
```
