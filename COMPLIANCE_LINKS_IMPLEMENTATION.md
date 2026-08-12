# Safety/Compliance Links Implementation (P3.8)

## 개요
Workspace(Organization)별로 SOP 및 규제 링크를 등록하고, 제품 상세에서 조건에 따라 자동으로 표시하는 기능을 구현했습니다.

## 구현된 기능

### 1. 데이터베이스 모델

#### ComplianceLinkTemplate
```prisma
model ComplianceLinkTemplate {
  id             String        @id @default(cuid())
  organizationId String        // FK to Organization
  title          String        // 예: "화학물질 취급 SOP"
  url            String
  description    String?
  tags           Json?         // string[] - ["SDS","폐기","보관","PPE"]
  rules          Json?         // 조건 규칙
  priority       Int           @default(100)
  enabled        Boolean       @default(true)
  createdAt      DateTime
  updatedAt      DateTime
}
```

#### Rules 구조 (JSON)
```typescript
{
  "hazardCodesAny": ["H314", "H225"],      // 위험 코드 중 하나라도 포함
  "pictogramsAny": ["corrosive", "flame"], // 피크토그램 중 하나라도 포함
  "categoryIn": ["시약", "화학물질"],         // 카테고리가 목록에 포함
  "vendorIn": ["Sigma", "Thermo"],         // 벤더가 목록에 포함
  "missingSds": true                       // SDS 누락 여부
}
```

### 2. 기본(공통) 규제 링크

`lib/compliance/default-links.ts`에 정의된 12개의 기본 링크:

1. 식품의약품안전처 (식약처)
2. 화학물질종합정보시스템
3. MSDS 통합검색 (국립환경과학원)
4. 안전보건공단 (KOSHA)
5. KOSHA MSDS 검색
6. 화학물질정보시스템 (NCIS)
7. EU REACH 규제
8. NFPA 다이아몬드 (미국)
9. GHS (국제조화시스템)
10. 폐기물관리법 (환경부)
11. 실험실 안전환경 구축에 관한 법률
12. 개인보호구 착용 가이드

### 3. API 엔드포인트

#### A) GET /api/compliance-links?productId={productId}
- **목적**: 특정 제품에 적용되는 규제/SOP 링크 조회
- **권한**: 로그인된 사용자
- **동작**:
  1. 제품의 안전 정보 추출 (hazardCodes, pictograms, category, vendor, SDS 여부)
  2. 사용자의 organization 조회
  3. Organization의 compliance link 템플릿 조회
  4. Rules를 평가하여 적용 가능한 링크만 필터링
  5. Priority 순으로 정렬
- **응답**:
  ```json
  {
    "defaults": [...],           // 기본 공통 링크
    "workspaceLinks": [...],     // Workspace 커스텀 링크
    "effective": [...]           // 효과적인 링크 (workspace 우선)
  }
  ```

#### B) GET /api/organizations/[id]/compliance-links
- **목적**: Organization의 compliance link 목록 조회
- **권한**: Organization 멤버 또는 시스템 ADMIN
- **응답**: Organization의 모든 compliance link 템플릿

#### C) POST /api/organizations/[id]/compliance-links
- **목적**: 새로운 compliance link 생성
- **권한**: Organization ADMIN 또는 시스템 ADMIN
- **필수 필드**: title, url
- **옵션 필드**: description, tags, rules, priority, enabled
- **검증**:
  - Rules 구조 검증
  - 허용된 규칙 키만 사용 가능
  - 배열/boolean 타입 검증
- **AuditLog**: COMPLIANCE_LINK_CREATE 기록

#### D) PATCH /api/compliance-links/[linkId]
- **목적**: Compliance link 수정
- **권한**: Organization ADMIN 또는 시스템 ADMIN
- **AuditLog**: COMPLIANCE_LINK_UPDATE 기록 (before/after 포함)

#### E) DELETE /api/compliance-links/[linkId]
- **목적**: Compliance link 삭제
- **권한**: Organization ADMIN 또는 시스템 ADMIN
- **AuditLog**: COMPLIANCE_LINK_DELETE 기록

### 4. 규칙 평가 로직

#### lib/compliance/rules.ts

