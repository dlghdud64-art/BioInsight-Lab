# §11.310c Commit Message Draft (PO new 페이지 prefill MVP)

```
feat(purchase-orders): §11.310c #purchase-orders-new-prefill — /dashboard/purchase-orders/new 신규 + prefill query string 수신 + form prefill + 발주 생성 MVP (호영님 Q31 = A, 2026-05-26)

호영님 P1 spec (Q31 = A, 2026-05-26):
재고 운영 도우미 → 재발주안 검토 sheet → [바로 발주] →
/dashboard/purchase-orders/new?productName=...&quantity=...&supplier=...
&unitPrice=...&prefill=reorder-recommendation
→ 본 페이지 진입 시 query string 수신 + form prefill + 발주 생성.

§11.310c MVP scope (호영님 spec "PO 화면 진입 시 클라이언트에서 draft auto-create"):
- useSearchParams 로 query string 수신
- form prefill (productName/quantity/supplier/unitPrice/notes)
- prefill="reorder-recommendation" 분기 시 권장 banner + notes 자동 채움
- [발주 생성] = MVP toast.info + redirect (실제 POST /api/orders 는 §11.310d 후속)
- [취소] = router.push("/dashboard/purchase-orders")
- dead button 0 — 모든 CTA real handler wiring

Fix (1 file 신규 + 1 NEW sentinel):

- apps/web/src/app/dashboard/purchase-orders/new/page.tsx (NEW, ~280 line):
  · "use client" + Suspense wrapper (useSearchParams 정합)
  · useSearchParams + useRouter (next/navigation)
  · PrefillForm interface (productName/quantity/supplier/unitPrice/notes)
  · EMPTY_FORM constant
  · NewPurchaseOrderPageInner 컴포넌트:
    - searchParams.get x 5 (productName/quantity/supplier/unitPrice/prefill)
    - useEffect mount 1회 — query string → form 초기화 (사용자 수정 보존)
    - prefillSource === "reorder-recommendation" 분기 → notes 자동 채움
      ("재고 운영 도우미 권장 — 안전 재고 미달")
  · 헤더:
    - [← PO 목록으로] back button (handleCancel)
    - 제목 "새 발주" + ShoppingCart icon
    - isReorderRecommendation 시 emerald badge "재고 도우미 권장"
  · prefill banner (testid="new-po-prefill-banner"):
    - emerald-50/border-emerald-200
    - "재고 운영 도우미 권장 초안이 자동 채워졌습니다" + 안내문
  · 입력 form (Card):
    - productName / quantity / supplier (필수, rose-600 *)
    - unitPrice / notes (optional)
    - quantity + unitPrice = tabular-nums
    - 모든 input testid (new-po-{field}-input)
  · 예상 금액 (testid="new-po-estimated-amount"):
    - quantity × unitPrice 자동 계산
    - bg-emerald-50 border-emerald-200 (§11.302 정합)
  · MVP 안내문 (slate-50/border-slate-200):
    - "실제 발주 생성 및 결재 요청은 후속 단계(§11.310d)에서 활성화됩니다"
  · CTA:
    - [취소] outline border-slate-300 (testid="new-po-cancel-cta")
    - [발주 생성] bg-green-600 (testid="new-po-create-cta", h-11 min-h-[44px])
  · handleCreate:
    - validation 3건 (productName/quantity/supplier) → toast.error
    - MVP: toast.info + setTimeout router.push("/dashboard/purchase-orders")
    - §11.310d 후속 — 실제 POST /api/orders 호출 + redirect to created PO
  · handleCancel: router.push("/dashboard/purchase-orders")

- apps/web/src/__tests__/regression/
  new-purchase-order-prefill-310c.test.ts (NEW, ~22 it):
  · 페이지 3 it (file/export + Suspense + useSearchParams import)
  · Query string prefill 5 it (5개 키 + isReorderRecommendation 분기 +
    banner testid + mount useEffect + notes 자동 채움)
  · Form 입력 3 it (5 input testid + 필수 rose-600 + 예상 금액 계산)
  · CTA wiring 6 it (발주 생성 testid + green-600 + validation 3건 +
    toast.info redirect + 취소 testid + back button + 44px)
  · 색상 정합 3 it (amber 0 + green-600 + emerald)
  · 회귀 0 1 it (기존 page.tsx audit only)

canonical truth 보존 (회귀 0):
- 기존 /dashboard/purchase-orders/page.tsx 변경 0
- 기존 /dashboard/purchase-orders/[poId]/page.tsx 변경 0
- /api/orders/route.ts 변경 0 (§11.310d 후속)
- PurchaseRecord / Order 모델 변경 0
- §11.310 ReorderReviewSheet [바로 발주] CTA — query string 정합 그대로
- §11.310b /api/inventory/reorder-recommendation 변경 0

호영님 production effect:
1. labaxis.co.kr 재고 → 도우미 → [재발주안 검토하기] → [바로 발주]:
   - /dashboard/purchase-orders/new 페이지 진입
   - query string 자동 form 채움 (품목/수량/공급사/단가)
   - emerald banner "재고 운영 도우미 권장 초안이 자동 채워졌습니다"
   - 사용자 form 검토/수정 → [발주 생성]
   - MVP: toast.info + PO 목록 redirect (실제 발주는 §11.310d)
2. /dashboard/purchase-orders/new 직접 진입 (query string 없음):
   - 빈 form + banner 없음 + 일반 신규 발주 흐름
3. §11.310 시리즈 closeout — 재고 도우미 → 견적/발주 flow 가능

§11.310 시리즈 (closeout 예정):
- §11.310 ✅ Sheet + 카드 분리 + sticky wiring + amber→green
- §11.310b ✅ PurchaseRecord 집계 API + hook
- §11.310c ✅ 본 batch — PO new 페이지 + prefill MVP
- §11.310d ⏳ 실제 POST /api/orders (draft create) + redirect to created PO
  (현재 toast.info 안내 → real backend wiring, MVP 동작은 정상)

Out of Scope (§11.310d 후속):
- 실제 POST /api/orders draft create + Order/OrderItem record
- 결재 요청 흐름 wiring (canApprove + approveRequestMutation)
- vendor lookup typeahead (현재 plain Input)
- catalog typeahead (productName 자동완성)
- multi-line items (현재 single product)
- 견적 ID 자동 linkage (호영님 spec quote → PO 변환)

Rollback path: git revert <SHA>
- 1 file (NEW page) + 1 sentinel 삭제
- 사용자 영향: [바로 발주] 진입 시 404 (NEW page 부재) → §11.310 sheet
  레벨 fallback 필요 (또는 §11.310 [바로 발주] disabled)
```

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main

git add apps/web/src/app/dashboard/purchase-orders/new/page.tsx `
  apps/web/src/__tests__/regression/new-purchase-order-prefill-310c.test.ts `
  docs/commit-drafts/COMMIT_11.310c-po-new-prefill.md

git status   # untracked: 3
git commit -F docs/commit-drafts/COMMIT_11.310c-po-new-prefill.md
git push origin main
```

## Production smoke

1. Vercel READY 확인
2. labaxis.co.kr 재고 → 도우미 → [재발주안 검토하기] → [바로 발주]:
   - /dashboard/purchase-orders/new 페이지 정상 진입
   - emerald banner 노출 + form 자동 채움 (품목/수량/공급사/단가)
   - notes "재고 운영 도우미 권장 — 안전 재고 미달"
   - 예상 금액 자동 계산
   - [발주 생성] → toast.info + PO 목록 redirect
3. /dashboard/purchase-orders/new 직접 진입 — 빈 form + banner 없음
4. 모바일 (375px) 터치 영역 ≥ 44px
```
