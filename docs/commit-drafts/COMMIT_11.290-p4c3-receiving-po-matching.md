# §11.290 Phase 4c-3 Commit Message Draft

## Commit message (호영님 클로드코드 환경에서 push)

```
feat(receiving): §11.290 Phase 4c-3 거래명세서 OCR → PO 매칭 + 입고 자동 prefill (placeholder console.info → 실제 client-side matching)

호영님 P1 spec (2026-05-23):
Phase 4e-2 (LabelScannerModal correct CTA) 완료 후 Phase 4c-3 진입
(호영님 결정). receiving page 의 거래명세서 OCR 결과를 받은 후
placeholder console.info 를 실제 PO 매칭 + 입고 자동 prefill 로 swap.

Lock (minimum-diff, client-side matching):
- 새 API route 0 — client-side 매칭만 (lines props 활용)
- items[].productName ↔ line.itemLabel case-insensitive bidirectional
  includes (양방향 substring match)
- matched line 의 setReceivedQty(line.id, items[].quantity) 자동 prefill
- 매칭 결과 alert 사용자 피드백 (matchedCount + line list)

Fix (1 page handler swap + 1 sentinel test):
- receiving/[receivingId]/page.tsx onScanComplete handler swap (~50 line):
  · result.parsed.items array iterate
  · item.productName 으로 lines.find (case-insensitive bidirectional includes)
  · matched line 마다 setReceivedQty functional update 호출
  · matchedLines.length > 0 → alert ("거래명세서 스캔 완료: N건 자동 prefill /
    공급사: VENDOR / 품목 list / 수량 확인 후 입고 처리")
  · 0건 → alert ("매칭된 품목 없음 — 수동 입력 필요")
  · console.info 보존 (debug log + Phase 5 audit log 연결)

- receiving-po-matching-290-p4c3.test.ts (NEW, 6 it):
  · trace + matching helper + setReceivedQty + alert + Phase 4c-2 trigger
    보존 + QuoteScannerModal 렌더 보존

canonical truth 보존:
- ReceivingInputPanel 의 기존 6 state 변경 0
- ReceivingLineExecution / LotDetailRow type 변경 0
- Phase 4c-2 trigger button + QuoteScannerModal 렌더 보존
- lines / lots props signature 변경 0
- QuoteParseResult shape 활용만

Changes (3 files):
- apps/web/src/app/dashboard/receiving/[receivingId]/page.tsx (handler swap, ~50 line)
- apps/web/src/__tests__/regression/receiving-po-matching-290-p4c3.test.ts (NEW, 6 it)
- docs/decisions/ADR-002-pilot-tenant-seed.md (§11.290 Phase 4c-3 entry)

Verification:
- vitest §11.290 p4c-3: 6/6 GREEN
- cluster (§11.290 p4 family): 26/26 GREEN

호영님 production effect:
1. receiving detail page → 거래명세서 스캔 → matched 품목 line 의
   receivedQty 자동 채움 → 사용자가 수량 확인만 → friction 50%+ 감소
2. 매칭 결과 alert 으로 prefill 결과 명확 안내 (line list + 공급사)
3. 매칭 0건 명확 알림 → 수동 입력 path 유지 (silent failure 방지)

Out of Scope (Phase 5 / 4c-4):
- PurchaseOrder findFirst (서버 API route 필요)
- newLotNumber / newLotExpiry 자동 prefill
- 매칭 자동 화면 scroll (activeLineId 자동 set)
- 매칭 audit log (OcrJob → Receiving 연결)
- Phase 5 SDK install + Vercel env

Dependency chain:
- Phase 0~4e-2 ✅ → Phase 4c-3 ✅ (current)
- Phase 5 (env + smoke) or Phase 4c-4 (newLot prefill + scroll)

Rollback path: git revert <SHA>
- handler 본문 revert + test 삭제 → placeholder console.info 복원
- 회귀 0
```

## Files to stage

```
apps/web/src/app/dashboard/receiving/[receivingId]/page.tsx
apps/web/src/__tests__/regression/receiving-po-matching-290-p4c3.test.ts
docs/decisions/ADR-002-pilot-tenant-seed.md
docs/commit-drafts/COMMIT_11.290-p4c3-receiving-po-matching.md
```

## Push 절차 (호영님)

```bash
cd ~/ai-biocompare && git pull --ff-only

git add apps/web/src/app/dashboard/receiving/\[receivingId\]/page.tsx \
        apps/web/src/__tests__/regression/receiving-po-matching-290-p4c3.test.ts \
        docs/decisions/ADR-002-pilot-tenant-seed.md \
        docs/commit-drafts/COMMIT_11.290-p4c3-receiving-po-matching.md

git commit -F - <<'EOF'
... (위 commit message)
EOF

git push origin main
```

## Production smoke (Vercel READY 후)

1. iOS Safari / 데스크탑 → /dashboard/receiving/[receivingId] 진입
2. "거래명세서 스캔" button click → modal 열림
3. 거래명세서 image upload → AI 분석 → 완료
4. modal close → alert popup ("N건 자동 prefill" 또는 "매칭 없음")
5. matched line 의 receivedQty input 자동 채워짐 확인
6. 수량 확인 후 입고 처리 button click → 정상 동작

## 다음 단계 (Phase 5 권장)

호영님 push 후 §11.290 family 거의 final close:
- **Phase 5 (호영님 dashboard 작업):**
  1. `pnpm add @google-cloud/vision @anthropic-ai/sdk`
  2. Vercel env 4종 (STORAGE_PROVIDER, BLOB_READ_WRITE_TOKEN,
     GOOGLE_VISION_API_KEY, ANTHROPIC_API_KEY)
  3. Vercel preview deploy → production smoke
  4. cost monitoring (per-provider per-call USD)
  5. ADR §11.290 family final close + Plan close
- **선택 backlog:** Phase 4e-3 (Quote correct), Phase 4c-4 (newLot prefill)
