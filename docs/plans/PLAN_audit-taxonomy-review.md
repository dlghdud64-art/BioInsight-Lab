# §audit-taxonomy-review — enforceAction 분류 체계 설계

작성: 2026-08-10
상태: **설계안 (승인 대기)** — 코드 변경·마이그레이션 없음. 문서 + enum 초안만.
발원: §enforcement-handle-close-sweep 배치1~12

---

## 0. 전제 조건 — 순서 의존성 (호영님 2026-08-10 확정)

**`entityCapabilities` DB 조회 구현(`server-enforcement-middleware.ts:146` TODO)은
이 트랙 완료 이후로 못박는다.** 순서를 뒤집으면 두 번 한다.

1. **오늘 고치면 감사 기록 정정, 나중에 고치면 접근 규칙 변경이다.**
   지금 `targetEntityType` 은 접근 판정에 무영향이다(§2). 구현 후에는 같은 수정이
   권한 변경이 되어 회귀 위험과 리뷰 비용이 한 자릿수 배 차이가 난다.
2. **오분류가 굳으면 capability 매핑을 틀린 taxonomy 위에 얹게 된다.**
3. **클래스 ③ 이 존재하므로 첫 단계가 타입 체계 설계다.** capability 구현과 같은
   층위라, 순서가 뒤집히면 같은 설계를 두 번 한다.

해당 TODO 라인에 역참조 주석을 남겼다.

## 0-1. 최상단 고정 규칙

**개별 route 의 `targetEntityType` 을 하나씩 고쳐서 시작하지 않는다.**
클래스 ③(enum 에 선택지 부재)이 존재하므로 첫 단계는 개별 교정이 아니라
**타입 체계 설계**다.

---

## 1. 실측 — 규모 재정의 (2026-08-10)

지금까지 "31건" 으로 보고해 온 것은 **sweep 작업 중 눈에 띈 후보**였다.
설계에 착수하며 전수를 세었다.

```
src/app/api/**/route.ts 의 enforceAction 호출 지점 = 169
```

| 지표 | 값 |
|---|---|
| enforceAction 호출 지점 | **169** |
| `targetEntityType: 'ai_action'` | **57 (34%)** |
| `targetEntityId: 'unknown'` | **54 (32%)** |
| 정규식으로 파싱하지 못한 지점 | 13 (포맷 상이) → 위 숫자는 **하한** |

현재 사용 중인 `targetEntityType` 분포:

| 값 | 건수 | 값 | 건수 |
|---|---|---|---|
| `ai_action` | 57 | `team` | 4 |
| `quote` | 25 | `workspace` | 4 |
| `product` | 14 | `billing` | 3 |
| `inventory` | 14 | `budget` | 3 |
| (파싱 실패) | 13 | `purchase_request` | 3 |
| `organization` | 10 | `approval` | 2 |
| `governance` | 8 | `cart` | 1 |
| `order` | 7 | `compare_session` | 1 |

**`ai_action` 이 전체의 1/3이라는 사실이 이 트랙의 핵심 근거다.** 이 값은 실제로
"AI 액션 아이템(`AiActionItem` 모델)" 을 가리키는 경우가 거의 없고, **"분류할 값이
없을 때의 기본값"** 으로 쓰여 왔다. 즉 taxonomy 가 아니라 미분류 표지다.

## 2. ⚠️ 설계 착수 중 발견 — audit envelope 은 지속되지 않는다

`targetEntityType` 의 세 소비처를 실측했다.

| 소비처 | 상태 |
|---|---|
| ① 접근 판정 `hasEntityCapability` | **무영향** — `entityCapabilities: []` 하드코딩(§0)이라 항상 true 반환 |
| ② security event provenance | 동일 in-memory 경로 |
| ③ audit envelope `appendAuditEnvelope` | **DB 로 가지 않는다** |

```ts
// src/lib/security/audit-integrity-engine.ts
const MAX_STORE_SIZE = 10000;
let auditStore: AuditStore = { ... };          // 모듈 수준 in-memory
// ...
// 최대 크기 초과 시 oldest 제거 (FIFO) — 실제 production에서는 외부 storage로 archive
```

