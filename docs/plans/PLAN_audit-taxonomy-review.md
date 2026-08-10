# §audit-foundation ① — enforceAction 분류 체계 설계 (구 §audit-taxonomy-review)

작성: 2026-08-10
상태: **설계안 (승인 대기)** — 코드 변경·마이그레이션 없음. 문서 + enum 초안만.
발원: §enforcement-handle-close-sweep 배치1~12

---

## §audit-foundation — 세 트랙이 아니라 한 트랙의 3단계 (호영님 2026-08-10)

**① 어휘 확정(이 문서) → ② 영속화(§audit-persistence-gap) → ③ 권한 연결(entityCapabilities)**

### ⚠️ ① 만 끝내면 라이브 효과는 **0** 이다

지금 taxonomy 는 어디에도 실제 영향을 주지 못한다.

- `entityCapabilities: []` 하드코딩 → 접근 판정 무영향
- `appendAuditEnvelope` in-memory only → audit 에도 남지 않음

**①은 그 자체로 가치가 아니라 ②의 선결 조건이다.** ① 완료를 성과로 읽으면 안 된다.
그럼에도 먼저 하는 이유는 하나뿐이다: **영속화가 시작되는 순간 어휘가 굳는다.**

### 순서를 바꾸면 각각 재작업이 발생한다

| 잘못된 순서 | 발생하는 재작업 |
|---|---|
| ② 먼저 (틀린 어휘로 영속화) | 그때부터 진짜 마이그레이션 비용이 생긴다. 지금은 과거 레코드가 사실상 0 이라 공짜인 것이 유료가 된다(§6) |
| ③ 먼저 (capability 매핑 선행) | 틀린 taxonomy 위에 매핑을 얹게 되고, 뒤집는 비용이 매핑 구현 이후에 훨씬 커진다. 또 오분류 다수가 그대로 **접근 규칙으로 활성화**된다 |
| ③ 먼저 (영속화 없이) | 판정 근거가 남지 않아 권한 사고를 사후 조사할 수단이 없다 |

### 착수 비용 판단 근거 — 규모

**enforceAction 호출 지점 169개.** `ai_action` 57(34%), `'unknown'` 54(32%),
미파싱 13(하한). 지금까지 보고해 온 "31건" 은 sweep 중 눈에 띈 후보였고
**실제는 5배 규모**다. 상세는 §1.

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

## 6. 과거 audit 레코드 — **실측 결과 문제 자체가 없다** (2026-08-10)

호영님 지시로 A안 확정 전에 DB 를 실측했다. **read-only SELECT 만 수행.**

### 실측

| 테이블 | 행 수 |
|---|---|
| `AuditLog` | **2** |
| `DataAuditLog` | 1 |
| `GovernanceAuditLog` | 0 |
| `MutationAuditEvent` | 0 |
| `IngestionAuditLog` | 0 |
| `CanonicalAuditEvent` | 0 |
| (참고) `ActivityLog` | 16 |

`AuditLog` 2행의 실제 값:

```
2026-07-31  entityType=QUOTE   eventType=DATA_EXPORTED       action=quote_pdf_generate
2026-08-01  entityType=ORDER   eventType=INGESTION_RECEIVED  action=receiving_draft_approved
```

### 판정 — A/B/C 선택 폐기

1. **enforceAction 경로의 과거 레코드는 0** — in-memory 라 애초에 없다(§2).
2. **`AuditLog` 의 과거 레코드는 2행** — 그리고 그 2행은 `QUOTE`/`ORDER` 라는
   **대문자 제3의 어휘**를 쓴다. enforceAction enum(`quote`/`order` 소문자)도 아니고
   §5-2 초안(snake_case)도 아니다. 즉 **어휘를 공유하지 않는다.**
3. 따라서 **옮길 레코드도, 매핑할 어휘도 사실상 없다.**

**결론: 과거 레코드 문제 자체가 존재하지 않는다. 매핑 테이블 불요.**
A/B/C 비교는 폐기하고, §audit-persistence-gap 착수 시점부터 **신규 어휘만 쓴다.**
2행은 마이그레이션 대상이 아니라 관측 사실로 문서에 남긴다(필요해지면 손으로 읽는다).

