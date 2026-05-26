# §11.309a Commit Message Draft (InventoryRestock 확장 + Claude invoice 분기)

⚠️ **호영님 push 전 DB migration apply 필요 (Vercel build 가 schema 새 컬럼 참조하면 fail 가능 — single push 로 schema + migration 동시 land).**

```
feat(receiving): §11.309a #inventory-restock-ocr-link — InventoryRestock 확장 (ocrJobId + extractedData) + Claude invoice 구조화 분기 (호영님 P0 2026-05-26)

호영님 P0 spec (2026-05-26):
스마트 입고 AI 스캔 backend MVP Phase A — DB schema + Claude 거래명세서
프롬프트 분기. §11.290 family OCR 인프라 (image-storage / cloud-vision /
claude-structurer / OcrJob) 재사용 + 신규 invoice flow 진입 기반 구축.

Q23 = A 옵션 (InventoryRestock 확장, 새 model 0건) — 호영님 dry-run 승인 후.

§11.309a evidence (sandbox 직접 audit):
1. schema.prisma 기존 OcrJob/OcrJobType/OcrResult 완성 확인 (§11.290 Phase 1)
2. InventoryRestock 기존 model 이 호영님 spec ReceivingFromScan 역할 80% 수행 중
3. ANTHROPIC_API_KEY / GOOGLE_VISION_API_KEY / BLOB_READ_WRITE_TOKEN 모두
   §11.290 production close 시 호영님 환경에 등록 완료
4. gemini-quote-parser.ts ParsedQuoteDocument shape 재사용 — Claude invoice
   구조화 결과를 Gemini Tier 1 결과와 같은 type 처리 (orchestrator 호환)

Fix (4 file 수정/추가 + 1 NEW sentinel + 1 NEW migration):

- apps/web/prisma/schema.prisma:
  · model InventoryRestock 에 2 field 추가:
    - ocrJobId String? (OcrJob FK, nullable — 수동 입고는 null)
    - extractedData Json? (확인된 OCR 추출 데이터 감사 추적)
  · ocrJob OcrJob? @relation onDelete: SetNull
    (OcrJob 삭제 시 입고 이력 보존, 감사 무결성 보호)
  · @@index([ocrJobId]) — 스캔 입고 조회 O(log n)
  · model OcrJob 에 restocks InventoryRestock[] back-relation 추가
    (1 OCR → N receiving 가능, 거래명세서 다수 품목 일괄 입고 정합)

- apps/web/prisma/migrations/
  20260526120000_inventory_restock_ocr_link/migration.sql (NEW):
  · ALTER TABLE InventoryRestock ADD COLUMN ocrJobId TEXT
  · ALTER TABLE InventoryRestock ADD COLUMN extractedData JSONB
  · ADD CONSTRAINT InventoryRestock_ocrJobId_fkey
    FOREIGN KEY (ocrJobId) REFERENCES OcrJob(id) ON DELETE SET NULL
  · CREATE INDEX InventoryRestock_ocrJobId_idx
  · Rollback SQL 주석 4건 (DROP CONSTRAINT / DROP INDEX / DROP COLUMN x2)
  · 회귀 0 — 두 컬럼 모두 NULL 허용, 기존 row 영향 0

- apps/web/src/lib/ocr/claude-structurer.ts (~150 line 추가):
  · 신규 export interface ClaudeStructureInvoiceResult
    (parsed: ParsedQuoteDocument / confidence / itemCount / cost / latency)
  · 신규 export INVOICE_STRUCTURE_PROMPT
    - 거래명세서 (Korean delivery note) 전용 프롬프트
    - ParsedQuoteDocument shape JSON 명시 (vendor / items[] / totalAmount /
      subtotal / vat / paymentTerms / deliveryTerms 등)
    - Korean 공급자/공급받는자/품목/규격/수량/단가/공급가액/세액/합계 인식
  · 신규 export async function structureInvoiceWithClaude
    - 같은 claude-haiku-4-5 모델 + 같은 dynamic import 패턴 (§11.290 정합)
    - max_tokens 2048 (라벨 512 대비 4x, invoice 다수 품목 대응)
    - JSON parse + 기본값 보강 (vendor/items/currency 누락 시 안전 처리)
    - confidence: items + 헤더 field 매칭 수 종합 (high/medium/low)
    - cost 추정 $0.002/call (라벨 $0.001 대비 2x)
    - ANTHROPIC_API_KEY 미설정 시 같은 ClaudeStructurerNotConfiguredError throw
  · 기존 structureWithClaude (라벨) 변경 0 — 회귀 보호

- apps/web/src/__tests__/regression/
  smart-receiving-schema-claude-invoice-309a.test.ts (NEW, 17 it):
  · schema 4건 (ocrJobId / extractedData / OcrJob relation / @@index)
  · OcrJob back-relation 1건 + 기존 indexes 보존 1건
  · migration SQL 5건 (file 존재 / ALTER ADD COLUMN x2 / FK / INDEX / Rollback)
  · claude-structurer invoice 6건 (function export / PROMPT export /
    ParsedQuoteDocument shape / interface / 모델 / error throw)
  · 기존 라벨 함수 회귀 0 4건 (structureWithClaude / STRUCTURE_PROMPT /
    Error class / Input interface)

canonical truth 보존 (회귀 0):
- §11.290 OcrJob / OcrResult / OcrCacheHit / image-storage / cloud-vision-parser
  변경 0
- 기존 structureWithClaude (라벨) 함수 + STRUCTURE_PROMPT 변경 0
- 기존 InventoryRestock caller (createOrUpdateMutation 등) 변경 0
  (NULL 허용 → 필드 미지정 시 기존 동작)
- InventoryRestock 기존 5 index (inventoryId / userId / restockedAt / orderId /
  receivingStatus) 보존
- ParsedQuoteDocument shape gemini-quote-parser.ts 와 정합
- claude-haiku-4-5 모델 정합 (§11.290 Phase 5)

호영님 production effect (§11.309a 자체):
1. DB schema: InventoryRestock 에 2 컬럼 추가 (NULL 허용 → 기존 동작 0 영향)
2. /dashboard/inventory 재고 페이지 UI: 변경 0 (§11.309c 에서 caller 추가)
3. /dashboard 대시보드: 변경 0 (§11.309d 에서 placeholder swap)
4. 스마트 입고 진입점: 여전히 §11.308a placeholder modal (§11.309d 까지 유지)
5. Claude API 호출: §11.309c 에서 새 route 가 호출하기 전까지 cost 0
6. backend MVP 진입 기반 완성 — §11.309b 품목 매칭 → §11.309c API route →
   §11.309d UI swap 순차 진행

§11.309 시리즈 진행:
- §11.309a ✅ 본 batch (schema 확장 + Claude invoice 프롬프트)
- §11.309b ⏳ 품목 매칭 로직 (catalog 정확 → fuzzy → 신규)
- §11.309c ⏳ /api/inventory/smart-receiving route + 새 receiving 생성
- §11.309d ⏳ SmartReceivingScannerModal + §11.308a placeholder swap

Out of Scope:
- §11.309b/c/d 별도 commit (호영님 Q17 = A: 4 push 단위)
- PO 자동 매칭 (Phase 2 발주서 완료 후, MVP 외)
- 비동기 큐 (BullMQ, MVP 외)
- 거래명세서 다수 품목 일괄 입고 UX 고도화 (MVP 외)
- Receiving (별도 model — receiving/[receivingId] 페이지용) 변경 0
- gemini-quote-parser.ts 변경 0 (Tier 1 보존)

Rollback path: git revert <SHA> + migration rollback
- schema/claude-structurer 4 file 복원
- migration rollback SQL 실행 (4 statement):
  ALTER TABLE "InventoryRestock" DROP CONSTRAINT "InventoryRestock_ocrJobId_fkey";
  DROP INDEX "InventoryRestock_ocrJobId_idx";
  ALTER TABLE "InventoryRestock" DROP COLUMN "ocrJobId";
  ALTER TABLE "InventoryRestock" DROP COLUMN "extractedData";
- 회귀 0 (NULL 허용 컬럼만 추가, 기존 데이터 영향 0)
```

