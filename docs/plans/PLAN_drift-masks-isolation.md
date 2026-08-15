# §drift-masks-isolation — 상시 500 은 안전이 아니라 **판정 유예**

- **Status:** 규칙 등재 (2026-08-14) · **클래스** (카드 1건이 아니다)
- **승격 경위:** §tenant-isolation-placeholder A트랙 실측 중 같은 형태가 4건 나왔다.
  1건이면 카드지만 4건이면 규칙이다.

---

## 0. 규칙

> **스키마에 없는 필드를 참조해 상시 500 인 경로는 "막혀 있는" 것이 아니라
> 격리 판정이 **유예된** 상태다. 드리프트 수정은 해당 경로의 **격리 검증 완료 후에만**
> 착수한다.**

순서를 뒤집으면 결함 하나를 고쳐서 **유출을 여는 것**이 된다.
실제로 `PATCH /api/quotes/[id]/status` 는 조직 게이트를 **통과한 뒤** Prisma 오류로만
멈춰 있었다(로그 `org_gate_result: true` 확인). 500 이 유일한 정지선이었다.

## 1. 확인된 4건 (2026-08-14)

| 참조 필드 | 실제 스키마 | 영향 경로 | 격리 상태 |
|---|---|---|---|
| `Quote.listItems` | `items` / `quoteItems` | `quotes/[id]/status` PATCH · `admin/quotes/[id]/items` PATCH · `admin/quotes/[id]` GET | 검사 0 (§tenant §8.1 #2·#3·#4) |
| `PurchaseRecord.purchaseDate` | `purchasedAt` | `safety/spend` GET | 검사 0 → **삭제됨**(호출부 0) |
| `PurchaseRecord.organizationId` | 필드 자체 부재(`scopeKey` 사용) | `products/safety` GET | 검사 0 → **삭제됨**(호출부 0) |
| `Organization.allowedEmailDomains` | 필드 자체 부재 | `organizations/[id]/security` GET | 검사 0 · **호출부 4** → A3 |

## 1.5 추가 3건 (2026-08-14, A4 단언 발견분)

work-queue 계열 3경로가 상시 500 이다. 스코프는 §tenant-isolation A3 에서 먼저 넣었고
(클라 `organizationId` 제거 → 세션 멤버십 도출), **드리프트는 손대지 않았다**.

| 경로 | 상태 |
|---|---|
| `GET /api/work-queue/daily-review` | 500 — 스코프 교정 완료, 드리프트 미수정 |
| `GET /api/work-queue/cadence-governance` | 500 — 동일 |
| `GET /api/work-queue/bottleneck-remediation` | 500 — 동일 |

⚠️ 이 3건은 500 때문에 **교차조직 유출이 실증되지 않았다**. "안전"이 아니라
**판정 유예**다. 드리프트 해소 시 §2.5 와 같은 조건(교차 차단 **AND** 동일조직 착지)으로 잰다.

## 1.6 추가 2건 (2026-08-14, 4-3 1단계 발견분)

| 경로 | 상태 |
|---|---|
| `POST /api/safety/sds/bulk` | 500 — 교차·대조 양쪽. 격리 판정 유예 |
| `POST /api/safety/sds/bulk/commit` | 500 — 동일 |

확인된 드리프트 경로 누계 **9**. 4-3 2단계에서 추가 발견을 예상하고 계속 편입한다.

### 편입하지 않은 건 — 기록 (오분류 정정)

| 경로 | 1차 라벨 | 실제 | 처리 |
|---|---|---|---|
| `POST /api/purchases/import-file` | 드리프트 500 | **요청 형식 미충족**(multipart 필요) | **편입 안 함** |

> **드리프트 목록이 부풀면 그 트랙의 우선순위 판단이 틀어진다.**
> 500 이라는 이유만으로 편입하지 않는다 — 스키마 부재 필드 참조인지 확인한 것만 넣는다.
> 빼는 것도 기록으로 남긴다.

## 1.7 추가 1건 (2026-08-14, 4-3 1차 잔여 발견분)

| 참조 필드 | 실제 스키마 | 영향 경로 | 격리 상태 |
|---|---|---|---|
| `QuoteListItem.quoteListId` | `quoteId` | `PUT /api/quote-lists/[id]/items` | guestKey 축 검사는 있음(교차 404). **대조군이 500 이라 판정 불가** |

확인된 드리프트 경로 누계 **10**.

⚠️ 이 건은 §2.5 와 같은 형태다 — 교차는 막히는 것을 봤으나 **정상 경로가 착지하는지**를
드리프트가 가려서 못 봤다. 해소 조건에 **대조군 착지 확인**을 포함한다.

## 1.8 추가 7건 + **하위 형태 2종 신규** (2026-08-14, 읽기 스윕 판정)

읽기 스윕의 판정 불가 500 을 **서버 로그로 전건 판정**했다(응답은 sanitize 되어 단서 0).

| 경로 | 원인 | 형태 |
|---|---|---|
| `safety/spend/export` | `PurchaseRecord.purchaseDate` (→ `purchasedAt`) | 필드 부재 |
| `safety/spend/unmapped` · `safety-spend/unmapped` | `PurchaseRecord.productId` 부재 | 필드 부재 |
| `organizations/[id]/sso` | `Organization.ssoEnabled` 부재 | 필드 부재 |
| `quotes/[id]/detail` | `QuoteListItem.productName` 부재 | 필드 부재 |
| `safety/spend/summary` · `safety-spend` | raw SQL `column "totalAmount" does not exist` (42703) | **raw SQL 컬럼 부재** 🆕 |
| `work-queue/{daily-review,cadence-governance,bottleneck-remediation}` | `ActivityType` enum 에 `ITEM_CLAIMED` 등 부재 | **enum 값 부재** 🆕 |

### 하위 형태 2종 — 클래스 정의 확장

이 클래스는 "스키마에 없는 **필드** 참조"로 정의했는데, 같은 결과를 내는 형태가 둘 더 있다:

1. **raw SQL 컬럼 부재** — `$queryRawUnsafe` 안의 컬럼명이 스키마와 어긋남.
   Prisma 타입 검사를 **통과**하므로 정적으로 더 안 보인다. §raw-sql-audit(동결)과 만나는 지점
2. **enum 값 부재** — 코드가 쓰는 enum 리터럴이 스키마 enum 에 없음.
   `ActivityType` 에 `ITEM_CLAIMED`·`CADENCE_*` 등이 없다 → work-queue 콘솔 3화면이 죽어 있다

**확인된 드리프트 경로 누계 17.**

## 1.9 🆕 하위 형태 3번째 — **드리프트가 500 이 아니라 200 으로 위장된다**

지금까지 이 클래스는 "상시 500 = 판정 유예"였다. 그런데 **500 조차 안 나는 형태**가 있다.

```
POST /api/work-queue/cadence-governance  (stepId=start_of_day_review)
→ 200 {"success":true}   ·  전역 count 변경 **0**
```

서버 로그:
```
[ActivityLog] 기록 실패 (메인 로직 계속 진행): PrismaClientValidationError
  Argument `entityType` is missing.   (+ ActivityType 에 CADENCE_START_OF_DAY 부재)
  at logCadenceStepCompletion → POST /api/work-queue/cadence-governance
```

**두 겹**이다:
1. **드리프트** — `entityType` 필수 누락 + `ActivityType` enum 에 `CADENCE_*` 4값 **전부 부재**
2. **§placeholder-success** — `createActivityLog` 의 `catch` 가
   *"로그 실패가 메인 로직을 막아선 안 됨"* 으로 삼키고,
   라우트는 `enforcement.complete({ afterState: { status: 'logged' } })` 후 `{success:true}` 반환

→ **감사 기록이 0인데 감사 봉투는 'logged' 라고 적힌다.**

> **규칙 보강: 드리프트를 500 으로만 찾지 않는다.**
> 삼켜진 예외는 200 뒤에 숨는다. **전역 count 0 + 200** 조합을 드리프트 후보로 본다.
> (이번에도 잡은 것은 §measurement-layer-blindness 의 독립 안전망이다)

### 정정 — §1.8 의 enum 부재 범위

§1.8 에 "`ITEM_CLAIMED` 등 부재"로 적었는데 실측하니 **`CADENCE_*` 4값도 전부 부재**다.
읽기 경로(`in: [...]`)와 쓰기 경로(단일 값) 양쪽이 같은 enum 결손을 공유한다.

## 2. 부수 사실 — 죽은 줄 몰랐던 기능이 있다

`organizations/[id]/security` GET 은 **호출부 4곳**(`settings/security`, `settings/workspace`)
을 가진 **살아있는 화면의 API** 인데 상시 500 이다. 즉 **보안 설정 화면이 운영에서
동작하지 않는다.** 드리프트가 유출만 가린 게 아니라 **기능 부재도 가리고 있었다.**

## 3. 착수 순서 (고정)

1. 해당 경로의 **격리 검증**(조직 스코프 추가 + 교차조직 실측 403/body 0)
2. 그 다음 드리프트 수정
3. 역전 금지 — 역전 시 유출 개방

## 4. 확장

§tenant-isolation-placeholder A5 런타임 스윕에서 **추가 발견을 예상하고 카운트**한다.
스윕 4분류 중 "드리프트 500" 은 **차단이 아니라 판정 불가**로 집계하고 이 문서에 편입한다.

## 5. 관계

- §tenant-isolation-placeholder — 이 규칙의 발원지. A3 순서 고정의 근거
- §quote-listitems-include-drift — 이 클래스의 **첫 카드**. 개별 카드는 유지하되 규칙은 여기
- §measurement-layer-blindness — 같은 세션이 남긴 다른 규칙. 저쪽은 층, 이쪽은 상태
