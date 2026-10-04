# LLM Provider 선택형 구조 기획서

> 목적: browser-agent의 모든 LLM 사용 지점(analyze / fallback / classify)에서
> **Claude(Anthropic) ↔ 로컬 Qwen(OpenAI 호환)** 을 **설정(config)만으로 골라 쓰도록** 만든다.
> 대상: `feature/browser-agent` / `python_services/packages/browser-agent/python_services`

---

## 1. 배경 & 동기

- 현재 browser-agent는 **Claude(Anthropic)** 를 코드에 하드코딩해 사용 → **개인 API 비용**이 나감.
- 회사가 **로컬 LLM 엔드포인트**(vLLM, OpenAI 호환)를 제공: `nvidia/Qwen3.6-27B-NVFP4`.
  - 지금은 이 로컬 모델로 **비용 없이** 쓰고 싶고,
  - 향후 회사가 정식 지원하면 **analyze까지 전부** 로컬로 돌릴 수 있어야 함.
- 따라서 특정 provider에 종속되지 않고, **역할별로 provider를 config에서 선택**하는 구조가 필요.

### 로컬 Qwen 엔드포인트 검증 결과 (실측)
| 항목 | 결과 |
|------|------|
| 엔드포인트 | `http://61.107.201.232:8000/v1` (OpenAI 호환, vLLM 0.24) |
| 모델 | `nvidia/Qwen3.6-27B-NVFP4` (컨텍스트 **262,144**) |
| 인증 | **불필요** (임의 키 허용) |
| 비용 | 회사 로컬 → 사실상 **무료** |
| ⚠️ 주의 | **reasoning 모델** — 기본 호출 시 사고만 하다 답(`content`)을 못 냄 |
| ✅ 해법 | 요청에 **`chat_template_kwargs: {"enable_thinking": false}`** 주입 시 깔끔한 JSON 출력 (10토큰) |

> 결론: 로컬 Qwen은 **thinking-off 옵션만 넣으면** 분류·요약 용도로 충분히 사용 가능.

---

## 2. 목표 / 비목표

### 목표
1. **역할(role)별 provider 선택**: analyze / fallback / classify 각각 Claude 또는 Qwen 지정.
2. **config만으로 전환**: `.env` 값만 바꾸면 코드 수정 없이 provider 변경.
3. **기존 동작 무손상**: 기본값을 현재와 동일(Claude)로 두어 전환 전까지 그대로 동작.
4. **provider별 특성 자동 처리**: Qwen은 thinking-off 자동 주입, Anthropic은 기존 방식.
5. **"전부 Qwen" 전환이 한 줄로 가능**: 회사 지원 시 env 몇 개만 바꿔 analyze까지 로컬화.

### 비목표
- 스트리밍 응답, 함수콜링 등 고급 기능 (현재 불필요).
- provider 자동 페일오버(장애 시 자동 전환)는 v1 범위 밖 (수동 전환으로 충분).
- news_agent(별도 서비스)의 provider 변경 (이 기획은 browser-agent 한정).

---

## 3. 설정(config) 스키마

`.env` (`python_services/packages/browser-agent/python_services/.env`):

```env
# ── 역할별 provider 선택 (anthropic | qwen) ──
ANALYZE_LLM=anthropic      # browser-use 분석 (기본 Claude; 회사 지원 시 qwen)
FALLBACK_LLM=anthropic     # browser-use 폴백 수집
CLASSIFY_LLM=qwen          # 기사 분류 (지금부터 로컬 Qwen)

# ── Claude (Anthropic) ──
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-haiku-4-5-20251001

# ── Qwen (회사 로컬, OpenAI 호환) ──
QWEN_BASE_URL=http://61.107.201.232:8000/v1
QWEN_MODEL=nvidia/Qwen3.6-27B-NVFP4
QWEN_API_KEY=dummy         # 인증 불필요, placeholder
QWEN_DISABLE_THINKING=true # reasoning off (기본 true)
```

- **역할 3개**를 분리해 세밀하게 제어 (예: analyze만 Claude, 나머지 Qwen).
- 회사 지원 시 → `ANALYZE_LLM=qwen`, `FALLBACK_LLM=qwen` 두 줄만 바꾸면 **전부 로컬**.
- 값이 없으면 안전한 기본값(anthropic)으로 폴백.

---

## 4. 아키텍처

### 4.1 새 모듈: `api/llm.py` (provider 팩토리)

한 곳에서 provider 분기를 흡수한다. 나머지 코드는 provider를 몰라도 됨.

