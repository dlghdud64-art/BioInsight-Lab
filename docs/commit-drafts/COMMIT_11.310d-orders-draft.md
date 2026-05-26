# §11.310d Commit Message Draft (실제 POST /api/orders/draft + new page wiring)

```
feat(orders): §11.310d #orders-draft-create — /api/orders/draft 신규 (PurchaseRecord create) + new page handleCreate fetch wiring (호영님 Q31 = A, 2026-05-26)

호영님 P1 spec (Q31 = A, 2026-05-26):
§11.310c MVP toast.info → 실제 POST 활성. 재고 도우미 권장 → /new
페이지 → [발주 생성] → PurchaseRecord create + toast.success + redirect.

단순화 정합 (호영님 "어렵게 가지말고 단순하게"):
- 기존 /api/orders POST (quote-based, enforceAction order_create) 변경 0
- Order/OrderItem schema 변경 0 — PurchaseRecord 만 활용 (§11.310b 패턴 정합)
- auth() 만 (enforceAction 미사용, §11.309c 패턴)

Fix (1 file 신규 + 1 file 수정 + 1 NEW sentinel):

- apps/web/src/app/api/orders/draft/route.ts (NEW, ~110 line):
  · POST handler — auth() + 401 분기
  · DraftOrderBody interface (productName/supplier/quantity/unitPrice/notes/source)
  · Input validation 3건 (productName/supplier 필수 + quantity > 0)
  · scopeKey = user.id (§11.310b PurchaseRecord 패턴 정합)
  · source 분기 — "reorder-recommendation" | "manual" (감사 추적)
  · safeUnitPrice = max(0, unitPrice ?? 0)
  · amount = quantity × safeUnitPrice
  · db.purchaseRecord.create:
    - scopeKey + purchasedAt now + vendorName.trim() + itemName.trim() +
      qty + unitPrice + amount + currency KRW + source + followUpStatus null
  · 응답: id/purchasedAt(ISO)/vendorName/itemName/qty/unitPrice/amount/source

- apps/web/src/app/dashboard/purchase-orders/new/page.tsx:
  · useState isSubmitting (button disabled 분기)
  · handleCreate sync → async:
    - validation 3건 (productName/supplier/quantity) — toast.error 기존 보존
    - fetch("/api/orders/draft", POST + JSON body)
    - body: productName.trim() + supplier.trim() + quantity + unitPrice +
      notes (optional trim) + source (reorder-recommendation | manual)
    - 응답 OK + 성공: toast.success("발주 draft가 등록되었습니다") +
      router.push("/dashboard/purchase-orders")
    - 실패: toast.error(msg) + setIsSubmitting(false)
  · 발주 생성 button:
    - disabled={isSubmitting}
    - label: isSubmitting ? "등록 중..." : "발주 생성"
  · MVP 안내문 swap (이전 slate-50 §11.310c → emerald-50 §11.310d):
    - "발주 draft가 PurchaseRecord에 등록됩니다. 정식 발주 결재는 PO 목록에서 진행하세요."

- apps/web/src/__tests__/regression/
  orders-draft-api-310d.test.ts (NEW, ~19 it):
  · API 9 it (file/POST + auth 401 + enforceAction 0 + validation 3건 +
    PurchaseRecord create + scopeKey + source 분기 + 응답 shape + KRW)
  · new page wiring 7 it (isSubmitting state + handleCreate async fetch +
    body 5건 + toast.success + redirect + toast.error + isSubmitting label +
    emerald 안내)
  · 회귀 0 3 it (기존 /api/orders quote-based 보존 + new page form 보존 + amber 0)

canonical truth 보존 (회귀 0):
- 기존 /api/orders POST (quote-based, order_create) 변경 0
- Order / OrderItem / Quote / Budget 모델 변경 0
- §11.310 ReorderReviewSheet [바로 발주] CTA 변경 0
- §11.310b /api/inventory/reorder-recommendation 변경 0
- §11.310c new page form 5 input + 색상 + Suspense + 권장 banner 변경 0
- PurchaseRecord 모델 변경 0 (read-only audit 후 write)
- auth() 미들웨어 패턴 정합 (§11.309c 단순화)

호영님 production effect:
1. labaxis.co.kr 재고 → 도우미 → [재발주안 검토하기] → [바로 발주]:
   - /dashboard/purchase-orders/new 진입 (§11.310c)
   - form prefill (§11.310c) + 추천 벤더/최근 구매 데이터 (§11.310b)
   - [발주 생성] → POST /api/orders/draft → PurchaseRecord 실제 record
   - "발주 draft가 등록되었습니다" toast + PO 목록 redirect
2. /dashboard/purchase-orders/new 직접 진입 (manual mode):
   - source="manual" 으로 PurchaseRecord create
   - 동일 흐름 (toast + redirect)
3. /dashboard/purchase-orders 목록에서 신규 PurchaseRecord 노출 (followUpStatus null)
4. 호영님 시나리오: 도우미 → bar press → 발주 1탭 완료 (3 step, 30초 내)

§11.310 시리즈 closeout ✅:
- §11.310 ✅ Sheet + 카드 분리 + sticky wiring + amber→green
- §11.310b ✅ PurchaseRecord 집계 API + hook (추천 벤더 + 최근 구매)
- §11.310c ✅ /new page + form prefill MVP (toast.info)
- §11.310d ✅ 본 batch — 실제 POST + redirect (real backend wiring)
- §11.310 series complete — 재고 도우미 → 발주 draft 흐름 종료

Out of Scope (§11.310d-2 후속):
- 정식 Order/OrderItem record 변환 (현재 PurchaseRecord 만)
- 결재 요청 워크플로우 (followUpStatus null → pending → reviewed)
- vendorId lookup (현재 vendorName plain string)
- approval workflow + audit envelope (enforceAction 추가)
- 견적 ID 자동 linkage (quote → PO 변환)
- multi-line items (현재 single product)
- /dashboard/purchase-orders 목록에서 PurchaseRecord 표시 (이미 모듈
  랜딩 페이지 — 별도 audit + tab/filter wiring 필요)

Rollback path: git revert <SHA>
- 1 file 신규 삭제 (API route) + 1 sentinel 삭제
- 1 file (new page) handleCreate 복원 → §11.310c toast.info MVP 회귀
- 사용자 영향: [발주 생성] 시 PurchaseRecord 생성 0, toast.info redirect 만
- PurchaseRecord schema 변경 0 → 기존 record 영향 0
```

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main

git add apps/web/src/app/api/orders/draft/route.ts `
  apps/web/src/app/dashboard/purchase-orders/new/page.tsx `
  apps/web/src/__tests__/regression/orders-draft-api-310d.test.ts `
  docs/commit-drafts/COMMIT_11.310d-orders-draft.md

git status   # modified: 1 + untracked: 3
git commit -F docs/commit-drafts/COMMIT_11.310d-orders-draft.md
git push origin main
```

## Production smoke

1. Vercel READY 확인
2. labaxis.co.kr 재고 → 도우미 → [재발주안 검토하기] → [바로 발주]:
   - /new 페이지 진입 + prefill 확인
   - [발주 생성] 탭 → "등록 중..." 후 toast.success
   - PO 목록 redirect 확인
3. /dashboard/purchase-orders 목록 — 신규 PurchaseRecord 노출 여부
   (현재 PO landing page 는 모듈 큐 — PurchaseRecord 표시 별도 §11.310e 후속)
4. API 직접 — POST /api/orders/draft 200 OK + 응답 shape
5. 기존 /api/orders POST (quote-based) 정상 동작
```
