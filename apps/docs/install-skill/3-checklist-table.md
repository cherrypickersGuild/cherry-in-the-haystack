# Install Skill — 체크리스트

시작/완료/테스트/검수 각 칸에 상태 마크:
- `[ ]` 미착수 · `[-]` 진행중 · `[x]` 완료 · `[!]` 블로커

마지막 수정: 2026-04-24 (Day 0)

---

## Day 0 — 기획 확정
| # | 항목 | 시작 | 완료 | 테스트 | 검수 |
|---|---|---|---|---|---|
| 0.1 | `1-work-guidelines.md` §3~13 읽기 + 2차 검수결과 확인 | [ ] | [ ] | — | [ ] |
| 0.2 | 재활용 가정 검증 (grep 5 키워드 + `delete_skill` 0건 확인) | [ ] | [ ] | [ ] | [ ] |
| 0.3 | Workshop localStorage 샘플 확인 (빈 상태 포함) | [ ] | [ ] | [ ] | [ ] |
| 0.4 | Claude Code `/skills` 핫 리로드 동작 확인 (수동) · 결과 기록 (a/b) | [ ] | [ ] | [ ] | [ ] |
| 0.5 | STEP 0.4 결과가 (a) 이면 §3-3/§6/§7 warnings 재작성 | [ ] | [ ] | — | [ ] |

## Day 1 — 카드 직렬화 (90 min)
| # | 항목 | 시작 | 완료 | 테스트 | 검수 |
|---|---|---|---|---|---|
| 1.1 | `serialize.ts` — `cardToSkillFile` (디렉토리 변환 규칙 포함) | [ ] | [ ] | — | [ ] |
| 1.2 | `buildMetaSkillFile` 함수 (SKILL.md 포맷, JSON 아님) | [ ] | [ ] | — | [ ] |
| 1.3 | `serialize.test.ts` — 8 케이스 pass, `compose-runtime.test.ts` 스타일 준수 | [ ] | [ ] | [ ] | [ ] |

## Day 1.5 — delete_skill_request 신규 이벤트 (45 min)
| # | 항목 | 시작 | 완료 | 테스트 | 검수 |
|---|---|---|---|---|---|
| 1.5.1 | gateway `requestDeleteSkill()` + ack 핸들러 | [ ] | [ ] | — | [ ] |
| 1.5.2 | `cherry-agent.js` delete_skill_request 수신 + path 방어 | [ ] | [ ] | — | [ ] |
| 1.5.3 | ad-hoc 수동 smoke (수동 생성한 cherry-test-xyz 삭제) | [ ] | [ ] | [ ] | [ ] |

## Day 2 — Install 엔드포인트 (90 min)
| # | 항목 | 시작 | 완료 | 테스트 | 검수 |
|---|---|---|---|---|---|
| 2.1 | `InstallBuildService.install()` — 4 gate + lock + 병렬 save + classifyResult | [ ] | [ ] | — | [ ] |
| 2.2 | `InstallBuildController` + `@UseGuards(JwtAuthGuard)` + 모듈 등록 | [ ] | [ ] | — | [ ] |
| 2.3 | curl 수동 테스트 — 200 / 409 / 403 각 케이스 확인 | [ ] | [ ] | [ ] | [ ] |

## Day 3 — Side Panel UI
| # | 항목 | 시작 | 완료 | 테스트 | 검수 |
|---|---|---|---|---|---|
| 3.1 | `install-result-panel.tsx` — 3 섹션 | [ ] | [ ] | — | [ ] |
| 3.2 | Connect 2-컬럼 레이아웃 (lg+) | [ ] | [ ] | — | [ ] |
| 3.3 | onInstalled 콜백 + state drilling | [ ] | [ ] | — | [ ] |

## Day 4 — 클라이언트 연결
| # | 항목 | 시작 | 완료 | 테스트 | 검수 |
|---|---|---|---|---|---|
| 4.1 | `installBuild()` in `api.ts` | [ ] | [ ] | — | [ ] |
| 4.2 | `InstallSkillSection.install()` 교체 | [ ] | [ ] | — | [ ] |
| 4.3 | e2e smoke (웹 클릭 → 파일 확인) | [ ] | [ ] | [ ] | [ ] |

