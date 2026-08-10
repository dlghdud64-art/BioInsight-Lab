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

## 0-0. 어휘 확정 (호영님 2026-08-10)

1. **어휘는 snake_case 소문자.** Prisma 모델명을 그대로 변환한다.
   `QuoteVendorRequest` → `quote_vendor_request`, `SDSDocument` → `sds_document`.
   현행 `AuditLog.entityType` 의 대문자 값(`QUOTE`/`ORDER`)은 승계하지 않는다(§6).

2. **`createAuditLog` 경로도 같은 enum 을 import 해야 ① 완료다.**
   지금 `AuditLog.entityType` 은 `String` 자유 필드이고 별도 어휘를 쓴다.
   두 경로가 같은 타입을 공유하지 않으면 어휘가 다시 갈라진다 — 그러면 ① 을
   한 번 더 하게 된다. **①의 완료 조건에 포함한다.**

   완료 판정:
   - `TargetEntityType` 이 단일 모듈에서 export 된다
   - `enforceAction` 과 `createAuditLog` 가 **둘 다** 그 타입을 import 한다
   - `AuditLog.entityType` 이 자유 문자열이 아니라 그 타입으로 좁혀진다
     (Prisma 컬럼은 String 유지 가능 — 타입 경계는 애플리케이션에서 강제)
   - sentinel: 두 호출부가 같은 심볼을 참조한다는 단언 + corrupt→RED

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
| `targetEntityType: 'ai_action'` | **58 (34%)** |
| `targetEntityId: 'unknown'` | **54 (32%)** |
| 특수 리터럴 id 전체(`unknown`/`new`/`bulk` 등) | **70 (41%)** |
| DB 쓰기가 0 인 핸들러 | **61 (36%)** |
| 파싱하지 못한 지점 | **0** (중괄호 매칭으로 재추출 — 이전 "13건 하한" 해소) |

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

## 4. 전수 분류표 — 169 호출 지점 (2026-08-10 실측)

중괄호 매칭 파서로 재추출해 **미파싱 0**. 이전 보고의 "13건 미파싱, 숫자는 하한" 은 해소됐다.

| 클래스 | 건수 | 비율 |
|---|---|---|
| 유지 | 71 | 42% |
| ① 오분류 | 12 | 7% |
| ③ 부재 | 44 | 26% |
| ④ 모델없음 | 42 | 25% |
| **계** | **169** | |

**id 축(클래스 ②)은 type 축과 병존한다** — 특수 리터럴을 쓰는 지점 **70건(41%)**.

kind 분포: `entity` 127 · `concept` 33 · `system` 9.
제안 `TargetEntityType` 29종, `TargetConceptType` 8종.

⚠️ **§4 의 이전 추정치는 전부 낮았다** (① 15+ ② 25+ ③ 20+ ④ 15+ → 실측 ① 12 ② 70 ③ 44 ④ 42).
특히 **② 가 70건**으로 가장 큰 축이다. `'unknown'` 폐기(원칙 3)가 이 설계의 핵심이라는 판단이 수치로 확인됐다.

### ① 오분류 — 12건

| route | M | 현행 type | 제안 kind/type | id | 쓰기 | ② |
|---|---|---|---|---|---|---|
| `ai-actions/generate/reorder-suggestions` | POST | `order` | entity / `inventory` | `'unknown'` | 1 | C2 |
| `inventory/auto-reorder` | POST | `order` | entity / `inventory` | `'unknown'` | 0 | C2 |
| `billing` | POST | `ai_action` | entity / `organization` | `'unknown'` | 6 | C2 |
| `purchases` | POST | `purchase_request` | entity / `purchase_record` | `'new'` | 1 | C2 |
| `purchases/import` | POST | `ai_action` | entity / `purchase_record` | `'unknown'` | 1 | C2 |
| `purchases/import/commit` | POST | `purchase_request` | entity / `purchase_record` | `'import-commit'` | 3 | C2 |
| `purchases/import/preview` | POST | `ai_action` | entity / `purchase_record` | `'unknown'` | 0 | C2 |
| `safety/spend/map` | POST | `ai_action` | entity / `purchase_record` | `purchaseId` | 1 |  |
| `request/[id]/approve` | POST | `approval` | entity / `purchase_request` | `requestId` | 4 |  |
| `request/[id]/reject` | POST | `approval` | entity / `purchase_request` | `requestId` | 1 |  |
| `ai-actions/generate/quote-rationale` | POST | `ai_action` | entity / `quote` | `"rationale-summary"` | 1 | C2 |
| `billing/portal` | POST | `ai_action` | entity / `workspace` | `workspaceId` | 0 |  |

