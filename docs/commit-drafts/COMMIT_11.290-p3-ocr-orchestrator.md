# §11.290 Phase 3 Commit Message Draft

## Commit message (호영님 클로드코드 환경에서 push)

```
feat(ocr): §11.290 Phase 3 multi-provider orchestrator + cross-validation + 3-tier fallback foundation (smart receiving AI Tier 1/2/3 logic)

호영님 P1 spec (2026-05-23):
Phase 2 (image storage) production land 후 Phase 3 진입. 3-tier
orchestrator: Tier 1 Gemini → Tier 2 Cloud Vision OCR + Claude 구조화 →
Tier 3 regex (text only).

Lock (Phase 0 결정 표):
- confidence ≥ 0.85 → SUCCESS (auto, secondary skip)
- 0.70~0.85 → cross-validate (secondary 호출 + 가중평균)
- < 0.70 → NEEDS_REVIEW (manual review)
- agreement ratio ≥ 0.8 → 가중평균 confidence
- agreement < 0.8 → NEEDS_REVIEW + mismatch alert

Fix (sandbox 3 helper + 1 unit test, minimum-diff):
- lib/ocr/orchestrator.ts (NEW, ~210 line):
  · computeAgreement(a, b) — field-level cross-validation
    (양쪽 null 제외 → denominator 감소)
  · finalizeOrchestrationResult({ primary, secondary, tertiary })
    — 5-branch logic (high SUCCESS / cross-validate / primary only /
    secondary fallback / 모두 fail FAILED)
  · enumConfidenceToNumber(result) — enum → numeric 가중평균용
  · 3 const: CONFIDENCE_AUTO_THRESHOLD=0.85,
    CONFIDENCE_REVIEW_THRESHOLD=0.7, AGREEMENT_THRESHOLD=0.8

- lib/ocr/cloud-vision-parser.ts (NEW, ~60 line):
  · extractWithCloudVision skeleton
  · CloudVisionNotConfiguredError (graceful throw)
  · Phase 5 SDK wiring placeholder

- lib/ocr/claude-structurer.ts (NEW, ~80 line):
  · structureWithClaude skeleton
  · ClaudeStructurerNotConfiguredError (graceful throw)
  · STRUCTURE_PROMPT re-export (audit + reuse)
  · lib/ai/anthropic.ts wrapper 재활용 결정

- lib/ocr/__tests__/orchestrator.test.ts (NEW, 10 it × 2 describes):
  · computeAgreement: identical / partial / total mismatch / null both
  · finalizeOrchestrationResult: high SUCCESS / low NEEDS_REVIEW /
    primary fail+secondary success / 모두 fail / cross-validate
    가중평균 / cross-validate mismatch

canonical truth 보존:
- LabelParseResult interface (lib/ocr/label-parser.ts) 변경 0 — 재사용
- OcrProvider enum (Phase 1) 정합 — providerUsed "GEMINI" /
  "CLOUD_VISION_CLAUDE" / "REGEX" 출력
- OcrJobStatus enum (Phase 1) 정합 — status "SUCCESS" / "FAILED" /
  "NEEDS_REVIEW" 출력
- lib/ai/anthropic.ts wrapper 보존 (Phase 5 wiring 시 재활용)

Changes (5 files):
- apps/web/src/lib/ocr/orchestrator.ts (NEW, ~210 line)
- apps/web/src/lib/ocr/cloud-vision-parser.ts (NEW, ~60 line)
- apps/web/src/lib/ocr/claude-structurer.ts (NEW, ~80 line)
- apps/web/src/lib/ocr/__tests__/orchestrator.test.ts (NEW, 10 it)
- docs/decisions/ADR-002-pilot-tenant-seed.md (§11.290 Phase 3 entry)

Verification:
- vitest §11.290 p3: 10/10 GREEN
- cluster (§11.290 p1 + p2 + p3): 20/20 GREEN

호영님 production effect (Phase 3 only): 0 (orchestrator land + skeleton)
Phase 4 (UI wiring + API route) 가 처음 caller.

Out of Scope (Phase 4+, 별도 commit):
- API route wiring (기존 3 route 내부 orchestrator 호출 swap)
- 2 신규 route (/api/ocr/retry/[jobId], /api/ocr/correct/[jobId])
- UI surface (LabelScannerModal 강화 + QuoteScannerModal NEW)
- Cloud Vision/Claude SDK install + wiring (Phase 5)
- Vercel env (GOOGLE_VISION_API_KEY + ANTHROPIC_API_KEY) (Phase 5)

Dependency chain:
- Phase 0 ✅ → Phase 1 ✅ → Phase 2 ✅ → Phase 3 ✅ (current)
- Phase 4 (UI wiring + API) → Phase 5 (env + smoke)

Plan document: docs/plans/PLAN_smart-receiving-ai-phase-1.md (67% complete)

Rollback path:
$ git revert <SHA>
3 helper file + 1 unit test 삭제 → Phase 4 import 시 missing import →
revert 안전.
```

## Files to stage

```
apps/web/src/lib/ocr/orchestrator.ts
apps/web/src/lib/ocr/cloud-vision-parser.ts
apps/web/src/lib/ocr/claude-structurer.ts
apps/web/src/lib/ocr/__tests__/orchestrator.test.ts
docs/decisions/ADR-002-pilot-tenant-seed.md
docs/plans/PLAN_smart-receiving-ai-phase-1.md
docs/commit-drafts/COMMIT_11.290-p3-ocr-orchestrator.md
```

## Push 절차 (호영님)

```bash
cd ~/ai-biocompare
git pull --ff-only

git add apps/web/src/lib/ocr/orchestrator.ts \
        apps/web/src/lib/ocr/cloud-vision-parser.ts \
        apps/web/src/lib/ocr/claude-structurer.ts \
        apps/web/src/lib/ocr/__tests__/orchestrator.test.ts \
        docs/decisions/ADR-002-pilot-tenant-seed.md \
        docs/plans/PLAN_smart-receiving-ai-phase-1.md \
        docs/commit-drafts/COMMIT_11.290-p3-ocr-orchestrator.md

git commit -F - <<'EOF'
... (위 commit message)
EOF

git push origin main
```

## 다음 단계 (Phase 4 진입)

호영님 push + Vercel READY 후 Phase 4 진입:
- 기존 3 route 내부 orchestrator 호출로 swap (minimum diff)
  · /api/inventory/scan-label
  · /api/quotes/parse-image
  · /api/quotes/parse-pdf
- 2 신규 route (NEW):
  · /api/ocr/retry/[jobId] (재처리 — provider swap)
  · /api/ocr/correct/[jobId] (수동 보정 결과 저장)
- UI surface 강화:
  · LabelScannerModal (confidence badge + 수동 보정 + 재처리 + cache hit indicator)
  · QuoteScannerModal (NEW, 거래명세서 trigger)
  · receiving/[receivingId]/page.tsx (QuoteScannerModal trigger button 추가)
- 8 RTL test (UI wiring + API route)
