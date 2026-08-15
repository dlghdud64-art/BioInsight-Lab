# §drift-pair-rederivation — (경로 × 드리프트) 전수 재도출

- **Status:** 1차 완료 (2026-08-15). 누계 공란 해제 — 이 배치 완료 시점 기준
- **작성 이유:** 카드 스키마가 `경로 → 드리프트 1` 이었다. D1 이 `quote-lists/[id]/items` 의
  드리프트 3개 중 1개만 고치고 "경로 해소" 를 기대했고, 필드명 정규식 도출은 **1/3만** 잡았다.
  D1c 를 그대로 열면 같은 형태의 3회차다 — `vendor`·`snapshot` 을 고쳤을 때
  4번째가 없다는 **근거가 없다**. Prisma 는 첫 인자에서 멈추므로 런타임은
  구조적으로 **한 번에 하나만** 보여준다.

---

## 0. 결론 — 규모

```
쌍 총계   55   (① 스키마 대조 45 + ③ raw SQL 10)
경로 총계 21   (라우트 15 + lib 6)
```

**경로 21개 중 13개가 드리프트를 2개 이상 가진다.** 카드 스키마 결함의 실증이다.

| 드리프트 수 | 경로 |
|---|---|
| 6 | `organizations/[id]/sso` |
| 5 | `safety/spend/map` · `safety/spend/summary` · `safety-spend` · `lib/ai/collaborative-filtering` |
| 4 | `ai-actions/[id]/approve` · `lib/ai-pipeline/processors/verification-processor` |
| 3 | `safety/spend/export` |
| 2 | `quote-lists/[id]/items` · `safety-spend/unmapped` · `safety/spend/unmapped` · `lib/ai-pipeline/processors/entity-linking-processor` · `lib/ai/purchase-pattern-analyzer` |
| 1 | 나머지 8경로 |

🛑 **완료 판정은 경로 단위**, 분류·등재는 **쌍 단위**. 한 경로가 D1·D3 동시 등재 가능.

## 1. 도출 3중 — 각 계측기의 자기검증 결과

> 도출기 자신에게도 **알려진 드리프트로 corrupt→RED** 를 걸었다.
> 두 계측기 모두 **1차 실행에서 알려진 건을 놓쳤고**, 고친 뒤에야 결과를 채택했다.

### ① 스키마 실필드 ↔ 코드 참조 대조 — **핵심**

정규식으로 찾을 이름을 미리 정하지 않는다. 스키마가 진리이고, 코드가 쓴 키가
스키마에 없으면 그 자체로 드러난다. (도출이 세 번 틀린 이유가 전부 "이름을 먼저 정하고 grep")

- 모집단: 스캔파일 2003 · Prisma 호출 1308 · 검사한 키 8753 · 모델 107
- 불투명 272 (스프레드·변수 인자·계산 키) — **0 으로 세지 않고 분모로 보고**
- 표현식 회수 21 (`.map()`/삼항 안의 객체 리터럴)

🔴 **1차 실행이 `quote-lists` 의 `vendor`·`snapshot` 둘 다 놓쳤다.**
`data:` 값이 객체 리터럴이 아니라 `items.map(...)` 표현식이면 파서가 통째로 건너뛰었다.
→ 표현식 안의 객체 리터럴 **회수** 를 넣은 뒤 알려진 7/7 HIT.

### ② 전 GET 라우트 스모크 — ①의 독립 안전망

- 모집단: GET 라우트 176 · 스윕 169 · **제외 7** (`cron/*` — 아카이브·퍼지 등 파괴적)
- 응답: 200×86 · 400×21 · 401×2 · 403×35 · 404×10 · 500×15
- ⚠️ **질의층 도달 101/169.** 68건은 403/400/404/401 로 **질의 전에 끝나** 드리프트를 노출하지 못했다.

⚠️ 응답 본문으로는 못 본다 — 라우트가 예외를 삼키고 `{"error":"Failed to ..."}` 만 준다.
**서버 로그**에서 Prisma 오류를 수집해야 한다.

### ③ raw SQL 문자열 내부 컬럼 스윕 — tsc 사각

