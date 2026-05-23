# §11.290 Phase 4a Commit Message Draft

## Commit message (호영님 클로드코드 환경에서 push)

```
feat(ocr): §11.290 Phase 4a 기존 3 route 내부 orchestration wrapper swap (호영님 Phase 0 결정 minimum-diff, backward-compatible)

호영님 P1 spec (2026-05-23):
Phase 3 (orchestrator + provider skeleton) production land 후 Phase 4a
진입. 호영님 Phase 0 결정 "기존 3 route 내부만 orchestrator 호출로 swap
(minimum diff)" 정합 — 새 route 신설 0, UI 변경 0.

Fix (2 wrapper + 3 route swap + 1 sentinel test):
- lib/ocr/run-ocr-pipeline.ts (NEW, ~90 line):
  runOcrPipeline({ base64, type, organizationId, userId }) entry point.
  Tier 1 Gemini 항상 실행 (기존 parseWithGemini 호환).
  STORAGE_PROVIDER 미설정 시 graceful fallback (audit/cache 미사용).
  Phase 5 SDK install 후 OcrJob/OcrResult DB write + multi-provider
  fallback 자동 활성.

- lib/ocr/run-quote-ocr-pipeline.ts (NEW, ~100 line):
  runQuoteOcrPipeline({ kind: "image" | "pdf", ... }) entry point.
  image base64 + PDF buffer 둘 다 지원.
  parseQuoteWithGemini / parseQuotePDFWithGemini 호환.

- /api/inventory/scan-label/route.ts swap:
  parseWithGemini(imageBase64) → runOcrPipeline({ base64, type: "LABEL", ... })
  parseReagentLabel regex fallback 보존 (Gemini 실패 + text input path)

- /api/quotes/parse-image/route.ts swap:
  parseQuoteWithGemini(imageBase64) → runQuoteOcrPipeline({ kind: "image", ... })

- /api/quotes/parse-pdf/route.ts swap:
  parseQuotePDFWithGemini(buffer) → runQuoteOcrPipeline({ kind: "pdf", ... })
  기존 QuoteExtractionResult 호환 형태 (vendor/items/etc.) 보존

canonical truth 보존:
- LabelParseResult / QuoteParseResult shape 변경 0
- parseReagentLabel regex fallback 보존
- enforcement / auth / session / response shape 변경 0
- Gemini 호출 path 보존 (wrapper 가 first tier 로 항상 실행)

Changes (7 files):
- apps/web/src/lib/ocr/run-ocr-pipeline.ts (NEW)
- apps/web/src/lib/ocr/run-quote-ocr-pipeline.ts (NEW)
- apps/web/src/app/api/inventory/scan-label/route.ts (import + swap)
- apps/web/src/app/api/quotes/parse-image/route.ts (import + swap)
- apps/web/src/app/api/quotes/parse-pdf/route.ts (import + swap)
- apps/web/src/__tests__/regression/ocr-route-swap-290-p4a.test.ts (NEW, 12 it)
- docs/decisions/ADR-002-pilot-tenant-seed.md (§11.290 Phase 4a entry)

Verification:
- vitest §11.290 p4a sentinel: 12/12 GREEN
- cluster (§11.290 p1 + p2 + p3 + p4a): 32/32 GREEN

호영님 production effect (Phase 4a only): 0 visual.
STORAGE_PROVIDER 미설정 (현재 production 상태) 시 wrapper 가 기존
parseWithGemini / parseQuoteWithGemini / parseQuotePDFWithGemini 와 동일
결과 반환. 안전한 swap.

Out of Scope (Phase 4b/c/d, 별도 commit):
- LabelScannerModal 강화 (confidence badge + 수동 보정 + 재처리 + cache hit)
- QuoteScannerModal NEW (거래명세서 trigger)
- receiving/[receivingId]/page.tsx QuoteScannerModal trigger 추가
- 2 신규 route (/api/ocr/retry/[jobId], /api/ocr/correct/[jobId])
- Cloud Vision/Claude SDK install + wiring (Phase 5)
- Vercel env (Phase 5)

Dependency chain:
- Phase 0 ✅ → Phase 1 ✅ → Phase 2 ✅ → Phase 3 ✅ → Phase 4a ✅
- Phase 4b/c/d (UI + 2 신규 route) → Phase 5 (env + smoke)

Plan document: docs/plans/PLAN_smart-receiving-ai-phase-1.md

Rollback path:
$ git revert <SHA>
2 wrapper file 삭제 + 3 route import/call revert.
Phase 3 orchestrator dependent UI 없음 → revert 안전.
```

## Files to stage

```
apps/web/src/lib/ocr/run-ocr-pipeline.ts
apps/web/src/lib/ocr/run-quote-ocr-pipeline.ts
apps/web/src/app/api/inventory/scan-label/route.ts
apps/web/src/app/api/quotes/parse-image/route.ts
apps/web/src/app/api/quotes/parse-pdf/route.ts
apps/web/src/__tests__/regression/ocr-route-swap-290-p4a.test.ts
docs/decisions/ADR-002-pilot-tenant-seed.md
docs/commit-drafts/COMMIT_11.290-p4a-route-swap.md
```

## Push 절차 (호영님)

```bash
cd ~/ai-biocompare && git pull --ff-only

git add apps/web/src/lib/ocr/run-ocr-pipeline.ts \
        apps/web/src/lib/ocr/run-quote-ocr-pipeline.ts \
        apps/web/src/app/api/inventory/scan-label/route.ts \
        apps/web/src/app/api/quotes/parse-image/route.ts \
        apps/web/src/app/api/quotes/parse-pdf/route.ts \
        apps/web/src/__tests__/regression/ocr-route-swap-290-p4a.test.ts \
        docs/decisions/ADR-002-pilot-tenant-seed.md \
        docs/commit-drafts/COMMIT_11.290-p4a-route-swap.md

git commit -F - <<'EOF'
... (위 commit message)
EOF

git push origin main
```

## Production smoke (Vercel READY 후)

Phase 4a = route 내부 wrapper swap → 사용자 visible 효과 0.
단, Vercel build pass 확인:
1. Vercel Dashboard — latest deploy READY 확인
2. Build log — tsc 0 error
3. /api/inventory/scan-label POST 호출 정상 (기존 LabelScannerModal 작동)
4. /api/quotes/parse-image + /api/quotes/parse-pdf POST 호출 정상

## 다음 단계 (Phase 4b/c/d 결정)

호영님 push 후 결정:
- **Phase 4b:** LabelScannerModal 강화 (confidence badge + 수동 보정 + 재처리 + cache hit indicator)
- **Phase 4c:** QuoteScannerModal NEW + receiving page trigger
- **Phase 4d:** 2 신규 route (/api/ocr/retry + /api/ocr/correct)
- **Phase 5:** Cloud Vision/Claude SDK install + Vercel env + production smoke
