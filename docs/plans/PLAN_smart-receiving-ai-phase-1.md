# Implementation Plan: §11.290 Smart Receiving AI Scan Backend — Phase 1

- **Status:** ⏳ Pending
- **Started:** 2026-05-23
- **Last Updated:** 2026-05-23
- **Estimated Completion:** 2026-06-04 (~5~7 영업일, Batch 10 full_enforce 완료 후 진입)

**CRITICAL INSTRUCTIONS** — After completing each phase:
1. ✅ Check off completed task checkboxes
2. 🧪 Run all relevant quality gate validation commands
3. ⚠️ Verify ALL quality gate items pass
4. 📅 Update "Last Updated" date
5. 📝 Document learnings in Notes section
6. ➡️ Only then proceed to the next phase

⛔ DO NOT skip quality gates or proceed with failing checks
⛔ DO NOT proceed with unresolved source-of-truth conflicts
⛔ DO NOT introduce dead button / no-op / placeholder success
⛔ DO NOT land schema migration in same batch as Batch 10 enforcement transition

---

## 0. Truth Reconciliation

### Latest Truth Source
- `apps/web/src/lib/ocr/label-parser.ts` — regex/heuristic deterministic parser (LabelParseResult interface 정의 위치)
- `apps/web/src/lib/ocr/gemini-label-parser.ts` — Gemini 2.5 Flash multimodal API (현 production OCR path)
- `apps/web/src/lib/ocr/gemini-quote-parser.ts` — Gemini quote (거래명세서) parser
- `apps/web/src/components/inventory/LabelScannerModal.tsx` — 시약 라벨 scan UI (작동 중)
- `apps/web/src/app/dashboard/receiving/[receivingId]/page.tsx` — receiving detail surface
- `apps/web/src/app/api/receiving/*` — receiving server routes
- 환경변수: `GOOGLE_GEMINI_API_KEY` (Vercel env, production active)

### Secondary References
- 호영님 spec (2026-05-23): "Google Cloud Vision + Claude API + 동시 진행 (라벨 + 거래명세서)"
- 호영님 결정 (multi-choice): Multi-provider fallback (Gemini 주 + Cloud Vision 보조)
- 호영님 결정: 추가 backlog 8개 모두 Phase 1 포함
- CLAUDE.md §5 LabAxis 제품 제약 (workbench / queue / rail / dock / same-canvas)
- labaxis-feature-planner skill (TDD + quality gate + rollback path)

### Conflicts Found
1. **Provider conflict:** 호영님 spec "Cloud Vision + Claude" vs 기존 production "Gemini single-call"
   → **해소:** 호영님 결정 "Multi-provider fallback (Gemini 주 + Cloud Vision 보조)" → Gemini 유지 + Vision/Claude fallback 추가
2. **거래명세서 parser 존재 여부:** `gemini-quote-parser.ts` 이미 존재 → 새로 만드는 게 아니라 multi-provider orchestrator로 통합
3. **Migration timing:** Batch 10 soft_enforce → full_enforce 전환 중 → schema 변경 동일 batch 금지

### Chosen Source of Truth
- **OCR provider order:** Gemini primary (현 production) → Cloud Vision OCR + Claude 구조화 secondary → regex (label-parser.ts) tertiary fallback
- **Cross-validation:** 양쪽 결과 비교 → confidence score 가중 + mismatch alert (agreement ratio ≥ 0.8 → 가중평균, < 0.8 → 양쪽 표시 + alert)
- **Image storage:** Vercel Blob (이미 설치됨 ^2.3.3), image hash 기반 cache TTL 48h
- **Schema:** `OcrJob` + `OcrResult` 새 Prisma model (캐시 / audit / 재처리 root)
- **거래명세서 ↔ PO 매칭:** OcrResult.parsedFields 와 `PurchaseOrder` 가격/수량 cross-check
- **Wiring decision (호영님 2026-05-23 결정):** 기존 3 route (`/api/inventory/scan-label`, `/api/quotes/parse-image`, `/api/quotes/parse-pdf`) 내부 함수만 orchestrator 호출로 swap. 새 `/api/ocr/*` route 신설 0, caller URL drift 0.
- **재처리/수동 보정 surface:** 새 route 만 신설 (`/api/ocr/retry/[jobId]`, `/api/ocr/correct/[jobId]`). 기존 route 와 분리.
- **Confidence threshold:** ≥ 0.85 auto / 0.70~0.85 cross-validate / < 0.70 manual review

