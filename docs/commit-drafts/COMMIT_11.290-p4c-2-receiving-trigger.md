# §11.290 Phase 4c-2 Commit Message Draft

## Commit message (호영님 클로드코드 환경에서 push)

```
feat(receiving): §11.290 Phase 4c-2 QuoteScannerModal trigger button + onScanComplete placeholder (Phase 4c modal 의 caller)

호영님 P1 spec (2026-05-23):
Phase 4c (QuoteScannerModal skeleton land) 완료 후 Phase 4c-2 진입.
receiving page 에 trigger button 추가 — 거래명세서 스캔 entry point 완성.

Fix (1 file 4 변경, minimum-diff):
- receiving/[receivingId]/page.tsx:
  · import — QuoteScannerModal + FileText icon
  · ReceivingInputPanel 안에 quoteScannerOpen useState 추가
  · header 옆에 "거래명세서 스캔" trigger button
    (FileText icon + 한글 label,
     data-testid="receiving-quote-scanner-button")
  · panel 하단에 <QuoteScannerModal /> 렌더 + onScanComplete placeholder
    (console.info — vendor/itemCount/totalAmount/providerUsed/cached)

canonical truth 보존:
- ReceivingInputPanel 기존 state (activeLineId / receivedQty /
  newLotNumber / newLotExpiry / newLotLocation / discrepancies) 변경 0
- line selector / qty input / 기존 form 변경 0
- ReceivingLineExecution / LotDetailRow type 변경 0
- onScanComplete placeholder — 실제 PO 매칭 / 입고 자동 prefill 은
  Phase 4c-3 별도

Changes (3 files):
- apps/web/src/app/dashboard/receiving/[receivingId]/page.tsx
  (import 2 + FileText 1 + state 1 + button block 12 + Modal 18 + comment 6, ~40 line)
- apps/web/src/__tests__/regression/receiving-quote-scanner-trigger-290-p4c2.test.ts (NEW, 6 it)
- docs/decisions/ADR-002-pilot-tenant-seed.md (§11.290 Phase 4c-2 entry)

Verification:
- vitest §11.290 p4c-2: 6/6 GREEN
- cluster (§11.290 p1+p2+p3+p4a+p4b+p4c+p4c-2): 65/65 GREEN

호영님 production effect:
1. receiving detail page 의 입고 수량 입력 panel header 옆에
   "📄 거래명세서 스캔" button 표시
2. Button click → QuoteScannerModal open → image upload → AI 분석 →
   vendor + 품목 + 금액 표시
3. onScanComplete placeholder console.info 로깅 — Phase 4c-3 에서
   실제 PO 매칭 handler swap

Out of Scope (Phase 4c-3 / 4d / 5):
- onScanComplete handler 의 PO 매칭 실제 wiring (PurchaseOrder
  findFirst by vendor.name + items[].catalogNumber matching)
- 입고 자동 prefill (receivedQty / newLotNumber 자동 채움)
- 2 신규 route (/api/ocr/retry, /api/ocr/correct)
- Phase 5 SDK install + Vercel env

Dependency chain:
- Phase 0~4c ✅ → Phase 4c-2 ✅ (current)
- Phase 4c-3 (PO 매칭 + 입고 prefill) or Phase 4d (2 신규 route)
- Phase 5 (env + smoke)

Rollback path: git revert <SHA>
- 1 page revert + 1 test 삭제
- trigger button 제거, QuoteScannerModal 미사용 → 회귀 0
```

## Files to stage

```
apps/web/src/app/dashboard/receiving/[receivingId]/page.tsx
apps/web/src/__tests__/regression/receiving-quote-scanner-trigger-290-p4c2.test.ts
docs/decisions/ADR-002-pilot-tenant-seed.md
docs/commit-drafts/COMMIT_11.290-p4c-2-receiving-trigger.md
```

## Push 절차 (호영님)

```bash
cd ~/ai-biocompare && git pull --ff-only

git add apps/web/src/app/dashboard/receiving/\[receivingId\]/page.tsx \
        apps/web/src/__tests__/regression/receiving-quote-scanner-trigger-290-p4c2.test.ts \
        docs/decisions/ADR-002-pilot-tenant-seed.md \
        docs/commit-drafts/COMMIT_11.290-p4c-2-receiving-trigger.md

git commit -F - <<'EOF'
... (위 commit message)
EOF

git push origin main
```

## Production smoke (Vercel READY 후)

1. iOS Safari / 데스크탑 → /dashboard/receiving/[receivingId] 진입
2. ReceivingInputPanel header 우측 "📄 거래명세서 스캔" button 표시 확인
3. Button click → QuoteScannerModal 열림
4. 이미지 선택 → AI 분석 → vendor + 품목수 + 총금액 + 3 metadata badges 표시
5. 완료 click → modal close, console.info 로깅 (DevTools 확인)
6. 기존 입고 수량 입력 form 정상 작동 (canonical truth 보존)

## 다음 단계 결정

호영님 push 후 결정:
- **Phase 4c-3:** onScanComplete handler PO 매칭 실제 wiring
  (PurchaseOrder findFirst + 입고 prefill)
- **Phase 4d:** 2 신규 route (/api/ocr/retry/[jobId] + /api/ocr/correct/[jobId])
- **Phase 5:** Cloud Vision/Claude SDK + Vercel env + production smoke
- **Phase 4c-3 + 4d 통합:** PO 매칭 + 재처리/수동 보정 한 batch
```
