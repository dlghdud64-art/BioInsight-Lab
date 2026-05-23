# §11.290 Phase 4d Commit Message Draft

## Commit message (호영님 클로드코드 환경에서 push)

```
feat(ocr): §11.290 Phase 4d 2 신규 route (/api/ocr/retry/[jobId] + /api/ocr/correct/[jobId]) skeleton (재처리 + 수동 보정 surface, 503 graceful)

호영님 P1 spec (2026-05-23):
Phase 4c-2 (receiving page trigger) 완료 후 Phase 4d 진입.
재처리 + 수동 보정 endpoint NEW — Phase 5 SDK install 후 multi-provider
fallback + OcrResult update 실제 wiring.

Lock:
- auth check + 401
- organizationId 격리 (multi-tenant)
- STORAGE_PROVIDER 미설정 시 503 graceful response
- OcrJob lookup placeholder
- Phase 5 실제 wiring 별도 mini-batch

Fix (2 신규 route + 1 sentinel test):
- /api/ocr/retry/[jobId]/route.ts (NEW, ~85 line):
  · POST handler — auth + STORAGE_PROVIDER check + jobId param
  · OcrJob.findFirst + organizationId 격리 + 404
  · Phase 5 placeholder: provider swap (Gemini → Vision+Claude) +
    runOcrPipeline 재호출 + OcrResult INSERT + finalResultId update
  · 현재 503 안내 response

- /api/ocr/correct/[jobId]/route.ts (NEW, ~95 line):
  · POST handler — auth + STORAGE_PROVIDER + jobId + correctedFields body
  · 400 validation (correctedFields object check)
  · OcrJob.findFirst + organizationId 격리 + 404
  · Phase 5 placeholder: OcrResult INSERT (provider=MANUAL, confidence=1.0)
    + finalResultId update + status SUCCESS 전환
  · 현재 503 안내 response

canonical truth 보존:
- OcrJob / OcrResult Prisma model 변경 0 (Phase 1 정합)
- 기존 route (scan-label / parse-image / parse-pdf) 변경 0
- LabelScannerModal / QuoteScannerModal 변경 0
- auth() / db / NextResponse 기존 pattern 정합
- organizationId placeholder (session.user.id) — Phase 5 OrganizationMember
  기반 실제 정합 (한 batch 일괄 swap)

Changes (4 files):
- apps/web/src/app/api/ocr/retry/[jobId]/route.ts (NEW)
- apps/web/src/app/api/ocr/correct/[jobId]/route.ts (NEW)
- apps/web/src/__tests__/regression/ocr-retry-correct-routes-290-p4d.test.ts (NEW, 14 it)
- docs/decisions/ADR-002-pilot-tenant-seed.md (§11.290 Phase 4d entry)

Verification:
- vitest §11.290 p4d: 14/14 GREEN
- cluster (§11.290 p1+p2+p3+p4a+p4b+p4c+p4c-2+p4d): 79/79 GREEN

호영님 production effect: 0 visual.
Phase 5 SDK install + Vercel env + caller wiring 후 활성.

Out of Scope (Phase 4e / 5):
- Phase 5 SDK install (Cloud Vision + Claude)
- Phase 5 Vercel env (STORAGE_PROVIDER + BLOB_READ_WRITE_TOKEN +
  GOOGLE_VISION_API_KEY + ANTHROPIC_API_KEY)
- retry route 의 provider swap 실제 wiring
- correct route 의 OcrResult INSERT + finalResultId update 실제 wiring
- LabelScannerModal / QuoteScannerModal 의 재처리 / 수동 보정 CTA →
  본 route 호출 wiring (Phase 4e)
- Phase 4c-3 PO 매칭 + 입고 prefill (별도 cluster)

Dependency chain:
- Phase 0~4c-2 ✅ → Phase 4d ✅ (current)
- Phase 4e (modal CTA wiring) or Phase 5 (env + smoke)

Rollback path:
$ git revert <SHA>
- 2 route 삭제 + 1 test 삭제 → endpoint 미존재, 회귀 0
```

## Files to stage

```
apps/web/src/app/api/ocr/retry/[jobId]/route.ts
apps/web/src/app/api/ocr/correct/[jobId]/route.ts
apps/web/src/__tests__/regression/ocr-retry-correct-routes-290-p4d.test.ts
docs/decisions/ADR-002-pilot-tenant-seed.md
docs/commit-drafts/COMMIT_11.290-p4d-retry-correct-routes.md
```

## Push 절차 (호영님)

```bash
cd ~/ai-biocompare && git pull --ff-only

git add apps/web/src/app/api/ocr/retry/\[jobId\]/route.ts \
        apps/web/src/app/api/ocr/correct/\[jobId\]/route.ts \
        apps/web/src/__tests__/regression/ocr-retry-correct-routes-290-p4d.test.ts \
        docs/decisions/ADR-002-pilot-tenant-seed.md \
        docs/commit-drafts/COMMIT_11.290-p4d-retry-correct-routes.md

git commit -F - <<'EOF'
... (위 commit message)
EOF

git push origin main
```

## Production smoke (Vercel READY 후)

Phase 4d = endpoint skeleton + 503 graceful → 사용자 visible 효과 0.
Build pass 확인:
1. Vercel Dashboard — latest deploy READY
2. Build log — tsc 0 error (새 route 정상 컴파일)
3. (선택) POST /api/ocr/retry/test-jobid → 401 unauthorized
4. (선택) authed POST → 503 "Phase 5 SDK install 대기"

## 다음 단계 결정

호영님 push 후 결정:
- **Phase 4e:** LabelScannerModal / QuoteScannerModal 에 retry + correct CTA
  wiring (button 추가 + /api/ocr/retry/[jobId] + /api/ocr/correct/[jobId] 호출)
- **Phase 4c-3:** receiving page onScanComplete handler 의 PO 매칭 +
  입고 자동 prefill
- **Phase 5:** Cloud Vision/Claude SDK install + Vercel env
  (STORAGE_PROVIDER, BLOB_READ_WRITE_TOKEN, GOOGLE_VISION_API_KEY,
  ANTHROPIC_API_KEY) + production smoke
- **Phase 4e + 5 통합:** modal CTA wiring + Vercel env 동시 land