`appendAuditEnvelope` 는 모듈 수준 배열에만 쌓이고 **어떤 DB 쓰기도 하지 않는다**
(`server-enforcement-middleware.ts` 에 `createAuditLog`/`db.auditLog` 호출 0건).
Vercel 람다에서는 인스턴스와 함께 사라지고, 인스턴스마다 체인이 갈라진다.

**이 사실의 함의 세 가지:**

1. **§enforcement-handle-close-sweep 의 근거 중 "감사 추적" 다리는 내가 과장했다.**
   lock 누수(TTL 5분)는 실재했고 그 교정은 온전히 유효하다. 그러나 "complete() 를
   불러야 누가 무엇을 바꿨는지 남는다" 는 서술은 **지속 저장을 전제한 표현**이었고
   현재는 성립하지 않는다. sweep 의 성과는 "호출 지점이 올바르게 정렬됐다" 까지다.
2. **과거 audit 레코드 마이그레이션 문제가 거의 사라진다**(§6). enforceAction
   경로에는 **옮길 과거 레코드가 없다.**
3. **§audit-persistence-gap 을 신규 트랙으로 등재해야 한다.** taxonomy 를 아무리
   정확히 만들어도 기록이 남지 않으면 값어치가 실현되지 않는다.
   다만 순서는 taxonomy 가 먼저다 — 틀린 어휘로 영속화를 시작하면 그때부터
   진짜 마이그레이션 비용이 생긴다.

별개로 **DB 에 지속되는 감사 기록은 존재한다**: `AuditLog` 모델(`entityType String`,
자유 문자열)에 `lib/audit/audit-logger.ts` 의 `createAuditLog` 가 쓴다. 일부 라우트만
호출한다. **enforceAction 의 enum 과 어휘가 다르고 서로 동기화되지 않는다.**

---

## 3. 설계 원칙 (호영님 2026-08-10)

1. **entityType 은 라우트 경로나 UI 표면이 아니라 도메인 엔티티의 canonical 명사.**
   기본 규칙 = **Prisma 모델명과 1:1**(snake_case 변환). 이 규칙에 169건을 비추면
   클래스 ①/③ 이 기계적으로 갈린다.
2. **모델 없는 개념은 별도 분류.** 검색 의도·번역·대시보드 레이아웃처럼 대응 모델이
   없는 것들이 있다. 억지로 모델에 매핑하면 taxonomy 가 거짓말을 한다.
   **"모델 대응 있음/없음" 을 1급 구분으로** 둔다.
3. **클래스 ②(대상 미존재)에 `'unknown'` 을 계속 쓰지 않는다.** 지금 `'unknown'` 은
   "대상이 원래 없음" 과 "지정을 빠뜨림" 을 같은 값으로 뭉갠다. 명시 값으로 분리해야
   앞으로 누락을 sentinel 로 잡을 수 있다. **이 설계의 핵심 판단이며, 여기가 갈리지
   않으면 나머지는 이름 바꾸기에 불과하다.**
4. **capability 열은 만들되 비워둔다.** 채우는 건 `entityCapabilities` 구현 작업이고,
   지금 채우면 설계 승인이 구현 승인으로 슬쩍 바뀐다.

---

## 4. 3클래스 분류 (169건, 원칙 1 기준)

### 클래스 ① 오분류 — enum 에 정확한 값이 **있는데** 다른 값

| route (대표) | 현재 | 실제 대상 | 비고 |
|---|---|---|---|
| `billing`, `billing/portal` | `ai_action` | Organization / Workspace | enum 에 둘 다 있다 |
| `shared-lists` POST | `compare_session` | SharedList | 값은 있으나 **다른 엔티티** |
| `protocol/extract-pdf` | `quote` | 문서(프로토콜) | 형제 4건은 `ai_action` — 같은 도메인이 갈렸다 |
| `products/[id]/inspection` | `product` + action `inventory_update` | Inspection | action 축 불일치 |
| `quotes/cost-optimization` 외 4 | `quote` + action `order_create` | Quote(조회/계산) | action 축 불일치 |
| `safety/spend/map` | `ai_action` | PurchaseRecord | enum 에 `purchase_record` **있는데 안 씀** |
| `inventory/auto-reorder` | `order` | ProductInventory → Order 제안 | 경계 모호 |

