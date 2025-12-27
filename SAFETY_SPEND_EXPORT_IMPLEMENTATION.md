# Safety Spend Report Export Implementation (P3.7)

## 개요
유해화학물질 구매 현황을 분석하고 CSV/XLSX 형식으로 내보낼 수 있는 기능을 구현했습니다.

## 구현된 기능

### 1. API 엔드포인트

#### A) GET /api/safety/spend
- **목적**: 안전 지출 데이터 조회 (대시보드 표시용)
- **권한**: 로그인된 사용자
- **파라미터**:
  - `from`: 시작일 (YYYY-MM-DD)
  - `to`: 종료일 (YYYY-MM-DD)
  - `organizationId`: (옵션) 조직 ID
- **응답**:
  ```json
  {
    "summary": {
      "totalAmount": 총지출금액,
      "hazardousAmount": 유해물질지출,
      "hazardousSharePct": 유해물질비율,
      "missingSdsAmount": SDS누락금액,
      "unmappedCount": 제품미매칭건수,
      "unmappedAmount": 미매칭금액
    },
    "breakdown": {
      "byMonth": [...],
      "topHazardCodes": [...],
      "topVendors": [...]
    }
  }
  ```

#### B) GET /api/safety/spend/export
- **목적**: 안전 지출 보고서 파일 생성 및 다운로드
- **권한**: ADMIN 또는 BUYER 역할
- **파라미터**:
  - `from`: 시작일 (필수, YYYY-MM-DD)
  - `to`: 종료일 (필수, YYYY-MM-DD)
  - `format`: 파일 형식 (csv|xlsx|pdf, 기본값: csv)
  - `organizationId`: (옵션) 조직 ID
- **기능**:
  - 날짜 범위 검증 (최대 2년)
  - CSV/XLSX 파일 생성
  - AuditLog 자동 기록
  - UTF-8 BOM 포함 (Excel 호환)
- **파일명 규칙**: `bioinsight_safety_spend_<from>_<to>.<ext>`

### 2. 대시보드 페이지

#### /dashboard/safety-spend
- **위치**: `apps/web/src/app/dashboard/safety-spend/page.tsx`
- **주요 기능**:
  - 기간 선택 (시작일/종료일)
  - 실시간 데이터 조회
  - 요약 통계 카드:
    - 총 지출 금액
    - 유해물질 지출 및 비율
    - SDS 누락 금액
    - 제품 미매칭 건수 및 금액
  - 월별 지출 추이 테이블
  - 상위 위험 코드 Top 10
  - 상위 벤더 Top 10
  - 파일 형식 선택 (CSV/XLSX)
  - 내보내기 버튼

### 3. 보고서 포함 항목

#### Summary 섹션
- 기간 (from ~ to)
- 총 지출 금액 (totalAmount)
- 유해물질 지출 (hazardousAmount)
- 유해물질 비율 (hazardousSharePct)
- SDS 누락 금액 (missingSdsAmount)
- 제품 미매칭 건수/금액 (unmappedCount/Amount)

#### Breakdown 섹션

**월별 분해 (byMonth)**:
- 년-월 (yearMonth)
- 총 지출 (total)
- 유해물질 지출 (hazardous)
- SDS 누락 금액 (missingSds)

**상위 위험 코드 (topHazardCodes)**:
- 위험 코드 (code)
- 금액 (amount)

**상위 벤더 (topVendors)**:
- 벤더명 (vendorName)
- 금액 (amount)

#### Detail 섹션 (상세 목록, 최대 5,000개)
- 구매일 (purchaseDate)
- 벤더 (vendor)
- 제품명 (productName)
- 카탈로그 번호 (catalogNumber)
- 금액 (amount)
- 제품 매칭 여부 (productMatched)
- 위험 코드 (hazardCodes)
- 피크토그램 (pictograms)
- SDS 보유 여부 (hasSds)
- 보관 조건 (storageCondition)

### 4. 파일 형식

#### CSV
- **특징**:
  - UTF-8 BOM 포함 (Excel에서 한글 깨짐 방지)
  - 섹션별 구분 (=== 헤더 사용)
  - 쉼표로 구분된 값
- **구조**:
  ```
  === Safety Spend Report Summary ===
  Period,2024-01-01 - 2024-03-31
  Total Amount,1000000 KRW
  ...

  === Monthly Breakdown ===
  Year-Month,Total Amount (KRW),Hazardous Amount (KRW),Missing SDS Amount (KRW)
  2024-01,500000,200000,50000
  ...

  === Top Hazard Codes ===
  ...

  === Top Vendors ===
  ...

  === Purchase Details ===
  ...
  ```

