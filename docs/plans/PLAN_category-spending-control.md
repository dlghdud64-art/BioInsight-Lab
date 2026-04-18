# 카테고리별 지출 통제 (Category-Based Spending Control)

> **상태**: 계획 검토 대기  
> **최종 갱신**: 2026-04-13  
> **예상 규모**: Large (6 Phase, ~20시간)

**CRITICAL INSTRUCTIONS**: 각 Phase 완료 후:
1. ✅ 완료된 항목 체크
2. 🧪 Quality Gate 검증 명령어 실행
3. ⚠️ 모든 Quality Gate 항목 통과 확인
4. 📅 "최종 갱신" 날짜 업데이트
5. 📝 Notes 섹션에 학습 내용 기록
6. ➡️ 다음 Phase 진행

⛔ Quality Gate를 건너뛰거나 실패한 채 진행 금지

---

## 개요

### 목적
연구 구매 운영 워크벤치에서 **카테고리별 예산 한도 설정 → 실시간 지출 집계 → 구매 승인 시 예산 검증 → 대시보드 시각화**를 구현한다.

### 현재 상태 (As-Is)
- `PurchaseRecord.category`: nullable string (인덱스 있음, 값 자유 입력)
- `Budget` 모델: scopeKey + yearMonth 기반, **카테고리 필드 없음**
- `ProductCategory` enum: REAGENT, TOOL, EQUIPMENT, RAW_MATERIAL (Product 모델에만 사용)
- 구매 요청 승인 시 **예산 검증 없음**
- 카테고리별 지출 대시보드 **미구현**

### 목표 상태 (To-Be)
- 관리자가 카테고리를 추가/수정/삭제 가능
- 카테고리별 월간 예산 한도 설정 (warning/soft_limit/hard_stop 3단계)
- 구매 요청 승인 시 해당 카테고리 예산 잔여 검증 → hard_stop이면 차단
- 대시보드에 카테고리별 이번 달 지출, MOM% 변화율, 상태 표시
- budget-control-contract의 `BudgetScopeLevel: "category"` 실제 연결

---

## 아키텍처 결정

### 1. 카테고리 모델링: 별도 `SpendingCategory` 테이블
**이유**: 
- PurchaseRecord.category가 이미 자유 문자열 → 기존 데이터와 정합성 유지 필요
- 관리자 설정 가능 → DB 레코드가 적합 (enum 확장보다)
- 카테고리별 예산 한도를 FK로 연결 가능

```
SpendingCategory {
  id, organizationId, name, displayName, description, 
  color, icon, sortOrder, isActive, isDefault
}

CategoryBudget {
  id, organizationId, categoryId (FK→SpendingCategory), 
  yearMonth, amount, warningPercent, softLimitPercent, hardStopPercent,
  controlRules (Json), isActive
}
```

### 2. 지출 집계: PurchaseRecord.category 기준 실시간 SUM
**이유**: 
- 별도 집계 테이블 없이 PurchaseRecord에 이미 category 인덱스 있음
- 조회 시 `GROUP BY category, yearMonth` → 카테고리별 월간 합산
- 추후 materialized view나 캐시 레이어 추가 가능

### 3. 예산 검증 위치: 승인 API (`/api/request/[id]/approve`)
**이유**: 
- 구매 요청 생성 시에는 warning만 (soft block)
- 승인 시에 hard_stop 검증 (irreversible action 직전)
- budget-control-contract의 기존 ControlRuleType 재사용

### 4. 대시보드: 기존 budget 페이지에 섹션 추가
**이유**: 
- 새 페이지 금지 (CLAUDE.md 준수)
- 기존 `/dashboard/budget` 페이지 하단에 카테고리별 지출 현황 섹션 추가

---

## Phase 1: 스키마 + 카테고리 관리 API (3~4시간)

### 목표
SpendingCategory, CategoryBudget 테이블 생성 + 카테고리 CRUD API

### Tasks

#### RED: 테스트 작성
- [ ] SpendingCategory CRUD API 테스트 (생성, 조회, 수정, 삭제, 비활성화)
- [ ] CategoryBudget CRUD API 테스트 (한도 설정, 조회, 수정)
- [ ] 권한 검증 테스트 (ADMIN만 카테고리/한도 관리 가능)
- [ ] 중복 카테고리명 방지 테스트