**규모: 최소 15건.** 원칙 1 규칙을 확정하면 전수 기계 판정 가능.

### 클래스 ② 대상 미존재 — 생성 전이라 id 가 없다

현재 두 가지 표기가 혼재한다: `'unknown'` 과 `'new'` 계열 리터럴.

| 표기 | route (대표) |
|---|---|
| `'new'` | `admin/orders`, `budgets`, `quote-lists`, `quotes`, `purchases`, `request`, `team` |
| `'unknown'` | `compliance-links` POST, `shared-lists` POST, `activity-logs`, `po-candidates` POST, `ingestion`, `purchases/import-file` |
| 기타 리터럴 | `'bulk'`, `'checkout'`, `'batch'`, `'import-commit'`, `'approval-baseline'`, `` `import_${Date.now()}` `` |

**이미 7건이 `'new'` 라는 명시 값을 쓰고 있다** — 원칙 3 의 방향은 코드베이스가
부분적으로 이미 택한 관행이며, 전면화하는 것이다. 새로 만드는 규약이 아니다.

**규모: 최소 25건.**

### 클래스 ③ 선택지 부재 — enum 에 정확한 값이 **아예 없다**

| 실제 대상 (Prisma 모델) | 현재 대리값 | route (대표) |
|---|---|---|
| `SDSDocument` | `ai_action` | `sds/[id]/apply` `extract` `signed-url` |
| (데이터시트 문서 — **모델 없음**) | `ai_action` | `datasheet/extract*` 3건 |
| `SharedList` | `ai_action` / `compare_session` | `shared-lists*` 3건 |
| `Vendor`, `VendorBillingRecord` | `product` | `vendor/billing`, `vendor/premium` |
| `ComplianceLink` | `ai_action` | `compliance-links*` 2건 |
| `QuoteTemplate` | `product` | `templates*` 2건 |
| `ProductRecommendation`, `RecommendationFeedback` | `ai_action` | `recommendations/*` 2건 |
| `POCandidate` | `ai_action` | `po-candidates` 3건 |
| `ImportJob` | `ai_action` | `purchases/import-file` |
| `IngestionEntry` | `ai_action` | `ingestion` |
| `ActivityLog` | `ai_action` | `activity-logs` |
| `Review` | `ai_action` | `reviews/[id]` |

**규모: 최소 20건.** ③ 은 예외가 아니라 **주요 클래스**다.

### 클래스 ④ (신설) 모델 대응 없음 — 원칙 2

억지로 엔티티에 매핑하면 taxonomy 가 거짓말을 하는 것들.

| route | 실제 대상 |
|---|---|
| `search/intent` | 질의 문자열(개념) |
| `translate` | 텍스트(개념) |
| `dashboard/layout` | 사용자 UI 상태(모델 없음, 저장도 안 함) |
| `export/presets` | 프리셋(모델 없음, 저장도 안 함) |
| `ai-ops/*` 5건 | `documentType` 문자열(카나리 설정 키) |
| `admin/canary-control` | 카나리 config(환경변수) |
| `admin/seed` | 시스템 전역 |
| `analytics/*` 4건 | 집계 조회 |

**규모: 최소 15건.** 이들 대부분은 **DB 쓰기가 0** 이며 sweep 에서 `fail()` 로 닫혔다.

---

## 5. enum 초안

### 5-1. 구조 — 단일 enum 을 두 필드로 쪼갠다

원칙 2("모델 대응 있음/없음 1급 구분")를 이름 규칙이 아니라 **타입 구조**로 표현한다.
접두사(`concept:` 등)로 한 enum 에 섞으면 소비처가 문자열 파싱을 하게 된다.

```ts
/** 대상의 성격 — 모델 대응 여부가 1급 구분 */
type TargetKind =
  | 'entity'    // Prisma 모델에 1:1 대응하는 도메인 엔티티
  | 'concept'   // 대응 모델이 없는 개념 (질의·번역·UI 상태)
  | 'system';   // 시스템 전역 설정/운영 (특정 대상 없음)

/** kind === 'entity' 일 때만 사용. Prisma 모델명 snake_case 1:1. */
type TargetEntityType = /* 5-2 표 */;

/** kind === 'concept' 일 때만 사용. 폐쇄 목록. */
type TargetConceptType =
  | 'search_intent' | 'translation' | 'ui_layout'
  | 'export_preset' | 'analytics_query' | 'canary_config';
```