**주요 함수**:

1. `evaluateRules(rules, product)`: 제품이 규칙을 만족하는지 평가
   - 모든 조건이 AND로 평가 (모든 조건 만족 필요)
   - 규칙이 없으면 모든 제품에 적용

2. `filterApplicableLinks(templates, product)`: 적용 가능한 링크 필터링
   - enabled=true인 템플릿만 선택
   - 규칙을 만족하는 템플릿만 필터링
   - priority 순으로 정렬 (낮을수록 우선)

3. `describeRules(rules)`: 규칙을 사람이 읽을 수 있는 형태로 변환
   - "위험 코드: H314, H225 / 카테고리: 시약, 화학물질"

4. `validateRules(rules)`: 규칙 유효성 검사
   - 허용된 키만 사용
   - 타입 검증 (배열, boolean)

**평가 로직**:

```typescript
// 예시: 부식성 물질에 대한 PPE 가이드
{
  "hazardCodesAny": ["H314"],      // H314 포함 시
  "pictogramsAny": ["corrosive"],  // 부식성 피크토그램 포함 시
  "missingSds": false              // SDS가 있는 경우만
}
```

### 5. 우선순위 시스템

1. **Workspace Links** (priority 낮을수록 우선)
   - Organization별로 커스터마이즈된 링크
   - Rules에 따라 조건부 표시
   - Priority: 1 ~ 999 (기본값: 100)

2. **Default Links**
   - 모든 사용자에게 항상 표시
   - Workspace Links 다음에 표시

3. **Effective Links**
   - Workspace Links + Default Links 조합
   - Workspace Links가 먼저 표시됨

### 6. AuditLog 기록

모든 Compliance Link 작업은 AuditLog에 자동 기록:

```typescript
{
  eventType: AuditEventType.SETTINGS_CHANGED,
  entityType: 'COMPLIANCE_LINK',
  entityId: linkId,
  action: 'COMPLIANCE_LINK_CREATE' | 'COMPLIANCE_LINK_UPDATE' | 'COMPLIANCE_LINK_DELETE' | 'COMPLIANCE_LINK_VIEW',
  changes: { before, after },  // UPDATE 시에만
  metadata: {
    linkId: string,
    title: string,
    deletedData: object  // DELETE 시에만
  },
  success: true/false,
  errorMessage: string  // 실패 시
}
```

## 파일 구조

```
apps/web/src/
├── lib/
│   └── compliance/
│       ├── default-links.ts              # 기본 규제 링크 상수
│       └── rules.ts                      # 규칙 평가 로직
├── app/
│   └── api/
│       ├── compliance-links/
│       │   ├── route.ts                  # GET (제품별 조회)
│       │   └── [linkId]/
│       │       └── route.ts              # PATCH, DELETE
│       └── organizations/
│           └── [id]/
│               └── compliance-links/
│                   └── route.ts          # GET, POST
└── prisma/
    └── schema.prisma                     # ComplianceLinkTemplate 모델
```

## 사용 예시

### 1. Workspace에 SOP 링크 등록

```bash
POST /api/organizations/{orgId}/compliance-links
Content-Type: application/json

{
  "title": "부식성 화학물질 취급 SOP",
  "url": "https://company.com/sop/corrosive-chemicals",
  "description": "부식성 물질 취급 시 반드시 준수해야 하는 안전 절차",
  "tags": ["SOP", "부식성", "안전"],
  "rules": {
    "hazardCodesAny": ["H314"],
    "pictogramsAny": ["corrosive"]
  },
  "priority": 10,
  "enabled": true
}
```

### 2. 제품에 적용되는 링크 조회

```bash
GET /api/compliance-links?productId=abc123
```

응답:
```json
{
  "defaults": [
    {
      "id": "msds-nier",
      "title": "MSDS 통합검색",
      "url": "https://msds.kosha.or.kr",
      "description": "물질안전보건자료 통합 검색",
      "tags": ["MSDS", "SDS", "안전"],
      "source": "default"
    }
  ],
  "workspaceLinks": [
    {
      "id": "link123",
      "title": "부식성 화학물질 취급 SOP",
      "url": "https://company.com/sop/corrosive-chemicals",
      "description": "부식성 물질 취급 시 안전 절차",
      "tags": ["SOP", "부식성", "안전"],
      "priority": 10
    }
  ],
  "effective": [
    /* Workspace links 먼저, 그 다음 defaults */
  ]
}
```

