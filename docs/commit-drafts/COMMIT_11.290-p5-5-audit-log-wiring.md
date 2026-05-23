# §11.290 Phase 5.5 Commit Message Draft

## Commit message (호영님 클로드코드 환경에서 push)

```
feat(ocr): §11.290 Phase 5.5 audit log + 48h TTL cache wiring (run-ocr-pipeline + run-quote-ocr-pipeline 본문 swap, OcrJob/OcrResult.create 활성, Phase 6 cost monitoring 의 데이터 source 정착)

호영님 P1 spec (2026-05-23):
Phase 5 wiring (b2bfd3d) 후 Phase 6 cost monitoring 의 데이터 source
부재 발견 — jobId/cached/costUsd 모두 hardcoded null. Phase 5.5 가
Phase 5 의 Tier 1/2 fallback logic 위에 audit log + image cache layer
만 추가 (시그니처 변경 0, backward-compatible).

Phase 0 Truth Reconciliation:
- git HEAD b2bfd3d 의 run-ocr-pipeline (129 line) + run-quote-ocr-pipeline
  (97 line) 모두 jobId: null + cached: false hardcoded
- extractWithCloudVision ($0.0015) + structureWithClaude ($0.001) 가
  costUsd 반환하지만 caller 가 destructure 안 함
- uploadOcrImage / findCachedOcrJob / OcrJob / OcrResult 모두 존재 —
  호출만 안 되고 있음

Lock (graceful fallback 보존):
- happy path (env 설정 + upload 성공 + DB write 성공) 에만 audit log + cache
- 실패 path (env 미설정 / upload throw / DB write throw) 는 try/catch +
  jobId: null fallback (b2bfd3d 패턴 보존, production 중단 0)
- cache hit → 즉시 반환 + cached: true + jobId 보존 + API call 0
- PDF case 는 graceful skip (image-storage 의 image/* mime 제약,
  Phase 5.5.b 백로그)

Fix (4 file):
- apps/web/src/lib/ocr/run-ocr-pipeline.ts (129 → ~280 line):
  · getOcrImageHash → findCachedOcrJob cache lookup → finalResult 조회
  · uploadOcrImage try/catch graceful
  · OcrJob.create (RUNNING) + OcrResult.create (Gemini, costUsd: 0.001 estimate)
  · Gemini high → OcrJob.update(SUCCESS, finalResultId)
  · Tier 2 try → visionResult + claudeResult → OcrResult.create
    (CLOUD_VISION_CLAUDE, costUsd: vision + claude, latencyMs: 합)
  · Tier 2 catch → Gemini fallback + OcrJob.update
  · 모든 DB 호출 lazy await import("@/lib/db") + try/catch + console.warn

- apps/web/src/lib/ocr/run-quote-ocr-pipeline.ts (97 → ~220 line):
  · PDF case early return (jobId: null, Phase 5.5.b 백로그)
  · image case label pipeline 패턴 복제 (type: "QUOTE", parseQuoteWithGemini)
  · confidence enum → numeric 매핑 (high=0.9 / medium=0.75 / low=0.5)
  · 동등 image-storage + OcrJob/OcrResult + graceful fallback

- apps/web/src/__tests__/regression/audit-log-wiring-290-p5-5.test.ts
  (NEW, 8 it × 1 describe + 2 nested describe):
  · trace marker + label 6 it (uploadOcrImage / findCachedOcrJob /
    OcrJob.create / OcrResult.create / Tier 2 costUsd / graceful fallback)
  · quote 1 it (trace + uploadOcrImage + OcrJob.create)

- docs/decisions/ADR-002-pilot-tenant-seed.md (§11.290 Phase 5.5 entry,
  Phase 5 entry 위 chronological append)

canonical truth 보존:
- RunOcrPipelineInput/Result + RunQuoteOcrPipelineInput/Result 시그니처 0
- LabelParseResult / QuoteParseResult interface 변경 0
- OcrJob/OcrResult Prisma schema 변경 0 (Phase 1 reuse, migration 0)
- image-storage helper signature 변경 0
- 5 parser (extractWithCloudVision / structureWithClaude /
  parseWithGemini / parseQuoteWithGemini / parseQuotePDFWithGemini) 변경 0

Verification (sandbox grep simulation):
- label 7 sentinel pattern count ≥ 1 (Phase 5.5 trace ×2 / uploadOcrImage
  ×3 / findCachedOcrJob ×2 / ocrJob.create ×1 / ocrResult.create ×2 /
  visionResult.costUsd ×2 / claudeResult.costUsd ×2) +
  graceful fallback (try{ ×8 / jobId: null ×2)
- quote 3 sentinel (Phase 5.5 trace ×3 / uploadOcrImage ×4 /
  ocrJob.create ×1)
- 호영님 환경 vitest 검증 위임 (sandbox pnpm 미설치)

호영님 production effect:
1. 라벨/거래명세서 image 스캔 시 image hash 계산 + 48h TTL cache lookup
2. cache hit (같은 이미지 재스캔) → 즉시 반환 + API call 0 + cached: true
3. cache miss → Vercel Blob upload + OcrJob INSERT + Tier 1 Gemini
   OcrResult INSERT + (조건부) Tier 2 OcrResult INSERT + OcrJob.update
4. OcrResult.costUsd field 에 per-call cost 정착 (Gemini ~$0.001 /
   Vision ~$0.0015 / Claude Haiku ~$0.001)
5. UI 의 ocrMetadata.jobId non-null → retry/correct 버튼 enabled 전환
6. CacheHitIndicator UI 실제 동작 (Phase 4b / 4c 의 dead UI 활성)
7. PDF 거래명세서 case 는 jobId: null 유지 (Phase 5.5.b 백로그)

Out of Scope (Phase 5.5.b / Phase 6):
- PDF image-storage upload 지원 (mime type 확장 + uploadOcrPdf helper)
- Phase 6 admin/ocr-monitoring dashboard (OcrResult.costUsd source 정착 후)
- Gemini / Claude Haiku cost 정확화 (token 기반)

Dependency chain:
- Phase 0~4e-2 + 4c-3 + 5 ✅ → Phase 5.5 ✅ (current)
- Phase 6 (cost monitoring dashboard) — Phase 5.5 push 후 OcrResult 데이터
  누적 확인 후 진입

Rollback path: git revert <SHA>
- 4 file b2bfd3d 상태로 복원 → Phase 5 graceful fallback 동작 +
  audit log 없음
- schema 변경 0 + migration 0 → DB rollback 없음
- backward-compatible (caller 영향 0)
```