### 5-2. `TargetEntityType` 초안 (Prisma 모델 1:1)

capability 열은 **의도적으로 비워둔다**(원칙 4).

| enum 값 | Prisma 모델 | 현행 대비 | capability |
|---|---|---|---|
| `organization` | `Organization` | 유지 | |
| `user` | `User` | 신규 | |
| `product` | `Product` | 유지 | |
| `vendor` | `Vendor` | **신규**(현 `product` 대리) | |
| `quote` | `Quote` | 유지 | |
| `quote_item` | `QuoteListItem` | 신규 | |
| `quote_vendor_request` | `QuoteVendorRequest` | 신규 | |
| `quote_template` | `QuoteTemplate` | **신규**(현 `product` 대리) | |
| `order` | `Order` | 유지 | |
| `inventory` | `ProductInventory` | 유지 | |
| `inspection` | `Inspection` | 신규 | |
| `purchase_request` | `PurchaseRequest` | 유지 | |
| `purchase_record` | `PurchaseRecord` | 유지(현재 미사용 → ①) | |
| `po_candidate` | `POCandidate` | **신규** | |
| `cart` | `Cart` | 유지 | |
| `budget` | `Budget` | 유지 | |
| `category_budget` | `CategoryBudget` | 신규 | |
| `spending_category` | `SpendingCategory` | 신규 | |
| `team` | `Team` | 유지 | |
| `workspace` | `Workspace` | 유지 | |
| `subscription` | `Subscription` | 신규 | |
| `invoice` | `Invoice` | 신규 | |
| `payment_method` | `PaymentMethod` | 신규 | |
| `shared_list` | `SharedList` | **신규** | |
| `compare_session` | `CompareSession` | 유지 | |
| `compliance_link` | `ComplianceLink` | **신규** | |
| `review` | `Review` | **신규** | |
| `recommendation` | `ProductRecommendation` | **신규** | |
| `recommendation_feedback` | `RecommendationFeedback` | **신규** | |
| `sds_document` | `SDSDocument` | **신규** | |
| `receiving_document` | `ReceivingDocument` | 신규 | |
| `import_job` | `ImportJob` | **신규** | |
| `ingestion_entry` | `IngestionEntry` | **신규** | |
| `activity_log` | `ActivityLog` | **신규** | |
| `ai_action_item` | `AiActionItem` | **의미 변경** — 현 `ai_action` 의 미분류 용법을 버리고 모델 대응으로 좁힌다 | |
| `invite` | `OrganizationInvite` / `WorkspaceInvite` | 유지(두 모델 대응 — §7-2) | |

**폐기 대상**: 현행 `ai_action` 의 미분류 용법, `governance`(모델 아님 → `system`),
`billing`(모델 아님 → `subscription`/`invoice`/`payment_method` 로 분해),
`approval`(모델 아님 → `purchase_request` + action 축), `dispatch`, `email_draft`,
`receiving`(→ `receiving_document`).

⚠️ **데이터시트 문서는 대응 모델이 없다.** `SDSDocument` 는 있는데 데이터시트는 없다 → §7-1.

### 5-3. `targetEntityId` 의 특수값 — 원칙 3

```ts
/** 'unknown' 폐기. 아래 셋만 특수값으로 허용한다. */
const TARGET_ID_NONE = 'none';   // 대상이 원래 없음 (concept/system)
const TARGET_ID_NEW  = 'new';    // 생성 전 (클래스 ②) — 이미 7건이 쓰는 관행
const TARGET_ID_BULK = 'bulk';   // 다중 대상 배치 — 이미 3건이 쓰는 관행
```

`'unknown'` 을 남기지 않는 것이 핵심이다. 남기면 "대상이 없음" 과 "지정 누락" 이
계속 같은 값으로 뭉개진다. **폐기 후에는 `'unknown'` 의 등장 자체가 누락이므로
sentinel 이 기계적으로 잡을 수 있다.**

