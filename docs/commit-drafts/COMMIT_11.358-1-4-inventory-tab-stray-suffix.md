# COMMIT — §11.358-1 #4: "운영 현황" 탭 무의미 "S" suffix 제거

```
fix(inventory) §11.358-1 #4 #tab-stray-suffix — "운영 현황" 탭 뒤 의미 없는 raw "S" suffix 제거 (화면 "운영 현황s" stray token)
```

## 무엇 (§11.358-1 #4 — 호영님 지적)
- 화면: 재고 "운영 현황" 탭 라벨 뒤에 작은 **"S"** 가 붙어 "운영 현황s" 처럼 보임 — 의미 없는 raw 토큰.
- 코드 추적: `inventory-content.tsx` overview 탭 `suffix: showLotIssueDecisionStrip ? null : "S"` (L1756) → 탭 렌더에서 `tab.suffix` 를 별도 `<span>` 으로 출력(L1793).
- dashboard 메인 page text 검색에 안 걸렸던 이유 = (1) inventory 화면 컴포넌트, (2) "운영 현황" 과 "S" 가 **별개 span** → 문자열 "운영 현황s" 리터럴 부재.
- "S" 의 의미 불명(과거 잔재) — 사용자에겐 오타/장식으로 보임. LabAxis **raw label 금지** 위반.

## Fix (`inventory-content.tsx`)
- overview 탭 객체에서 `suffix` 정의 제거.
- 탭 렌더에서 `{"suffix" in tab && tab.suffix && <span>…}` 출력 제거.
- canonical 주석에서 suffix 항목 제거 + §11.358-1 #4 사유 명기.
- 보존: 4 key / aria / testid / min-h-[44px] / **badge(N건 rose-500)** / showLotIssueDecisionStrip 분기 — 전부 유지.

## §11.321 sentinel 충돌 해소
- `inventory-tab-segmented-control-321.test.ts` 가 `tab.suffix` 존재를 canonical 보존으로 강제했음 → 본 정정과 충돌.
- 해당 단언을 **suffix 제거 가드**(`not.toMatch(/tab\.suffix/)`)로 갱신. badge rose-500 보존은 유지.
- §11.321 의 "S suffix 보존"은 raw label 금지 원칙(§11.358-1 #4)으로 폐기.

## canonical truth
- 데이터/탭 동작 변경 0. 무의미 시각 토큰만 제거 — 라벨 정직성 회복.

## 검증
- sentinel 갱신: `inventory-tab-segmented-control-321.test.ts` (suffix 제거 가드 + badge 보존). ⚠️ sandbox node_modules 소실 → Claude Code `npm run test`.
- `inventory-header-brief-migration-317.test.ts` 는 label 만 매칭 → 무영향.
- 배포 후 Chrome: "운영 현황" 탭에 "S" 미노출 확인.

## Out of Scope
- 다른 탭(품목 관리/보관 위치/입출고 흐름)은 suffix 없었음 — 변경 0.

## Rollback
- suffix 정의/렌더 복귀 + §11.321 sentinel 단언 원복.
```
footer 없음
```
