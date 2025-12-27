# Purchase Import - File Upload API

## Overview

CSV/XLSX 파일 업로드를 통한 구매내역 일괄 등록 기능. JSON rows import와 병행 사용 가능.

## Features

### 1. Supported File Formats
- **CSV** (.csv)
- **Excel** (.xlsx, .xls)

### 2. Column Name Flexibility
자동으로 다양한 컬럼명을 표준 필드로 매핑:

| Standard Field | Accepted Variations |
|---|---|
| `purchasedAt` | purchasedAt, purchased_at, date, purchase_date, 구매일, 구매일자 |
| `vendorName` | vendorName, vendor_name, vendor, supplier, 공급사, 벤더 |
| `category` | category, 카테고리, 분류 |
| `itemName` | itemName, item_name, item, product, product_name, 품목, 제품명 |
| `catalogNumber` | catalogNumber, catalog_number, cat_no, catno, catalog, 카탈로그번호 |
| `unit` | unit, 단위 |
| `qty` | qty, quantity, 수량, amount_qty |
| `unitPrice` | unitPrice, unit_price, price, 단가 |
| `amount` | amount, total, total_amount, 금액, 총액 |
| `currency` | currency, 통화 |

### 3. Import Job Tracking
모든 파일 import는 `ImportJob` 레코드로 추적:
- 실시간 상태 (PENDING, PROCESSING, COMPLETED, FAILED, PARTIAL)
- 성공/실패 행 수 집계
- 오류 샘플 저장 (최대 10개)

## API Endpoint

### POST /api/purchases/import-file

**Headers:**
```
x-guest-key: <your-guest-key>
Content-Type: multipart/form-data
```

**Body (FormData):**
```
file: <CSV or XLSX file>
```

**Response:**
```json
{
  "jobId": "import_job_123",
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
  "records": [
    // First 10 successfully imported records
  ]
}
```

## File Format Examples

### CSV Example

```csv
purchasedAt,vendorName,category,itemName,catalogNumber,unit,qty,unitPrice,amount,currency
2025-01-15,Sigma-Aldrich,REAGENT,Reagent A,R1234,ea,10,50000,500000,KRW
2025-01-20,Thermo Fisher,EQUIPMENT,Centrifuge,CF-5000,ea,1,2000000,2000000,KRW
2025-01-22,Merck,REAGENT,Buffer Solution,BS-100,L,5,30000,150000,KRW
```

### XLSX Example

| 구매일 | 공급사 | 카테고리 | 품목 | 카탈로그번호 | 단위 | 수량 | 단가 | 금액 | 통화 |
|---|---|---|---|---|---|---|---|---|---|
| 2025-01-15 | Sigma-Aldrich | REAGENT | Reagent A | R1234 | ea | 10 | 50000 | 500000 | KRW |
| 2025-01-20 | Thermo Fisher | EQUIPMENT | Centrifuge | CF-5000 | ea | 1 | 2000000 | 2000000 | KRW |

## Usage Examples

### JavaScript/TypeScript

```typescript
import { getGuestKey } from "@/lib/guest-key";

async function uploadPurchaseFile(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/purchases/import-file", {
    method: "POST",
    headers: {
      "x-guest-key": getGuestKey(),
    },
    body: formData,
  });

  const result = await response.json();

  if (result.errorRows > 0) {
    console.warn(`Import completed with ${result.errorRows} errors:`, result.errorSample);
  }

  return result;
}
```

### cURL

```bash
curl -X POST http://localhost:3000/api/purchases/import-file \
  -H "x-guest-key: guest_12345" \
  -F "file=@purchases.csv"
```

### Python

```python
import requests

def upload_purchase_file(filepath, guest_key):
    url = "http://localhost:3000/api/purchases/import-file"
    headers = {"x-guest-key": guest_key}

    with open(filepath, "rb") as f:
        files = {"file": f}
        response = requests.post(url, headers=headers, files=files)

    return response.json()

result = upload_purchase_file("purchases.xlsx", "guest_12345")
print(f"Imported {result['successRows']} out of {result['totalRows']} rows")
```

