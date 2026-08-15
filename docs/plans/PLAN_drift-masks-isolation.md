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

확인된 드리프트 경로 누계 **9**. ⚠️ §1.10 로 무효화

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

확인된 드리프트 경로 누계 **10**. ⚠️ §1.10 로 무효화

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

**확인된 드리프트 경로 누계 17.** ⚠️ **이 숫자는 API 라우트 기준이며 무효다 — §1.10 참조**

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

### 🆕 두 번째 사례 — 삼키는 위치만 옮긴 형태 (2026-08-15)

```ts
// quotes/[id]/status PATCH
createActivityLogServer({...}).catch(...)   // ← await 없음
logStateTransition({...}).catch(...)        // ← await 없음
```

라우트는 **감사 쓰기 성공 여부와 무관하게 200** 을 반환한다.
`cadence-governance` 와 **동일 형태**다 — 삼키는 위치가 **함수 내부 `catch`** 에서
**호출부 `.catch()`** 로 옮겼을 뿐이다.

| | 삼키는 위치 | 결과 |
|---|---|---|
| `cadence-governance` | `createActivityLog` 내부 `catch` | 200 + 감사 0 + 봉투 'logged' |
| `quotes/[id]/status` PATCH | 호출부 `.catch()` (미-await) | 200 + 감사 착지 **미확인** |

⚠️ 이번 D1 프로브에서 `quotes/[id]/status` 의 **row 변경은 확인**됐으나
**감사 로그가 실제로 착지했는지는 안 봤다.** 판정 규칙("전역 count 0 + 200")을
아직 적용하지 않은 상태다.

### 착지 지연 실측 (D1b P5, 2026-08-15)

조밀 샘플링(250ms)으로 미-await 두 호출의 착지 시각을 실측:

```
응답(200) 수신 = t0
t0 + 498ms   ActivityLog 3→4      ← createActivityLogServer
t0 + 945ms   ActivityLog 4→5      ← logStateTransition
→ 관측 최대 지연 945ms · 정온 하한 = ×2 = 1890ms
```

**8차 동형오류가 여기서 정확히 재현됐다.** D1 프로브의 사후 읽기는 t0+~500ms 창에 있었고
그래서 `3→4` 만 담겼다. `4→5` 는 창 밖에 떨어져 **다음 프로브(`safety/spend/export`)의
델타로 잡혔다** — 그 라우트에는 쓰기 경로가 아예 없는데도.

→ 정온 하한이 없으면 이 형태는 **반드시** 재발한다. 시간 대기가 아니라 하한이 근거인 이유다.

### ② 판정 비대칭 — 델타 ≥1 은 해소가 아니다

P5 파생 델타 = `ActivityLog:3→5` (2건 착지). 그러나:

| | 의미 |
|---|---|
| 델타 0 | 🔴 확진 → D4 이관 |
| 델타 ≥1 | **완전 손실만 배제. 해소 아님 — D4 잔류** |

200 위장의 실체는 "쓰기 **결과와 무관하게** 200" 이고, 그건 **실패 주입 없이는 안 보인다**.
델타가 2여도 라우트는 여전히 쓰기 실패 시 200 을 반환한다.
🛑 "P5 GREEN" 을 해소로 적지 않는다 — §2.5 를 렌더 확인에 붙였던 것과 같은 형태다.

### ✅ D4 실행 완료 — 실패 주입 확진 (2026-08-15)

§audit-integrity-200-mask 로 분리·확진했다. 요지:

- 실패 주입 2/2 → **200 반환**. ①(호출부 미-await)·②(정의부 삼킴) 둘 다 확진
- 감사 헬퍼 **6개 정의부가 전부** 실패를 삼킨다 → `await` 를 붙여도 결과 동일
- 델타 +1 이 소실을 가렸다: 정상 +2 vs 주입 +1 — **기준선을 알아야만 보인다**

### D4 배치 범위 확장

