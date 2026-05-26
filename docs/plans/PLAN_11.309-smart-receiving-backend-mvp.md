# Implementation Plan: §11.309 스마트 입고 AI 스캔 backend MVP

- **Status:** 🔄 In Progress (§11.309a Phase 0 — schema dry-run 보고 대기)
- **Started:** 2026-05-26
- **Last Updated:** 2026-05-26
- **Estimated Completion:** ~5영업일 (호영님 spec 12영업일 → §11.290 인프라 재사용으로 단축)
- **Owner:** Claude (sandbox) → 호영님 (push + DB approve)

**CRITICAL INSTRUCTIONS:**
1. ⛔ schema 변경 전 → 평이한 한국어 dry-run 보고 → 호영님 "진행" 회신 → apply
2. ⛔ DO NOT introduce dead button
3. ⛔ DO NOT bypass §11.290 인프라 (기존 OCR pipeline 재사용 강제)
4. ⛔ DO NOT change §11.308a placeholder modal 동작 (§11.309d 에서만 swap)

---

## 0. Truth Reconciliation (sandbox audit 완료)

**§11.290 family production close 확정:**

| 인프라 | 상태 | 위치 |
|---|---|---|
| Vercel Blob 이미지 업로드 + 48h cache | ✅ | `lib/ocr/image-storage.ts` (Phase 2) |
| Google Vision REST API OCR | ✅ | `lib/ocr/cloud-vision-parser.ts` (Phase 5) |
| Claude haiku-4-5 구조화 | ✅ | `lib/ocr/claude-structurer.ts` (Phase 5) |
| 3-tier orchestrator | ✅ | `lib/ocr/run-ocr-pipeline.ts` |
| OcrJob / OcrResult / OcrCacheHit Prisma model | ✅ | `prisma/schema.prisma:3077~3148` |
| OcrJobType enum (LABEL / **QUOTE**=거래명세서) | ✅ | line 3077-3080 |
| InventoryRestock model | ✅ | line 855~ (수동 입고 기존 이력) |
| QuoteScannerModal (Phase 4c) | ✅ | `components/inventory/QuoteScannerModal.tsx` |
| `/api/quotes/parse-image` + `parse-pdf` route | ✅ | 거래명세서 OCR API |

**환경 변수 호영님 등록 완료 (§11.290 production close 증거):**

- ✅ ANTHROPIC_API_KEY
- ✅ GOOGLE_VISION_API_KEY
- ✅ BLOB_READ_WRITE_TOKEN + STORAGE_PROVIDER=vercel-blob

**§11.309 진짜 신규 작업 (호영님 spec 12영업일 → 5영업일):**

1. `InventoryRestock` 확장 OR `ReceivingFromScan` 신규 (Phase 0 dry-run 결정)
2. `claude-structurer` 거래명세서 프롬프트 분기 (호영님 spec invoice JSON shape)
3. 품목 매칭 로직 (catalog 정확 → fuzzy → 신규)
4. `/api/inventory/smart-receiving` route 신규 (OCR pipeline → 새 receiving 생성)
5. `SmartReceivingScannerModal` 신규 (`QuoteScannerModal` 패턴 복제, but onScanComplete = 새 receiving create)
6. §11.308a placeholder modal → 실제 스캐너 modal swap

---

## 1. Priority Fit

- [x] **P0** (호영님 spec — LabAxis 핵심 차별화 기능)
- 호영님 Q18 = A: frontend P2 병행 (§11.306b 완료, §11.306c / §11.308b/c/d 후속)

---

## 2. Work Type

- [x] Feature (스마트 입고 MVP)
- [x] API (route 신규 + DB migration)
- [x] UX (스캐너 modal + 확인 UI)
- [x] DB Migration (호영님 dry-run 보고 강제)
- [x] Mobile (호영님 spec — 모바일 우선 사용)

---

## 3. Overview

**Scope (4 phase, ~5영업일):**

| Phase | scope | 영업일 | DB 변경 |
|---|---|---|---|
| **§11.309a** | DB schema (`InventoryRestock` 확장 OR `ReceivingFromScan` 신규) + invoice 프롬프트 분기 | ~1.5 | **Yes** (dry-run 보고) |
| **§11.309b** | 품목 매칭 로직 (catalog 정확 → fuzzy → 신규) + sentinel | ~1 | No |
| **§11.309c** | `/api/inventory/smart-receiving` route + 새 receiving 생성 + 재고 갱신 | ~1.5 | No (309a 적용 후) |
| **§11.309d** | `SmartReceivingScannerModal` + §11.308a placeholder swap + 진입점 wiring | ~1 | No |

---

## 4. §11.309a Phase 0 — DB schema dry-run 보고 (호영님 결정 대기)

