# CSV Upload UI Implementation - Complete

## ✅ Implementation Summary

구매내역 추가 모달에 3개의 탭(간편 입력, TSV 붙여넣기, CSV 업로드)이 구현되었습니다.

## 🎯 Features Implemented

### 1. Three-Tab Interface
- **간편 입력 (Simple Form)**: 개별 필드 입력 폼
- **TSV 붙여넣기 (TSV Paste)**: 기존 텍스트 붙여넣기 방식
- **CSV 업로드 (CSV Upload)**: 3-step 파일 업로드 UX (신규)

### 2. CSV Upload 3-Step Flow

#### Step 1: 파일 선택 (File Upload)
- **Drag & Drop Zone**: 파일을 드래그하거나 클릭하여 선택
- **Supported Formats**: .csv, .xlsx, .xls
- **File Validation**: 파일 타입 및 크기 검증
- **API Call**: `POST /api/purchases/import/preview`
- **Response**: columns, sampleRows (20행), totalRows, fileId

#### Step 2: 컬럼 매핑 (Column Mapping)
- **Auto-mapping**: 컬럼명 자동 매핑 (한글/영문)
- **Manual Mapping**: Select 드롭다운으로 수동 매핑
- **Required Fields Validation**:
  - 구매일 (purchasedAt) *
  - 벤더 (vendorName) *
  - 품목명 (itemName) *
  - 수량 (qty) *
  - 금액 또는 단가 (amount OR unitPrice) *
- **Sample Preview**: 매핑된 데이터 미리보기
- **Full Preview Table**: 20행 샘플 데이터 (가로 스크롤, sticky header)

#### Step 3: 실행 + 결과 (Execution & Result)
- **API Call**: `POST /api/purchases/import/commit`
- **Result Cards**: 총 행 수, 성공, 실패
- **Error Table**: 오류 샘플 (최대 10개)
- **Error CSV Download**: 에러만 CSV로 다운로드
- **Success Actions**:
  - purchases 리스트 refetch
  - dashboard summary refetch
  - 성공 토스트

### 3. Responsive Design
- **Mobile-first**: 모바일부터 데스크톱까지 지원
- **Horizontal Scroll**: 샘플 테이블 가로 스크롤
- **Sticky Headers**: 테이블 헤더 고정
- **Grid Layout**: 폼 필드 2열 그리드 (모바일 1열)

### 4. Accessibility
- **Loading States**: 모든 비동기 작업에 로딩 상태 표시
- **Error States**: 명확한 에러 메시지
- **Disabled States**: 유효성 검증 실패 시 버튼 비활성화
- **Visual Feedback**: 드래그 오버 시 시각적 피드백

## 📁 Created/Updated Files

```
apps/web/
├── src/
│   ├── app/
│   │   └── api/
│   │       └── purchases/
│   │           └── import/
│   │               ├── preview/
│   │               │   └── route.ts          (NEW) - Preview endpoint
│   │               └── commit/
│   │                   └── route.ts          (NEW) - Commit endpoint
│   ├── components/
│   │   └── purchases/
│   │       └── csv-upload-tab.tsx            (NEW) - CSV upload component
│   └── app/
│       └── dashboard/
│           └── purchases/
│               └── page.tsx                  (UPDATED) - Added tabs
```

## 🔧 Technical Details

### API Endpoints

#### Preview Endpoint
```typescript
POST /api/purchases/import/preview
Headers: x-guest-key
Body: FormData with file

Response: {
  columns: string[];
  sampleRows: Record<string, any>[];
  totalRows: number;
  filename: string;
  fileId: string; // Temporary cache ID
}
```

#### Commit Endpoint
```typescript
POST /api/purchases/import/commit
Headers: x-guest-key, Content-Type: application/json
Body: {
  fileId: string;
  columnMapping: Record<string, string>;
}

Response: {
  jobId: string;
  totalRows: number;
  successRows: number;
  errorRows: number;
  errorSample: Array<{ row: number; errors: string[] }>;
  records?: any[];
}
```