#### XLSX (옵션)
- **특징**:
  - xlsx 라이브러리 사용
  - 다중 시트 구성
- **시트 구성**:
  1. Summary (요약)
  2. Monthly Breakdown (월별)
  3. Hazard Codes (위험 코드)
  4. Vendors (벤더)
  5. Details (상세, 최대 5,000행)

#### PDF (미구현)
- MVP에서 제외
- 향후 구현 예정

### 5. 안전 및 성능

#### 권한 제어
- API 엔드포인트: ADMIN 또는 BUYER 역할만 접근 가능
- 401 Unauthorized: 미인증 사용자
- 403 Forbidden: 권한 없는 사용자

#### 기간 제한
- 최대 2년 (24개월)
- 초과 시 400 Bad Request 반환

#### Rate Limiting
- 향후 구현 권장 (남용 방지)

#### 상세 데이터 제한
- 최대 5,000개 행
- 초과 시 안내 메시지 포함 권장

### 6. AuditLog 기록

모든 export 요청은 자동으로 AuditLog에 기록됩니다:

```typescript
{
  eventType: AuditEventType.DATA_EXPORTED,
  entityType: 'SAFETY_SPEND_REPORT',
  action: 'SAFETY_SPEND_EXPORT',
  metadata: {
    from: '2024-01-01',
    to: '2024-03-31',
    format: 'csv',
    recordCount: 150
  },
  success: true/false,
  errorMessage: (실패 시)
}
```

## 파일 구조

```
apps/web/src/
├── app/
│   ├── api/
│   │   └── safety/
│   │       └── spend/
│   │           ├── route.ts          # 조회 API
│   │           └── export/
│   │               └── route.ts      # 내보내기 API
│   └── dashboard/
│       └── safety-spend/
│           └── page.tsx              # 대시보드 페이지
```

## 설치된 패키지

```json
{
  "xlsx": "^0.18.5"  // XLSX 파일 생성용
}
```

## 사용 방법

### 1. 대시보드 접속
```
/dashboard/safety-spend
```

### 2. 기간 선택
- 시작일과 종료일 입력
- "조회" 버튼 클릭하여 데이터 확인

### 3. 내보내기
- 파일 형식 선택 (CSV 또는 XLSX)
- "내보내기" 버튼 클릭
- 파일 자동 다운로드

### 4. API 직접 호출 (옵션)
```bash
# CSV 내보내기
GET /api/safety/spend/export?from=2024-01-01&to=2024-03-31&format=csv

# XLSX 내보내기
GET /api/safety/spend/export?from=2024-01-01&to=2024-03-31&format=xlsx
```

## 완료 기준 달성

✅ CSV 다운로드가 바로 Excel에서 깨짐 없이 열림 (UTF-8 BOM 적용)
✅ Summary/분해/상세가 포함됨
✅ Export가 AuditLog에 기록됨
✅ XLSX 옵션 지원 (xlsx 라이브러리 설치)
✅ 권한 제어 (ADMIN/BUYER만 접근)
✅ 날짜 검증 및 기간 제한 (최대 2년)
✅ 파일명 규칙 준수

## 향후 개선 사항

1. **Rate Limiting**: 남용 방지를 위한 요청 제한
2. **PDF Export**: PDF 형식 지원
3. **이메일 전송**: 대용량 보고서를 이메일로 전송
4. **스케줄링**: 정기적인 보고서 자동 생성
5. **추가 필터**: 벤더별, 위험 코드별 필터링
6. **차트 포함**: 월별 추이 그래프를 XLSX/PDF에 포함

## 테스트 방법

1. **기능 테스트**:
   - 다양한 날짜 범위로 조회
   - CSV/XLSX 파일 다운로드
   - Excel에서 파일 열어 한글 정상 표시 확인

2. **권한 테스트**:
   - ADMIN 계정으로 접근
   - BUYER 계정으로 접근
   - 일반 사용자로 접근 (403 확인)

3. **에러 케이스**:
   - 날짜 미입력
   - 시작일 > 종료일
   - 2년 초과 기간 선택

4. **AuditLog 확인**:
   - Export 후 AuditLog 테이블 확인
   - metadata 정보 확인

## 문의

구현 관련 문의사항은 이슈로 등록해주세요.
