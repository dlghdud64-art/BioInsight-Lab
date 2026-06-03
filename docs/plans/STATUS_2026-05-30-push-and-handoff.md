# 작업 상태 대시보드 (2026-05-30) — 푸시 묶음 + 호영님 회신 대기

이번 세션 sandbox 산출물의 **푸시 묶음**과 **호영님 env 회신 대기 항목**을 정리.
⚠️ sandbox git status 가 변경을 정확히 못 잡음 → **호영님 env `git status`/`git log` 가 ground truth**.
아래 파일 목록 기준으로 `git add` 후 묶음별 커밋 권장.

---

## A. 푸시 대기 묶음 (sandbox 산출, 호영님 env에서 커밋·푸시)

### 묶음 1 — §11.319 가이드 프레임 + 신뢰도 (모바일/웹 라벨 스캔)
- M `apps/mobile/app/scan.tsx`, `apps/mobile/hooks/useApi.ts`, `apps/mobile/lib/analytics.ts`, `apps/mobile/app/purchases/register.tsx`
- M `apps/web/src/components/inventory/LabelScannerModal.tsx`
- A `apps/mobile/lib/ocr/capture-quality.ts`, `apps/web/src/lib/ocr/capture-quality.ts`(+`__tests__/capture-quality.test.ts`)
- A `apps/web/src/__tests__/regression/reagent-label-scan-{mobile,web}-319.test.ts`
- A `docs/plans/PLAN_11.319-*.md`, `docs/commit-drafts/COMMIT_11.319-*.md`
- ※ 일부는 이미 land 됐을 수 있음(commit `9897e34a §11.319`) — env git status 로 잔여만.

### 묶음 2 — §11.318 비교 재설계 (core + 1d-1 환각 억제 + 1d-2 가드)
- A `apps/web/src/lib/compare-workspace/sourcing-recommendation.ts`(+test)  ← Phase 1c core(HEAD 드로어/route 가 import, 빌드 충족)
- A `apps/web/src/lib/ai/compare-analysis-data-gate.ts`(+test)  ← 1d-1
- M `apps/web/src/app/api/ai/compare-analysis/route.ts`  ← 1d-1 게이트
- M `apps/web/src/app/_workbench/_components/comparison-modal.tsx`  ← 1d-2 가드
- A `apps/web/src/__tests__/regression/compare-category-guard-318-1d2.test.ts`  ← 1d-2
- A `apps/web/src/app/compare/_components/sourcing-recommendation-drawer.tsx`(HEAD에 있으면 skip)
- M `apps/web/src/app/compare/page.tsx`(HEAD 복원분 — diff 0이면 skip)
- A `docs/plans/PLAN_11.318-*.md`
- ⚠️ **중복 route 삭제 필요**: `rm apps/web/src/app/api/sourcing/recommendations/route.ts` (sandbox 권한 차단으로 미삭제. 정식 route 는 `api/sourcing/recommend/route.ts`)

### 묶음 3 — §11.326 입고 데이터 모델 (packSize vs 입고수량)
- M `apps/web/prisma/schema.prisma` + A `apps/web/prisma/migrations/20260530120000_add_product_packsize_packunit/`
- A `apps/web/src/lib/inventory/map-label-to-receiving.ts`(+test)
- M `apps/web/src/components/inventory/LabelScannerModal.tsx`, `apps/web/src/app/dashboard/inventory/inventory-content.tsx`, `apps/web/src/app/api/inventory/route.ts`
- A `apps/mobile/lib/inventory/map-label-to-receiving.ts` + M `apps/mobile/app/scan.tsx`(Phase B)
- A `apps/web/src/lib/inventory/suspect-received-quantity.ts`(+test) + `apps/web/src/__tests__/regression/suspect-received-banner-326p4.test.ts`(Phase 4)
- A `apps/web/src/__tests__/regression/receiving-packsize-split-{326,mobile-326b}.test.ts`
- A `docs/plans/PLAN_11.326-*.md`
- ※ 일부 이미 push 됨(호영님: "326 푸시완료") — env git status 로 잔여만.

### 묶음 4 — §11.329 PDF 레이아웃 정정
- M `apps/web/src/lib/quotes/quote-request-pdf-generator.ts`, `apps/web/src/lib/orders/po-pdf-generator.ts`
- A `apps/web/src/__tests__/regression/pdf-layout-329.test.ts`
- A `docs/plans/PLAN_11.329-*.md`

---

## B. 호영님 env 검증 회신 대기 (회신 순서대로 sandbox 진입)

| # | 트랙 | 대기 회신 | 회신 시 진입 |
| :-- | :-- | :-- | :-- |
| 1 | §11.326 입고 | `prisma migrate deploy`(완료됨 ✓) + `vitest run` GREEN + 실제 라벨 스캔(IMG_5712 → "규격 100 CAPSULES" + "입고 1통" 분리) | (검증 완료 시) Phase B 이미 land — 추가 없음 |
| 2 | §11.318 1d-1/1d-2 | production 환각 억제 시나리오: 가격/납기 없는 비교 → 시나리오 0 / 혼합 카테고리(시약+소모품) → 자동분석 안 뜨고 경고+"그래도 분석" | baseline 확정 → 1c-rev |
| 3 | §11.329 PDF | 실제 견적서/발주서 다운로드 → 레이아웃(잘림/정렬/요청사유/푸터) 정상 + 1/10품목/긴사유/페이지넘김 | 어긋나면 COL.w 조정 |
| 4 | §11.327 (403) | production info 4건: 403 body / request headers(인증·CSRF) / 다른 PATCH·POST 정상 여부 / 로그인 직후 vs 시간 후 | Phase 2 root cause |
| 5 | §11.330 (상세 보기) | Truth Reconciliation 회신 + 옵션 A/B/C 결정 | 재배선 |

---

## C. 진입 우선순위 (회신 받는 순서)
1. §11.326 입고 검증 → (Phase B 이미 land 확인)
2. §11.327 production info → Phase 2 (DevTools Network 만으로 회신 가능, 빠름)
3. §11.330 결정 → 재배선
4. §11.318 1c-rev (대체품/벤더 추천 워크벤치 신설) — baseline 확정 후
5. dep(`/compare` deprecation) / Phase 2(외부 데이터) — 1c-rev 후속

---

## D. 학습 메모 (이번 세션)
- "회귀 0"은 **정규식 단언까지 돌린 뒤에만 선언** (grep substring 은 false negative — 주석의 단어를 호출로 오판). 1d-3 에서 lock-305/error-305-2/human-gate 3건 정밀 검증으로 확정.
- 큰 파일 편집은 **Python 원자 치환 + 매 편집 후 brace/paren/eof 무결성 확인**(Edit 툴 truncation 재발 이력 3회 — 전부 HEAD/백업 복원).
- 완료 마킹은 **sentinel PASS 확인 후에만**.
