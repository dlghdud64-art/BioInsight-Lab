# §11.310 Commit Message Draft (재고 운영 도우미 재발주안 검토 플로우)

```
feat(inventory): §11.310 #reorder-review-flow — 재고 도우미 카드 button 분리 + 재발주안 검토 바텀시트 + 견적/발주 pre-fill 라우팅 + amber→green (호영님 P1 2026-05-26)

호영님 spec § 번호 §11.303 → §11.310 부여 (기존 §11.303 = 플랜 구조 개편
충돌 회피).

호영님 P1 spec (2026-05-26):
재고 운영 도우미 (inventory-ai-assistant-panel) 모달 안 "재발주안 검토하기"
button 이 2 개 (카드 내부 outline + 하단 sticky primary) 동시 노출 →
스크롤 시 같은 라벨 중복. 카드 button = 탐색 액션만, sticky CTA = 최종
액션으로 분리.

호영님 결정 (Q30/Q31/Q32/Q33):
  - Q30 = A: 견적 pre-fill = query string (DB write 0)
  - Q31 = A: PO pre-fill = query string + 클라이언트 draft auto-create
  - Q32 = A: 추천 벤더 = PurchaseRecord 집계 (MVP 빈 array, 후속 §11.310b)
  - Q33: §11.310 scope 만 amber→green, 전체 sweep §11.302d-6 별도

Fix (2 file 신규 + 1 file 수정 + 1 NEW sentinel):

- apps/web/src/components/inventory/ReorderReviewSheet.tsx (NEW, ~280 line):
  · Sheet (side="bottom") 기반 — max-h-[85vh] overflow-y-auto
  · 입력 type: ReorderReviewInput (productId/productName/recommendedQty/
    unit/storageLocation/vendors[]/recentPurchases[])
  · 품목 요약 (Package icon + 권장 수량 + 보관 위치 grid 2x1)
  · 추천 벤더 list (Building2 icon, slice(0,3), 최근 구매 vendor 에 emerald
    badge, vendors 0 시 yellow 안내 + bg-yellow-50 border-yellow-200)
  · 최근 구매 list (History icon, slice(0,3), 조건부 — recentPurchases > 0)
  · 예상 금액 (DollarSign icon, bg-emerald-50, 권장 수량 × 최근 단가,
    testid="reorder-review-estimated-amount")
  · CTA: [견적 요청] (outline, secondary, testid="reorder-review-request-quote-cta")
    → router.push("/dashboard/quotes?...") query string pre-fill
    (productName/quantity/reason/supplier)
  · CTA: [바로 발주] (bg-green-600 primary, testid="reorder-review-direct-purchase-cta")
    → router.push("/dashboard/purchase-orders/new?...") query string +
    prefill=reorder-recommendation (Q31 클라이언트 draft auto-create signal)
    → disabled={!hasVendor} (추천 벤더 0건 시 disabled)
  · 색상 정합: bg-green-600 / bg-emerald-50 / bg-yellow-50 / bg-yellow-100 /
    text-yellow-700 / text-emerald-700 (amber/orange 0)
  · 터치 영역 ≥ 44px (h-11 min-h-[44px])

- apps/web/src/components/ai/inventory-ai-assistant-panel.tsx:
  · import: useState + ReorderReviewSheet + ReorderReviewInput
  · lucide-react import 에 History 추가
  · InventoryAiAssistantPanel 안:
    - useState isReorderSheetOpen + selectedReorderForReview
    - handleOpenReorderSheet — recommendation set + sheet open + caller
      onReviewReorder?.() 호환 호출 (다른 caller side-effect 유지)
    - reorderReviewInput 매핑 (MVP — selectedReorderForReview 에서 vendors
      derive, recentPurchases = [], 후속 §11.310b PurchaseRecord aggregate hook)
  · ReorderSection (카드 내부) button 분리:
    - "재발주안 검토하기" button 제거 (sticky CTA 단일화 — 호영님 spec)
    - "추천 벤더 보기" 유지 (탐색 액션, testid="reorder-card-view-vendors-cta")
    - "구매 이력 보기" 신설 (탐색 액션, testid="reorder-card-view-history-cta",
      onClick → /dashboard/purchases?search=<productName>&tab=history)
  · ReorderSection 색상 정합 (§11.302 신호등):
    - urgency.urgent: bg-red-50 text-red-600 → text-red-700 (강화)
    - urgency.high: bg-amber-50 text-amber-600 → bg-yellow-100 text-yellow-700
      border-yellow-200 (호영님 spec — amber 폐지)
    - urgency.medium: text-blue-600 → text-blue-700
    - isHighlighted: bg-orange-50/50 → bg-emerald-50/40 (재발주 권장 톤)
  · StickyActions onReviewReorder = handleOpenReorderSheet (sticky CTA wiring)
  · Sticky CTA "재발주안 검토하기" 색상:
    - bg-blue-600 hover:bg-blue-700 → bg-green-600 hover:bg-green-700
      (호영님 spec "primary CTA 실행 가능 액션 = green") + font-semibold
    - testid="reorder-sticky-cta"
  · <ReorderReviewSheet> 렌더 (panel Sheet 내부) — open + onClose + data

- apps/web/src/__tests__/regression/
  reorder-review-sheet-310.test.ts (NEW, ~24 it):
  · ReorderReviewSheet 9 it (file/export + Sheet side bottom + 견적 CTA
    query string + 발주 CTA prefill + green-600 + amber 0 + 0건 fallback +
    예상 금액 계산 + 리스트 testid + 44px)
  · panel wiring 7 it (import + state + handleOpenReorderSheet +
    reorderReviewInput 매핑 + StickyActions wiring + sticky CTA green +
    Sheet 렌더)
  · 카드 button 분리 3 it (재발주안 검토하기 제거 + 추천 벤더 유지 +
    구매 이력 신설)
  · 색상 정합 4 it (urgency.high yellow + urgent red-700 + isHighlighted
    emerald + amber 잔여 0)
  · 회귀 0 3 it (라벨 / hasReorder 분기 / LotExpirySection out of scope)

canonical truth 보존 (회귀 0):
- ReorderRecommendation type 변경 0
- InventoryAiPanelData / use-inventory-ai-panel hook 변경 0
- caller props (onReviewReorder / onViewVendors / onViewLotDetail /
  onReviewDisposal / onCreatePurchaseRequest / onViewActions) 모두 호환
- StickyActions component 구조 보존 (props 만 panel handler 로 swap)
- LotExpirySection / BusinessImpactSection 변경 0 (§11.310 scope 외)
- 다른 amber 사용처 (LotExpirySection isHighlighted bg-amber-50/40 등)
  보존 — §11.302d-6 후속 sweep 대상

호영님 production effect:
1. labaxis.co.kr 재고 페이지 → 재고 운영 도우미 모달:
   - 재발주 카드 button: [추천 벤더 보기] + [구매 이력 보기] (2개, 동일 outline)
   - 하단 sticky CTA: [재발주안 검토하기] (green) + [재고 조치 항목 보기] (outline)
   - "재발주안 검토하기" 중복 해소 (이전 카드 + sticky 2 개)
2. [재발주안 검토하기] (sticky CTA) 탭 → ReorderReviewSheet:
   - 품목 / 권장 수량 / 보관 위치 요약
   - 추천 벤더 list (현재 MVP 1개, suggestedVendor 에서 derive)
   - 예상 금액 자동 계산
   - [견적 요청] → /dashboard/quotes?productName=...&quantity=...&supplier=...&reason=...
   - [바로 발주] → /dashboard/purchase-orders/new?...&prefill=reorder-recommendation
3. amber/orange → yellow/emerald 정합 (§11.310 scope 한정)
4. 호영님 시나리오: 도우미 진입 → 재발주안 검토 → 견적 또는 발주 흐름 시작

§11.310 시리즈:
- §11.310 ✅ 본 batch (카드 button 분리 + sheet + 색상 + pre-fill 라우팅)
- §11.310b ⏳ PurchaseRecord 집계 hook (useReorderVendorSuggestions /
  useReorderPurchaseHistory) — MVP vendors/recentPurchases 빈 array → 실제
  데이터 wiring
- §11.310c ⏳ /dashboard/purchase-orders/new 클라이언트 draft auto-create
  hook (prefill=reorder-recommendation 분기 처리)

Out of Scope:
- /dashboard/quotes?productName=... pre-fill 수신 처리 (caller 책임,
  기존 또는 후속 §11.310b 에서 구현)
- /dashboard/purchase-orders/new draft auto-create (§11.310c 후속)
- PurchaseRecord 집계 API/lib (§11.310b 후속)
- 다른 amber 사용처 sweep (§11.302d-6 별도 batch)
- 다수 품목 페이지네이션 ("다음 품목 2/3" — 후속, MVP 첫 품목만)

Rollback path: git revert <SHA>
- 2 file 신규 삭제 (ReorderReviewSheet + sentinel)
- 1 file (panel) 복원 — 카드 button 4개 + sticky CTA blue + amber 색상 회귀
```

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main

git add apps/web/src/components/inventory/ReorderReviewSheet.tsx `
  apps/web/src/components/ai/inventory-ai-assistant-panel.tsx `
  apps/web/src/__tests__/regression/reorder-review-sheet-310.test.ts `
  docs/commit-drafts/COMMIT_11.310-reorder-review-flow.md

git status   # modified: 1 + untracked: 3
git commit -F docs/commit-drafts/COMMIT_11.310-reorder-review-flow.md
git push origin main
```

## Production smoke (호영님 평일)

1. Vercel READY 확인
2. labaxis.co.kr 재고 → 재고 운영 도우미 모달:
   - 카드 button 2개 (추천 벤더 / 구매 이력) — "재발주안 검토하기" 0
   - sticky CTA: 녹색 "재발주안 검토하기"
3. sticky CTA 탭 → ReorderReviewSheet 열림:
   - 품목 / 수량 / 위치 요약
   - 추천 벤더 (현재 MVP 1개 — 후속 wiring)
   - 예상 금액
   - [견적 요청] → /dashboard/quotes query string
   - [바로 발주] → /dashboard/purchase-orders/new query string
4. 색상 정합 — yellow/emerald (amber 0)
5. LotExpirySection (Lot 및 유효기간 확인) 변경 0
```