## Files to stage

```
apps/web/src/lib/ocr/run-ocr-pipeline.ts
apps/web/src/lib/ocr/run-quote-ocr-pipeline.ts
apps/web/src/__tests__/regression/audit-log-wiring-290-p5-5.test.ts
docs/decisions/ADR-002-pilot-tenant-seed.md
docs/commit-drafts/COMMIT_11.290-p5-5-audit-log-wiring.md
```

## Push 절차 (호영님)

```bash
cd ~/ai-biocompare && git pull --ff-only

# Phase 5.5 검증 (선택)
pnpm vitest run apps/web/src/__tests__/regression/audit-log-wiring-290-p5-5.test.ts

git add apps/web/src/lib/ocr/run-ocr-pipeline.ts \
        apps/web/src/lib/ocr/run-quote-ocr-pipeline.ts \
        apps/web/src/__tests__/regression/audit-log-wiring-290-p5-5.test.ts \
        docs/decisions/ADR-002-pilot-tenant-seed.md \
        docs/commit-drafts/COMMIT_11.290-p5-5-audit-log-wiring.md

git commit -F - <<'EOF'
... (위 commit message)
EOF

git push origin main
```

## Production smoke (Vercel READY 후)

1. iOS Safari / 데스크탑 Chrome → labaxis.co.kr 로그인
2. /dashboard/inventory → "AI 라벨 스캔" → 시약 라벨 사진 1장 스캔
3. **검증 항목 5종:**
   - ocrMetadata.jobId non-null (network tab response 확인)
   - ProviderBadge 표시 (GEMINI / CLOUD_VISION_CLAUDE / REGEX 중 하나)
   - 같은 이미지로 다시 스캔 → CacheHitIndicator 등장 + API call 0
   - 재처리 / 보정 저장 버튼 enabled 전환 (Phase 4e / 4e-2 dead UI 활성)
   - Vercel function logs 에 OcrJob/OcrResult INSERT 로그 + cost 누적

4. /dashboard/receiving/[id] → "거래명세서 스캔" image 1장 →
   동일 5 검증 (PDF 는 Phase 5.5.b 까지 jobId: null 유지)

## 다음 단계 (Phase 6)

Phase 5.5 push + production smoke 통과 후:
- **Phase 6.0 Truth Lock:** OcrResult 데이터 누적 확인 (Vercel function logs
  또는 production DB query) + admin/cron 패턴 + recharts dynamic import 패턴
- **Phase 6.1 RED:** ocr-monitoring-admin-290-p6.test.ts (12 it)
- **Phase 6.2 GREEN API:** /api/admin/ocr-monitoring/route.ts
  (per-provider aggregation + per-day groupBy + cache hit ratio)
- **Phase 6.3 GREEN UI:** /admin/ocr-monitoring/page.tsx + OcrCostChart
  (recharts dynamic import) + admin-sidebar entry
- **Phase 6.4 ADR + commit draft + §11.290 family final-final close v2**

## 호영님 결정 필요 (선택)
- Phase 5.5.b 진행 여부 (PDF image-storage upload 지원, 별도 batch ~3h)
- Gemini / Claude Haiku cost 정확화 (token 기반, ~2h)
- Phase 6 즉시 진행 vs 평일 시각 검증 후 진입