### Environment Reality Check
- [x] repo / branch context understood — `~/ai-biocompare` main branch
- [x] runnable commands identified — `pnpm test`, `pnpm prisma migrate dev`, `pnpm tsc --noEmit`
- [x] Vercel Blob `@vercel/blob` ^2.3.3 이미 설치됨 — Phase 2 install skip
- [ ] **Phase 5 시점 호영님 작업 필요:** Vercel env (`GOOGLE_VISION_API_KEY`, `ANTHROPIC_API_KEY`) 설정 + Vercel Blob bucket 활성화 확인
- [ ] **Phase 3 시점 sandbox install 필요:** `@google-cloud/vision`, `@anthropic-ai/sdk` (lib/ai/anthropic.ts wrapper 재활용)

---

## 1. Priority Fit

### Current Priority Category
- [ ] P1 immediate
- [x] Release blocker (Batch 10 완료 후)
- [ ] Post-release
- [ ] P2 / Deferred

### Why This Priority
- Smart receiving 은 LabAxis 운영 OS 의 핵심 가치 (라벨/거래명세서 자동 prefill → 입고 friction 제거)
- 현재 Gemini single-call 은 single point of failure — production 운영 안정성 부족
- Batch 10 full_enforce 완료 후 즉시 진입 (호영님 결정) — Multi-provider fallback + canonical truth (LOT/PO 매칭) 통합

---

## 2. Work Type

- [x] Feature (Multi-provider OCR orchestrator + 거래명세서 trigger)
- [x] API Slimming (`/api/ocr/*` 통합 endpoint)
- [x] Workflow / Ontology Wiring (OcrResult → InventoryItem prefill, OcrResult → PO 매칭)
- [ ] Migration / Rollout (schema migration 포함 → rollout safety 명시)
- [ ] Billing / Entitlement (Phase 3 defer)
- [ ] Mobile (Phase 2 defer — Expo 카메라 직접 촬영)
- [x] Web

---

## 3. Overview

### Feature Description
LabAxis 입고 surface 에서 시약 라벨 / 거래명세서를 카메라 또는 파일 업로드로 스캔 시:
1. Gemini 2.5 Flash multimodal 1차 호출
2. Confidence < threshold 또는 호출 실패 → Cloud Vision OCR text 추출 → Claude API 구조화 fallback
3. 양쪽 결과 cross-validation (양쪽 모두 성공 시 가중 평균, mismatch 시 alert)
4. Parsed result → InventoryItem prefill (LOT/유통기한/제조원 자동 채움) 또는 PurchaseOrder 가격/수량 mismatch alert
5. Confidence < manual review threshold → 사용자 수동 보정 UI 노출
6. Image hash 기반 cache (48h TTL) — 동일 라벨 재스캔 시 OCR 호출 skip

### Success Criteria
- [ ] Multi-provider fallback 작동 — Gemini 실패 시 Vision+Claude 자동 fallback
- [ ] Cross-validation 작동 — 양쪽 결과 비교 후 confidence score 가중
- [ ] OcrJob audit log 모든 호출 기록 (provider/cost/latency/success)
- [ ] Image cache hit 시 API 호출 0
- [ ] LOT/유통기한 자동 prefill — InventoryItem 생성 friction 제거
- [ ] 거래명세서 ↔ PO 가격/수량 mismatch 자동 detect + alert
- [ ] 수동 보정 UI — confidence 낮을 시 dead button 없이 graceful recovery
- [ ] iOS Safari + Chrome smoke GREEN (라벨 + 거래명세서 양쪽)

