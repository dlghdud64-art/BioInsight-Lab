# Purchase/Budget Dashboard Implementation - COMPLETE

## ✅ Implementation Summary

완료된 guestKey(scopeKey) 기반 구매내역/예산 대시보드 MVP 구현

### 핵심 기능

1. **Prisma Schema 업데이트**
   - ✅ PurchaseRecord 모델: scopeKey 기반, 모든 필수 인덱스 포함
   - ✅ Budget 모델: scopeKey + yearMonth unique constraint
   - ✅ QuoteStatus enum: PURCHASED 상태 추가

2. **API Endpoints (모두 handleApiError + logger 적용)**
   - ✅ **POST /api/purchases/import**: JSON rows 기반 import with zod validation
   - ✅ **POST /api/purchases/import-file**: CSV/XLSX 파일 업로드 import with ImportJob tracking
   - ✅ **GET /api/purchases**: 필터링 + 페이지네이션
   - ✅ **GET /api/purchases/summary**: 집계 데이터 (total, topVendors, topCategories, byMonth)
   - ✅ **PATCH /api/quotes/[id]**: markPurchased 액션 with 멱등성 처리

3. **Error Handling & Logging**
   - ✅ `handleApiError`: Zod, Error, Unknown error 처리
   - ✅ `logger`: info, warn, error, debug 레벨 지원
   - ✅ 모든 API 엔드포인트에 적용

4. **markPurchased 구현**
   - ✅ QuoteListItem.productSnapshot 기반
   - ✅ `createMany` 사용 (bulk insert)
   - ✅ quoteId 기반 멱등성 보장
   - ✅ 이메일 발송 통합

## 📁 Created/Updated Files

### Core Libraries
```
apps/web/src/lib/
├── logger.ts                    (NEW) - Structured logging
├── api-error-handler.ts         (NEW) - Centralized error handling
├── guest-key.ts                 (NEW) - Guest key management
└── file-parser.ts               (NEW) - CSV/XLSX parsing utility
```

### API Routes
```
apps/web/src/app/api/
├── purchases/
│   ├── route.ts                 (NEW) - GET purchases with filters
│   ├── import/route.ts          (UPDATED) - POST import with zod
│   ├── import-file/route.ts     (NEW) - POST file upload (CSV/XLSX)
│   └── summary/route.ts         (UPDATED) - GET aggregated data
└── quotes/[id]/
    ├── route.ts                 (UPDATED) - markPurchased integration
    └── markPurchased.ts         (NEW) - Purchase creation logic
```

### Database
```
apps/web/prisma/
├── schema.prisma                (UPDATED) - PurchaseRecord, Budget, ImportJob models
└── migrations/
    ├── 20241224_guestkey_scope/
    │   └── migration.sql        (NEW) - PurchaseRecord, Budget migration
    └── 20241224_import_job/
        └── migration.sql        (NEW) - ImportJob migration
```

### UI Pages
```
apps/web/src/app/
└── dashboard-guest/
    ├── page.tsx                 (NEW) - Main dashboard
    └── purchases/page.tsx       (NEW) - Purchase management
```

## 🔧 Technical Implementation

### 1. Zod Validation Schema
```typescript
const PurchaseRowSchema = z.object({
  purchasedAt: z.string().min(1),
  vendorName: z.string().min(1),
  category: z.string().optional(),
  itemName: z.string().min(1),
  catalogNumber: z.string().optional(),
  unit: z.string().optional(),
  qty: z.number().int().positive(),
  unitPrice: z.number().int().optional(),
  amount: z.number().int().optional(),
  currency: z.string().default("KRW"),
});
```

### 2. Error Handler
```typescript
export function handleApiError(error: unknown, context: string): NextResponse {
  // Handles: ZodError, Error, Unknown
  // Returns: Proper status codes (400, 401, 403, 404, 409, 500)
  // Logs: All errors with context
}
```

### 3. Logger
```typescript
const logger = createLogger("context");
logger.info("message", data);
logger.warn("message", data);
logger.error("message", error);
logger.debug("message", data); // Development only
```

### 4. markPurchased with createMany
```typescript
export async function markQuoteAsPurchased({ quoteId, scopeKey }) {
  // 1. Check idempotency (quoteId already purchased?)
  // 2. Build purchase data from QuoteListItem snapshots
  // 3. Bulk insert with createMany (single transaction)
  // 4. Return { alreadyPurchased, count, purchaseData }
}
```

## 🚀 API Usage Examples

### 1. Import Purchases (JSON)
```bash
curl -X POST http://localhost:3000/api/purchases/import \
  -H "Content-Type: application/json" \
  -H "x-guest-key: guest_12345" \
  -d '{
    "rows": [
      {
        "purchasedAt": "2025-01-15",
        "vendorName": "Sigma-Aldrich",
        "category": "REAGENT",
        "itemName": "Reagent A",
        "qty": 10,
        "unitPrice": 50000,
        "amount": 500000
      }
    ]
  }'
```

