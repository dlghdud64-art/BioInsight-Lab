feat(api) §11.366-후속 #dashboard-stats-perf — stats route 경량화(0건 count-check + followThrough·trend 병렬 호이스트 + brand overfetch 제거)

호영님 spec: §11.366 mobile-entry-loading P0 CORE+ⓑ 후속. UX는 6s 상한+retry 단축으로 해소(라이브 차단 X). 그 위에 cold/empty 시 응답 자체를 줄여 임계경로 단축. 단순 revert 금지(§11.361-1b/1c truth fix 유지).

Fix (apps/web/src/app/api/dashboard/stats/route.ts):
- (a) Stage A 직후 0건 early count-check 분기 도입.
  · quote.count + order.count + productInventory.count + product.count 4종 병렬 호출.
  · 4종 전부 0 일 때 ~20 쿼리 배터리 스킵하고 client 기본값 흡수 가능한 minimal 응답 즉시 반환.
  · 마커: §11.366 — 0건 early count-check / `quoteCount === 0 && orderCount === 0 && ...`
- (d) brand: true overfetch 제거. select 에서 사용처 0인 brand 컬럼 제외 → 페이로드/IO 감소.
- (e) followThrough·trend Stage 병렬 호이스트. 직렬 await 체인을 Promise.all 묶음으로 끌어올림.
  · 마커: §11.366 — 병렬 호이스트.
  · 임계경로 9 stage → ≈6.

Canonical truth / contract 보존:
- 집계 8 산식 byte-보존: totalPurchaseAmount(orders 합산) / thisMonthOrders(monthStart 필터) / monthOverMonthChange / weekOverWeekChange(§11.94) / totalAssetValue(unitPrice × quantity) / categorySpending / monthlySpending(최근 6개월) / reorderNeededCount(dailyUsage × leadTime / safetyStock).
- payload top-level 24 키 보존: trend / budget / budgetUsageRate / totalPurchaseAmount / thisMonthPurchaseAmount / monthOverMonthChange / weekOverWeekChange / last7DaysSpending / totalAssetValue / reorderNeededCount / lowStockAlerts / totalInventory / expiringItems / expiringCount / lowStockItems / categorySpending / orderStats / quoteStats / monthlySpending / recentOrders / recentPurchases ...
- §11.361-1b throw → retry / §11.361-1c 스켈레톤 거짓 빈상태 차단 truth fix 유지.
- (a) 회귀 보호: client 가 totalInventory / lowStockAlerts ?? 0 기본값으로 0건 응답 흡수 — 0건 응답이 onboarding mode UX 와 정합.

회귀 검증:
- tsc src 0
- npm run build PASS (Next.js lint 포함)
- dashboard-stats-perf-366: 38/38 green (RED 4 → green 전환 + GREEN 34 보존)

Production effect: cold/empty cold start 시 stats 응답 임계경로 9 → ≈6 stage. 첫 진입 응답 단축 + 페이로드 감소(brand overfetch 제거). UX 무한 스켈레톤 차단(§11.366 CORE+ⓑ)과 시너지.

Out of Scope:
- opsFunnel 3-chain 별도 호이스트.
- §11.350 sibling(dashboard/inventory 외) 동형 적용 — 별 트랙.
- ⓒ ad-hoc early count(host route) / 2-B 세션 강제 reauth — 런타임 a/b/c 회신 후 결정.

Rollback: git revert <hash> — route 단일 파일 변경, 마커 분기·select·Promise.all 호이스트 3개 hunk 만 revert 하면 직전 동작 복구.