## Push 절차 (호영님 환경)

### Step 1: Migration apply (production DB 변경 — Q19 강제 보고)

호영님 PowerShell 에서 production DB migration:

```powershell
# (1) sandbox 에서 생성된 migration 파일 확인
cd D:\bio-insight-lab
git pull origin main  # sandbox 변경 가져오기 전

# (2) 본 commit 전 production migration apply (Q19 보고 후 승인 시):
# 호영님이 .env (production DB URL) 가 있는 환경에서 실행
pnpm --filter web prisma migrate deploy

# 또는 SQL 직접 실행 (Supabase dashboard SQL Editor):
# 위 migration.sql 내용 복사 → 실행
```

### Step 2: Commit + push

```powershell
git add `
  apps/web/prisma/schema.prisma `
  apps/web/prisma/migrations/20260526120000_inventory_restock_ocr_link/migration.sql `
  apps/web/src/lib/ocr/claude-structurer.ts `
  apps/web/src/__tests__/regression/smart-receiving-schema-claude-invoice-309a.test.ts `
  docs/plans/PLAN_11.309-smart-receiving-backend-mvp.md `
  docs/commit-drafts/COMMIT_11.309a-inventory-restock-ocr-link.md

git commit -F docs/commit-drafts/COMMIT_11.309a-inventory-restock-ocr-link.md
git push origin main
```

## Production smoke

1. **DB**: `SELECT column_name, data_type, is_nullable FROM information_schema.columns
   WHERE table_name = 'InventoryRestock' AND column_name IN ('ocrJobId', 'extractedData');`
   → 2 row return, is_nullable = YES
2. Vercel deployment SUCCESS (TypeScript 컴파일 — 새 export 정합)
3. 재고 페이지 /dashboard/inventory: 기존 입고 이력 표시 변화 0
4. §11.308a placeholder modal: 여전히 정상 동작 ("곧 제공 예정" + 수동 fallback)
5. Anthropic API: 새 caller 추가 전까지 호출 0 (cost 0)
