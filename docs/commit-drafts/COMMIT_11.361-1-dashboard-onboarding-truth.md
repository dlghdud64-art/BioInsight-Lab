# COMMIT — §11.361-1: 대시보드 온보딩 게이트 canonical truth (Critical)

```
fix(dashboard) §11.361-1 #onboarding-gate-truth — 온보딩 판정을 견적 단독 → 견적·재고·발주 기준으로 확장 (재고 보유 운영 유저 KPI 마스킹 해소)
```

## 무엇 (§11.361 Critical 1 — canonical truth 위반)
- 증상: 대시보드 "재고 부족 0건 · 처리 필요 0" 인데 재고 모듈은 "품목 3 · 안전재고 미달 2". 같은 계정 두 화면 상반.
- **Claude in Chrome 런타임 검증(2026-06-03, www.labaxis.co.kr):**
  - `GET /api/dashboard/stats` → **`lowStockAlerts: 2`, `reorderNeededCount: 2`, `lowStockItems.length: 2`** (200).
  - `GET /api/inventory` → **3 품목, 안전재고 미달 2**(org 소유).
  - ⇒ **데이터 층은 완전 일치(둘 다 2). truth 충돌은 데이터가 아니라 프론트 렌더.**
- **근본:** `isOnboardingMode = totalQuotesCount === 0` (견적만). 유저가 재고 3·미달 2 를 보유해도 견적이 0 이면 온보딩 모드로 강제 → "0/3 단계" 히어로 + KPI 0 placeholder 로 **실 stats(lowStockAlerts=2) 마스킹.**

## Fix
- `dashboard/page.tsx`: 온보딩 판정을 다중 모듈 기준으로:
  ```
  const hasAnyOperationalData =
    totalQuotesCount > 0 || stats.totalInventory > 0 || (stats.orderStats?.totalOrders ?? 0) > 0;
  const isOnboardingMode = !hasAnyOperationalData;
  ```
- 재고/발주 데이터가 있으면 운영 모드 → 실 KPI(재고 부족 2 등) 노출. 견적·재고·발주 전부 0 일 때만 온보딩 히어로.

## canonical truth
- 대시보드 KPI = 하위 모듈과 동일 stats(이미 live 집계, 하드코딩 0 아님). 게이트가 마스킹하던 것만 해제 → 두 화면 truth 일치.

## 검증
- 런타임(Chrome): stats=2 / inventory=2 일치 확인(위). 데이터 정상 확정.
- sentinel `dashboard-onboarding-gate-truth-361.test.ts` (게이트 다중 기준 + 구 게이트 제거). ⚠️ sandbox node_modules 소실 → **Claude Code `npm run test` 실행 필요.**
- 적용 후 Chrome 재검증 권장: 같은 계정 대시보드가 "재고 부족 2건" 노출하는지.

## Out of Scope
- §11.361-3(0-state CTA weight)·4(raw label "운영 현황s" — 대시보드 메인 page text 에 없음, 해당 탭 위치 확인 필요)·5(FAB §11.359)·6(랜딩 reveal 무해).

## Rollback
- isOnboardingMode 게이트 1블록 + sentinel revert. 독립.
```
footer 없음
```
