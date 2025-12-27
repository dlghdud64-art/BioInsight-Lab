# File Upload Implementation Summary

## ✅ Implementation Complete

CSV/XLSX 파일 업로드를 통한 구매내역 일괄 등록 기능이 완료되었습니다.

## 🎯 Completed Features

### 1. File Parsing Library
- **Library**: xlsx (SheetJS)
- **Location**: `apps/web/src/lib/file-parser.ts`
- **Features**:
  - CSV/XLSX 자동 감지 및 파싱
  - 컬럼명 자동 매핑 (한글/영문 모두 지원)
  - 숫자 포맷 정규화 (콤마, 공백 제거)
  - 에러 핸들링

### 2. ImportJob Tracking
- **Model**: `ImportJob` (Prisma schema)
- **Status Types**: PENDING, PROCESSING, COMPLETED, FAILED, PARTIAL
- **Tracking**: 총 행 수, 성공 행 수, 실패 행 수, 에러 샘플
- **Migration**: `apps/web/prisma/migrations/20241224_import_job/migration.sql`

### 3. API Endpoint
- **Path**: `POST /api/purchases/import-file`
- **Input**: multipart/form-data with file
- **Output**: Import job result with success/error details
- **Features**:
  - Zod validation
  - handleApiError integration
  - Logger integration
  - ImportJob creation and tracking

### 4. Column Name Flexibility

| Standard Field | Accepted Variations |
|---|---|
| purchasedAt | purchasedAt, purchased_at, date, purchase_date, 구매일, 구매일자 |
| vendorName | vendorName, vendor_name, vendor, supplier, 공급사, 벤더 |
| category | category, 카테고리, 분류 |
| itemName | itemName, item_name, item, product, product_name, 품목, 제품명 |
| catalogNumber | catalogNumber, catalog_number, cat_no, catno, catalog, 카탈로그번호 |
| unit | unit, 단위 |
| qty | qty, quantity, 수량, amount_qty |
| unitPrice | unitPrice, unit_price, price, 단가 |
| amount | amount, total, total_amount, 금액, 총액 |
| currency | currency, 통화 |

## 📁 Created Files

```
apps/web/
├── src/
│   ├── lib/
│   │   └── file-parser.ts               (NEW) - CSV/XLSX parsing utility
│   └── app/
│       └── api/
│           └── purchases/
│               └── import-file/
│                   └── route.ts          (NEW) - File upload endpoint
├── prisma/
│   ├── schema.prisma                     (UPDATED) - Added ImportJob model
│   └── migrations/
│       └── 20241224_import_job/
│           └── migration.sql             (NEW) - ImportJob migration
└── sample-purchase-import.csv            (NEW) - Sample CSV for testing
```

## 🔧 Technical Details

### file-parser.ts Functions

```typescript
// Parse CSV/XLSX buffer to JSON rows
export function parseFileBuffer(buffer: Buffer, filename: string): ParseResult

// Normalize column names (한글/영문 자동 매핑)
export function normalizeColumnNames(row: ParsedRow): ParsedRow

// Convert string to number (handles comma separators)
export function parseNumber(value: any): number | undefined

// Transform row for purchase import
export function transformPurchaseRow(row: ParsedRow): any
```

### ImportJob Model

```prisma
model ImportJob {
  id           String          @id @default(cuid())
  scopeKey     String          // guestKey for MVP
  type         String          // "purchase"
  filename     String
  status       ImportJobStatus @default(PENDING)
  totalRows    Int             @default(0)
  successRows  Int             @default(0)
  errorRows    Int             @default(0)
  errorSample  Json?           // Array of error samples
  result       Json?           // Import result metadata
  startedAt    DateTime?
  completedAt  DateTime?
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt
}

enum ImportJobStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
  PARTIAL
}
```

## 🚀 Usage Examples

### cURL
```bash
curl -X POST http://localhost:3000/api/purchases/import-file \
  -H "x-guest-key: guest_12345" \
  -F "file=@purchases.csv"
```

### JavaScript/TypeScript
```typescript
const formData = new FormData();
formData.append('file', fileInput.files[0]);

const response = await fetch('/api/purchases/import-file', {
  method: 'POST',
  headers: {
    'x-guest-key': getGuestKey(),
  },
  body: formData,
});

const result = await response.json();
console.log(`Import job ${result.jobId}: ${result.successRows}/${result.totalRows} rows imported`);

if (result.errorRows > 0) {
  console.warn('Errors:', result.errorSample);
}
```