## Day 5 — 덮어쓰기 / 고아 정리
| # | 항목 | 시작 | 완료 | 테스트 | 검수 |
|---|---|---|---|---|---|
| 5.1 | `delete_skill_request` 흐름 조사 | [ ] | [ ] | [ ] | [ ] |
| 5.2 | pre-delete 로직 service 에 통합 | [ ] | [ ] | [ ] | [ ] |
| 5.3 | Build A → B 재설치 시 고아 없음 | [ ] | [ ] | [ ] | [ ] |

## Day 6 — 시나리오 리허설 (pass / fail / 보류 기록)

**fail 액션 기준** (모든 시나리오 공통):
- pass → 다음 시나리오
- fail (로직 오류) → 즉시 수정, 같은 시나리오 재실행
- fail (환경/데이터) → skip 표시, 4-progress-log.md 에 원인 + 재현 방법 기록
- blocker (설계 결함) → 진행 중단, 기획 문서 업데이트 후 재승인

| # | 시나리오 | 결과 | 기대 동작 |
|---|---|---|---|
| 6.1 | Happy path (prompt + mcp + skillA+B) | [ ] | installed=2, meta_written=true, `local_skills.count >= 4` (cherry-p-* + cherry-s-* + cherry-build-meta), mcp 는 skipped[] |
| 6.2 | 부분 실패 (bogus card id → failed 1건) | [ ] | HTTP 207, installed 최소 1건, failed 1건, 기존 스킬 건드리지 않음 |
| 6.3 | 재설치 A → B (atomic 덮어쓰기 + 고아 정리) | [ ] | `orphans_removed` 배열에 Build A cherry-* dir 정확히 기록, ls 에 B 의 스킬만 |
| 6.4 | 오프라인 에이전트 (409, 즉시 반환) | [ ] | pre-check 로 1초 내 응답, hang 없음 |
| 6.5 | 중복 클릭 (Promise 공유, 동일 응답) | [ ] | 서버 로그에 run 1개만, 클라이언트 2 호출자 모두 같은 JSON 수신 |
| 6.6 | 7-슬롯 풀 빌드 (성능 < 15s) | [ ] | 최대 3 동시 save, 총 시간 <15s |
| 6.7 | Claude Code 세션 재로드 (`/skills` 반영) | [ ] | §8-7 — 0.4 결과 (a/b) 에 맞춰 경고 메시지 정확히 |
| 6.8 | 빈 빌드 보호 (400 + 사유) | [ ] | equippedCount=0 → HTTP 400, "Build is empty" |
| 6.9 | SKILL.md frontmatter 포맷 확인 (`name` + `description` 만) | [ ] | 각 저장된 SKILL.md 첫 4줄이 `---/name:/description:/---` |
| 6.10 | 브라우저 새로고침 — 응답 전 F5 → UI 복원 | [ ] | side panel 빈 상태로 reset (진행중 표시 사라짐), 새 요청 필요 |
| 6.11 | 에이전트 소유권 위반 (다른 유저 agent) → 403 | [ ] | `@UseGuards(JwtAuthGuard)` + service Gate 2 |
| 6.12 | 전부 timeout (가짜 지연) → 504 | [ ] | installed=[], failed 전부 "timeout", HTTP 504 |
| 6.13 | save 중 에이전트 disconnect | [ ] | 진행중 save 실패 → failed[] 기록, 기존 스킬 유지 |

## Day 7 — 정리
| # | 항목 | 시작 | 완료 | 테스트 | 검수 |
|---|---|---|---|---|---|
| 7.1 | `4-progress-log.md` 최종 기록 | [ ] | [ ] | — | [ ] |
| 7.2 | `3-checklist-table.md` 최종 업데이트 | [ ] | [ ] | — | [ ] |
| 7.3 | 루트 `README.md` Install Skill 섹션 | [ ] | [ ] | — | [ ] |
| 7.4 | git commit + PR 생성 | [ ] | [ ] | — | [ ] |

---

## 파일 산출물 체크
| 신규 파일 | 상태 | 비고 |
|---|---|---|
| `apps/api/src/modules/bench/cards/serialize.ts` | [ ] |  |
| `apps/api/src/modules/bench/cards/serialize.test.ts` | [ ] |  |
| `apps/api/src/modules/kaas/install-build.service.ts` | [ ] |  |
| `apps/api/src/modules/kaas/install-build.controller.ts` | [ ] |  |
| `apps/web/components/cherry/install-result-panel.tsx` | [ ] |  |
| `apps/docs/install-skill/4-progress-log.md` | [x] 생성됨 | 세션 기록 누적 |