- 모집단: SQL 리터럴 108 · 스키마 컬럼 722 · 테이블 107
- 결과: **컬럼미상 10쌍** (2경로) · 테이블미등재 122 · 혼합 133

🔴 **1차 실행이 알려진 `totalAmount`→`amount` 를 놓쳤다. 두 가지 이유가 겹쳤다:**
1. 전역 컬럼 합집합과 대조 → `Quote.totalAmount`·`Order.totalAmount` 가 삼켰다.
   → **문장이 지목한 테이블의 컬럼으로만** 판정하도록 수정
2. 호출부(`$queryRawUnsafe`)에서 앞으로 읽음 → **변수로 조립된 SQL 을 구조적으로 못 봄**
   (`safety/spend/summary` 는 `kpiQuery` 를 위에서 만들어 넘긴다)
   → 호출부가 아니라 **SQL 로 보이는 문자열 리터럴**을 모집단으로 교체

## 2. ①↔② 불일치 — **양방향으로 갈렸다** (일치시키지 않고 기록)

### ② 만 잡은 것 — ①의 확인된 사각: **enum 값**

`work-queue/{daily-review,cadence-governance,bottleneck-remediation}` 3경로가
② 에서 500 인데 ① 은 **0쌍**이다.

> ① 은 **필드명**을 대조한다. `ActivityType` 의 **enum 값**(`ITEM_*`·`CADENCE_*`) 부재는
> 필드 대조로 안 드러난다. → **① 의 구조적 사각이 실측으로 확인됐다.**

### ① 만 잡은 것 — ②의 커버리지 한계

`organizations/[id]/security` 는 ① 이 `allowedEmailDomains` 를 잡았으나
② 는 **403** 으로 질의층에 못 갔다. 68/169 가 이 상태다.

→ **두 도출은 서로를 대체하지 못한다.** 합집합이 최소치이고, 둘 다 아직 상한이 아니다.

## 3. 분류 — 쌍 단위

### (가) 코드 전용 — 이름만 어긋났고 대상 필드 실재 (18쌍)

| 참조 | 실제 | 경로 |
|---|---|---|
| `QuoteListItem.vendor` | `vendorName` | `quote-lists/[id]/items:91` |
| `QuoteListItem.snapshot` | `raw` | `quote-lists/[id]/items:98` |
| `QuoteListItem.productName` | `name` | `quotes/[id]/detail:56` · `verification-processor:187` |
| `QuoteListItem.sortOrder` | `position` | `ai-actions/[id]/approve:414` |
| `OrderItem.productName` | `name` | `verification-processor:203` |
| `Quote.vendorName` | `vendor` | `verification-processor:185` |
| `Order.vendorName` | `vendor` 관계 경유 | `entity-linking-processor:200,212` · `verification-processor:201` |
| `PurchaseRecord.purchaseDate` | `purchasedAt` | `safety-spend/unmapped:60` · `safety/spend/unmapped:74` |
| `PurchaseRecord.quantity` | `qty` | `collaborative-filtering:39,59` |
| `PurchaseRecord.totalAmount` | `amount` | `collaborative-filtering:40,60` |
| `PurchaseRecord.vendor` (include) | `vendorName` 스칼라 | `safety-spend/unmapped:52` · `safety/spend/export:94` · `safety/spend/unmapped:66` |
| `SearchHistory.searchQuery` | `query` | `lib/api/search-history:60` |
| `WorkspaceMember.userId_workspaceId` | **`workspaceId_userId`** | `work-queue/purchase-conversion/[quoteId]/request-approval:292` |

🆕 `userId_workspaceId` 는 **복합 unique 의 선언 순서가 뒤집힌** 형태다.
스키마가 `@@unique([workspaceId, userId])` 라 Prisma 가 만드는 키는 `workspaceId_userId` 다.
오탐처럼 보이지만 진짜 드리프트이고, **이 하위형태는 이번에 처음 나왔다**.

### (나) 마이그레이션 / 설계 판단 — 대응 필드 없음

