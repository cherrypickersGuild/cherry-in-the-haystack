# 데이터 스냅샷 (백업·보관용)

- **스냅샷 일시:** 2026-08-01 14:17 KST
- **성격:** 보관용 백업 스냅샷. **라이브 원본이 아님.**
- **출처(라이브 원본):** `apps/web/public/{cases,research,discourse}/*.json`, `apps/web/public/logos/model/`
- **직전 스냅샷:** `../data-snapshot-2026-08-01-0626KST/` (이력 보존)

## 이번 스냅샷의 변경점 — kind 항목별 전수 재분류
직전(0626) 이후, 세 그룹의 `kind`(domain/article)를 **항목별로 재판정**해 정정했다(요약).
- **판정 기준:** 지속되는 실체(제품·모델·툴·프레임워크/표준·조직·뉴스레터·이벤트·데이터셋·마켓맵/랜드스케이프) = **domain**. 특정 발행물 1건(블로그·뉴스·논문·오피니언/분석) = **article**. Research는 URL 기준(arxiv/논문 링크=article, 실제 사이트/리포=domain)을 병용.
- **렌더링:** 혼합 분류는 도메인 카드(프론트 정적 `StaticDomainLandscape`) + 기사/논문 목록으로 분리 표시(Product Discovery 방식). ND 도메인 렌더는 프론트 정적으로 일원화.

### kind 분포 (이 스냅샷 시점)
**cases (914)** — case-studies: domain 0 / article 543 · product-discovery: 123 / 101 · domain-applications: 110 / 37
**research (208)** — papers: 6 / 56 · model-updates: 70 / 3 · benchmarks-datasets: 10 / 63
**discourse (1151)** — regulations-policy-compliance: 49 / 5 · community: 28 / 0 · big-tech-trends: 21 / 0 · market-investment: 116 / 420 · technical-deep-dives: 4 / 451 · insights-opinions: 57 / 0

## ⚠️ 편집 규칙
앱은 `apps/web/public/`에서 JSON을 읽습니다. **실제 수정·추가는 반드시 원본(public)에서** 하세요.
이 폴더는 그 시점의 사본일 뿐이며, 이후 원본이 바뀌면 이 스냅샷과 어긋날 수 있습니다(의도된 것 — 보관용).

## 담긴 내용
- `cases/` — entities.json · icons.json · pages.json
- `research/` — entities.json · icons.json · pages.json · model-rank.json
- `discourse/` — entities.json · icons.json · pages.json
- `logos/model/` — 모델 제공사 로고 21개

## 다시 스냅샷 뜰 때
`apps/web/public`의 위 경로를 새 `data-snapshot-<날짜-시각>KST/` 폴더로 복사하고, 위 **스냅샷 일시**를 갱신하세요.