⚠️ 부수 효과 — **lock 입도**: `deriveConcurrencyKey` 는 `'unknown'` 일 때만 userId 로
폴백한다. 특수값이 셋으로 늘면 폴백 조건도 함께 고쳐야 한다. `'new'`/`'bulk'` 는
per-user 폴백이 맞고, `'none'` 은 그 자체를 키로 써도 된다(집행할 대상이 없으므로).
→ §7-3.

---

## 6. 과거 audit 레코드 해석 — 3안 비교

§2 의 발견이 이 절의 비용 계산을 크게 바꾼다.
**enforceAction 경로에는 옮길 과거 레코드가 없다**(in-memory, 람다와 함께 소멸).
따라서 아래 비교는 실질적으로 **`AuditLog` 테이블**에만 적용된다.

| 안 | 방식 | 비용 | 위험 | 감사 성질 |
|---|---|---|---|---|
| **A. 옛 값 보존 + 매핑 테이블** | 과거 레코드는 그대로 두고 `legacy → canonical` 매핑을 유지, 조회 시 적용 | 낮음 — 마이그레이션 0 | 낮음. 매핑 적용 누락이 새 결함 클래스가 될 수 있음 | **원본 불변** |
| **B. 백필** | 과거 `entityType` 을 새 어휘로 UPDATE | 중간 — 1회 마이그레이션 | **높음** (아래) | **원본 훼손** |
| **C. 버전 필드 추가** | `taxonomyVersion` 컬럼, 신규 v2 / 과거 v1 | 중간 — 스키마 변경 + 전 소비처 분기 | 중간 | 원본 불변 + 명시적 |

### 실측 근거

- `AuditLog.entityType` 은 `String` 자유 필드다(enum 아님). **B 를 해도 스키마가
  품질을 강제해 주지 않는다.**
- 현행 `ai_action` 57건이 새 어휘에서 **12종 이상으로 분기**한다. B 의 백필은
  "이 레코드가 실제로 무엇이었나" 를 역추론해야 하는데, `AuditLog` 에는 **라우트
  경로 컬럼이 없다.** 역추론 근거 자체가 부족하다.
- C 는 A 의 상위집합이다(A + 명시 표시). A → C 승격은 가능하나 역은 어렵다.

### 권고 — **A안**, 다만 근거를 보강한다

호영님 선호와 결론은 같으나 이유가 하나 더 있다. A 를 고르는 이유는 "감사는 원본성이
값어치" 라는 원칙만이 아니라, **B 의 백필이 기술적으로 불가능에 가깝기 때문**이다
(역추론 근거 부족). 이 건에서는 원칙과 실현가능성이 같은 답을 가리킨다.

**반박 지점**: 매핑 테이블은 "당분간" 이 아니라 영구 유지 대상이 된다. 과거 레코드를
조회하는 소비처가 늘수록 매핑 적용 누락이 새 결함 클래스가 된다. 이를 감수할지,
C 로 시작해 명시적으로 다룰지는 승인 시 판단.

---

## 7. 승인 요청 항목

1. **데이터시트 문서**: `SDSDocument` 는 모델이 있으나 데이터시트는 없다.
   (a) `document` 상위 값으로 통합 / (b) 모델 신설 / (c) `concept` 분류.
2. **`invite`**: `OrganizationInvite` 와 `WorkspaceInvite` 두 모델 대응 — 분리 여부.
3. **`targetEntityId` 특수값과 lock 폴백**: `'none'`/`'new'`/`'bulk'` 채택 시
   `deriveConcurrencyKey` 폴백 규칙(§5-3).
4. **과거 레코드**: A안 확정 여부(§6).

## 8. Out of Scope

- 코드 변경·마이그레이션 (승인 후 별도)
- capability 열 채우기 (원칙 4)
- **쓰기 없는 라우트가 enforceAction 을 쓰는 것이 맞는가** — 클래스 ④ 15건 대부분이
  DB 쓰기 0 이다. lock 만 잡고 audit 은 남기지 않는다. §enforcement-coverage-gap 의 반대편 축.
- `action` 축 정리 (`order_create` 가 조회 라우트에, `sensitive_data_import` 가
  DELETE 에 붙은 사례 다수)
- **§audit-persistence-gap** (신규 등재) — §2. taxonomy 확정 **이후**.
