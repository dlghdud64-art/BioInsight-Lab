# §11.310b Commit Message Draft (PurchaseRecord 집계 hook + API)

```
feat(inventory): §11.310b #reorder-recommendation — /api/inventory/reorder-recommendation 신규 (PurchaseRecord 집계) + useReorderRecommendation hook + panel wiring (호영님 Q32 = A, 2026-05-26)

호영님 P1 spec (Q32 = A, 2026-05-26):
§11.310 ReorderReviewSheet 의 "추천 벤더" + "최근 구매" 영역 데이터.
MVP 빈 array → PurchaseRecord 집계 데이터로 실제 wiring.
신규 lib / API 없이 기존 PurchaseRecord 모델에서 Prisma raw query 로 집계.

Fix (2 file 신규 + 1 file 수정 + 1 NEW sentinel):

- apps/web/src/app/api/inventory/reorder-recommendation/route.ts (NEW, ~140 line):
  · GET handler — auth() 인증 + 401 분기 (§11.309c 패턴, enforceAction 0)
  · Input: ?productName=<name> (필수, 400 if empty)
  · scopeKey = user.id (guest key/userId 기존 PurchaseRecord 패턴 정합)
  · 최근 3개월 필터 (now - 90 days)
  · itemName insensitive contains productName 매칭
  · recentPurchases: db.purchaseRecord.findMany take 3 + orderBy purchasedAt desc
    - poNumber = quoteId ?? id.slice(0,8).toUpperCase()
    - unitPrice fallback = floor(amount / max(qty, 1))
  · vendors: db.purchaseRecord.groupBy
    - by vendorName, _count _all, _max purchasedAt + unitPrice
    - orderBy _max.purchasedAt desc, take 3
  · 응답 type 3건 export (ReorderVendorSuggestion / ReorderRecentPurchase /
    ReorderRecommendationResponse) — hook 에서 재사용

- apps/web/src/hooks/use-reorder-recommendation.ts (NEW, ~65 line):
  · React Query useQuery — queryKey ["reorder-recommendation", productName]
  · enabled: !!productName && productName.trim().length > 0
  · staleTime 60_000 (재고 도우미 빈번 호출 방지) + retry 1
  · 응답 fallback (vendors / recentPurchases 빈 array)
  · API route 의 type 3건 re-export (caller import 단순)

- apps/web/src/components/ai/inventory-ai-assistant-panel.tsx:
  · import useReorderRecommendation hook
  · recommendationData = useReorderRecommendation(selectedReorderForReview?.productName ?? null)
  · reorderReviewInput vendors fallback chain:
    1. recommendationData.vendors (PurchaseRecord 집계) — 우선
    2. selectedReorderForReview.suggestedVendor (MVP fallback, single)
    3. [] (empty)
  · reorderReviewInput recentPurchases:
    - recommendationData.recentPurchases.map (poNumber/purchasedAt/quantity/unitPrice)
    - 빈 array 시 ReorderReviewSheet 안 조건부 hidden (이미 §11.310 정합)

- apps/web/src/__tests__/regression/
  reorder-recommendation-api-310b.test.ts (NEW, ~20 it):
  · API 10 it (file + GET / auth 401 / productName 400 / 3개월 필터 /
    itemName insensitive / scopeKey 격리 / findMany take 3 desc /
    groupBy vendorName + _max / 응답 shape / poNumber fallback)
  · Hook 5 it (file + export / useQuery + queryKey / enabled / staleTime+retry / fallback)
  · Panel wiring 3 it (hook import + 호출 / vendors fallback chain / recentPurchases 매핑)
  · §11.310 회귀 0 3 it (Sheet 컴포넌트 / handleOpenReorderSheet / sticky CTA + 카드 button)

canonical truth 보존 (회귀 0):
- PurchaseRecord 모델 변경 0 (read-only)
- §11.310 ReorderReviewSheet 컴포넌트 변경 0
- §11.310 handleOpenReorderSheet / sticky CTA / 카드 button 분리 변경 0
- §11.309c smart-receiving route 변경 0 (auth 패턴만 재사용)
- 신규 API endpoint — 기존 caller 0
- staleTime 60s — 사용자 인터랙션 최소화

호영님 production effect:
1. labaxis.co.kr 재고 → 도우미 모달 → "재발주안 검토하기":
   - sheet 의 "추천 벤더" 영역에 실제 PurchaseRecord 집계 데이터 노출
     (최근 3개월 해당 품목 구매 vendors, 최근 구매 순 top 3)
   - "최근 구매" 영역에 PO 번호 / 일자 / 수량 / 단가 list (top 3)
   - 예상 금액 = 권장 수량 × 최근 단가 (자동 계산)
   - 벤더 0건 시 "등록된 공급사가 없습니다. 견적 요청으로 시작하세요." (호영님 spec)
2. PurchaseRecord 0건 인 신규 사용자 — fallback chain 으로 MVP 동작 유지
3. /api/inventory/reorder-recommendation 새 API endpoint — auth 만, enforceAction 0

§11.310 시리즈:
- §11.310 ✅ Sheet + 카드 분리 + sticky wiring + amber→green
- §11.310b ✅ 본 batch (PurchaseRecord 집계 hook + API)
- §11.310c ⏳ /dashboard/purchase-orders/new 클라이언트 draft auto-create
  (prefill=reorder-recommendation 분기, 호영님 Q31 = A)

Out of Scope:
- /dashboard/purchase-orders/new draft auto-create (§11.310c 후속)
- vendor reputation/score (현재 단순 최근 구매순)
- scopeKey workspace 분리 (현재 user.id 만, 후속)
- 다국어 productName 정규화 (현재 native lowercase contains)

Rollback path: git revert <SHA>
- 2 file 신규 삭제 (API route + hook)
- 1 file (panel) 복원 — MVP vendors 1개 fallback 으로 회귀
- 사용자 영향: 추천 벤더/최근 구매 list 0건 으로 회귀 (MVP fallback 정상)
```

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main

git add apps/web/src/app/api/inventory/reorder-recommendation/route.ts `
  apps/web/src/hooks/use-reorder-recommendation.ts `
  apps/web/src/components/ai/inventory-ai-assistant-panel.tsx `
  apps/web/src/__tests__/regression/reorder-recommendation-api-310b.test.ts `
  docs/commit-drafts/COMMIT_11.310b-reorder-recommendation.md

git status   # modified: 1 + untracked: 4
git commit -F docs/commit-drafts/COMMIT_11.310b-reorder-recommendation.md
git push origin main
```

## Production smoke

1. Vercel READY 확인
2. labaxis.co.kr 재고 → 도우미 → [재발주안 검토하기]:
   - sheet 안 "추천 벤더" — 실제 PurchaseRecord 집계 (최근 3개월) 노출
   - "최근 구매" — PO 3건 list 노출
   - 예상 금액 자동 계산
3. PurchaseRecord 0건 사용자 — vendors / recentPurchases 빈 array (안내문 노출)
4. /api/inventory/reorder-recommendation?productName=test — 200 OK + 응답 shape
```
