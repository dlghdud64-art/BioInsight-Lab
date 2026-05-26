# §11.309c Commit Message Draft (스마트 입고 API route)

```
feat(api): §11.309c #smart-receiving-api — /api/inventory/smart-receiving POST route (기존/신규 분기 + ocrJobId 감사 + 원자적 트랜잭션) — 호영님 P0 backend MVP Phase C

호영님 P0 spec (2026-05-26):
스마트 입고 backend MVP Phase C — OCR 결과 확인 후 사용자가 [입고 등록]
탭 시 호출되는 API. §11.309a 의 InventoryRestock.ocrJobId + extractedData
필드 활용. §11.309b 의 4-tier 매칭 결과 (caller 가 inventoryId 결정)
받아 기존 재고 increment OR 신규 Product + ProductInventory + InventoryRestock
모두 create.

§11.309c 실행 전제 (확인됨):
- §11.309a Vercel READY (sha 780b7358) — InventoryRestock 새 컬럼 활성
- §11.309b Vercel READY (sha f6135322) — product-matcher lib 사용 가능
- 기존 /api/inventory/[id]/restock/route.ts 패턴 참조 (auth + enforce +
  transaction + audit) — 정확 정합

Fix (1 file 신규 + 1 NEW sentinel):

- apps/web/src/app/api/inventory/smart-receiving/route.ts (NEW, ~280 line):
  · POST handler — auth() + enforceAction("inventory_smart_receiving")
  · Input validation (ocrJobId / quantity > 0 / 신규 시 productName)
  · OcrJob 검증 — findUnique + multi-tenant 격리 (ocrOrgMatches /
    ocrOwnerMatches / organizationMember.findFirst fallback)
  · 분기 A — 기존 inventoryId:
    - ProductInventory.findUnique + 권한 확인 (owner / org member)
    - db.$transaction:
      · productInventory.update currentQuantity increment
      · inventoryRestock.create with ocrJobId + extractedData (§11.309a 정합)
      · createAuditLog INVENTORY_RESTOCK CREATE + source="smart_receiving"
    - enforcement.complete + 응답 isNew=false
  · 분기 B — 신규 품목 (inventoryId null):
    - confirmedData.productName 필수 검증
    - targetOrgId = body.organizationId ?? ocrJob.organizationId
    - db.$transaction:
      · product.create (name/brand/catalogNumber/lotNumber/category/storageCondition)
        - category fallback DEFAULT_CATEGORY (OTHER)
      · productInventory.create (productId + userId + targetOrgId + qty)
      · inventoryRestock.create with ocrJobId + extractedData
      · createAuditLog INVENTORY_RESTOCK CREATE + source="smart_receiving" + isNewProduct=true
    - enforcement.complete + 응답 isNew=true
  · 에러 처리:
    - 401 Unauthorized / 400 입력 validation / 403 Forbidden / 404 not found
    - 500 fallback + enforcement.fail()
    - dead button 0 — 모든 분기에 real DB write + audit

- apps/web/src/__tests__/regression/
  smart-receiving-api-309c.test.ts (NEW, 22 it):
  · 파일 존재 + POST export + auth + enforceAction + deny/complete/fail (5)
  · 입력 validation 3건 (ocrJobId / quantity / productName)
  · OcrJob multi-tenant 격리 2건 (findUnique + ocrOrgMatches/ocrOwnerMatches)
  · 분기 A 5건 (findUnique 권한 / transaction increment / ocrJobId+extractedData /
    AuditLog INVENTORY_RESTOCK + source / isNew=false)
  · 분기 B 5건 (Product create / ProductInventory create / 2 inventoryRestock.create /
    isNew=true / DEFAULT_CATEGORY=OTHER)
  · 의존성 import 2건 (auth/db/Prisma/audit/enforcement + ProductCategory)

canonical truth 보존 (회귀 0):
- §11.290 OCR pipeline (image-storage / cloud-vision / claude-structurer)
  변경 0
- §11.309a InventoryRestock schema + ocrJobId/extractedData 변경 0
- §11.309b product-matcher lib 변경 0 (caller 별도)
- 기존 /api/inventory/[id]/restock POST 패턴 변경 0
- Product / ProductInventory / OcrJob schema 변경 0
- DataAuditLog 패턴 변경 0
- enforceAction security middleware 변경 0
- §11.308a SmartReceivingPlaceholderModal + §11.308a-v2 헤더 진입점 변경 0

호영님 production effect (§11.309c 자체):
1. DB schema 변경 0
2. UI 변화 0 (route 만 — caller §11.309d ScannerModal 추가 시 호출)
3. 신규 API endpoint 사용 가능:
   POST /api/inventory/smart-receiving
4. 기존 /api/inventory/[id]/restock 변경 0 (parallel route)
5. 호출 0 (placeholder modal 만 노출, 실제 scan flow 부재) — §11.309d 까지

§11.309 시리즈 진행:
- §11.309a ✅ schema + Claude invoice 프롬프트
- §11.309a-hotfix ✅ ParsedQuoteVendor shape
- §11.309b ✅ 품목 매칭 lib
- §11.309c ✅ 본 batch — API route P0
- §11.309d ⏳ SmartReceivingScannerModal + §11.308a placeholder swap (모바일 카메라 + 결과 확인 UI + API 호출)

Out of Scope:
- 신규 Product 의 category 자동 추론 (LLM 분류 — 후속 §11.309c-2)
- 거래명세서 다수 품목 일괄 입고 (현 1건 씩, 후속 §11.309e)
- PO 자동 매칭 (Phase 2 발주서 완료 후)
- 비동기 큐 처리 (MVP 동기)
- React Query invalidation (caller §11.309d 책임)
- Rate limiting (enforceAction 외 추가)
- 신규 ProductInventory 안의 organizationMember 확인 (자동 사용자/orgId 할당)

Rollback path: git revert <SHA>
- 1 file (route.ts) + 1 sentinel 신규 삭제만
- 호출 caller 0 (placeholder modal 만) → 사용자 영향 0
- 기존 inventory restock route 보존 — 수동 입고 흐름 정상
```

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main

git add apps/web/src/app/api/inventory/smart-receiving/route.ts `
  apps/web/src/__tests__/regression/smart-receiving-api-309c.test.ts `
  docs/commit-drafts/COMMIT_11.309c-smart-receiving-api.md

git status   # untracked: 3 file 확인
git commit -F docs/commit-drafts/COMMIT_11.309c-smart-receiving-api.md
git push origin main
```

## Production smoke

1. Vercel build PASS (TypeScript 정합 — Prisma type / Audit enum / Prisma.InputJsonValue)
2. Route registered: POST /api/inventory/smart-receiving
3. 호출 0 — placeholder modal 만 (§11.309d 까지 dead route)
4. 기존 /api/inventory/[id]/restock 동작 변경 0
5. DB schema InventoryRestock 새 컬럼 (§11.309a) 활용 가능
```