### 현 상태

`InventoryRestock` model (line 855~) 이 이미 입고 이력 record:

```
model InventoryRestock {
  id               String          @id
  inventoryId      String          // 어느 재고 품목
  userId           String          // 입고한 사용자
  quantity         Float           // 입고 수량
  expectedQuantity Float?
  unit             String?
  lotNumber        String?         // LOT
  expiryDate       DateTime?       // 유효기간
  receivingStatus  ReceivingStatus // PENDING / PARTIAL / COMPLETED / ISSUE
  orderId          String?         // 연결된 주문 (PO 매칭 가능)
  issueNote        String?
  notes            String?
  restockedAt      DateTime
  createdAt        DateTime
}
```

호영님 spec 의 `ReceivingFromScan` 역할의 **80% 이상이 `InventoryRestock` 에 이미 있음**. 차이는:

- 호영님 spec `extractedData Json` (확인된 추출 데이터)
- 호영님 spec `scanJobId` FK (스캔 record 연결)

### 옵션 비교

**옵션 A — `InventoryRestock` 확장 (Claude 권장 — 최소 diff):**

```
// 2 field 추가
model InventoryRestock {
  ...existing fields...
  ocrJobId       String?   // §11.309 — OCR scan 으로 생성된 경우 link
  ocrJob         OcrJob?   @relation(fields: [ocrJobId], references: [id], onDelete: SetNull)
  extractedData  Json?     // §11.309 — 확인된 OCR 추출 데이터 (감사 추적)

  @@index([ocrJobId])
}

// OcrJob 에 back-relation 추가
model OcrJob {
  ...existing fields...
  restocks       InventoryRestock[]  // §11.309 — back-relation
}
```

마이그레이션 SQL:
```sql
ALTER TABLE "InventoryRestock" ADD COLUMN "ocrJobId" TEXT;
ALTER TABLE "InventoryRestock" ADD COLUMN "extractedData" JSONB;
ALTER TABLE "InventoryRestock" ADD CONSTRAINT "InventoryRestock_ocrJobId_fkey"
  FOREIGN KEY ("ocrJobId") REFERENCES "OcrJob"("id") ON DELETE SET NULL;
CREATE INDEX "InventoryRestock_ocrJobId_idx" ON "InventoryRestock"("ocrJobId");
```

장점:
- 새 model 0건
- 수동 입고 / 스캔 입고 모두 같은 record 로 통합 (재고 UI 변경 0)
- 기존 `InventoryRestock` 조회 / 인덱스 / report 영향 0
- field 추가만 — 기존 row 영향 0 (NULL 허용)

단점:
- 호영님 spec 의 `ReceivingFromScan` 명칭과 다름
- 스캔 출처 record 가 수동 입고와 같은 테이블 — 조회 시 필터 필요

**옵션 B — `ReceivingFromScan` 신규 model (호영님 spec 정합):**

```
model ReceivingFromScan {
  id              String   @id @default(cuid())
  ocrJobId        String   // OcrJob FK
  ocrJob          OcrJob   @relation(fields: [ocrJobId], references: [id])
  inventoryItemId String?  // 매칭된 기존 품목 (null 이면 신규)
  extractedData   Json     // 확인된 OCR 추출 데이터
  quantity        Int
  lotNumber       String?
  expirationDate  DateTime?
  storageLocation String?
  registeredAt    DateTime @default(now())
  organizationId  String   // multi-tenant
  userId          String   // 등록한 사용자

  @@index([ocrJobId])
  @@index([organizationId, registeredAt])
}
```

마이그레이션 SQL:
```sql
CREATE TABLE "ReceivingFromScan" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "ocrJobId" TEXT NOT NULL,
  "inventoryItemId" TEXT,
  "extractedData" JSONB NOT NULL,
  "quantity" INTEGER NOT NULL,
  "lotNumber" TEXT,
  "expirationDate" TIMESTAMP(3),
  "storageLocation" TEXT,
  "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  CONSTRAINT "ReceivingFromScan_ocrJobId_fkey" FOREIGN KEY ("ocrJobId") REFERENCES "OcrJob"("id")
);
CREATE INDEX "ReceivingFromScan_ocrJobId_idx" ON "ReceivingFromScan"("ocrJobId");
CREATE INDEX "ReceivingFromScan_organizationId_registeredAt_idx" ON "ReceivingFromScan"("organizationId", "registeredAt");
```

장점:
- 호영님 spec 명칭 정합
- 스캔 출처 record 가 별도 테이블 — 조회 / report 분리 명확