### Out of Scope (⚠️ 절대 구현하지 말 것)
- [ ] Expo 카메라 직접 촬영 → Phase 2 (labaxis-react-native-expert)
- [ ] Entitlement 기반 monthly OCR quota → Phase 3 (Batch 10 full_enforce 이후)
- [ ] 다중 이미지 merge (front/back/side) → Phase 2
- [ ] 손상품 photo 첨부 + 검수자 서명 → 별도 spec
- [ ] OCR 학습 데이터 수집 (ML fine-tuning pipeline) → 장기 R&D
- [ ] Slack/Email push 알림 → Phase 3 (webhook infrastructure 별도 트랙)

### User-Facing Outcome
- 시약 도착 → LabelScannerModal 카메라/파일 → 즉시 OcrJob 생성 → 결과 표시 (confidence badge 포함)
- 거래명세서 도착 → QuoteScannerModal (NEW) 카메라/파일 → 즉시 OcrJob 생성 → PO 자동 매칭 결과 표시
- 결과가 confidence 낮을 시 → "수동 보정" CTA 노출 → 사용자가 field 직접 편집
- 동일 라벨 재스캔 → cache hit indicator 표시 (API 호출 0)

---

## 4. Product Constraints

### Must Preserve
- [x] workbench / queue / rail / dock — receiving surface 의 4-zone 구조 유지
- [x] same-canvas — LabelScannerModal/QuoteScannerModal 은 receiving page 안에서 작동 (별도 페이지 신설 금지)
- [x] canonical truth — OcrResult 는 read-only projection, InventoryItem/PurchaseOrder 가 truth
- [x] invalidation discipline — OcrJob 완료 시 receiving query cache invalidate

### Must Not Introduce
- [x] page-per-feature — `/dashboard/receiving/ocr/*` 별도 페이지 신설 금지
- [x] chatbot/assistant reinterpretation — OcrResult 는 selectable work object, 자유 채팅 0
- [x] dead button / no-op / placeholder success — 수동 보정 CTA / 재처리 CTA 모두 실제 mutation 연결
- [x] fake billing/auth shortcut — 호영님 결정 전 entitlement 추가 금지
- [x] preview overriding actual truth — OcrResult 가 InventoryItem update 시 사용자 명시 confirm 필수

### Canonical Truth Boundary
- **Source of Truth:** `OcrJob` (image hash + provider + result + audit) + `InventoryItem` (prefilled fields) + `PurchaseOrder` (매칭 대상)
- **Derived Projection:** `OcrResult.parsedFields` (LabelParseResult shape) + cross-validation score + cache hit
- **Snapshot / Preview:** Scan modal 안의 "결과 미리보기" — 사용자 confirm 전까지 InventoryItem 변경 0
- **Persistence Path:** Scan → OcrJob 생성 → provider 호출 → OcrResult 저장 → 사용자 confirm → InventoryItem prefill mutation

### UI Surface Plan
- [x] Existing route section — `/dashboard/receiving/[receivingId]` 안의 modal
- [x] Settings panel — Phase 5 cost monitoring dashboard (간단한 audit log viewer)
- [ ] New page (⚠️ 명시적 정당화 없음)

---

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| **Gemini primary + Vision/Claude fallback** | 현 production Gemini 단일 호출 graceful degradation 없음 → 안정성 강화 | API 비용 ~2x (양쪽 호출 시), latency ~1.5x |
| **Vercel Blob image storage** | image hash cache 위한 영구 저장 + Vercel infra 통합 | S3 대비 비용 약간 높음, 호영님 dashboard 설정 필요 |
| **OcrJob + OcrResult 분리** | OcrJob = 1번 호출, OcrResult = provider 별 결과 (cross-validation 위함) | Schema 복잡도 +1 model, migration 신중 필요 |
| **Image hash cache (SHA-256)** | 동일 라벨 재스캔 비용 0 + 사용자 UX 개선 | 같은 lot 다른 인쇄 (조명/각도) → cache miss (TODO Phase 2) |
| **Confidence threshold = 0.7 (low → manual review)** | 자동 fail-safe — 잘못된 prefill 방지 | 호영님 실사용 데이터로 tuning 필요 |

