# §11.290 Phase 4c Commit Message Draft

## Commit message (호영님 클로드코드 환경에서 push)

```
feat(ocr): §11.290 Phase 4c QuoteScannerModal NEW (skeleton) + parse-image/pdf ocrMetadata 응답 (호영님 동시 진행 spec — 거래명세서 trigger)

호영님 P1 spec (2026-05-23):
Phase 4b (LabelScannerModal 강화) 완료 후 Phase 4c 진입. 호영님 Phase 0
결정 "라벨 + 거래명세서 동시 trigger" 정합 — QuoteScannerModal NEW
(skeleton) + 2 quote route 의 ocrMetadata 응답 추가.

Fix (3 변경, minimum-diff):
- /api/quotes/parse-image/route.ts:
  · ocrMetadata outer scope retain (let ocrMetadata)
  · response JSON 에 ocrMetadata 추가
  · §11.290 Phase 4c trace marker

- /api/quotes/parse-pdf/route.ts:
  · 동일 pattern (PDF buffer 경로)
  · 기존 QuoteExtractionResult 호환 형태 보존
  · §11.290 Phase 4c trace marker

- QuoteScannerModal.tsx (NEW, ~270 line, skeleton):
  · QuoteScanApiResponse interface (QuoteParseResult + ocrMetadata)
  · ConfidenceBadge (LabelScannerModal 와 동일 spec)
  · ProviderBadge (Phase 4b 패턴 복제)
  · CacheHitIndicator (Phase 4b 패턴 복제)
  · 4 step state (upload / scanning / review / error)
  · File input → POST /api/quotes/parse-image → review
  · data-testid="quote-scanner-modal" + upload-button + file-input
  · Phase 4c-2 별도: receiving trigger / 풀스펙 form / PDF upload

canonical truth 보존:
- LabelScannerModal 변경 0 (별도 component)
- parse-image / parse-pdf 기존 response shape 보존 (호환 필드 + ocrMetadata 추가)
- receiving page 변경 0 (trigger 추가는 Phase 4c-2 별도)
- QuoteParseResult shape 보존 (gemini-quote-parser 재활용)
- Phase 4b 와 동일 component spec — visual 일관성

Changes (5 files):
- apps/web/src/app/api/quotes/parse-image/route.ts (let ocrMetadata + retain + response, ~15 line)
- apps/web/src/app/api/quotes/parse-pdf/route.ts (동일 pattern, ~15 line)
- apps/web/src/components/inventory/QuoteScannerModal.tsx (NEW, ~270 line)
- apps/web/src/__tests__/regression/quote-scanner-metadata-290-p4c.test.ts (NEW, 13 it × 3 describes)
- docs/decisions/ADR-002-pilot-tenant-seed.md (§11.290 Phase 4c entry)

Verification:
- vitest §11.290 p4c: 13/13 GREEN
- cluster (§11.290 p1+p2+p3+p4a+p4b+p4c): 59/59 GREEN

호영님 production effect:
1. QuoteScannerModal land — receiving page trigger 추가 (Phase 4c-2) 후
   거래명세서 image scan 가능
2. parse-image / parse-pdf response 에 ocrMetadata 노출 — caller 가 provider
   / cache hit metadata 표시 가능
3. Phase 5 후 STORAGE_PROVIDER 설정 시 multi-provider fallback + cache +
   audit log 자동 활성

Out of Scope (Phase 4c-2 / 4d / 5):
- receiving/[receivingId]/page.tsx 에 QuoteScannerModal trigger button 추가
- QuoteScannerModal 풀스펙 review form (vendor / items[] 편집)
- PDF upload support (현재 image 만)
- 2 신규 route (/api/ocr/retry, /api/ocr/correct)
- Cloud Vision/Claude SDK install + Vercel env (Phase 5)

Dependency chain:
- Phase 0~4b ✅ → Phase 4c ✅ (current)
- Phase 4c-2 (receiving trigger + 풀스펙 form) → Phase 4d (2 신규 route)
- Phase 5 (env + smoke)

Rollback path:
$ git revert <SHA>
- 2 route revert + QuoteScannerModal.tsx 삭제 + 1 test 삭제
- 회귀 0 (modal 미사용, route metadata 제거)
```

## Files to stage

```
apps/web/src/app/api/quotes/parse-image/route.ts
apps/web/src/app/api/quotes/parse-pdf/route.ts
apps/web/src/components/inventory/QuoteScannerModal.tsx
apps/web/src/__tests__/regression/quote-scanner-metadata-290-p4c.test.ts
docs/decisions/ADR-002-pilot-tenant-seed.md
docs/commit-drafts/COMMIT_11.290-p4c-quote-scanner-modal.md
```

## Push 절차 (호영님)

```bash
cd ~/ai-biocompare && git pull --ff-only

git add apps/web/src/app/api/quotes/parse-image/route.ts \
        apps/web/src/app/api/quotes/parse-pdf/route.ts \
        apps/web/src/components/inventory/QuoteScannerModal.tsx \
        apps/web/src/__tests__/regression/quote-scanner-metadata-290-p4c.test.ts \
        docs/decisions/ADR-002-pilot-tenant-seed.md \
        docs/commit-drafts/COMMIT_11.290-p4c-quote-scanner-modal.md

git commit -F - <<'EOF'
... (위 commit message)
EOF

git push origin main
```

## Production smoke (Vercel READY 후)

Phase 4c = modal land + route metadata 추가 → 사용자 visible 효과 0
(receiving page trigger 미land).

Build pass 확인:
1. Vercel Dashboard — latest deploy READY
2. Build log — tsc 0 error (QuoteScannerModal 새 component import 정상)
3. /api/quotes/parse-image + /api/quotes/parse-pdf POST 호출 정상 (기존
   caller 동일 동작, ocrMetadata response field 추가만)

## 다음 단계 (Phase 4c-2 / 4d)

호영님 push 후 결정:
- **Phase 4c-2:** receiving/[receivingId]/page.tsx 에 QuoteScannerModal
  trigger button 추가 + onScanComplete handler 작성 (PO 매칭 / 입고 자동
  prefill 등)
- **Phase 4d:** 2 신규 route (/api/ocr/retry/[jobId] + /api/ocr/correct/[jobId])
  — 재처리 + 수동 보정 endpoint
- **Phase 5:** Cloud Vision/Claude SDK install + Vercel env (GOOGLE_VISION_API_KEY
  + ANTHROPIC_API_KEY) + production smoke