### ③ 부재 — 44건

| route | M | 현행 type | 제안 kind/type | id | 쓰기 | ② |
|---|---|---|---|---|---|---|
| `activity-logs` | POST | `ai_action` | entity / `activity_log` | `'unknown'` | 1 | C2 |
| `ai-actions/[id]` | PATCH | `ai_action` | entity / `ai_action_item` | `params.id` | 1 |  |
| `ai-actions/[id]/approve` | POST | `ai_action` | entity / `ai_action_item` | `params.id` | 6 |  |
| `work-queue/assignment` | POST | `ai_action` | entity / `ai_action_item` | `itemId` | 0 |  |
| `work-queue/bottleneck-remediation` | POST | `ai_action` | entity / `ai_action_item` | `targetRemediationId` | 0 |  |
| `work-queue/cadence-governance` | POST | `ai_action` | entity / `ai_action_item` | `stepId` | 0 |  |
| `work-queue/compare-sync` | POST | `ai_action` | entity / `ai_action_item` | `'unknown'` | 0 | C2 |
| `work-queue/daily-review` | POST | `ai_action` | entity / `ai_action_item` | `itemId` | 0 |  |
| `work-queue/ops-execute` | POST | `ai_action` | entity / `ai_action_item` | `itemId` | 0 |  |
| `work-queue/ops-sync` | POST | `ai_action` | entity / `ai_action_item` | `'unknown'` | 0 | C2 |
| `category-budgets` | POST | `budget` | entity / `category_budget` | ``${parsed.data.categoryI..` | 1 |  |
| `category-budgets/[id]` | DELETE | `budget` | entity / `category_budget` | `budgetId` | 1 |  |
| `category-budgets/[id]` | PATCH | `budget` | entity / `category_budget` | `budgetId` | 1 |  |
| `compliance-links` | POST | `ai_action` | entity / `compliance_link` | `'unknown'` | 1 | C2 |
| `compliance-links/[id]` | PATCH | `ai_action` | entity / `compliance_link` | `id` | 1 |  |
| `purchases/import-file` | POST | `ai_action` | entity / `import_job` | `'unknown'` | 3 | C2 |
| `ingestion` | POST | `ai_action` | entity / `ingestion_entry` | `'unknown'` | 0 | C2 |
| `billing/payment-methods` | DELETE | `billing` | entity / `payment_method` | `paymentMethodId \|\| 'un..` | 1 |  |
| `billing/payment-methods` | POST | `billing` | entity / `payment_method` | `body.id \|\| 'unknown'` | 2 |  |
| `po-candidates` | DELETE | `ai_action` | entity / `po_candidate` | `id` | 0 |  |
| `po-candidates` | PATCH | `ai_action` | entity / `po_candidate` | `id` | 0 |  |
| `po-candidates` | POST | `ai_action` | entity / `po_candidate` | `'unknown'` | 0 | C2 |
| `work-queue/purchase-conversion/[quoteId]/request-approval` | POST | `approval` | entity / `po_candidate` | `quoteId` | 3 |  |
| `work-queue/purchase-conversion/bulk-po` | POST | `po` | entity / `po_candidate` | ``bulk-po:${session.user...` | 3 |  |
| `quote-items/[id]` | DELETE | `quote` | entity / `quote_item` | `id` | 1 |  |
| `quote-items/[id]` | PUT | `quote` | entity / `quote_item` | `id` | 1 |  |
| `templates` | POST | `product` | entity / `quote_template` | `'unknown'` | 0 | C2 |
| `templates/[id]` | DELETE | `product` | entity / `quote_template` | `id` | 0 |  |
| `recommendations/feedback` | POST | `ai_action` | entity / `recommendation_feedback` | `recommendationId` | 2 |  |
| `reviews/[id]` | DELETE | `ai_action` | entity / `review` | `id` | 0 |  |
| `sds/[id]/apply` | POST | `ai_action` | entity / `sds_document` | `'unknown'` | 2 | C2 |
| `sds/[id]/extract` | POST | `ai_action` | entity / `sds_document` | `'unknown'` | 6 | C2 |
| `sds/[id]/signed-url` | POST | `ai_action` | entity / `sds_document` | `'unknown'` | 0 | C2 |
| `shared-lists` | POST | `compare_session` | entity / `shared_list` | `'unknown'` | 1 | C2 |
| `shared-lists/[publicId]` | PATCH | `ai_action` | entity / `shared_list` | `'unknown'` | 1 | C2 |
| `shared-lists/bulk` | DELETE | `ai_action` | entity / `shared_list` | `'unknown'` | 1 | C2 |
| `spending-categories` | POST | `budget` | entity / `spending_category` | `"new-spending-category"` | 1 | C2 |
| `spending-categories/[id]` | DELETE | `budget` | entity / `spending_category` | `categoryId` | 3 |  |
| `spending-categories/[id]` | PATCH | `budget` | entity / `spending_category` | `categoryId` | 1 |  |
| `billing/checkout` | POST | `billing` | entity / `subscription` | `'checkout'` | 1 | C2 |
| `user/profile` | PATCH | `user" as never` | entity / `user` | `session.user.id` | 1 |  |
| `ai-actions/generate/vendor-email-draft` | POST | `product` | entity / `vendor` | `'unknown'` | 2 | C2 |
| `vendor/billing` | POST | `product` | entity / `vendor` | `'unknown'` | 2 | C2 |
| `vendor/premium` | POST | `product` | entity / `vendor` | `vendor.id` | 2 |  |

### ④ 모델없음 — 42건

| route | M | 현행 type | 제안 kind/type | id | 쓰기 | ② |
|---|---|---|---|---|---|---|
| `ai/budget-anomaly` | POST | `ai_action` | concept / `analytics_query` | `'unknown'` | 0 | C2 |
| `ai/impact-analysis` | POST | `ai_action` | concept / `analytics_query` | `'unknown'` | 0 | C2 |
| `ai/safety-check` | POST | `ai_action` | concept / `analytics_query` | `'unknown'` | 0 | C2 |
| `analytics/ai-insight` | POST | `ai_action` | concept / `analytics_query` | `?` | 0 |  |
| `analytics/recommendation-metrics` | POST | `ai_action` | concept / `analytics_query` | `'unknown'` | 1 | C2 |
| `analytics/search-history` | POST | `ai_action` | concept / `analytics_query` | `'unknown'` | 2 | C2 |
| `analytics/track` | POST | `ai_action` | concept / `analytics_query` | `'unknown'` | 1 | C2 |
| `analytics/user-behavior` | POST | `ai_action` | concept / `analytics_query` | `'unknown'` | 1 | C2 |
| `quotes/cost-optimization` | POST | `quote` | concept / `analytics_query` | `'unknown'` | 0 | C2 |
| `quotes/optimize-combination` | POST | `quote` | concept / `analytics_query` | `'unknown'` | 0 | C2 |
| `recommendations/optimized` | POST | `ai_action` | concept / `analytics_query` | `'unknown'` | 0 | C2 |
| `admin/canary-control` | POST | `ai_action` | concept / `canary_config` | `'unknown'` | 0 | C2 |
| `ai-ops/auto-verify` | POST | `ai_action` | concept / `canary_config` | `body.documentType \|\| '..` | 0 |  |
| `ai-ops/hold` | POST | `ai_action` | concept / `canary_config` | `body.documentType \|\| '..` | 0 |  |
| `ai-ops/kill-switch` | POST | `ai_action` | concept / `canary_config` | `body.documentType \|\| '..` | 0 |  |
| `ai-ops/promote` | POST | `ai_action` | concept / `canary_config` | `body.documentType \|\| '..` | 0 |  |
| `ai-ops/rollback` | POST | `ai_action` | concept / `canary_config` | `body.documentType \|\| '..` | 0 |  |
| `datasheet/extract` | POST | `ai_action` | concept / `datasheet_extraction` | `'unknown'` | 0 | C2 |
| `datasheet/extract-pdf` | POST | `ai_action` | concept / `datasheet_extraction` | `'unknown'` | 0 | C2 |
| `datasheet/extract-url` | POST | `ai_action` | concept / `datasheet_extraction` | `'unknown'` | 0 | C2 |
| `ai/bom-parse` | POST | `ai_action` | concept / `document_extraction` | `'unknown'` | 0 | C2 |
| `protocol/bom` | POST | `ai_action` | concept / `document_extraction` | `'unknown'` | 2 | C2 |
| `protocol/extract` | POST | `ai_action` | concept / `document_extraction` | `'unknown'` | 0 | C2 |
| `protocol/extract-pdf` | POST | `quote` | concept / `document_extraction` | `'unknown'` | 1 | C2 |
| `protocol/extract-pdf-text` | POST | `ai_action` | concept / `document_extraction` | `'unknown'` | 0 | C2 |
| `protocol/extract-text` | POST | `ai_action` | concept / `document_extraction` | `'unknown'` | 0 | C2 |
| `quotes/parse-image` | POST | `quote` | concept / `document_extraction` | `'unknown'` | 0 | C2 |
| `quotes/parse-pdf` | POST | `quote` | concept / `document_extraction` | `'unknown'` | 0 | C2 |
| `export/presets` | POST | `ai_action` | concept / `export_preset` | `'unknown'` | 0 | C2 |
| `search/intent` | POST | `ai_action` | concept / `search_intent` | `'unknown'` | 0 | C2 |
| `admin/seed` | POST | `ai_action` | system / `system` | `'unknown'` | 15 | C2 |
| `governance/approval-baseline` | DELETE | `governance` | system / `system` | `'approval-baseline'` | 0 | C2 |
| `governance/approval-baseline` | POST | `governance` | system / `system` | `'approval-baseline'` | 0 | C2 |
| `governance/event-dedupe` | DELETE | `governance` | system / `system` | `poNumber \|\| 'unknown'` | 0 |  |
| `governance/event-dedupe` | POST | `governance` | system / `system` | `key \|\| poNumber \|\| '..` | 0 |  |
| `governance/outbound-history` | DELETE | `governance` | system / `system` | `poId \|\| 'unknown'` | 0 |  |
| `governance/outbound-history` | POST | `governance` | system / `system` | `poId \|\| 'unknown'` | 0 |  |
| `governance/review-queue-draft` | DELETE | `governance` | system / `system` | `session.user.id \|\| 'un..` | 0 |  |
| `governance/review-queue-draft` | POST | `governance` | system / `system` | `session.user.id \|\| 'un..` | 0 |  |
| `quotes/generate-english` | POST | `quote` | concept / `translation` | `'unknown'` | 0 | C2 |
| `translate` | POST | `ai_action` | concept / `translation` | `'unknown'` | 0 | C2 |
| `dashboard/layout` | POST | `ai_action` | concept / `ui_layout` | `'unknown'` | 0 | C2 |

### 유지 — 71건

| route | M | 현행 type | 제안 kind/type | id | 쓰기 | ② |
|---|---|---|---|---|---|---|
| `budgets` | POST | `budget` | entity / `budget` | `'new'` | 2 | C2 |
| `budgets/[id]` | DELETE | `budget` | entity / `budget` | `id` | 1 |  |
| `budgets/[id]` | PATCH | `budget` | entity / `budget` | `id` | 1 |  |
| `cart` | DELETE | `cart` | entity / `cart` | `'unknown'` | 1 | C2 |
| `inventory` | POST | `inventory` | entity / `inventory` | `productId` | 3 |  |
| `inventory/[id]` | DELETE | `inventory` | entity / `inventory` | `params.id` | 1 |  |
| `inventory/[id]` | PATCH | `inventory` | entity / `inventory` | `params.id` | 2 |  |
| `inventory/[id]/inspection` | POST | `inventory` | entity / `inventory` | `params.id` | 2 |  |
| `inventory/[id]/restock` | POST | `inventory` | entity / `inventory` | `id` | 3 |  |
| `inventory/[id]/restock-request` | POST | `inventory` | entity / `inventory` | `inventoryId` | 1 |  |
| `inventory/[id]/use` | POST | `inventory` | entity / `inventory` | `id` | 2 |  |
| `inventory/alerts/send` | POST | `inventory` | entity / `inventory` | `inventoryId` | 2 |  |
| `inventory/bulk` | POST | `inventory` | entity / `inventory` | `'bulk'` | 1 | C2 |
| `inventory/dispatch-batch` | POST | `inventory` | entity / `inventory` | `"batch"` | 2 | C2 |
| `inventory/import` | POST | `inventory` | entity / `inventory` | `'unknown'` | 0 | C2 |
| `inventory/import/commit` | POST | `inventory` | entity / `inventory` | ``import_${Date.now()}`` | 4 |  |
| `inventory/import/preview` | POST | `inventory` | entity / `inventory` | `'unknown'` | 0 | C2 |
| `inventory/scan-label` | POST | `inventory` | entity / `inventory` | `crypto.randomUUID()` | 1 |  |
| `inventory/usage` | POST | `inventory` | entity / `inventory` | `inventoryId \|\| 'unknown'` | 2 |  |
| `admin/orders` | POST | `order` | entity / `order` | `'new'` | 4 | C2 |
| `admin/orders/[id]/status` | PATCH | `order` | entity / `order` | `orderId` | 1 |  |
| `ai-actions/generate/order-followup` | POST | `order` | entity / `order` | `orderId` | 2 |  |
| `order-queue/bulk` | POST | `order` | entity / `order` | `'bulk'` | 0 | C2 |
| `orders` | POST | `order` | entity / `order` | `?` | 4 |  |
| `organizations/[id]` | DELETE | `organization` | entity / `organization` | `id` | 2 |  |
| `organizations/[id]` | PATCH | `organization` | entity / `organization` | `id` | 0 |  |
| `organizations/[id]/billing-info` | PUT | `organization` | entity / `organization` | `id` | 1 |  |
| `organizations/[id]/invites` | DELETE | `organization` | entity / `organization` | `id` | 1 |  |
| `organizations/[id]/invites` | POST | `organization` | entity / `organization` | `id` | 1 |  |
| `organizations/[id]/members` | PATCH | `organization` | entity / `organization` | `memberId \|\| id` | 1 |  |
| `organizations/[id]/safety-settings` | PATCH | `organization` | entity / `organization` | `id` | 1 |  |
| `organizations/[id]/security` | PATCH | `organization` | entity / `organization` | `id` | 1 |  |
| `organizations/[id]/sso` | PUT | `organization` | entity / `organization` | `id` | 1 |  |
| `organizations/[id]/subscription` | POST | `organization` | entity / `organization` | `id` | 3 |  |
| `products/[id]/embedding` | POST | `product` | entity / `product` | `id` | 0 |  |
| `products/[id]/inspection` | POST | `product` | entity / `product` | `params.id` | 2 |  |
| `products/[id]/safety` | PATCH | `product` | entity / `product` | `id` | 1 |  |
| `products/[id]/safety-extract` | POST | `product` | entity / `product` | `id` | 2 |  |
| `products/[id]/sds` | POST | `product` | entity / `product` | `productId` | 1 |  |
| `products/[id]/specification` | PATCH | `product` | entity / `product` | `id` | 1 |  |
| `products/[id]/usage` | POST | `product` | entity / `product` | `id` | 0 |  |
| `products/[id]/view` | POST | `product` | entity / `product` | `id` | 0 |  |
| `products/compare` | POST | `product` | entity / `product` | `'unknown'` | 0 | C2 |
| `request` | POST | `purchase_request` | entity / `purchase_request` | `'new'` | 1 | C2 |
| `admin/quotes/[id]/items` | PATCH | `quote` | entity / `quote` | `quoteId` | 2 |  |
| `ai-actions/generate/quote-draft` | POST | `quote` | entity / `quote` | `'unknown'` | 2 | C2 |
| `quote-lists` | POST | `quote` | entity / `quote` | `'new'` | 1 | C2 |
| `quote-lists/[id]` | PUT | `quote` | entity / `quote` | `id` | 1 |  |
| `quote-lists/[id]/items` | PUT | `quote` | entity / `quote` | `id` | 3 |  |
| `quotes` | POST | `quote` | entity / `quote` | `'new'` | 1 | C2 |
| `quotes/[id]` | DELETE | `quote` | entity / `quote` | `id` | 1 |  |
| `quotes/[id]` | PATCH | `quote` | entity / `quote` | `id` | 3 |  |
| `quotes/[id]/responses/[responseId]` | PATCH | `quote` | entity / `quote` | `quoteId` | 2 |  |
| `quotes/[id]/rfq-token` | PATCH | `quote` | entity / `quote` | `quoteId` | 1 |  |
| `quotes/[id]/rfq-token` | POST | `quote` | entity / `quote` | `quoteId` | 1 |  |
| `quotes/[id]/select-item-vendor` | POST | `quote` | entity / `quote` | `quoteId` | 1 |  |
| `quotes/[id]/select-reply` | POST | `quote` | entity / `quote` | `quoteId` | 1 |  |
| `quotes/[id]/share` | DELETE | `quote` | entity / `quote` | `id` | 1 |  |
| `quotes/[id]/share` | POST | `quote` | entity / `quote` | `id` | 2 |  |
| `quotes/[id]/status` | PATCH | `quote` | entity / `quote` | `id` | 1 |  |
| `quotes/[id]/vendor-replies` | POST | `quote` | entity / `quote` | `quoteId` | 3 |  |
| `quotes/[id]/vendor-requests` | POST | `quote` | entity / `quote` | `id` | 2 |  |
| `quotes/[id]/versions` | POST | `quote` | entity / `quote` | `id` | 1 |  |
| `team` | POST | `team` | entity / `team` | `'new'` | 1 | C2 |
| `team/[id]/members` | DELETE | `team` | entity / `team` | `teamId` | 1 |  |
| `team/[id]/members` | PATCH | `team` | entity / `team` | `teamId` | 1 |  |
| `team/invite` | POST | `team` | entity / `team` | `teamId \|\| 'unknown'` | 1 |  |
| `workspaces/[id]` | DELETE | `workspace` | entity / `workspace` | `workspaceId` | 1 |  |
| `workspaces/[id]` | PATCH | `workspace` | entity / `workspace` | `workspaceId` | 1 |  |
| `workspaces/[id]/members/[memberId]` | DELETE | `workspace` | entity / `workspace` | `workspaceId` | 1 |  |
| `workspaces/[id]/members/[memberId]` | PATCH | `workspace` | entity / `workspace` | `workspaceId` | 1 |  |

## 4-1. 전수 분류에서 새로 드러난 사실 3건

### (가) `as never` 로 enum 을 우회한 지점이 있다 — 클래스 ③의 다른 얼굴

```ts
// src/app/api/user/profile/route.ts:94
action: "user_profile_update" as never,
targetEntityType: "user" as never,
```

enum 에 `user` 가 없자 **타입 캐스트로 우회**했다(주석: "enum cast (schema 정합 대기)").
클래스 ③ 이 "틀린 값을 넣는다" 로만 나타나는 게 아니라 **타입 안전성 자체를 무력화하는
형태**로도 나타난다는 뜻이다. `as never` 는 컴파일러에게 "이 값을 검사하지 말라" 는
지시이므로, 이 지점은 enum 을 바꿔도 **자동으로 따라오지 않는다** — 교정 시 개별 대상.

전수 확인: `as never`/`as any` 우회는 **이 1건뿐**이다.

### (나) `routePath` 표기 규약이 88 : 81 로 갈려 있다

`routePath` 는 `deriveConcurrencyKey` 의 구성요소다
(`${action}:${routePath}:${scope}`). 그런데 표기가 둘로 갈린다.

| 표기 | 건수 |
|---|---|
| `/api/...` 접두 포함 | **88** |
| `/...` 접두 없음 | **81** |

같은 라우트 안에서는 일관되므로 **현재 오작동은 없다.** 그러나 lock 키 네임스페이스가
두 갈래로 존재하는 상태이고, 규약이 없어 새 라우트가 어느 쪽이든 될 수 있다.
같은 라우트의 서로 다른 핸들러가 다른 표기를 쓰게 되면 그때는 실해가 된다.
→ **①의 교정 범위에 포함할지 승인 필요**(어휘와 별개 축이지만 같은 파일을 건드린다).

### (다) DB 쓰기가 0 인 핸들러가 61건(36%)

lock 만 잡고 audit 은 남기지 않는 지점이 전체의 1/3이다. 클래스 ④(42건)와 상당 부분
겹치지만 완전히 같지는 않다 — 엔티티 대상이면서 읽기 전용인 지점도 있다.
"쓰기 없는 라우트가 enforceAction 을 쓰는 것이 맞는가" 는 §8 에 남긴 별도 질문이며,
이 수치가 그 질문의 규모다.

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