### Dependencies
- **Required Before Starting:**
  - [ ] Batch 10 full_enforce 완료 (호영님 진행 중)
  - [ ] Vercel env `GOOGLE_VISION_API_KEY` 추가 (호영님 dashboard)
  - [ ] Vercel env `ANTHROPIC_API_KEY` 추가 (호영님 dashboard)
  - [ ] Vercel Blob bucket 생성 (호영님 dashboard)
- **External Packages:**
  - `@google-cloud/vision` (Cloud Vision OCR)
  - `@anthropic-ai/sdk` (Claude API 구조화)
  - `@vercel/blob` (image storage)
- **Existing Routes / Models / Services Touched:**
  - `apps/web/src/lib/ocr/*` — 3 file (orchestrator 추가)
  - `apps/web/src/components/inventory/LabelScannerModal.tsx` — confidence badge + 수동 보정 추가
  - `apps/web/src/components/inventory/QuoteScannerModal.tsx` — NEW
  - `apps/web/src/app/api/ocr/*` — NEW (unified endpoint)
  - `apps/web/src/app/dashboard/receiving/[receivingId]/page.tsx` — QuoteScannerModal trigger 추가
  - `prisma/schema.prisma` — OcrJob + OcrResult model 추가

### Integration Points
- `/api/ocr/label` — POST image → OcrJob → OcrResult (시약 라벨)
- `/api/ocr/quote` — POST image → OcrJob → OcrResult (거래명세서)
- `/api/ocr/retry/:jobId` — provider swap 재처리
- `/api/ocr/correct/:jobId` — 수동 보정 결과 저장
- TanStack Query cache key: `["ocr", "job", jobId]`, `["receiving", receivingId]`

---

## 6. Global Test Strategy

All phases must strictly follow Red-Green-Refactor.

### Test Strategy by Work Type
- **Business logic:** unit tests required (orchestrator, cross-validation, cache hash)
- **API contract:** integration tests required (`/api/ocr/*` 4 routes)
- **User-visible flows:** smoke path 2 (라벨 + 거래명세서)
- **Migration:** rollback verification (revert migration + data preserved)
- **Workflow / ontology:** OcrResult → InventoryItem prefill mutation matrix + PO 매칭 mismatch matrix

### Execution Notes
- Sandbox vitest 실행 불가 시 호영님 클로드코드 환경 위임
- Vercel preview deploy + Chrome MCP smoke 권장
- Cost monitoring 은 phase 5 에서 실제 호출 비용 측정 (sandbox 검증 불가)

---

## 7. Implementation Phases

### Phase 0: Context & Truth Lock
**Goal:** OCR pipeline / Vision SDK / Claude SDK / Vercel Blob 상호작용 audit + 결정 표 확정.
- Status: [x] Complete (2026-05-23)

**🔴 RED:** 현 Gemini pipeline 의 confidence 분포 (실제 운영 데이터) + 실패 case 식별 — production data 미수집 (Phase 5 metering 시 수집)
**🟢 GREEN:** Multi-provider call order 확정 (Gemini → Vision+Claude → regex → cross-validate)
**🔵 REFACTOR:** 가정 / 충돌 / risk 명시 — 호영님 결정 2건 (wiring + env timing) 반영

**산출물:**
- [x] OCR provider call order decision table (3-tier: Gemini → Vision+Claude → regex)
- [x] Cross-validation algorithm pseudocode (field-level agreement ratio ≥ 0.8 → 가중평균)
- [x] Cache key (SHA-256(imageBase64) + `:${type}`) + TTL 48h 결정
- [x] Cost estimation per provider (Gemini $0.001 + Vision $0.0015 + Claude Haiku $0.03 = fallback path ~$0.0325, primary only $0.001, 실효 ~$0.005/call cache+success 가정)
- [x] 기존 routes 발견 (`/api/inventory/scan-label`, `/api/quotes/parse-image`, `/api/quotes/parse-pdf`) → swap 결정
- [x] @vercel/blob 이미 설치됨 확인 (^2.3.3)
- [x] @google-cloud/vision + @anthropic-ai/sdk 미설치 확인 (Phase 3 install 단계 추가)
- [x] lib/ai/anthropic.ts provider-agnostic wrapper 재활용 결정 (LABAXIS_AI_PROVIDER=anthropic 모드)