#### GREEN: 구현
- [ ] Prisma 스키마 추가: `SpendingCategory`, `CategoryBudget` 모델
- [ ] `prisma migrate dev` 실행
- [ ] `/api/spending-categories` route (GET: 목록, POST: 생성)
- [ ] `/api/spending-categories/[id]` route (PATCH: 수정, DELETE: 삭제)
- [ ] `/api/category-budgets` route (GET: 목록, POST: 한도 설정)
- [ ] `/api/category-budgets/[id]` route (PATCH: 수정, DELETE: 삭제)
- [ ] enforceAction 적용 (budget_create, budget_update, budget_delete)
- [ ] 기본 카테고리 시드 데이터 (시약 및 화합물, 소모품, 세포 배양 배지, 항체 및 단백질)

#### REFACTOR
- [ ] Zod validation 스키마 분리
- [ ] 응답 타입 통일

### Quality Gate
- [ ] `npx prisma migrate dev` 성공
- [ ] CRUD API 테스트 통과
- [ ] enforceAction 적용 확인
- [ ] TSC 에러 0건 (기존 제외)

### 의존성
없음 (첫 Phase)

---

## Phase 2: 카테고리별 지출 집계 엔진 (2~3시간)

### 목표
PurchaseRecord 기반 카테고리별 월간 지출 집계 + MOM% 계산 API

### Tasks

#### RED: 테스트 작성
- [ ] 카테고리별 월간 지출 합산 테스트
- [ ] MOM% 변화율 계산 테스트 (전월 대비)
- [ ] 예산 대비 사용률 계산 테스트
- [ ] 상태 판정 테스트 (정상/주의/예산 초과 위험)
- [ ] 카테고리가 없는(null) PurchaseRecord 처리 테스트
- [ ] PurchaseRecord.category ↔ SpendingCategory 매핑 테스트

#### GREEN: 구현
- [ ] `lib/budget/category-spending-engine.ts`: 집계 핵심 로직
  - `aggregateCategorySpending(orgId, yearMonth)` → 카테고리별 합산
  - `calculateMoM(orgId, yearMonth)` → 전월 대비 변화율
  - `evaluateCategoryBudgetStatus(spending, budget)` → 상태 판정
- [ ] `/api/category-spending` route (GET: 카테고리별 지출 현황)
  - 파라미터: organizationId, yearMonth (기본: 이번 달)
  - 응답: `{ categories: [{ id, name, spent, budget, usagePercent, momChange, status }] }`
- [ ] PurchaseRecord.category → SpendingCategory 매핑 로직
  - 정확 매치 우선, 부분 매치 fallback, 미매핑은 "기타"

#### REFACTOR
- [ ] 집계 쿼리 최적화 (단일 GROUP BY 쿼리)
- [ ] 타입 안전성 강화

### Quality Gate
- [ ] 집계 정확도 테스트 통과
- [ ] MOM% 계산 정확도 테스트 통과
- [ ] null 카테고리 안전 처리 확인
- [ ] TSC 에러 0건 (기존 제외)

### 의존성
Phase 1 (SpendingCategory, CategoryBudget 모델)

---

## Phase 3: 구매 승인 시 예산 검증 연동 (3~4시간)

### 목표
구매 요청 승인 시 카테고리별 예산 잔여 검증 + hard_stop/soft_limit 차단/경고

### Tasks

#### RED: 테스트 작성
- [ ] 예산 잔여 충분 → 승인 정상 진행 테스트
- [ ] hard_stop 초과 → 승인 차단 테스트
- [ ] soft_limit 초과 → 경고 반환 + 승인은 허용 테스트
- [ ] warning 도달 → 경고 반환 + 승인 허용 테스트
- [ ] CategoryBudget 미설정 카테고리 → 기본 통과 테스트
- [ ] 복수 카테고리 아이템 → 각각 검증 테스트
- [ ] 구매 요청 생성 시 budget warning 반환 테스트

#### GREEN: 구현
- [ ] `lib/budget/category-budget-validator.ts`:
  - `validateCategoryBudget(orgId, items)` → 카테고리별 예산 검증
  - 반환: `{ allowed: boolean, warnings: [], blockers: [], details: [] }`
- [ ] `/api/request/[id]/approve/route.ts` 수정:
  - 승인 전 `validateCategoryBudget()` 호출
  - hard_stop 위반 → 403 + blocker 메시지
  - soft_limit 위반 → 200 + warning 메시지 (승인은 진행)
