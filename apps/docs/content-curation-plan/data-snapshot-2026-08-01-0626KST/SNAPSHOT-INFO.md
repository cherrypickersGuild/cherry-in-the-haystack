# 데이터 스냅샷 (백업·보관용)

- **스냅샷 일시:** 2026-08-01 06:26 KST
- **성격:** 보관용 백업 스냅샷. **라이브 원본이 아님.**
- **출처(라이브 원본):** `apps/web/public/{cases,research,discourse}/*.json`, `apps/web/public/logos/model/`

## ⚠️ 편집 규칙
앱은 `apps/web/public/`에서 JSON을 읽습니다. **실제 수정·추가는 반드시 원본(public)에서** 하세요.
이 폴더는 그 시점의 사본일 뿐이며, 이후 원본이 바뀌면 이 스냅샷과 어긋날 수 있습니다(의도된 것 — 보관용).

## 담긴 내용
- `cases/` — entities.json · icons.json · pages.json
- `research/` — entities.json · icons.json · pages.json · model-rank.json
- `discourse/` — entities.json · icons.json · pages.json
- `logos/model/` — 모델 제공사 로고 21개

## 다시 스냅샷 뜰 때
`apps/web/public`의 위 경로를 이 폴더로 다시 복사하고, 위 **스냅샷 일시**를 갱신하세요.