**✋ Quality Gate:** Conflict 0 (호영님 spec ↔ existing pipeline 통합 해소), rollback path 명시 (planning-only, no code change)
**Rollback:** N/A — read-only audit

---

### Phase 1: Schema (OcrJob + OcrResult + Migration)
**Goal:** Prisma schema 변경 + migration + sentinel test (RED).
- Status: [x] Complete sandbox (2026-05-23) — migration land 호영님 클로드코드 환경 위임

**🔴 RED:** OcrJob/OcrResult 부재 확인 test 작성 (`expect(schema).toMatch(/model OcrJob/)`)
**🟢 GREEN:**
```prisma
model OcrJob {
  id            String   @id @default(cuid())
  tenantId      String
  userId        String
  type          OcrJobType  // LABEL | QUOTE
  imageUrl      String       // Vercel Blob URL
  imageHash     String       // SHA-256
  status        OcrJobStatus // PENDING | RUNNING | SUCCESS | FAILED | NEEDS_REVIEW
  results       OcrResult[]
  finalResult   OcrResult? @relation("FinalResult", fields: [finalResultId], references: [id])
  finalResultId String? @unique
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  @@index([tenantId, type])
  @@index([imageHash])  // cache lookup
}

model OcrResult {
  id             String   @id @default(cuid())
  jobId          String
  job            OcrJob   @relation(fields: [jobId], references: [id], onDelete: Cascade)
  provider       OcrProvider  // GEMINI | CLOUD_VISION_CLAUDE
  parsedFields   Json         // LabelParseResult shape
  confidence     Float        // 0.0 ~ 1.0
  rawText        String?      // OCR raw text
  costUsd        Decimal      @db.Decimal(10,6)
  latencyMs      Int
  errorMessage   String?
  createdAt      DateTime @default(now())
  @@index([jobId])
}

enum OcrJobType { LABEL QUOTE }
enum OcrJobStatus { PENDING RUNNING SUCCESS FAILED NEEDS_REVIEW }
enum OcrProvider { GEMINI CLOUD_VISION_CLAUDE }
```
**🔵 REFACTOR:** Naming consistency (다른 audit table 과 정합)

**산출물:**
- [ ] `prisma/schema.prisma` diff
- [ ] Migration file: `add_ocr_job_result_models`
- [ ] `apps/web/src/__tests__/regression/ocr-schema-presence-290-p1.test.ts`

**✋ Quality Gate:**
- [ ] RED 확인 (initial test failing 명확)
- [ ] `pnpm prisma generate` 통과
- [ ] `pnpm tsc --noEmit` 통과
- [ ] Migration rollback path 확인 (`pnpm prisma migrate reset` 또는 down migration)

**Rollback:** `pnpm prisma migrate resolve --rolled-back <migration>` + schema revert

---

### Phase 2: Image Storage Helper (Vercel Blob + SHA-256 hash)
**Goal:** Image upload + hash + cache lookup 헬퍼.
- Status: [ ] Pending

**🔴 RED:** `uploadOcrImage` / `getOcrImageHash` / `findCachedOcrJob` 부재 test
**🟢 GREEN:** `apps/web/src/lib/ocr/image-storage.ts`:
- `uploadOcrImage(base64) → { url, hash }`
- `findCachedOcrJob(hash, type) → OcrJob | null` (48h TTL 이내)
- `getOcrImageHash(base64) → SHA-256 string`

**🔵 REFACTOR:** Naming + error handling

**산출물:**
- [ ] `apps/web/src/lib/ocr/image-storage.ts`
- [ ] `apps/web/src/lib/ocr/__tests__/image-storage.test.ts` (3 unit test)

**✋ Quality Gate:**
- [ ] `pnpm test image-storage` GREEN
- [ ] Vercel Blob sandbox connection 확인 (또는 호영님 위임)

**Rollback:** Helper file 삭제 + test 삭제 (다른 phase 미사용 보장)

---

### Phase 3: Multi-Provider Orchestrator + Cross-Validation
**Goal:** Gemini + Cloud Vision + Claude orchestrator + 양쪽 결과 cross-validation + audit log.
- Status: [ ] Pending