- [ ] `/api/request/route.ts` 수정 (POST):
  - 생성 시 `validateCategoryBudget()` 호출
  - warning/soft_limit → 경고 메시지 반환 (생성은 허용)
  - hard_stop → 경고 메시지 반환 (생성은 허용, 승인만 차단)
- [ ] 구매 요청 아이템에서 카테고리 추출 로직
  - QuoteItem → Product.category 매핑
  - 수동 아이템 → 사용자 입력 카테고리

#### REFACTOR
- [ ] validator 결과를 enforcement audit에 기록
- [ ] budget-control-contract의 ControlRuleType 재사용

### Quality Gate
- [ ] hard_stop 차단 동작 검증
- [ ] soft_limit 경고 동작 검증
- [ ] 기존 승인 플로우 회귀 없음 확인
- [ ] enforceAction audit에 budget 정보 포함 확인
- [ ] TSC 에러 0건 (기존 제외)

### 의존성
Phase 1 (스키마), Phase 2 (집계 엔진)

---

## Phase 4: 카테고리 관리 UI (2~3시간)

### 목표
관리자용 카테고리 관리 + 카테고리별 예산 한도 설정 UI

### Tasks

#### RED: 테스트 작성
- [ ] 카테고리 목록 렌더링 테스트
- [ ] 카테고리 추가/수정/삭제 동작 테스트
- [ ] 예산 한도 설정 폼 유효성 검증 테스트
- [ ] ADMIN 아닌 사용자에게 관리 UI 숨김 테스트

#### GREEN: 구현
- [ ] `lib/store/spending-category-store.ts`: Zustand store
  - categories, categoryBudgets CRUD 액션
  - API 연동 (fetch, create, update, delete)
- [ ] 기존 `/dashboard/budget` 페이지에 카테고리 관리 섹션 추가
  - 카테고리 목록 (이름, 색상, 아이콘, 활성/비활성)
  - 카테고리 추가/수정 다이얼로그
  - 카테고리별 예산 한도 설정 (금액, warning/soft_limit/hard_stop %)
- [ ] 권한 기반 UI 분기 (ADMIN만 관리 가능, 일반 사용자는 조회만)

#### REFACTOR
- [ ] budget-control-view-models의 BudgetRuleCardViewModel 활용
- [ ] 운영형 workbench 톤 유지 (flashy SaaS 금지)

### Quality Gate
- [ ] 카테고리 CRUD 전체 동작 확인
- [ ] 예산 한도 설정/수정 동작 확인
- [ ] 권한 분기 정상 동작 확인
- [ ] 모바일 반응형 기본 확인
- [ ] TSC 에러 0건 (기존 제외)

### 의존성
Phase 1 (API), Phase 2 (집계)

---

## Phase 5: 카테고리별 지출 대시보드 위젯 (2~3시간)

### 목표
대시보드에 카테고리별 지출 현황 카드 (이번 달 지출, MOM%, 상태 표시)

### Tasks

#### RED: 테스트 작성
- [ ] 카테고리별 지출 카드 렌더링 테스트
- [ ] MOM% 양수/음수 표시 테스트
- [ ] 상태별 색상/아이콘 테스트 (정상=green, 주의=amber, 초과위험=red)
- [ ] 데이터 없는 카테고리 처리 테스트
- [ ] 로딩/에러 상태 테스트

#### GREEN: 구현
- [ ] `components/dashboard/CategorySpendingWidget.tsx`:
  - 카테고리별 카드 그리드 (스크린샷 기준 4열)
  - 각 카드: 카테고리명, 이번 달 금액(₩), MOM% 변화율, 상태 뱃지
  - MOM%: 양수(↑ 빨강), 음수(↓ 초록)
  - 상태: 정상(emerald), 주의(amber), 예산 초과 위험(red)
- [ ] 기존 `/dashboard/budget` 페이지에 위젯 삽입
  - 예산 요약 섹션 바로 아래
  - 접기/펼치기 불필요 (항상 표시)
- [ ] `/api/category-spending` 호출 연동

#### REFACTOR
- [ ] RISK_CONFIG 재사용 (기존 budget 페이지와 톤 통일)
- [ ] formatWonShort 재사용

### Quality Gate
- [ ] 4개 기본 카테고리 정상 렌더링
- [ ] MOM% 계산 정확도 확인
- [ ] 상태별 시각적 구분 확인
- [ ] 0건 카테고리 안전 처리 확인
- [ ] TSC 에러 0건 (기존 제외)