## 수정되는 기존 파일
| 경로 | 상태 | 의도 |
|---|---|---|
| `apps/api/src/modules/kaas/kaas.module.ts` | [ ] | install-build controller/service 등록 |
| `apps/api/src/modules/kaas/kaas-ws.gateway.ts` | [ ] | (Day 1.5) `requestDeleteSkill()` 메서드 + delete_skill_ack 핸들러 신규 |
| `apps/web/public/cherry-agent.js` | [ ] | (Day 1.5) delete_skill_request 수신 + `fs.rmSync` + path traversal 방어 |
| `apps/web/lib/api.ts` | [ ] | `installBuild()` 추가 |
| `apps/web/app/start/connect/page.tsx` | [ ] | 2컬럼 + onInstalled, install() 교체 |
| `apps/web/components/cherry/install-result-panel.tsx` | [ ] | 신규이지만 Connect 페이지와 연동 |

---

## 블로커 / 이슈 트래킹
*Day 진행 중 발견된 이슈를 여기에 기록. 닫힘 시 취소선.*

- (예) ~~Day 2 WebSocket save_skill_request 에 request_id mismatch~~ — (resolved Day 2-2)

---

## Day 0 검수 반영 — ✅ 1차(17건) + 2차(15건) 완료

1차 17건 + 2차 15건 = **총 32건** 검수 반영 완료.

### 1차 (초안 직후, §12)
| # | 이슈 | 반영 위치 |
|---|---|---|
| 1 | SKILL.md frontmatter `name`+`description` 만 | §4-2 / 6.9 테스트 |
| 2 | meta 파일도 SKILL.md 확장자 | §4-3 / 6.1 테스트 |
| 3 | MCP 슬롯 실제 tool 활성화는 스코프 밖 | §3-3 / §4-1 |
| 4 | Claude Code 핫 리로드 여부 확인 | 0.4 / 6.7 |
| 5 | `isAgentConnected` pre-check | 2.1 / 6.4 |
| 6 | HTTP path `/api/v1/...` prefix | §6 / 2.3 |
| 7 | 개별 10s + 병렬 3 + 상한 60s | 2.1 / 6.6 |
| 8 | 중복 클릭 in-flight lock | 2.1 / 6.5 |
| 9 | 에이전트 소유권 403 | 2.1 / 6.11 |
| 10 | 덮어쓰기 atomic (save → cleanup) | 5.2 / 6.3 |
| 11 | 빈 빌드 400 | 2.1 / 6.8 |
| 12 | 성능 15s target | 6.6 |
| 13 | 로그 prefix 규약 | §11 |
| 14 | 에러 코드 표 (400/403/404/409/500/504) | §6 |
| 15 | 브라우저 새로고침 | 6.10 |
| 16 | Side panel mobile 동작 | §7 추후 |
| 17 | Day 6 fail 액션 기준 | **✅ 해소** — §Day 6 상단 기준 명시 |

### 2차 (§13)
| # | 이슈 | 반영 위치 |
|---|---|---|
| 18 | in-flight = Promise 공유 (409 안 씀) | §3-2 / §6 HTTP 분기 |
| 19 | installed[] 는 regular skill 만, meta 분리 | §6 / 2.1 |
| 20 | HTTP 상태 분기 규칙 (200/207/504) | §6 / `classifyResult` |
| 21 | save_skill payload = synthetic concept_id | §4-4 |
| 22 | 디렉토리 이름 변환 규칙 (`inv-p-` strip) | §4-1 |
| 23 | `delete_skill_request` 신규 추가 | **Day 1.5** 추가 |
| 24 | run_id vs request_id 구분 | §11-2 |
| 25 | stdio vs WebSocket 경로 명확화 | §5 |
| 26 | Day 0 STEP 0.4 결과 분기 | 0.4 / 0.5 |
| 27 | test runner = compose-runtime.test.ts 스타일 | 1.3 |
| 28 | `@UseGuards(JwtAuthGuard)` 필수 | 2.2 / §6 |
| 29 | v8 migration 안 함 | §3-3 |
| 30 | warnings 기본값 명시 | §6 |
| 31 | cherry-build-meta 덮어쓰기 | §4-1 "중요 3" |
| 32 | Day 1 duration 60→90min | §9 |