**🔴 RED:** Orchestrator integration test (mock provider) — fallback path / cross-validation / cache hit / audit log
**🟢 GREEN:**
- `apps/web/src/lib/ocr/cloud-vision-parser.ts` (OCR text 추출만)
- `apps/web/src/lib/ocr/claude-structurer.ts` (Cloud Vision text → LabelParseResult)
- `apps/web/src/lib/ocr/orchestrator.ts`:
  ```ts
  async function runOcrJob({ jobId, type, image }): Promise<OcrJob> {
    // 1. cache lookup
    const cached = await findCachedOcrJob(hash, type);
    if (cached) return cached;
    // 2. Gemini primary
    const geminiResult = await tryGemini(image);
    if (geminiResult.confidence >= 0.85) return saveResult(jobId, geminiResult);
    // 3. Vision + Claude fallback
    const visionResult = await tryVisionClaude(image);
    // 4. cross-validate
    const final = crossValidate(geminiResult, visionResult);
    return saveResult(jobId, final);
  }
  ```
- Cost / latency / error 모두 OcrResult.costUsd / latencyMs / errorMessage 기록

**🔵 REFACTOR:** Provider abstraction interface (`interface OcrProviderClient { parse(image): OcrResult }`)

**산출물:**
- [ ] `apps/web/src/lib/ocr/cloud-vision-parser.ts`
- [ ] `apps/web/src/lib/ocr/claude-structurer.ts`
- [ ] `apps/web/src/lib/ocr/orchestrator.ts`
- [ ] `apps/web/src/lib/ocr/__tests__/orchestrator.test.ts` (5 integration test)

**✋ Quality Gate:**
- [ ] Provider fallback path GREEN (Gemini fail → Vision+Claude 자동 fallback)
- [ ] Cross-validation 정확 (mismatch detect + confidence 가중)
- [ ] Audit log 모든 호출 기록 (cost/latency/success)
- [ ] Cache hit 시 API 호출 0 확인

**Rollback:** Orchestrator file 삭제 + LabelScannerModal 이 직접 gemini-label-parser 호출하던 상태로 revert

---

### Phase 4: UI Wiring (LabelScannerModal + QuoteScannerModal + API routes)
**Goal:** 실제 사용자 surface 와 연결 — 수동 보정 / 재처리 / cache hit indicator 포함.
- Status: [ ] Pending

**🔴 RED:** RTL test — confidence badge / 수동 보정 CTA / 재처리 CTA 존재 + onClick 실제 mutation 연결
**🟢 GREEN:**
- `apps/web/src/app/api/ocr/label/route.ts` (POST)
- `apps/web/src/app/api/ocr/quote/route.ts` (POST)
- `apps/web/src/app/api/ocr/retry/[jobId]/route.ts` (POST)
- `apps/web/src/app/api/ocr/correct/[jobId]/route.ts` (POST)
- `apps/web/src/components/inventory/LabelScannerModal.tsx` 수정:
  - Confidence badge (`high|medium|low` → emoji + color)
  - 수동 보정 CTA (confidence < 0.7 시 표시)
  - 재처리 CTA (provider swap)
  - Cache hit indicator (`🔄 캐시 적중`)
- `apps/web/src/components/inventory/QuoteScannerModal.tsx` (NEW, LabelScannerModal pattern 복제):
  - 거래명세서 trigger
  - PO 매칭 결과 표시 (가격/수량 mismatch alert)
- `apps/web/src/app/dashboard/receiving/[receivingId]/page.tsx`:
  - QuoteScannerModal trigger button 추가 (same-canvas, 별도 페이지 X)

**🔵 REFACTOR:** Shared component (ScanResultPanel) — Label/Quote modal 공통 UI 추출

**산출물:**
- [ ] API routes (4 file)
- [ ] LabelScannerModal.tsx 수정 (confidence badge + 수동 보정 + 재처리 + cache hit)
- [ ] QuoteScannerModal.tsx (NEW)
- [ ] receiving/[receivingId]/page.tsx 수정 (QuoteScannerModal trigger)
- [ ] `apps/web/src/__tests__/regression/ocr-ui-wiring-290-p1.test.ts` (8 RTL test)