### 의존성
Phase 2 (집계 API), Phase 4 (store)

---

## Phase 6: 통합 검증 + 엣지 케이스 (2~3시간)

### 목표
전체 흐름 E2E 검증 + 엣지 케이스 처리 + 문서 갱신

### Tasks

#### 통합 시나리오 검증
- [ ] 관리자: 카테고리 생성 → 예산 한도 설정 → 대시보드 확인
- [ ] 구매 요청 생성 → 카테고리 예산 warning 확인
- [ ] 구매 요청 승인 → hard_stop 차단 동작 확인
- [ ] PurchaseRecord 추가 후 → 대시보드 지출 반영 확인
- [ ] 월 변경 시 → 새 달 예산 정상 적용 확인

#### 엣지 케이스
- [ ] PurchaseRecord.category가 null인 기존 데이터 처리
- [ ] SpendingCategory가 삭제된 후 기존 PurchaseRecord 조회
- [ ] CategoryBudget 미설정 카테고리의 지출 → "기타" 처리
- [ ] 동시 승인 요청 시 race condition (budget 잔여 동시 차감)
- [ ] 조직이 없는(개인) 사용자의 카테고리 예산

#### 문서/계약 갱신
- [ ] budget-control-contract.ts: category scope 실제 연결 주석 갱신
- [ ] ARCHITECTURE.md: 카테고리별 지출 통제 추가 (해당 시)

### Quality Gate
- [ ] 전체 E2E 시나리오 통과
- [ ] 엣지 케이스 안전 처리 확인
- [ ] 기존 예산 기능 회귀 없음
- [ ] TSC 에러 0건 (기존 제외)
- [ ] `npm run build` 성공

### 의존성
Phase 1~5 전체

---

## 리스크 평가

| 리스크 | 확률 | 영향 | 대응 |
|--------|------|------|------|
| PurchaseRecord.category 기존 데이터 불일치 | 높음 | 중간 | fuzzy 매핑 + "기타" fallback |
| 동시 승인 시 budget race condition | 중간 | 높음 | DB 트랜잭션 + SELECT FOR UPDATE |
| CategoryBudget 없는 카테고리 차단 오류 | 중간 | 높음 | 미설정 = 통과 (opt-in 정책) |
| 대시보드 집계 성능 | 낮음 | 중간 | 인덱스 활용, 추후 캐시 추가 |
| Prisma migrate 충돌 | 낮음 | 중간 | 기존 마이그레이션 이력 확인 후 진행 |

---

## 롤백 전략

- **Phase 1**: `prisma migrate revert` + API route 파일 삭제
- **Phase 2**: 집계 엔진 파일 삭제 (의존 없음)
- **Phase 3**: approve/reject route를 git checkout으로 복원
- **Phase 4~5**: UI 파일 삭제 + store 파일 삭제
- **Phase 6**: 테스트 파일만 제거

---

## Prisma 스키마 변경 상세

```prisma
model SpendingCategory {
  id              String    @id @default(cuid())
  organizationId  String
  name            String    // 내부 키 (영문, unique per org)
  displayName     String    // 표시명 (한국어)
  description     String?
  color           String    @default("#6366f1") // tailwind indigo-500
  icon            String?   // lucide icon name
  sortOrder       Int       @default(0)
  isActive        Boolean   @default(true)
  isDefault       Boolean   @default(false) // 시드 카테고리
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  organization    Organization @relation(fields: [organizationId], references: [id])
  budgets         CategoryBudget[]

  @@unique([organizationId, name])
  @@index([organizationId, isActive])
}

model CategoryBudget {
  id              String    @id @default(cuid())
  organizationId  String
  categoryId      String
  yearMonth       String    // "YYYY-MM"
  amount          Int       // 예산 금액
  currency        String    @default("KRW")
  warningPercent  Int       @default(70)
  softLimitPercent Int      @default(90)
  hardStopPercent Int       @default(100)
  controlRules    Json?     // ["warning", "soft_limit", "hard_stop"]
  isActive        Boolean   @default(true)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  organization    Organization @relation(fields: [organizationId], references: [id])
  category        SpendingCategory @relation(fields: [categoryId], references: [id])

  @@unique([organizationId, categoryId, yearMonth])
  @@index([organizationId, yearMonth])
  @@index([categoryId])
}
```

---

## Notes & Learnings
(Phase 진행 중 기록)