### Component Architecture

```typescript
<Tabs defaultValue="csv-upload">
  <TabsList>
    <TabsTrigger value="simple-form">간편 입력</TabsTrigger>
    <TabsTrigger value="tsv-paste">TSV 붙여넣기</TabsTrigger>
    <TabsTrigger value="csv-upload">CSV 업로드</TabsTrigger>
  </TabsList>

  <TabsContent value="simple-form">
    <!-- Form fields for manual entry -->
  </TabsContent>

  <TabsContent value="tsv-paste">
    <!-- Textarea for TSV paste -->
  </TabsContent>

  <TabsContent value="csv-upload">
    <CsvUploadTab onSuccess={handleSuccess} />
  </TabsContent>
</Tabs>
```

### CsvUploadTab Component Structure

```typescript
type Step = "upload" | "mapping" | "result";

interface PreviewData {
  columns: string[];
  sampleRows: Record<string, any>[];
  totalRows: number;
  filename: string;
  fileId: string;
}

interface ImportResult {
  jobId: string;
  totalRows: number;
  successRows: number;
  errorRows: number;
  errorSample: Array<{ row: number; errors: string[] }>;
}

function CsvUploadTab({ onSuccess }: { onSuccess?: () => void }) {
  const [step, setStep] = useState<Step>("upload");
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Step 1: File upload handlers
  // Step 2: Column mapping with validation
  // Step 3: Result display with error table
}
```

## 🎨 UI Components Used

- **Card**: Container for content sections
- **Tabs**: Tab navigation
- **Button**: Actions (upload, execute, download)
- **Select**: Column mapping dropdowns
- **Input**: Form fields (simple form tab)
- **Textarea**: TSV paste tab
- **Table**: Preview and error tables
- **Toast**: Success/error notifications
- **Label**: Form field labels

## 🔄 User Flow

### CSV Upload Flow

1. **User selects CSV upload tab**
   - Sees drag & drop zone
   - Can drag file or click to select

2. **User uploads file**
   - Loading state shown
   - File sent to `/api/purchases/import/preview`
   - Success: Moves to mapping step
   - Error: Toast error message

3. **User maps columns**
   - Auto-mapped columns pre-filled
   - Can adjust mappings with dropdowns
   - Sees sample data in preview table
   - Required fields validated
   - "가져오기 실행" button enabled when valid

4. **User executes import**
   - Loading state shown
   - Data sent to `/api/purchases/import/commit`
   - Success: Shows result with stats
   - Partial: Shows result with errors
   - Error: Toast error message

5. **User reviews results**
   - Sees success/error counts
   - Can view error table
   - Can download error CSV
   - Can upload new file

## 📊 Validation Rules

### Column Mapping Validation

```typescript
const validateMapping = () => {
  // Required fields
  if (!columnMapping.purchasedAt) return { valid: false, message: "구매일 컬럼 매핑 필요" };
  if (!columnMapping.vendorName) return { valid: false, message: "벤더 컬럼 매핑 필요" };
  if (!columnMapping.itemName) return { valid: false, message: "품목명 컬럼 매핑 필요" };
  if (!columnMapping.qty) return { valid: false, message: "수량 컬럼 매핑 필요" };

  // Either amount or unitPrice required
  if (!columnMapping.amount && !columnMapping.unitPrice) {
    return { valid: false, message: "금액 또는 단가 중 하나는 매핑 필요" };
  }

  return { valid: true };
};
```

### Data Validation (Same as before)

- Zod schema validation
- Date format parsing
- Number parsing with comma removal
- Required field checks

## 🎯 Key Features

### 1. Auto-mapping Intelligence

