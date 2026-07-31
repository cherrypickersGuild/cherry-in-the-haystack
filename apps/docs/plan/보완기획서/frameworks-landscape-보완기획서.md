# 보완기획서 — Frameworks Landscape 후속 과제

작성: 2026-07-29
상위 기획서: [../frameworks-landscape-admin-curation-plan.md](../frameworks-landscape-admin-curation-plan.md)
상태: **후속(나중에 진행)** — 본 기획서 P1~P4 완료 후 착수

> 본 문서는 상위 기획서에서 "나중에"로 미룬 항목을 모아 둔다. 지금 구현하지 않는다.

---

## A. 빌딩블락스 JSON을 백엔드로 이전

### 현재
- `apps/web/public/building-blocks/entities.json` (프론트 정적 파일).
- Frameworks 자동생성은 지금은 이 파일을 **읽기만** 함(상위 기획서 §3-0).

### 목표
- 이 소스를 **백엔드가 소유**하도록 이전.
  - 저장 위치: `DATA_DIR/building-blocks/entities.json` (영속 볼륨, 상위 §3-3과 동일 루트).
  - 백엔드 API로 서빙 → Building Blocks 페이지도 정적 파일 → API로 통일(선택).
- 이전 후 Frameworks 자동생성의 입력도 백엔드 소스를 바라보게 전환.

### 이유
- 관리자 업로드(아래 B)로 소스를 교체하려면 백엔드가 파일을 쓰고/읽는 주체여야 함.
- 프론트 정적 파일은 재배포 시 교체·영속 관리가 불가.

---

## B. 빌딩블락스 수동 업로드 + 갱신 비트(flag) → 자동 리프레시

### 개념 (대표 결정)
- 빌딩블락스 데이터는 **수동 업로드**로 갱신한다.
- **업로드 시 "갱신 비트"를 설정**한다. 이 비트가 Frameworks landscape 재생성의 트리거.

### 흐름(안)
1. 관리자 페이지에서 빌딩블락스 JSON 업로드 → 백엔드가 `DATA_DIR/building-blocks/entities.json` 교체.
2. 교체 시 **갱신 비트/버전** 기록(예: `building-blocks.meta.json`의 `updatedAt`/`version` 증가, 또는 단순 `dirty=true` 플래그).
3. 이 비트를 감지하면 Frameworks landscape **재생성(병합)** 실행 → `source:"auto"` 카드 최신화, `source:"admin"` 카드는 선택 유지·표시데이터만 갱신(상위 §3-2/§5).
4. 재생성 후 비트 해제.

### 검토 필요
- 비트 저장 형태: 별도 메타 파일 vs 파일 mtime vs 버전 카운터.
- 재생성 실행 시점: 업로드 직후 동기 실행 vs 비동기(큐/다음 요청 시 lazy).
- 업로드 검증: 스키마 검증, 최소 항목 수, 실패 시 롤백(이전 파일 보존).
- 업로드 권한: ADMIN 한정(`@Roles(ADMIN)`).

---

## C. (선택) Building Blocks 페이지도 API 소스로 통일

- A 완료 시 Building Blocks 페이지도 정적 `public` → API GET 전환 가능.
- 소스 일원화로 유지보수 단순화. 우선순위 낮음.

---

## 착수 조건

- 상위 기획서 P1~P4(자동생성 + API + 관리자 편집 + 리셋/수정시각) 완료.
- Dokploy 영속 볼륨(`DATA_DIR`) 매핑 확정.