`Organization.allowedEmailDomains` + SSO 6종 · `PurchaseRecord.{productId,product,organization,hazardSnapshot,matchType,importedBy}` ·
`Product.{normalizedCategoryId,organizationId}` · `SearchHistory.metadata` ·
`InventoryRestock.{orderedBy,reason,status}` · `SDSDocument.extractionJobId` ·
`RecommendationFeedback.user` 관계

⚠️ `Product.organizationId` 는 **전역 카탈로그 축**과 맞물린다(§global-catalog-write-authz).
필드 추가 = 카탈로그를 조직 소유로 바꾸는 설계 결정이다. 드리프트 수정으로 처리하면 안 된다.

### (다) raw SQL 컬럼 (10쌍 / 2경로)

`safety/spend/summary` · `safety-spend` — `totalAmount` · `hazardSnapshot` · `productId` · `purchaseDate` · `vendorId`

### (라) 다른 축 — 스키마 미등재 테이블

`ShadowComparisonLog`(80) · `CanaryHaltLog`(19) · `ProcessingLog`(4) · `ExclusionPattern`(2)

② 에서 `42P01 relation "ShadowComparisonLog" does not exist` 로 확인. 필드 어긋남이 아니라
**테이블 자체가 스키마·DB 에 없다.** `admin/{canary-control,rollout-gate,shadow-report,shadow-sampling}` 4화면이 죽어 있다.
드리프트 트랙이 아니라 **ai-pipeline 축**으로 별도 등재한다.
(`_prisma_migrations` 는 Prisma 자체 테이블 — 오탐, 제외)

## 4. 배치 재편성 — D1c 흡수

| 배치 | 범위 | 선결 |
|---|---|---|
| **D1c** | (가) 코드 전용 18쌍 / 13경로 — `vendor`·`snapshot` 포함 | 없음. 즉시 |
| **D2** | `safety/sds/bulk` ×2 원인 판정 | 서버 로그 |
| **D3** | (나) 마이그레이션 — "필드 추가 vs 참조 제거" 설계 판단 | **호영님 회신 먼저** |
| **D4** | `await` 없는 감사 헬퍼 전역 열거 + cadence 성공 위장 | 없음 |
| **별건** | (라) ai-pipeline 미등재 테이블 4 | 축 판정 |

## 5. 이 배치가 닫지 않는 것

- **enum 값 드리프트** — ① 이 구조적으로 못 본다. ② 로만 3경로 확인. 전수 미도출
- **② 미도달 68/169** — 403/400/404 로 질의층 전에 끝난 GET
- **비-GET 라우트 전체** — 스윕 안 함
- **불투명 272** — 스프레드·변수 인자·계산 키
- **`cron/*` 7경로** — 파괴적이라 제외

→ 55쌍은 **최소치이지 상한이 아니다.**

### 누계 표기 — 숫자만 채우지 않는다

> `55쌍 / 21경로 (분모 = ①스키마대조 도달분 + ③raw + ②GET 스윕 도달분.
> enum·비-GET·미도달 68 제외)`

누계 공란을 숫자로만 해제하면 정정 7회차다. **분모를 함께 적지 않으면 적지 않는다.**
(D1c 이후 실측: ① 47 → 29. enum 채택분 12쌍 별도 축.)

## 7. 🔴 ① 의 신뢰도 — **② 와 대조된 범위 안에서만** (2026-08-15 승격)

① 은 이제 **세 번 다 1차 실행에서 놓쳤고, 세 원인이 전부 다르다**:

| 회차 | 놓친 것 | 원인 | 잡은 것 |
|---|---|---|---|
| 1 | `vendor`·`snapshot` | `data:` 값이 `.map()` 표현식 | 알려진 건 corrupt→RED |
| 2 | `totalAmount` (③) | 전역 합집합 삼킴 + 변수 조립 SQL | 알려진 건 corrupt→RED |
| 3 | `count({ where })` 축약 | 축약/변수 인자를 불투명으로도 안 셈 | **② 의 런타임 증거** |

🛑 **3차가 결정적이다.** 알려진 건 corrupt→RED 를 걸었는데도 **통과했다** —
그 형태를 내가 몰랐기 때문이다.

> **corrupt 검증은 내가 아는 형태만 덮는다.**
> 도출기 검증 기준 = **알려진 건 HIT + 독립 도출과 양방향 대조**.
> corrupt→RED 단독으로 도출기를 채택하지 않는다.