**Response:**
```json
{
  "totalRows": 1,
  "successRows": 1,
  "errorRows": 0,
  "errorSample": [],
  "records": [...]
}
```

### 2. Import Purchases (File Upload - CSV/XLSX)
```bash
curl -X POST http://localhost:3000/api/purchases/import-file \
  -H "x-guest-key: guest_12345" \
  -F "file=@purchases.csv"
```

**Response:**
```json
{
  "jobId": "import_job_clx123",
  "totalRows": 50,
  "successRows": 48,
  "errorRows": 2,
  "errorSample": [
    {
      "row": 15,
      "errors": ["qty: qty must be positive"]
    }
  ],
  "records": [...]
}
```

**Sample CSV Format:**
```csv
purchasedAt,vendorName,category,itemName,catalogNumber,unit,qty,unitPrice,amount,currency
2025-01-15,Sigma-Aldrich,REAGENT,Reagent A,R1234,ea,10,50000,500000,KRW
2025-01-20,Thermo Fisher,EQUIPMENT,Centrifuge,CF-5000,ea,1,2000000,2000000,KRW
```

See [FILE_IMPORT_API.md](./FILE_IMPORT_API.md) for detailed file upload documentation.

### 3. Get Purchases
```bash
curl -X GET "http://localhost:3000/api/purchases?from=2025-01-01&to=2025-01-31&page=1&limit=20" \
  -H "x-guest-key: guest_12345"
```

**Response:**
```json
{
  "items": [...],
  "totalCount": 42,
  "page": 1,
  "limit": 20,
  "totalPages": 3
}
```

### 4. Get Summary
```bash
curl -X GET "http://localhost:3000/api/purchases/summary?from=2025-01-01&to=2025-01-31" \
  -H "x-guest-key: guest_12345"
```

**Response:**
```json
{
  "totalAmount": 1500000,
  "byMonth": [
    { "yearMonth": "2025-01", "amount": 1500000 }
  ],
  "topVendors": [
    { "vendorName": "Sigma-Aldrich", "amount": 800000 }
  ],
  "topCategories": [
    { "category": "REAGENT", "amount": 900000 }
  ]
}
```

### 5. Mark Quote as Purchased
```bash
curl -X PATCH http://localhost:3000/api/quotes/quote_123 \
  -H "Content-Type: application/json" \
  -H "x-guest-key: guest_12345" \
  -d '{ "status": "PURCHASED" }'
```

**Response:**
```json
{
  "quote": {
    "id": "quote_123",
    "status": "PURCHASED",
    ...
  }
}
```

## 🎯 Completion Criteria

### ✅ All Requirements Met

1. **Prisma Schema**
   - [x] Purchase model with scopeKey
   - [x] Budget model with scopeKey + yearMonth unique
   - [x] Proper indexes (scopeKey + purchasedAt, vendorName, category)
   - [x] quoteId index for idempotency

2. **APIs**
   - [x] POST /api/purchases/import (JSON rows)
   - [x] POST /api/purchases/import-file (CSV/XLSX file upload)
   - [x] GET /api/purchases (with filters)
   - [x] GET /api/purchases/summary (aggregations)
   - [x] PATCH /api/quotes/[id] action=markPurchased

3. **Validation & Error Handling**
   - [x] Zod validation for all inputs
   - [x] handleApiError for consistent error responses
   - [x] Logger for all events (info, warn, error, debug)

4. **markPurchased**
   - [x] QuoteItem.productSnapshot 기반
   - [x] createMany 사용 (bulk insert)
   - [x] quoteId 멱등 처리 (중복 방지)
   - [x] 이메일 발송

5. **File Upload (CSV/XLSX)**
   - [x] xlsx library integration
   - [x] Column name auto-mapping (다국어 지원)
   - [x] ImportJob tracking model
   - [x] File parsing utility
   - [x] Sample CSV file

## 🧪 Testing Guide

### 1. Database Migration
```bash
cd apps/web
# Apply migrations
psql -d your_database < prisma/migrations/20241224_guestkey_scope/migration.sql
psql -d your_database < prisma/migrations/20241224_import_job/migration.sql

# Generate Prisma client
npx prisma generate
```

### 2. Test JSON Import
```typescript
const response = await fetch('/api/purchases/import', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-guest-key': 'test_guest_key',
  },
  body: JSON.stringify({
    rows: [
      {
        purchasedAt: '2025-01-15',
        vendorName: 'Test Vendor',
        itemName: 'Test Item',
        qty: 10,
        amount: 100000,
      },
    ],
  }),
});
```

