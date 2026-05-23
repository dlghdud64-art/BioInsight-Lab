# §11.290 Phase 1 Commit Message Draft

## Commit message (호영님 클로드코드 환경에서 push)

```
feat(ocr): §11.290 Phase 1 OcrJob/OcrResult Prisma schema + 3 enum (smart receiving AI multi-provider fallback foundation, 호영님 P1 spec)

호영님 P1 spec (2026-05-23):
Smart receiving AI scan backend Phase 1 — Multi-provider OCR fallback
(Gemini primary + Cloud Vision + Claude secondary + regex tertiary) 의
audit / cache / 재처리 root 가 될 schema.

호영님 결정 3건 (Phase 0):
- Multi-provider fallback (Gemini 주 + Cloud Vision 보조)
- 라벨 + 거래명세서 동시 trigger
- Phase 1 추가 backlog 8개 모두 포함 (신뢰도/cross-validation/수동 보정/
  재처리/audit log/cache/LOT prefill/PO 매칭)

호영님 결정 2건 (Phase 0 audit 후):
- 기존 3 route 내부만 orchestrator 호출로 swap (minimum diff)
- Phase 5 시점 Vercel env 호영님 dashboard 작업

Phase 0 Truth Reconciliation 결과:
- 기존 lib/ocr/{label-parser,gemini-label-parser,gemini-quote-parser}.ts
  3 file 발견. 기존 3 route 발견 + Gemini→regex fallback 패턴 발견.
- @vercel/blob ^2.3.3 이미 설치
- @google-cloud/vision + @anthropic-ai/sdk 미설치 (Phase 3 install)
- lib/ai/anthropic.ts provider-agnostic wrapper 재활용 가능

Fix (schema.prisma append, 1 file 5 def):
- enum OcrJobType — LABEL / QUOTE
- enum OcrJobStatus — PENDING / RUNNING / SUCCESS / FAILED / NEEDS_REVIEW
- enum OcrProvider — GEMINI / CLOUD_VISION_CLAUDE / REGEX (3-tier)
- model OcrJob — id / organizationId / userId / type / imageUrl /
  imageHash (SHA-256) / status / results[] / finalResult? / createdAt /
  updatedAt + @@index([organizationId, type]) + @@index([imageHash])
- model OcrResult — id / jobId / job(Cascade) / provider / parsedFields
  Json / confidence Float / rawText / costUsd Float / latencyMs /
  errorMessage / createdAt + @@index([jobId])

canonical truth 보존:
- organizationId convention (tenantId 아님, 기존 schema 정합)
- Float for cost (Decimal 미사용 schema 정합)
- 기존 LabelParseResult/ParsedQuoteDocument shape 은 parsedFields Json 흡수
- 기존 3 route Gemini→regex fallback 패턴 → OcrProvider.REGEX 흡수

변경 2 file:
- apps/web/prisma/schema.prisma (+~70 line: 3 enum + 2 model + §11.290
  comment block)
- apps/web/src/__tests__/regression/ocr-schema-presence-290-p1.test.ts
  (NEW, 7 it × 1 describe — 1 trace + 3 enum + 2 model field + 1 relation)
- docs/decisions/ADR-002-pilot-tenant-seed.md (§11.290 Phase 1 entry)

Verification:
- vitest §11.290 p1 sentinel: 7/7 GREEN
- cluster regression (§11.290 p1 + §11.284c + §11.283d): 24/24 GREEN
- prisma validate: sandbox network 403 → 호영님 환경 위임

Migration 호영님 클로드코드 환경 실행:
$ pnpm prisma validate
$ pnpm prisma migrate dev --name add_ocr_job_result_models
$ pnpm prisma generate

Out of Scope (Phase 2+, 별도 commit):
- Vercel Blob image storage helper
- Multi-provider orchestrator (Vision + Claude SDK install)
- Cross-validation algorithm
- 2 신규 route (/api/ocr/{retry|correct}/[jobId])
- 기존 3 route 내부 orchestrator swap
- UI wiring (LabelScannerModal 강화 + QuoteScannerModal NEW)
- Vercel env (GOOGLE_VISION_API_KEY + ANTHROPIC_API_KEY)

호영님 production effect (Phase 1 only): 0 (schema-only)
Phase 5 후 production: 시약 라벨 / 거래명세서 OCR scan → multi-provider
fallback → confidence badge / 수동 보정 / 재처리 / cache hit

Dependency chain:
- Phase 0 ✅ (audit) → Phase 1 ✅ (current, schema)
- Phase 2 → Phase 3 → Phase 4 → Phase 5 (Vercel env)

Plan document: docs/plans/PLAN_smart-receiving-ai-phase-1.md

Rollback path:
$ git revert <SHA>
$ pnpm prisma migrate resolve --rolled-back add_ocr_job_result_models
Migration data drop 0 (새 model 추가) → revert 안전.
```

## Files to stage

```
apps/web/prisma/schema.prisma
apps/web/src/__tests__/regression/ocr-schema-presence-290-p1.test.ts
docs/decisions/ADR-002-pilot-tenant-seed.md
docs/plans/PLAN_smart-receiving-ai-phase-1.md
docs/commit-drafts/COMMIT_11.290-p1-smart-receiving-ai-ocr-schema.md
```

## Push 절차 (호영님)

```bash
cd ~/ai-biocompare
git pull --ff-only

# Schema validation (먼저!)
cd apps/web
pnpm prisma validate

# Migration 생성 + 적용
pnpm prisma migrate dev --name add_ocr_job_result_models
pnpm prisma generate

# Migration 파일 stage
cd ../..
git add apps/web/prisma/schema.prisma \
        apps/web/prisma/migrations/ \
        apps/web/src/__tests__/regression/ocr-schema-presence-290-p1.test.ts \
        docs/decisions/ADR-002-pilot-tenant-seed.md \
        docs/plans/PLAN_smart-receiving-ai-phase-1.md \
        docs/commit-drafts/COMMIT_11.290-p1-smart-receiving-ai-ocr-schema.md

git commit -F /dev/stdin <<'EOF'
... (위 commit message)
EOF

git push origin main
```

## Pre-push 검증 (호영님 환경)

1. `pnpm prisma validate` — schema syntax GREEN 확인
2. `pnpm prisma migrate dev --name add_ocr_job_result_models` — migration 적용 (PostgreSQL connection 필요)
3. `pnpm prisma generate` — Prisma Client 재생성 확인
4. `pnpm test ocr-schema-presence` — sentinel 7/7 GREEN
5. `pnpm tsc --noEmit` — type drift 0 확인

## Production smoke (Vercel READY 후)

Phase 1 = schema-only → production visual effect 0. 단, Vercel build pass 확인:
1. **Vercel Dashboard** — `labaxis` 프로젝트 latest deploy 상태 READY 확인
2. **Build log** — `prisma generate` step 통과 + tsc 0 error
3. **DB migration** — Vercel Postgres / Supabase 에 `add_ocr_job_result_models` migration 적용 확인 (Vercel build 시 자동 또는 수동)

## 다음 단계 (Phase 2 진입 조건)

호영님 push + Vercel READY + DB migration land 확인 후:
- Phase 2: `apps/web/src/lib/ocr/image-storage.ts` (Vercel Blob + SHA-256 hash + cache lookup)
- Phase 3: `lib/ocr/{cloud-vision-parser,claude-structurer,orchestrator}.ts` + Vision/Claude SDK install
- Phase 4: 기존 3 route swap + 2 신규 route + UI wiring
- Phase 5: Vercel env + smoke + cost monitoring + ADR final close