**✋ Quality Gate:**
- [ ] Dead button 0, no-op 0 (모든 CTA 실제 mutation 연결)
- [ ] Loading/error/empty state 모두 존재
- [ ] Same-canvas 유지 (별도 페이지 신설 0)
- [ ] Mobile responsive 정합 (sm:/md:/lg: breakpoint)

**Rollback:** Modal 변경 revert + QuoteScannerModal.tsx 삭제 + API route 삭제

---

### Phase 5: Smoke + Rollout + ADR
**Goal:** Vercel env 설정 후 production smoke + cost monitoring + rollback path 확정.
- Status: [ ] Pending

**🔴 RED:** Rollout failure mode 식별 (Vision API key missing / Claude rate limit / Vercel Blob quota)
**🟢 GREEN:**
- Vercel env 확정 (`GOOGLE_VISION_API_KEY`, `ANTHROPIC_API_KEY`)
- Vercel preview deploy
- iOS Safari 라벨 scan smoke
- iOS Safari 거래명세서 scan smoke
- Cost monitoring 첫 100 호출 비용 측정
- Cache hit ratio 측정
- ADR-002 §11.290 entry append

**🔵 REFACTOR:** Temporary instrumentation 제거, audit log dashboard 간소화

**산출물:**
- [ ] Production smoke checklist (8 항목)
- [ ] Cost monitoring 결과 (per-provider per-call USD)
- [ ] Cache hit ratio 결과 (24h 윈도우)
- [ ] `docs/decisions/ADR-002-pilot-tenant-seed.md` §11.290 entry
- [ ] `docs/commit-drafts/COMMIT_11.290-smart-receiving-ai-phase-1.md`

**✋ Quality Gate:**
- [ ] iOS Safari 라벨 scan smoke GREEN (confidence badge / 수동 보정 / 재처리 / cache hit 모두 작동)
- [ ] iOS Safari 거래명세서 scan smoke GREEN (PO 매칭 mismatch alert 정상)
- [ ] Cost per-call < $0.05 (Gemini 0.001 + Vision 0.0015 + Claude 0.03 baseline)
- [ ] Rollback path 명시 (env unset → orchestrator graceful degradation → Gemini single-call mode)

**Rollback:** Vercel env unset → orchestrator 가 Vision/Claude 호출 skip + Gemini single-call mode 로 graceful degradation. Schema rollback 은 별도 migration (data preserve).

---

## 8. Optional Addenda

### A. Workflow / Ontology Addendum (Inventory + Receiving)

**Resolver Input:** OcrResult.parsedFields (LOT/유통기한/catalogNo/lotNo/brand) + receivingId + (optional) purchaseOrderId
**Expected Output:**
- InventoryItem prefill payload (LOT/유통기한/제조원 자동 채움)
- PO 매칭 결과 (가격/수량 mismatch alert)
- nextAction: `CONFIRM_INVENTORY_PREFILL` | `MANUAL_CORRECTION` | `PO_MISMATCH_REVIEW`
- allowedActions: `confirm` | `correct` | `retry` | `dismiss`

**Surface Rules:**
- receiving detail page 안의 modal — same-canvas
- chatbot / 자유 input 0
- ontology resolver 가 PO/InventoryItem 가 정합 안된 경우 prefill block

**Validation:**
- [ ] LOT/유통기한 prefill 정확 (10 sample 라벨)
- [ ] PO 매칭 mismatch detect (가격/수량 5% 이상 차이 시 alert)
- [ ] InventoryItem 생성 mutation 정합 (cache invalidate)

---

### B. API Slimming Addendum

**Waste Type:** Duplicate Projection (label-parser + gemini-label-parser 가 LabelParseResult 중복 정의 위험)

**Minimal Diff Fix:**
- LabelParseResult 단일 source = `label-parser.ts` (현 위치 유지)
- 새 `orchestrator.ts` 가 모든 provider 결과를 LabelParseResult shape 으로 표준화
- `gemini-label-parser.ts` 는 orchestrator 의 1 provider client 로 격하 (parseWithGemini 함수 export 유지)

---

## 9. Risk Assessment