네 번째가 없다는 근거는 없다. **① 의 신뢰도는 "② 와 대조된 범위 안에서만" 이다.**

## 8. 🔴 D1c 8경로 치환분 — **정적 확인만, 런타임 미검증**

```
8경로 치환분 — 정적 확인만. 런타임 미검증.
경로 500 유지(잔여 (나) 드리프트) → D3 완료 시 재프로브 필수.
D3 가 이 8경로를 살릴 때 치환분이 함께 검증되지 않으면 D3 도 미완.
```

대상 8경로: `safety/spend/{map,export,unmapped}` · `safety-spend/unmapped` ·
`lib/ai/collaborative-filtering` · `lib/ai/purchase-pattern-analyzer` ·
`lib/ai-pipeline/entity-linking-processor` · `ai-actions/[id]/approve`

§1.65 경계다 — **정적 판독은 발견이고 판정이 아니다.** UNCLASSIFIED 로 두지 않은 것은
프로브 대상이 아니었기 때문이지 검증됐기 때문이 아니다.

> **D3 완료 조건에 이 재프로브를 포함한다.** 넣지 않으면 D3 가 GREEN 을 찍는 순간
> 검증 없는 치환분이 조용히 통과한다.

## 9. enum 전수 스윕 (2026-08-15) — 부분 채택

모집단을 **코드 참조값**에서 출발시켰다(스키마 enum 을 먼저 읽고 grep 하지 않았다).

| 수집기 | 형태 | 알려진 건 |
|---|---|---|
| (A) `Enum.MEMBER` 멤버 참조 (333) | — | **0 HIT** |
| (B) `key: "VALUE"` (1277) | — | **0 HIT** |
| (C) enum 필드 **값 표현식 전체** + 식별자 회수 (960) | ✅ 맞음 | **12 HIT** |

(A)(B) 가 0 이었던 이유: 실제 형태가
`activityType: { in: [...ASSIGNMENT_ACTIVITY_TYPES] }` 이고 값들은 **다른 위치의 const 배열**에 있다.
→ 자기검증 게이트가 (A)(B) 단독 채택을 **막았다**. 게이트가 설계대로 작동했다.

### ✅ 채택 — 양방향 대조 통과분 (12쌍 / 1파일)

```
lib/work-queue/work-queue-service.ts  (ActivityType)
  ITEM_CLAIMED ITEM_ASSIGNED ITEM_REASSIGNED ITEM_STARTED ITEM_BLOCKED
  ITEM_HANDED_OFF ITEM_ESCALATED ITEM_REVIEW_COMPLETED
  CADENCE_START_OF_DAY CADENCE_MIDDAY_CHECK CADENCE_END_OF_DAY CADENCE_WEEKLY_REVIEW
```

② 런타임 증거와 **양방향 일치**: 3라우트가 500 이고 스택이 전부 이 서비스로 수렴한다
(`Invalid value for argument `in`. Expected ActivityType.`).

📌 **카드 정정**: 구 카드는 이 드리프트를 `work-queue/{daily-review,cadence-governance,bottleneck-remediation}`
**3라우트**에 적었다. 실제 위치는 **공유 서비스 lib 1파일**이고, 3라우트는 그 소비자다.

### ❌ 미채택 — (C) 나머지 322쌍

(C) 는 **모델 문맥 없이 필드명만으로** 매칭한다(`type`·`status`·`result` 등이 여러 모델·여러 enum 에 걸린다).
정밀도 미검증이라 **건수를 발견으로 보고하지 않는다.**
재작업 조건: ① 의 검증된 파서로 **Prisma 호출 × 모델 스코프**를 붙인 뒤 재측정.

## 6. 관계

- §drift-masks-isolation — 형태 분류. 이번에 **복합키 순서 역전** 하위형태 추가
- §drift-track-scoping — D1/D1b 실측. 이 재도출이 그 카드의 모집단을 대체
- §measurement-layer-blindness — 계측기 자기검증 규칙
- §global-catalog-write-authz — `Product.organizationId` 가 여기로 물린다