### Sample CSV Format
```csv
purchasedAt,vendorName,category,itemName,catalogNumber,unit,qty,unitPrice,amount,currency
2025-01-15,Sigma-Aldrich,REAGENT,Reagent A,R1234,ea,10,50000,500000,KRW
2025-01-20,Thermo Fisher,EQUIPMENT,Centrifuge,CF-5000,ea,1,2000000,2000000,KRW
```

### Sample XLSX (Korean Headers)
| 구매일 | 공급사 | 카테고리 | 품목 | 수량 | 단가 | 금액 |
|---|---|---|---|---|---|---|
| 2025-01-15 | Sigma-Aldrich | REAGENT | Reagent A | 10 | 50000 | 500000 |

## 📊 Response Format

### Success
```json
{
  "jobId": "import_clx123abc",
  "totalRows": 50,
  "successRows": 48,
  "errorRows": 2,
  "errorSample": [
    {
      "row": 15,
      "errors": ["qty: qty must be positive"]
    },
    {
      "row": 32,
      "errors": ["purchasedAt: Invalid date format: 2025-13-01"]
    }
  ],
  "records": [/* First 10 successfully imported records */]
}
```

### Error
```json
{
  "error": "Invalid file type. Only CSV and XLSX files are supported."
}
```

## 🧪 Testing

### 1. Run Migration
```bash
cd apps/web
psql -d your_database < prisma/migrations/20241224_import_job/migration.sql
npx prisma generate
```

### 2. Test with Sample CSV
```bash
curl -X POST http://localhost:3000/api/purchases/import-file \
  -H "x-guest-key: test_key" \
  -F "file=@apps/web/sample-purchase-import.csv"
```

### 3. Verify Import Job
```sql
SELECT * FROM "ImportJob" ORDER BY "createdAt" DESC LIMIT 1;
```

### 4. Verify Purchase Records
```sql
SELECT * FROM "PurchaseRecord"
WHERE "scopeKey" = 'test_key'
AND "source" = 'import'
ORDER BY "createdAt" DESC;
```

## 📝 Validation Rules

### Required Fields
- `purchasedAt` (string, date format)
- `vendorName` (string, min 1 char)
- `itemName` (string, min 1 char)
- `qty` (positive integer)
- Either `amount` OR (`qty` + `unitPrice`)

### Date Formats
- ISO 8601: `2025-01-15`
- Slash: `2025/01/15`
- Dot: `2025.01.15`

### Number Formats
- Plain: `50000`
- With commas: `50,000` (auto-cleaned)
- With spaces: `50 000` (auto-cleaned)

## 🔄 Comparison: JSON vs File Upload

| Feature | JSON Import | File Upload |
|---|---|---|
| Endpoint | `/api/purchases/import` | `/api/purchases/import-file` |
| Input | JSON array | CSV/XLSX file |
| Column Flexibility | Exact field names | Auto-mapping |
| Job Tracking | No | Yes (ImportJob) |
| Best For | API integration | Bulk upload from spreadsheets |
| Max Size | ~10MB JSON | ~10MB file |

## 🎯 Key Benefits

1. **User-Friendly**: Excel/CSV 파일로 직접 업로드 가능
2. **Flexible**: 한글/영문 컬럼명 자동 인식
3. **Trackable**: ImportJob으로 업로드 이력 관리
4. **Robust**: 행 단위 에러 처리 및 샘플 제공
5. **Validated**: Zod 스키마로 데이터 품질 보장
6. **Logged**: 모든 작업 로그 기록

## 🔮 Future Enhancements

- [ ] Async processing for large files (>1000 rows)
- [ ] Progress tracking API
- [ ] Download template CSV/XLSX
- [ ] Multi-sheet support
- [ ] Custom column mapping UI
- [ ] Import history view
- [ ] Rollback/undo functionality
- [ ] Duplicate detection

## 📚 Related Documentation

- [FILE_IMPORT_API.md](./FILE_IMPORT_API.md) - Detailed API documentation
- [IMPLEMENTATION_COMPLETE.md](./IMPLEMENTATION_COMPLETE.md) - Complete implementation guide
- [PURCHASE_DASHBOARD_GUESTKEY_MVP.md](./PURCHASE_DASHBOARD_GUESTKEY_MVP.md) - MVP overview

## ✅ Checklist

- [x] xlsx library installed
- [x] file-parser.ts created
- [x] ImportJob model added to schema
- [x] ImportJob migration created
- [x] /api/purchases/import-file endpoint created
- [x] Prisma client regenerated
- [x] Sample CSV file created
- [x] Documentation completed
- [x] IMPLEMENTATION_COMPLETE.md updated

**Status: COMPLETE** ✅