```
get_provider(role) -> "anthropic" | "qwen"      # env에서 역할별 선택값 읽기

# (a) browser-use용 LLM 객체 생성
make_browser_use_llm(role):
    anthropic → browser_use ChatAnthropic(model=ANTHROPIC_MODEL, api_key=...)
    qwen      → browser_use ChatOpenAI(model=QWEN_MODEL, base_url=QWEN_BASE_URL,
                                       api_key=QWEN_API_KEY)   # + thinking-off 처리

# (b) 단순 JSON 채팅 (분류/요약용)
async chat_json(prompt, role, max_tokens) -> str:
    anthropic → Anthropic SDK messages.create(...)
    qwen      → OpenAI SDK chat.completions.create(
                    ..., extra_body={"chat_template_kwargs":{"enable_thinking":false}})
                → choices[0].message.content
```

### 4.2 provider별 특성 처리 (팩토리 내부에 캡슐화)

| | Anthropic (Claude) | Qwen (로컬) |
|---|---|---|
| SDK | `anthropic` (이미 설치됨) | `openai` (이미 설치됨) |
| 인증 | `ANTHROPIC_API_KEY` | `QWEN_API_KEY`(dummy) |
| thinking off | 불필요 | **`extra_body.chat_template_kwargs.enable_thinking=false` 필수** |
| browser-use 클래스 | `ChatAnthropic` | `ChatOpenAI(base_url=...)` |

### 4.3 연결 지점

| 사용처 | 현재 | 변경 후 |
|--------|------|---------|
| `crawler.py::_run_browser_use_analysis` | `ChatAnthropic` 하드코딩 | `make_browser_use_llm("ANALYZE")` |
| `crawler.py::_do_fallback` | `ChatAnthropic` 하드코딩 | `make_browser_use_llm("FALLBACK")` |
| 분류 단계(신규) | 없음 | `chat_json(prompt, "CLASSIFY", ...)` |

---

## 5. 흐름 (역할별 provider가 다를 수 있음)

```
[수집]  run-all
  ├─ analyze  → make_browser_use_llm("ANALYZE")   → (기본) Claude
  ├─ fallback → make_browser_use_llm("FALLBACK")  → (기본) Claude
  └─ execute  → LLM 미사용
[분류]  classify
  └─ chat_json(..., "CLASSIFY")                    → (기본) 로컬 Qwen
```

회사 지원 후:
```
ANALYZE_LLM=qwen, FALLBACK_LLM=qwen  →  모든 LLM이 로컬 Qwen (비용 0)
```

---

## 6. 리스크 & 확인 필요 사항

1. **browser-use의 `ChatOpenAI` + `base_url` 지원 여부** (browser-use 0.13.1)
   - 지원되면 analyze도 config로 Qwen 전환 가능.
   - **미지원/제약 시**: analyze/fallback은 Claude 고정, **classify만 Qwen** 으로 v1 진행 (이미 무료 로컬 이득 확보).
   - browser-use에서 Qwen의 thinking-off 주입 경로(`extra_body`)가 먹히는지도 확인.
2. **browser-use를 Qwen으로 돌릴 때 분석 품질**: 브라우저 조작은 어려운 agentic 작업이라 로컬 27B가 Claude보다 실패율이 높을 수 있음 → 전환 시 재검증 필요.
3. **엔드포인트 가용성**: 회사 로컬 IP가 항상 접근 가능한지(네트워크/VPN). 장애 시 수동으로 `CLASSIFY_LLM=anthropic` 전환.
4. **thinking-off 미적용 사고(regression)**: Qwen 경로는 반드시 `enable_thinking=false`를 넣어야 함 — 팩토리에서 강제.

---

## 7. 구현 단계 (제안)

| 단계 | 내용 | 산출물 | 안전성 |
|------|------|--------|:---:|
| **P0** | `.env`에 Qwen/역할 변수 추가 (`.env.example`도) | 설정 | 무해 |
| **P1** | `api/llm.py` 팩토리 작성 (`make_browser_use_llm`, `chat_json`) | 새 모듈 | 무해(미연결) |
| **P2** | `crawler.py` analyze/fallback을 팩토리로 배선 (기본 anthropic) | 리팩터 | 기본값 유지 시 무손상 |
| **P3** | browser-use `ChatOpenAI` 실제 연동 시험 (analyze=qwen 1회 테스트) | 검증 | 실험 |
| **P4** | 분류 단계에서 `chat_json("CLASSIFY")` 사용 (별도 기획서 §3 참조) | 기능 | 신규 |

> P0~P2는 기본값이 현재와 같아 **동작이 안 깨짐**. P3에서 Qwen analyze의 실사용 가능성을 판별.

---

## 8. 관련 문서
- `docs/classification-redesign.md` — 룰베이스+최소LLM 분류 재설계 (이 provider 구조 위에 얹힘)
- 로컬 Qwen 검증: 본 문서 §1 (실측)