단점:
- 새 model 1건 추가 (sandbox 보고 + 승인 필요)
- 재고 갱신 시 `InventoryRestock` + `ReceivingFromScan` 둘 다 create (이중 write)
- 기존 재고 UI 가 `InventoryRestock` 만 조회 → 스캔 입고 안 보이거나 별도 query 필요
- 마이그레이션 작업량 큼

### Claude 추천: **옵션 A**

근거:
- minimal diff (호영님 Karpathy 원칙 정합)
- 재고 UI 변경 0 (스캔 입고도 기존 입고와 같이 노출)
- 호영님 통제 구조의 "dry-run → 한국어 보고 → 진행" 부담 ↓ (field 추가 만)
- 호영님 spec 의 `ReceivingFromScan` 역할은 `InventoryRestock` 가 이미 90% 수행 중

---

## 5. §11.309b/c/d — Phase 분해

### §11.309b (~1영업일) — 품목 매칭 로직

- 신규 `lib/ocr/product-matcher.ts` 또는 `lib/inventory/product-matcher.ts`
- 입력: `LabelParseResult` (catalogNo, brand, productName)
- 출력: `{ type: 'exact' | 'fuzzy' | 'new', items: Product[], confidence: number }`
- 1차: catalogNumber 정확 매칭 (Prisma findFirst)
- 2차: productName + brand fuzzy 매칭 (contains insensitive, take 5)
- 3차: 신규 품목 권장
- Sentinel test (unit test) — 3 분기 모두 검증

### §11.309c (~1.5영업일) — `/api/inventory/smart-receiving` route

- POST `/api/inventory/smart-receiving`
- input: `{ confirmedData: LabelParseResult, ocrJobId: string, inventoryItemId: string | null, quantity, lotNumber, expirationDate, storageLocation }`
- 처리:
  1. `inventoryItemId` 있으면 기존 품목 재고 update + `InventoryRestock` create (with ocrJobId + extractedData)
  2. `inventoryItemId` null 이면 신규 품목 생성 + 초기 재고 + `InventoryRestock` create
  3. 감사 로그 (`MutationAuditEvent`)
  4. 응답: `{ inventoryRestockId, inventoryItemId, quantity }`
- React Query invalidation: `["inventories"]` + `["team-inventory"]`
- TDD: integration test (createOrUpdateMutation 패턴)

### §11.309d (~1영업일) — `SmartReceivingScannerModal` + 진입점 swap

- `components/inventory/SmartReceivingScannerModal.tsx` (NEW)
- `QuoteScannerModal` 패턴 복제 — file upload + `/api/quotes/parse-image` OR `/api/inventory/scan-label` 호출
- 호영님 spec UI 흐름: 원본 이미지 + 추출 결과 (모든 필드 input) + 신뢰도 hilight + 품목 매칭 결과 + [입고 등록]
- §11.308a `SmartReceivingPlaceholderModal` → `SmartReceivingScannerModal` swap (dashboard/page.tsx + inventory-main.tsx)
- placeholder modal 은 보존 (다른 backend 미완성 기능 fallback 용 재사용 가능)

---

## 6. Risk

| Risk | Probability | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| schema migration production fail | Low | High | 옵션 A field 추가만 → NULL 허용 → 회귀 0 |
| `claude-structurer` LabelParseResult vs invoice JSON shape 불일치 | Med | Med | 309a 에서 invoice 프롬프트 분기 신규 추가, LabelParseResult 보존 |
| 품목 매칭 false positive | Med | Med | confidence < 0.7 시 신규 옵션 강제 + 사용자 확인 UI |
| Vercel serverless function timeout (OCR + LLM 합산 ~5초) | Med | Med | streaming response 또는 background job (MVP 후속) |
| `OcrJob` cache hit 시 stale data 가 새 receiving create | Low | Low | imageHash + 48h TTL — 같은 거래명세서 재스캔만 캐시 |

---

## 7. Rollback

- §11.309a (옵션 A): `ALTER TABLE InventoryRestock DROP COLUMN ocrJobId, DROP COLUMN extractedData` — 기존 row 영향 0
- §11.309b/c/d: `git revert <SHA>` 단위

---

## 8. Notes

- §11.290 family 가 인프라 80% 구축 — §11.309 는 invoice 분기 + UI swap + 매칭 강화 + 진입점 wiring 위주
- 호영님 통제 구조: schema 변경 시 매번 dry-run → "진행" 회신 → apply (§11.309a + §11.309c 잠재적)
- backend MVP 완료 후 후속 (§11.309 family 외):
  - PO 자동 매칭 (Phase 2 발주서 완료 후)
  - 비동기 큐 (BullMQ) — MVP 성능 데이터 확보 후
  - 자체 OCR 모델 학습
  - 다수 품목 일괄 입고 UX 고도화