```typescript
const autoMapping: Record<string, string> = {};
for (const field of STANDARD_FIELDS) {
  const matchedColumn = data.columns.find((col) => {
    const normalized = col.toLowerCase().replace(/[_\s-]/g, "");
    const fieldNormalized = field.key.toLowerCase();
    return (
      normalized === fieldNormalized ||
      normalized.includes(fieldNormalized) ||
      fieldNormalized.includes(normalized)
    );
  });
  if (matchedColumn) {
    autoMapping[field.key] = matchedColumn;
  }
}
```

### 2. File Cache Management

```typescript
// 30-minute temporary cache
const fileCache = new Map<string, {
  rows: any[];
  filename: string;
  timestamp: number
}>();

// Auto cleanup old entries
function cleanupCache() {
  const now = Date.now();
  const thirtyMinutes = 30 * 60 * 1000;

  for (const [key, value] of fileCache.entries()) {
    if (now - value.timestamp > thirtyMinutes) {
      fileCache.delete(key);
    }
  }
}
```

### 3. Error CSV Download

```typescript
const downloadErrorCsv = () => {
  const csvContent = [
    ["행 번호", "오류"],
    ...importResult.errorSample.map((err) => [
      err.row,
      err.errors.join("; ")
    ]),
  ]
    .map((row) => row.join(","))
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "import-errors.csv";
  link.click();
  URL.revokeObjectURL(url);
};
```

## 🧪 Testing

### Manual Testing Steps

1. **Test file upload**
   ```bash
   # Use sample-purchase-import.csv
   - Drag file to dropzone
   - Verify preview appears
   - Check auto-mapping
   ```

2. **Test column mapping**
   - Try different column names
   - Verify required field validation
   - Check sample data preview

3. **Test import execution**
   - Execute with valid mapping
   - Verify success count
   - Check data in database

4. **Test error handling**
   - Upload file with invalid data
   - Verify error display
   - Download error CSV

5. **Test responsiveness**
   - Test on mobile (375px)
   - Test on tablet (768px)
   - Test on desktop (1920px)

## 📱 Responsive Breakpoints

```css
/* Mobile */
@media (max-width: 768px) {
  - Single column form
  - Horizontal scroll tables
  - Full-width buttons
}

/* Tablet */
@media (min-width: 768px) and (max-width: 1024px) {
  - Two column form
  - Optimized table widths
}

/* Desktop */
@media (min-width: 1024px) {
  - Two column form
  - Full table display
  - Larger modals
}
```

## 🎨 Visual Design

### Step Indicator
- Active: Primary color with white text
- Completed: Green with checkmark icon
- Pending: Muted background

### Drag & Drop Zone
- Default: Dashed border
- Hover: Primary border with subtle background
- Dragging: Primary border with primary background (5% opacity)

### Result Cards
- Total: Default border
- Success: Green background/text
- Error: Red background/text

## 🔮 Future Enhancements

- [ ] Drag reorder for column mapping
- [ ] Save custom column mappings as templates
- [ ] Batch file upload (multiple files)
- [ ] Import progress bar for large files
- [ ] Column data type detection
- [ ] Advanced filtering in preview table
- [ ] Export successful records to CSV
- [ ] Undo import functionality

## 📚 Related Documentation

- [FILE_IMPORT_API.md](./FILE_IMPORT_API.md) - API documentation
- [FILE_UPLOAD_IMPLEMENTATION_SUMMARY.md](./FILE_UPLOAD_IMPLEMENTATION_SUMMARY.md) - Backend summary
- [IMPLEMENTATION_COMPLETE.md](./IMPLEMENTATION_COMPLETE.md) - Complete project guide

## ✅ Completion Checklist

- [x] Preview endpoint created
- [x] Commit endpoint created
- [x] CSV upload tab component created
- [x] File dropzone with drag & drop
- [x] Column mapping UI with validation
- [x] Sample preview table
- [x] Import result display
- [x] Error table with download
- [x] Step indicator component
- [x] Integration with dashboard
- [x] Three-tab interface
- [x] Responsive design
- [x] Toast notifications
- [x] Query invalidation on success

**Status: COMPLETE** ✅