### 3. 링크 수정

```bash
PATCH /api/compliance-links/{linkId}
Content-Type: application/json

{
  "title": "부식성 화학물질 취급 SOP (개정)",
  "priority": 5
}
```

### 4. 링크 삭제

```bash
DELETE /api/compliance-links/{linkId}
```

## Rules 예시

### 예시 1: 발암성 물질에 대한 폐기 절차
```json
{
  "title": "발암성 물질 폐기 절차",
  "url": "https://company.com/sop/carcinogen-disposal",
  "rules": {
    "hazardCodesAny": ["H350", "H351"]
  }
}
```

### 예시 2: SDS 누락 품목에 대한 안내
```json
{
  "title": "SDS 누락 품목 처리 가이드",
  "url": "https://company.com/guide/missing-sds",
  "rules": {
    "missingSds": true
  },
  "priority": 1
}
```

### 예시 3: 특정 벤더의 시약 보관 가이드
```json
{
  "title": "Sigma-Aldrich 시약 보관 지침",
  "url": "https://company.com/storage/sigma",
  "rules": {
    "vendorIn": ["Sigma-Aldrich", "Sigma"],
    "categoryIn": ["시약", "화학물질"]
  }
}
```

### 예시 4: 인화성 물질 취급 SOP
```json
{
  "title": "인화성 물질 취급 SOP",
  "url": "https://company.com/sop/flammable",
  "rules": {
    "hazardCodesAny": ["H225", "H226"],
    "pictogramsAny": ["flame"]
  }
}
```

## 완료 기준 달성

✅ Admin이 workspace에 SOP 링크를 등록 가능
✅ 제품 상세에서 해당 조건에 맞는 링크가 자동으로 노출됨 (API 구현 완료)
✅ 링크 변경이 감사로그에 남음
✅ Rules 평가 로직 구현 (hazardCodes, pictograms, category, vendor, missingSds)
✅ 우선순위 시스템 (workspace 링크 우선, priority 정렬)
✅ 기본(공통) 규제 링크 12개 제공
✅ CRUD API 완전 구현
✅ 권한 제어 (ADMIN / Organization ADMIN)

## 다음 단계 (UI 구현)

1. **제품 상세 페이지에 compliance links 섹션 추가**
   - `apps/web/src/app/products/[id]/page.tsx` 수정
   - Compliance Links 섹션 추가
   - 링크 목록 표시 (아이콘, 제목, 설명)

2. **Admin UI: Compliance Links 관리 페이지**
   - `/dashboard/organizations/[id]/compliance-links` 페이지 생성
   - 링크 목록 표시
   - 추가/수정/삭제 폼
   - Rules 시각적 편집기

3. **Rules 편집기 컴포넌트**
   - 드롭다운으로 조건 선택
   - 위험 코드 자동완성
   - 피크토그램 선택
   - 실시간 규칙 미리보기

## 테스트 방법

1. **Prisma 마이그레이션 실행**:
   ```bash
   cd apps/web
   npx prisma migrate dev --name add_compliance_link_template
   npx prisma generate
   ```

2. **API 테스트**:
   - Organization에 링크 생성
   - 제품에서 링크 조회
   - Rules 평가 확인
   - AuditLog 확인

3. **Rules 평가 테스트**:
   - 다양한 조건의 링크 생성
   - 해당하는 제품에서만 표시되는지 확인
   - Priority 순서 확인

## 보안 고려사항

1. **권한 제어**:
   - Organization ADMIN만 링크 관리 가능
   - 시스템 ADMIN은 모든 organization의 링크 관리 가능

2. **URL 검증**:
   - 향후 URL 형식 검증 추가 권장
   - HTTPS 강제 고려

3. **XSS 방지**:
   - 링크 제목/설명 표시 시 sanitize 필요

4. **Rate Limiting**:
   - API 호출 제한 고려

## 문의

구현 관련 문의사항은 이슈로 등록해주세요.