> **`await` 없는 감사 헬퍼 호출 전역 열거** 를 D4 에 포함한다.
> `.catch()` 만 붙은 미-await 호출은 **실패를 삼키면서 200 을 반환**하므로
> §1.9(200 위장)의 정의에 그대로 들어간다. 선언 갱신과는 **별개 배치**.

### 정정 — §1.8 의 enum 부재 범위

§1.8 에 "`ITEM_CLAIMED` 등 부재"로 적었는데 실측하니 **`CADENCE_*` 4값도 전부 부재**다.
읽기 경로(`in: [...]`)와 쓰기 경로(단일 값) 양쪽이 같은 enum 결손을 공유한다.

## 1.10 🛑 **모집단 정의 오류** — 누계를 말할 수 없다 (2026-08-15)

### 무엇이 틀렸나

이 카드의 경로 열거는 **API 라우트 기준**이었다. 그래서 **lib 계층이 통째로 빠졌다.**

D1 착수 시 사양서 §1 이 지시한 **독립 안전망(전역 앵커 count)** 으로 교차 확인하다가
카드에 없는 드리프트 2건이 나왔다:

| 지점 | 참조 | 성격 |
|---|---|---|
| `src/lib/ai/collaborative-filtering.ts` (41·61·180) | `purchaseRecord.select/orderBy: purchaseDate` | 부재 필드 |
| `src/lib/ai/purchase-pattern-analyzer.ts` (34·46) | 동일 | 부재 필드 |

**동형오류 7번째다** — #5(도출 정규식이 헬퍼 경유 쓰기를 못 봄)와 같은 형태이고,
이번에도 잡은 것은 **도출이 아니라 도출과 독립인 안전망**이다.

### 🛑 누계 숫자는 **공란으로 둔다**

> **"17 → 19" 로 적지 않는다.** 모집단 정의를 안 고치고 숫자만 옮기는 것은
> 이 세션 규모 정정 5회차와 같은 병이다(§measurement-layer-blindness §1.8).

**모집단 정의 수정:**

| | 이전 (틀림) | 수정 |
|---|---|---|
| 모집단 | `API 라우트` | **부재 필드를 참조하는 모든 코드 지점** — 라우트 · lib · 헬퍼 · 서비스 계층 |

**누계: (재도출 전 — 공란)**
전역 앵커 기준 **드리프트 전수 재도출을 별도 배치로 예약**한다.
지금 재도출하지 않는다 — 배치 확대다.

## 1.11 🛑 **카드 스키마 결함** — `경로 → 드리프트 1` 이 틀렸다 (2026-08-15)

경로별 드리프트를 **1종으로만 기록**한 것이 두 번 나왔다:

| 경로 | 카드 기록 | 실제 |
|---|---|---|
| `safety/spend/unmapped` | `productId` 부재 | `productId` **+ `purchaseDate`** |
| `safety/spend/export` | `purchaseDate` | `purchaseDate` **+ 관계 3(`product`·`vendor`·`organization`) 부재** |

**한 번은 우연, 두 번은 형태다.**

### 왜 배치가 매번 중간에 깨지는가

카드 스키마가 `경로 → 드리프트 1` 인데 실제는 `경로 → 드리프트 N` 이다.
그래서 **D1/D3 분류가 "첫 발견 드리프트" 에 따라 결정되고**, 나머지는 **착수 후에야 드러난다**.
`safety/spend/export` 는 D1(코드 전용)으로 분류됐지만 실제로는 D3(구조 판단)였다.

### 전수 재도출 배치에 반영할 것

> **경로 기준이 아니라 `(경로 × 드리프트)` 쌍 기준으로 재도출한다. 분류도 쌍 단위.**
> 한 경로가 **D1 과 D3 에 동시에 등재되는 것을 허용**하고,
> **완료 판정은 경로 단위**로 한다(모든 쌍이 닫혀야 그 경로가 닫힌다).

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