## Data Validation

### Required Fields
- `purchasedAt` (string, date format)
- `vendorName` (string, min 1 char)
- `itemName` (string, min 1 char)
- `qty` (positive integer)
- Either `amount` OR (`qty` + `unitPrice`)

### Optional Fields
- `category`
- `catalogNumber`
- `unit`
- `unitPrice`
- `currency` (default: "KRW")

### Date Formats Supported
- ISO 8601: `2025-01-15`
- Slash format: `2025/01/15`
- Dot format: `2025.01.15`

### Number Formats
- Plain numbers: `50000`
- With comma separators: `50,000` (automatically cleaned)
- With spaces: `50 000` (automatically cleaned)

## Error Handling

### File-Level Errors
```json
{
  "error": "Invalid file type. Only CSV and XLSX files are supported."
}
```

### Row-Level Errors
Individual row errors are collected in `errorSample`:
```json
{
  "errorSample": [
    {
      "row": 5,
      "errors": [
        "qty: qty must be positive",
        "purchasedAt: purchasedAt is required"
      ]
    }
  ]
}
```

### Import Job Status
- **PENDING**: Job queued (not used in sync processing)
- **PROCESSING**: Currently processing
- **COMPLETED**: All rows imported successfully
- **PARTIAL**: Some rows failed (check `errorSample`)
- **FAILED**: All rows failed

## Database Schema

### ImportJob Model

```prisma
model ImportJob {
  id           String          @id @default(cuid())
  scopeKey     String
  type         String          // "purchase"
  filename     String
  status       ImportJobStatus @default(PENDING)
  totalRows    Int             @default(0)
  successRows  Int             @default(0)
  errorRows    Int             @default(0)
  errorSample  Json?
  result       Json?
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

## File Parsing Library

Uses **xlsx** library (SheetJS):
- Supports CSV, XLSX, XLS
- Auto-detects file format
- Handles multi-sheet files (uses first sheet)
- Preserves cell values as strings for custom parsing

## Migration

Run the migration to create ImportJob table:

```bash
cd apps/web
psql -d your_database < prisma/migrations/20241224_import_job/migration.sql
npx prisma generate
```

## Comparison: File Upload vs JSON Import

| Feature | File Upload (`/import-file`) | JSON Import (`/import`) |
|---|---|---|
| Input Format | CSV/XLSX file | JSON array |
| Column Flexibility | Auto-mapping of column names | Exact field names required |
| Job Tracking | ImportJob record created | No job tracking |
| Use Case | Bulk import from spreadsheets | API integration, programmatic import |
| Error Handling | Row-level errors with samples | Row-level errors with samples |
| Max Rows | Limited by file size/memory | Limited by request size |

## Best Practices

1. **Column Names**: Use standard column names or Korean equivalents for auto-mapping
2. **Date Format**: Use ISO 8601 (YYYY-MM-DD) for consistency
3. **Numbers**: Plain integers without decimals (KRW amounts)
4. **Error Checking**: Always check `errorRows` and `errorSample` in response
5. **File Size**: Keep files under 10MB for optimal performance
6. **Validation**: Pre-validate data in spreadsheet before upload

## Future Enhancements

- [ ] Async processing for large files (background jobs)
- [ ] Progress tracking for uploads
- [ ] Template download (sample CSV/XLSX)
- [ ] Multi-sheet support
- [ ] Custom column mapping UI
- [ ] Import history view
- [ ] Rollback functionality

## See Also

- [IMPLEMENTATION_COMPLETE.md](./IMPLEMENTATION_COMPLETE.md) - Complete implementation guide
- [PURCHASE_DASHBOARD_GUESTKEY_MVP.md](./PURCHASE_DASHBOARD_GUESTKEY_MVP.md) - MVP overview