⚠️ 부수 관측: `AuditLog.entityType` 이 대문자 어휘라는 것은 **`createAuditLog` 경로가
또 하나의 독립 taxonomy 를 쓰고 있다**는 뜻이다. §audit-persistence-gap 에서
enforceAction envelope 를 영속화할 때 **두 경로를 같은 어휘로 통일할지**가
설계 항목으로 추가된다(지금 결정하지 않는다).

⚠️ 실측의 한계: 이 숫자는 **현재 연결된 DB 기준**이다. 다른 환경(스테이징 등)에
더 많은 행이 있을 가능성은 배제하지 못한다. 다만 어휘 불일치(대문자 제3어휘)는
환경과 무관한 사실이므로 결론은 바뀌지 않는다.

## 7. 승인 항목 — 결정 반영 (호영님 2026-08-10)

### a) 데이터시트 문서 — **판정 기준 = "무엇이 바뀌는가"**

모델이 없다는 사실만으로 concept 으로 보내지 않는다. 배치9 실측을 그대로 적용하면 갈린다.

| route | 배치9 실측 | 판정 |
|---|---|---|
| `datasheet/extract` `extract-pdf` `extract-url` | DB 쓰기 **0** (추출 결과를 반환만) → `fail()` | **concept** (`datasheet_extraction`) |
| `sds/[id]/apply` | `db.product.update` 실재 | **entity = `product`** — 바뀌는 것은 제품이다 |
| `sds/[id]/extract` | `db.sDSDocument.update`(status→queued) | **entity = `sds_document`** |
| `sds/[id]/signed-url` | 읽기 전용(서명 URL 발급) | **entity = `sds_document`** (대상 실재, 변경 없음은 action 축이 표현) |

→ `TargetConceptType` 에 `datasheet_extraction` 추가. 모델 신설 불요.

### b) `invite` — **분리 확정**

같은 단어가 두 모델을 가리키면 enum 에서 합치는 순간 taxonomy 가 거짓말을 시작한다.
원칙 1(모델명 1:1)이 이미 답을 준다.

```
invite  →  organization_invite | workspace_invite
```

### c) 특수값과 lock 폴백 — **셋 다 userId 폴백, 단 하나의 상수에서 파생**

`'none'`/`'new'`/`'bulk'` 모두 단일 대상이 없으므로 per-user double-submit 보호가
의미론적으로 맞다. 지금 `'unknown'` 이 하던 역할 그대로다.

**중요한 건 값이 아니라 구조다.** 특수값 목록과 폴백 대상 목록을 두 곳에 손으로
적으면 다음에 특수값이 추가될 때 폴백에서 빠지고, 그러면 `'bulk'` 같은 값이
**전역 공용 lock 키**가 된다 — 배치 초반에 `'unknown'` 을 두고 잘못 짚었던 그 사고가
이번엔 진짜로 일어난다.

```ts
/** 단일 진입점 — 여기서만 정의하고 폴백은 여기서 파생시킨다 */
export const TARGET_ID_SENTINELS = ['none', 'new', 'bulk'] as const;
export type TargetIdSentinel = (typeof TARGET_ID_SENTINELS)[number];

const isSentinel = (id: string): id is TargetIdSentinel =>
  (TARGET_ID_SENTINELS as readonly string[]).includes(id);

// deriveConcurrencyKey 안에서
const scope = isSentinel(targetEntityId) ? userId : targetEntityId;
```

**sentinel 로 잠근다**: 특수값 집합과 폴백 집합이 같다는 단언 + corrupt→RED 실증.
(구현 시점에 작성 — 이 문서는 설계까지)

### d) 과거 레코드 — **실측으로 종결**(§6). 결정 불요.

### 승인 후 남는 결정

- `TargetConceptType` 폐쇄 목록 최종안 (현재 7값: search_intent / translation /
  ui_layout / export_preset / analytics_query / canary_config / datasheet_extraction)

## 8. Out of Scope

- 코드 변경·마이그레이션 (승인 후 별도)
- capability 열 채우기 (원칙 4)
- **쓰기 없는 라우트가 enforceAction 을 쓰는 것이 맞는가** — 클래스 ④ 15건 대부분이
  DB 쓰기 0 이다. lock 만 잡고 audit 은 남기지 않는다. §enforcement-coverage-gap 의 반대편 축.
- `action` 축 정리 (`order_create` 가 조회 라우트에, `sensitive_data_import` 가
  DELETE 에 붙은 사례 다수)
- **§audit-persistence-gap** (신규 등재) — §2. taxonomy 확정 **이후**.
