# Git 백업 및 롤백 전략

**작성일:** 2026-04-07
**대상:** Epic 1+2 통합 팀
**목적:** 10일 간의 통합 작업 중 안전한 버전 관리

---

## 🎯 왜 백업 태그가 필요한가요?

**비유: 게임의 세이브 포인트와 같습니다.**

보스전(위험한 작업)에 들어가기 전에 게임을 저장합니다. 문제가 생기면 처음부터 다시 시작하는 게 아니라, 그 지점부터 다시 시작하면 됩니다.

### 우리가 할 위험한 작업들:
- 4명의 개발자 코드를 10일 동안 병합
- Python ↔ TypeScript 통합 (처음 시도)
- 데이터베이스 마이그레이션 및 스키마 변경
- GraphDB, Neptune 등 새로운 서비스 연결

### 백업 태그가 없으면:
- 수동으로 모든 변경사항을 되돌려야 함
- 무엇이 바뀌었는지 기억하기 어려움
- 시간 낭비, 스트레스

### 백업 태그가 있으면:
```bash
# 명령어 하나로 "전의 상태"로 복귀
git reset --hard pre-epic-1-2-integration-20260407
```

---

## 📊 세 가지 롤백 레벨

| 레벨 | 사용 상황 | 설명 | 명령어 |
|------|----------|------|--------|
| **레벨 1** | 마지막 커밋에 작은 실수 | 변경사항 유지하되 마지막 커밋만 취소 | `git reset --soft HEAD~1` |
| **레벨 2** | 중간 정도 문제, 며칠 치 작업 문제 | 백업 태그로 리셋, 파일은 남겨둠 (리뷰 가능) | `git reset pre-epic-1-2-integration-*` |
| **레벨 3** | 완전한 재앙, 방향이 잘못됨 | 통합 브랜치 폐기, main으로 복귀 | `git checkout main` + 브랜치 삭제 |

---

## 🔧 실제 명령어

### 1. 백업 태그 생성 (Day 1 전, Tech Lead만 실행)

```bash
# 로컬에 태그 생성
git tag pre-epic-1-2-integration-20260407

# GitHub에도 백업 (안전장치)
git push origin pre-epic-1-2-integration-20260407
```

### 2. 모든 태그 확인

```bash
git tag
```

### 3. 레벨 1 롤백: 마지막 커밋 취소 (작업 내용 유지)

```bash
# 마지막 커밋만 취소, 변경사항은 스테이징 상태로 남음
git reset --soft HEAD~1

# 수정 후 다시 커밋
git add .
git commit -m "수정된 메시지"
```

### 4. 레벨 2 롤백: 백업 태그로 리셋

```bash
# 백업 태그로 리셋 (파일은 유지됨)
git reset pre-epic-1-2-integration-20260407

# 변경사항 리뷰 후 수정
# ...
```

### 5. 레벨 3 롤백: 완전 폐기

```bash
# main으로 체크아웃
git checkout main

# 통합 브랜치 삭제 (선택 사항 - 참고용으로 남겨둘 수도 있음)
git branch -D epic-1-2-integration

# 또는 완전 리셋 (통합 작업 손실)
git checkout main
git reset --hard pre-epic-1-2-integration-20260407
```

---

## ⚠️ 중요: Git 권한 규칙

- **Tech Lead만** `main` 브랜치로 병합(Merge) 가능
- **Tech Lead만** 롤백 실행 가능
- 모든 팀원은 `epic-1-2-integration` 브랜치에서 작업
- 커밋 전에: `git status`로 상태 확인

---

## 📋 체크리스트

### Day 1 전 (Tech Lead)
- [ ] 백업 태그 생성 (`git tag pre-epic-1-2-integration-YYYYMMDD`)
- [ ] GitHub에 태그 푸시 (`git push origin pre-epic-1-2-integration-*`)
- [ ] 통합 브랜치 생성 (`git checkout -b epic-1-2-integration`)
- [ ] 팀원들에게 이 문서 공유

### 작업 중 (모든 팀원)
- [ ] 커밋 전에 `git status` 실행
- [ ] 자주 커밋 (작은 단위로)
- [ ] 명확한 커밋 메시지 작성
- [ ] 문제 발생 시 즉시 Tech Lead에게 보고

---

## 🆘 긴급 상황 대처

| 상황 | 대처 방법 | 누가 |
|------|----------|------|
| 코드를 망침 (아직 커밋 안 함) | `git checkout -- <file>`로 파일 복원 | 본인 |
| 커밋했는데 실수 발견 | `git reset --soft HEAD~1` 후 수정 | 본인 |
| 병합 충돌 발생 | Tech Lead에게 요청 | Tech Lead |
| 통합 작업 전체가 문제 | Tech Lead가 롤백 결정 | Tech Lead |

---

## 💡 요약

- **백업 태그 = 보험** (30초 만에 생성, 평생 안심)
- **작은 단위로 자주 커밋** (실수해도 되돌리기 쉬움)
- **문제는 빨리 보고** (늦으면 늦을수록 복구 어려움)
- **Tech Lead가 최종 결정** (롤백, 병합, 방향 전환)

---

**마지막 업데이트:** 2026-04-07
**버전:** 1.0
**상태:** 팀 브리핑 준비 완료