### 3. Test File Upload
```typescript
const fileInput = document.querySelector('input[type="file"]');
const file = fileInput.files[0];

const formData = new FormData();
formData.append('file', file);

const response = await fetch('/api/purchases/import-file', {
  method: 'POST',
  headers: {
    'x-guest-key': 'test_guest_key',
  },
  body: formData,
});

const result = await response.json();
console.log(`Import job ${result.jobId}: ${result.successRows}/${result.totalRows} rows imported`);
```

Or use the sample CSV file:
```bash
curl -X POST http://localhost:3000/api/purchases/import-file \
  -H "x-guest-key: test_key" \
  -F "file=@apps/web/sample-purchase-import.csv"
```

### 4. Test Idempotency
```typescript
// First call
await fetch('/api/quotes/quote_id', {
  method: 'PATCH',
  headers: {
    'x-guest-key': 'test_key',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ status: 'PURCHASED' }),
});

// Second call - should skip creation
await fetch('/api/quotes/quote_id', {
  method: 'PATCH',
  headers: {
    'x-guest-key': 'test_key',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ status: 'PURCHASED' }),
});
// Check logs: "Purchases already exist for quote..."
```

## 📊 Logging Examples

### Console Output
```
[2025-01-24T10:30:00.000Z] [INFO] [purchases/import] Importing 5 purchase rows for scopeKey: guest_abc123
[2025-01-24T10:30:00.123Z] [INFO] [purchases/import] Import completed: 5 success, 0 errors
[2025-01-24T10:30:02.000Z] [INFO] [purchases/import-file] Processing file import: purchases.csv for scopeKey: guest_abc123
[2025-01-24T10:30:02.100Z] [INFO] [file-parser] Parsed 50 rows from purchases.csv
[2025-01-24T10:30:02.150Z] [INFO] [purchases/import-file] Created import job import_clx123 with 50 rows
[2025-01-24T10:30:03.000Z] [INFO] [purchases/import-file] Import job import_clx123 completed: 48 success, 2 errors
[2025-01-24T10:30:05.000Z] [INFO] [quotes/markPurchased] Marking quote quote_xyz as purchased for scopeKey: guest_abc123
[2025-01-24T10:30:05.456Z] [INFO] [quotes/markPurchased] Created 3 purchase records for quote quote_xyz
[2025-01-24T10:30:06.000Z] [WARN] [quotes/markPurchased] Purchases already exist for quote quote_xyz, skipping creation
```

## 🔄 Migration Path to Workspace

When transitioning from guestKey to workspaceId:

```sql
-- 1. Rename columns
ALTER TABLE "PurchaseRecord" RENAME COLUMN "scopeKey" TO "workspaceId";
ALTER TABLE "Budget" RENAME COLUMN "scopeKey" TO "workspaceId";
ALTER TABLE "ImportJob" RENAME COLUMN "scopeKey" TO "workspaceId";

-- 2. Add foreign keys
ALTER TABLE "PurchaseRecord"
  ADD CONSTRAINT "PurchaseRecord_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE CASCADE;

ALTER TABLE "Budget"
  ADD CONSTRAINT "Budget_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE CASCADE;

ALTER TABLE "ImportJob"
  ADD CONSTRAINT "ImportJob_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE CASCADE;

-- 3. Migrate data (example)
UPDATE "PurchaseRecord" pr
SET "workspaceId" = w.id
FROM "Workspace" w
WHERE pr.scopeKey LIKE 'guest_%'
  AND w.guestKey = pr.scopeKey;

UPDATE "Budget" b
SET "workspaceId" = w.id
FROM "Workspace" w
WHERE b.scopeKey LIKE 'guest_%'
  AND w.guestKey = b.scopeKey;

UPDATE "ImportJob" ij
SET "workspaceId" = w.id
FROM "Workspace" w
WHERE ij.scopeKey LIKE 'guest_%'
  AND w.guestKey = ij.scopeKey;
```

## 🎉 Summary

**모든 요구사항이 완료되었습니다:**

- ✅ Prisma: Purchase, Budget, ImportJob models with indexes
- ✅ APIs: import (JSON), import-file (CSV/XLSX), GET, summary, markPurchased
- ✅ File Upload: xlsx parsing, column auto-mapping, ImportJob tracking
- ✅ Validation: Zod schemas for all inputs
- ✅ Error Handling: handleApiError + logger everywhere
- ✅ markPurchased: productSnapshot + createMany + idempotency
- ✅ UI: Dashboard + purchases pages

**Ready for production!** 🚀

## 📚 Documentation

- **[FILE_IMPORT_API.md](./FILE_IMPORT_API.md)** - Comprehensive file upload API guide
- **[PURCHASE_DASHBOARD_GUESTKEY_MVP.md](./PURCHASE_DASHBOARD_GUESTKEY_MVP.md)** - MVP overview
- **sample-purchase-import.csv** - Sample CSV file for testing