| Risk | Probability | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| Vercel Blob quota 초과 | Low | Med | Phase 5 cost monitoring + 알림 임계값 설정 |
| Claude API rate limit (429) | Med | Med | Exponential backoff + Gemini single-call fallback |
| Cloud Vision API key missing | High (초기) | High | Phase 5 까지 호영님 dashboard 작업 확정 + orchestrator graceful degradation |
| OcrJob 모델 migration 실패 | Low | High | Phase 1 quality gate 에 rollback verification 포함 |
| Confidence threshold tuning 필요 | High | Low | Phase 5 후 production data 기반 호영님 tuning |
| PO 매칭 false positive (mismatch alert 남발) | Med | Med | 5% threshold + 수동 dismiss CTA |
| Image cache miss (다른 인쇄/조명) | High | Low | Phase 2 image embedding cache 로 개선 (defer) |
| Multi-provider 비용 2x | Med | Med | Cache + confidence threshold 로 fallback 호출 최소화 |
| Batch 10 enforcement 정합 충돌 | High (전환 중) | High | Phase 1 schema land 시점 = Batch 10 full_enforce 완료 후 |

---

## 10. Rollback Strategy

- **If Phase 1 Fails:** `pnpm prisma migrate resolve --rolled-back <migration>` + schema revert
- **If Phase 2 Fails:** `apps/web/src/lib/ocr/image-storage.ts` 삭제 + test 삭제 (다른 phase 미사용)
- **If Phase 3 Fails:** orchestrator/cloud-vision/claude-structurer 3 file 삭제 + LabelScannerModal 이 직접 gemini-label-parser 호출하던 상태로 revert
- **If Phase 4 Fails:** UI 변경 revert + QuoteScannerModal.tsx 삭제 + API route 4 file 삭제
- **If Phase 5 Fails:** Vercel env unset → orchestrator graceful degradation → Gemini single-call mode 유지

### Special Cases
- **DB migration rollback:** `add_ocr_job_result_models` migration 은 data drop 0 (새 model 추가) → revert 안전
- **Cost overrun:** Vercel env unset 으로 즉시 fallback off + cache TTL 확장 (48h → 168h)
- **Multi-provider mismatch 남발:** confidence threshold 0.7 → 0.5 로 임시 하향 + manual review fallback 활성

---

## 11. Progress Tracking

- Overall completion: 33%
- Current phase: Phase 1 sandbox ✅ — Phase 2 진입 대기 (호영님 push + migration land 후)
- Current blocker: 호영님 클로드코드 환경에서 `pnpm prisma migrate dev --name add_ocr_job_result_models` 실행 필요
- Next validation step: 호영님 push + migration land 확인 후 Phase 2 (Vercel Blob image storage helper) 진입

**Phase Checklist:**
- [x] Phase 0 complete (Truth lock + decision table)
- [x] Phase 1 complete sandbox (Schema + sentinel test) — migration land 호영님 위임
- [ ] Phase 2 complete (Image storage helper)
- [ ] Phase 3 complete (Multi-provider orchestrator)
- [ ] Phase 4 complete (UI wiring + API routes)
- [ ] Phase 5 complete (Smoke + rollout + ADR)

---

## 12. Notes & Learnings

### Blockers Encountered
- (none yet)

### Implementation Notes
- 호영님 spec "Cloud Vision + Claude" 와 기존 production Gemini pipeline 충돌 해소 결정: Multi-provider fallback orchestrator 로 통합 (Gemini primary, Vision+Claude fallback)
- 호영님 결정 backlog 8개 모두 Phase 1 포함: 신뢰도 / cross-validation / 수동 보정 / 재처리 / audit log / cache / LOT prefill / PO 매칭
- 호영님 결정 우선순위: Batch 10 full_enforce 완료 후 Phase 1 진입 (schema migration 충돌 회피)
- Phase 2 defer 항목: Expo 카메라 직접 촬영 / 다중 이미지 merge
- Phase 3 defer 항목: Entitlement quota / Slack/Email push 알림
- 별도 spec defer 항목: 손상품 photo / 검수자 서명 (receiving inspection 본질 별 트랙)
