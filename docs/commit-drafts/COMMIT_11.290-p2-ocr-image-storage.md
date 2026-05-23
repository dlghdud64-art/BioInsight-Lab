# §11.290 Phase 2 Commit Message Draft

## Commit message (호영님 클로드코드 환경에서 push)

```
feat(ocr): §11.290 Phase 2 image-storage helper (Vercel Blob + SHA-256 cache + 48h TTL lookup, smart receiving AI multi-provider foundation)

호영님 P1 spec (2026-05-23):
Phase 1 (schema + production land) 완료 후 Phase 2 진입. Multi-provider
OCR fallback 의 image storage layer — uploadOcrImage / findCachedOcrJob /
getOcrImageHash 3 helper.

Truth Reconciliation:
- @vercel/blob ^2.3.3 이미 설치 (Phase 0 audit 확인)
- 기존 lib/orders/po-pdf-storage.ts abstraction 패턴 재활용
  (STORAGE_PROVIDER env + dynamic provider switch + graceful degradation)
- prefix "ocr-images" 으로 PO PDF ("po-pdfs") 와 분리
- Phase 1 schema OcrJob.imageHash @@index 활용 — cache lookup O(log n)

Fix (sandbox 1 helper + 1 unit test, minimum-diff):
- lib/ocr/image-storage.ts (NEW, 3 export):
  · getOcrImageHash(base64) → SHA-256 hex (data URI prefix normalize)
  · uploadOcrImage({ base64, organizationId, type }) → { url, hash, provider }
    Vercel Blob put() deterministic key (hash) + addRandomSuffix=false +
    allowOverwrite=true (idempotent re-upload safe)
  · findCachedOcrJob(hash, type) → OcrJob | null
    48h TTL within + status SUCCESS/NEEDS_REVIEW filter
- lib/ocr/__tests__/image-storage.test.ts (NEW, 3 it):
  · deterministic SHA-256 (same input → same hash)
  · distinct base64 → distinct hash
  · SHA-256 hex string 64 char format
- db import lazy (await import("@/lib/db")) — sandbox vitest path alias
  해석 회피, production runtime 정상

canonical truth 보존:
- STORAGE_PROVIDER env convention (po-pdf-storage 와 동일)
- BLOB_READ_WRITE_TOKEN Vercel env reuse
- Vercel Blob put() 옵션 정합 (po-pdf-storage 와 동일)
- OcrJob/OcrResult Prisma model 변경 0
- multi-tenant key: ocr-images/{organizationId}/{type}/{hash}.{ext}

Changes (3 files):
- apps/web/src/lib/ocr/image-storage.ts (NEW, ~110 line)
- apps/web/src/lib/ocr/__tests__/image-storage.test.ts (NEW, ~50 line, 3 it)
- docs/decisions/ADR-002-pilot-tenant-seed.md (§11.290 Phase 2 entry)

Verification:
- vitest §11.290 p2 unit test: 3/3 GREEN
- cluster (§11.290 p1 + p2 + §11.283e): 16/16 GREEN

호영님 production effect (Phase 2 only): 0 (helper land, caller 없음)
Phase 3 (orchestrator) 가 처음 caller.

Out of Scope (Phase 3+, 별도 commit):
- Multi-provider orchestrator (Gemini + Cloud Vision + Claude + cross-
  validation + audit log)
- @google-cloud/vision + @anthropic-ai/sdk install
- 기존 3 route 내부 orchestrator swap
- UI wiring (LabelScannerModal 강화 + QuoteScannerModal NEW)
- Vercel env (GOOGLE_VISION_API_KEY + ANTHROPIC_API_KEY)

Dependency chain:
- Phase 0 ✅ → Phase 1 ✅ → Phase 2 ✅ (current)
- Phase 3 (orchestrator) → Phase 4 (UI) → Phase 5 (Vercel env)

Plan document: docs/plans/PLAN_smart-receiving-ai-phase-1.md (50% complete)

Rollback path:
$ git revert <SHA>
Helper file + test 삭제 → Phase 3 import 시 missing import → revert 안전.
```

## Files to stage

```
apps/web/src/lib/ocr/image-storage.ts
apps/web/src/lib/ocr/__tests__/image-storage.test.ts
docs/decisions/ADR-002-pilot-tenant-seed.md
docs/plans/PLAN_smart-receiving-ai-phase-1.md
docs/commit-drafts/COMMIT_11.290-p2-ocr-image-storage.md
```

## Push 절차 (호영님)

```bash
cd ~/ai-biocompare
git pull --ff-only

git add apps/web/src/lib/ocr/image-storage.ts \
        apps/web/src/lib/ocr/__tests__/image-storage.test.ts \
        docs/decisions/ADR-002-pilot-tenant-seed.md \
        docs/plans/PLAN_smart-receiving-ai-phase-1.md \
        docs/commit-drafts/COMMIT_11.290-p2-ocr-image-storage.md

git commit -F - <<'EOF'
... (위 commit message)
EOF

git push origin main
```

## Production smoke (Vercel READY 후)

Phase 2 = helper land only → production visual effect 0.
단, Vercel build pass 확인:
1. Vercel Dashboard — latest deploy READY 확인
2. Build log — tsc 0 error, prisma generate step 통과

## 다음 단계 (Phase 3 진입)

호영님 push + Vercel READY 확인 후:
- Phase 3 Plan:
  · lib/ocr/cloud-vision-parser.ts (NEW — Cloud Vision OCR text 추출)
  · lib/ocr/claude-structurer.ts (NEW — text → LabelParseResult 구조화)
  · lib/ocr/orchestrator.ts (NEW — Gemini → Vision+Claude → regex 3-tier
    fallback + cross-validation + audit log)
  · 5 integration test (provider fallback / cross-validation / cache hit /
    audit log / cost log)
- SDK install 호영님 환경:
  $ pnpm add @google-cloud/vision @anthropic-ai/sdk
