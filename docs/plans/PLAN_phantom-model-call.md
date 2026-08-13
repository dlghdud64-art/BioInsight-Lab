# §phantom-model-call — 존재하지 않는 Prisma 모델을 호출하는 지점

작성: 2026-08-10
상태: 전수 실측 완료 / sentinel ratchet **6→4** / 이름 교정 2종 완료, 1종 보류
발원: §audit-foundation ① 검증 ①이 `ComplianceLink` 를 잡은 뒤 호영님 지시로 전수

---

## 0-0. 원칙 (호영님 2026-08-10, `purchase` 판단에서 확립)

> **억지로 맞추면 "동작하지만 틀린 대상을 조회하는" 코드가 되어 유령보다 나쁘다 —
> 유령은 최소한 실패로 드러난다.**

유령 호출을 고칠 때 모델명이 불확실하면 **고치지 말고 남긴다.** 미해결이 ratchet 목록에
보이는 상태가, 조용히 틀린 대상을 조회하는 상태보다 정직하다.

## 0. 왜 이 클래스가 숨는가

`src/lib/db.ts` 의 `db` 는 **`any`** 로 선언돼 있다(Prisma 미생성 시 stub 폴백 구조).

```ts
let db: any;
```

따라서 `db.존재하지않는모델.findMany()` 가 **컴파일을 통과하고 런타임에만 실패**한다.
tsc·build·vitest 어느 것도 잡지 못한다. 화면은 배포되고, 그 화면만 500 이 난다.

**`ComplianceLink` 가 1건인지 알 수 없다** 는 호영님 지적이 맞았다 — 전수 결과 6종이었다.

## 1. 실측 결과 (2026-08-10)

스캔: `src/**/*.{ts,tsx}` 2004 파일 / 생성된 Prisma Client 모델 105종.

**유령 모델 6종 · 호출 20회 · 10파일.**

| 유령 모델명 | 호출 | 실제 모델 | 호출 지점 |
|---|---|---|---|
| `complianceLink` | 7 | **없음** | `api/compliance-links/route.ts`(create, findMany)<br>`api/compliance-links/[id]/route.ts`(findUnique, update, delete) |
| ~~`quoteList`~~ **교정완료** | 7 | `Quote` | `api/quote-lists/route.ts`(create)<br>`api/quote-lists/[id]/route.ts`(findFirst, update)<br>`api/quote-lists/[id]/items/route.ts`(findFirst, update)<br>`api/quote-lists/[id]/export/route.ts`(findFirst) |
| `inventoryAlertSetting` | 2 | **없음** | `api/inventory/alerts/send/route.ts`(findUnique, update) |
| `purchase` | 2 | **미상**(PurchaseRecord 아님 — §3-3) | `lib/ai-pipeline/processors/entity-linking-processor.ts`<br>`lib/ai-pipeline/processors/verification-processor.ts` |
| ~~`inventory`~~ **교정완료** | 1 | `ProductInventory` | `api/inventory/scan-label/route.ts`(findFirst) |
| `inventoryAlertLog` | 1 | **없음** | `api/inventory/alerts/send/route.ts`(create) |

### 두 부류로 갈린다

**(가) 이름만 틀린 것 — 모델은 있다 (3종 10회)**
`inventory`→`productInventory`, `purchase`→`purchaseRecord`, `quoteList`→`quote`(확인 필요).
교정은 이름 치환 수준이나 **필드가 대응하는지 확인이 필요**하다(예: `quoteList.create` 의
data 형태가 `Quote` 스키마와 맞는가).

**(나) 모델 자체가 없다 (3종 10회)**
`complianceLink`, `inventoryAlertSetting`, `inventoryAlertLog`.
스키마 설계 + 마이그레이션이 필요하다 → 승인 사항.

⚠️ **재고 알림 2종이 (나)에 있다.** `inventory/alerts/send` 는 재고 부족 이메일 발송
라우트이며, 알림 설정 조회·발송 이력 기록이 **전부 유령**이다. 즉 이 라우트는
어떤 경로로 호출되든 실패한다.

## 2. 도달성 실측

| 라우트 | UI 호출자 |
|---|---|
| `api/quote-lists*` | **있다** — `_workbench/_components/quote-panel.tsx`(3곳), `components/quote-list/export-button.tsx` |
| `api/compliance-links*` | **있다** — `app/products/[id]/page.tsx:138`, `app/settings/compliance-links/page.tsx`(CRUD 전부) |
| `api/inventory/alerts/send` | **없다** (앱 코드 호출자 0) |
| `api/inventory/scan-label` | 있다(라벨 스캔). 단 유령 호출은 `matchedProduct && merged.lotNo` 분기 안 — **조건부 경로** |
| `lib/ai-pipeline/processors/*` | 파이프라인 내부 |

**quote-lists 는 워크벤치 견적 패널의 저장/조회/항목/내보내기 경로다.**
`ComplianceLink` 보다 영향이 크다.

## 3. 타입 검사 무력화 탈출구 (계수만, 교정 금지)

| 패턴 | 횟수 | 파일 |
|---|---|---|
| `$queryRawUnsafe` | **90** | 32 |
| `$executeRawUnsafe` | **46** | 7 |
| `db as any` | 4 | 2 |
| `dbAny` | 3 | 1 |
| `(prisma as any)` | 0 | 0 |

raw SQL 136회는 **모델명 검사 자체가 적용되지 않는 표면**이다. 이 트랙의 sentinel 은
raw SQL 안의 테이블명을 보지 않는다(§5 한계).

### 부수 관측 — 인코딩 이탈 3파일 (→ sentinel 공통 규칙 승격)

전수 스캔 중 UTF-8 이 아닌 소스가 나왔다.
`components/ui/data-table.tsx`(**UTF-16**), `_components/demo-flow-switcher.tsx`(UTF-8 BOM),
`_components/home/demo-flow-switcher.tsx`(UTF-8 BOM).
도구가 파일을 읽지 못해 **스캔에서 조용히 빠질 수 있다**(이번 스캐너는 대응했다).
**sentinel 공통 규칙으로 승격했다**(호영님 2026-08-10):
> 소스 스캔 sentinel 은 **읽기 실패한 파일을 skip 하지 않고 실패시킨다.**
> 파일 수 단언(공허 GREEN 방지)과 **다른 축**이다 — 파일 수는 맞는데 내용이 안 읽힌
> 경우를 파일 수로는 잡을 수 없다. stripComments · 앵커 유일성 · corrupt→RED 와 같은 층.

이 트랙의 sentinel 에 `§source-encoding-drift` ratchet 을 함께 넣었다(3파일 고정, 신규 0).
corrupt→RED: `src/lib/utils.ts` 에 BOM 주입 → RED.

**mojibake 3파일과 한 문서로 합친다** — 같은 클래스(소스 인코딩 오염)이고 따로
관리할 이유가 없다. 지금 고치지 않는다.

## 3-1. 실측 — `quote-lists` 판정: **오기**(설계 잔재 아님)

호영님 판정 기준 2개를 모두 봤다.

### 기준 1 — `quoteList.create` 의 data ↔ `Quote` 스키마

| create data | `Quote` 필드 | 대응 |
|---|---|---|
| `guestKey` | `guestKey` | ✓ |
| `title` | `title` (주석: "리스트 제목") | ✓ |
| `message` | `description` (주석: "리스트 설명/비고") | **이름 불일치** |
| `totalAmount` | `totalAmount` | ✓ |
| `items: { create: [...] }` | `items QuoteListItem[]` | ✓ **관계명까지 동일** |

item 하위: `productId` `name` `brand` `catalogNumber` `unitPrice` `quantity`
`lineTotal` `notes` → `QuoteListItem` 에 전부 대응.
**불일치 2건**: `vendor`(QuoteListItem 에 없음 — `Quote.vendor` 는 있다),
`snapshot`(실제 컬럼명은 `raw`).

### 기준 2 — UI 가 기대하는 응답 형태 (**결정적**)

`_workbench/_components/quote-panel.tsx` 는 이 API 를 **`quoteId`** 라는 변수로 부른다.

```ts
const response = await fetch(`/api/quote-lists/${quoteId}`, ...)
// queryKey: ["quote-list", quoteId]
```

즉 **UI 자신이 이것을 Quote 로 취급**한다. "사용자가 저장한 별개의 견적 묶음" 이 아니라
Quote 를 부르는 옛 이름이다.

### `/items` 라우트가 따로 있는 이유 — 방향 힌트와 반대 결론

호영님 힌트는 "`Quote` 가 이미 항목을 갖는데 또 항목 라우트가 있으면 같은 것일 수 없다"
였다. **실측은 반대다**: `QuoteListItem` 이 별도 **모델**이므로 항목 CRUD 라우트가
따로 있는 것이 자연스럽다. `Quote.items` 관계 주석에 "QuoteItem 대신 QuoteListItem 사용"
이라고 적혀 있다. 지시대로 실측을 따른다.

### 판정과 처리

**오기 → 차단 불필요. 이름 치환 + 필드 매핑.**

다만 "한 줄"은 아니다. 모델명 외에 **필드 2건 매핑**이 필요하다:
`message`→`description`, item 의 `vendor` 제거(또는 `Quote.vendor` 로 이동),
`snapshot`→`raw`. 4라우트 7회를 함께 본다.

⚠️ 이 라우트들은 지금 **워크벤치 견적 저장/조회/항목/내보내기 전 경로가 실패 중**이다.
(가) 이름 교정 3종 중 **우선순위 1위**다.

## 3-2. 실측 — `inventory/alerts/send` 크론 여부: **크론 없음**

`apps/web/vercel.json` 의 `crons` 7개를 전수 확인했다.
`/api/inventory/alerts/send` 는 **없다.** 재고 관련 크론은
`/api/cron/inventory-check`(매일 08:00) 하나이며, 그 핸들러는
`detectInventoryIssues` 를 부르고 **`alerts/send` 를 호출하지 않는다.**

→ **호출자 0 확정, 우선순위 낮음.** 매일 조용히 실패하고 있던 것은 아니다.

다만 다른 사실이 드러났다:

- `detectInventoryIssues` 는 **in-app 알림 디스패치 + 푸시 + `aiActionItem.create`** 로
  처리한다. 이메일 경로가 아니다.
- 이메일 템플릿 `generateLowStockAlertEmail` 의 **유일한 사용처가 `alerts/send`** 다.
- 즉 **재고 부족 "이메일" 채널만 통째로 죽어 있다** — 라우트·템플릿·모델 전부.
  in-app/푸시 알림은 살아 있으므로 "있어야 할 신호가 아예 없는" 상태는 아니다.

이 서술 차이가 중요하다: 크론이 있었다면 §fabricated-data-surface 의 반대 클래스
(있어야 할 신호가 없는데 표시도 없음)였겠지만, 실측은 **채널 하나가 미구현인 상태**다.

## 3-3. 이름 교정 실행 — `dbTyped` 도입 + **`purchase` 는 보류**

호영님 지시대로 **`db` any 캐스트를 함께 풀어** 필드 매핑을 컴파일러가 검증하게 했다.

### 도입 — `src/lib/db.ts` 의 `dbTyped`

```ts
const dbTyped = db as import("@prisma/client").PrismaClient;
export { db, dbTyped, isPrismaAvailable };
```

같은 인스턴스를 **PrismaClient 타입으로** 노출한다(런타임 동작 동일, 폴백 stub 도 그대로).
교정 대상과 새 코드는 이쪽을 쓴다.

### 교정 완료 2종

| 유령 | 교정 | 지점 |
|---|---|---|
| `quoteList` → `dbTyped.quote` | 7회 / 4라우트 | 저장·조회·항목·내보내기 |
| `inventory` → `dbTyped.productInventory` | 1회 | `inventory/scan-label` |

필드 매핑(서버 흡수, **프론트 불변**):
- `message` → `description` (create + PATCH 양쪽)
- `snapshot` → `raw`
- `title` — `Quote.title` 이 **required** 인데 기존 코드는 `title || null` 이었다.
  any 였기에 통과했을 뿐 런타임에서 실패했을 값이다. → `title || "제목 없음"`.

### ⚠️ `purchase` 2건 — 단순 rename 불가, **되돌리고 상신**

`dbTyped.purchaseRecord` 로 바꾸자 **필드 오류 8건**이 드러났다.

```
'organizationId' does not exist in type 'PurchaseRecordWhereInput'   (entity-linking)
'organizationId' does not exist in type 'PurchaseRecordSelect'       (entity-linking)
'totalAmount'    does not exist in type 'PurchaseRecordSelect'       (verification)
'items'          does not exist on type PurchaseRecord              (verification)
... 외 4
```

즉 이 코드가 가정하는 엔티티는 `PurchaseRecord` 가 **아니다**.
`organizationId`/`totalAmount`/`items` 는 `Order` 에 있다. 그러나 `invoiceNumber` 는
`PurchaseRecord` 쪽이라(tsc 가 그 필드는 문제삼지 않았다) 두 모델 어느 쪽으로도
깔끔하게 떨어지지 않는다.

**문서 §1 표의 "실제 모델은 PurchaseRecord" 는 내 추정이었고, typed client 가 그것을 반증했다.**

억지로 맞추면 **"동작하지만 틀린 대상을 조회하는" 코드**가 된다 — 유령 호출보다 나쁘다
(유령은 최소한 실패로 드러난다). 변경을 되돌리고 `LEGACY_PHANTOM` 에 남겼다.
→ **§ai-pipeline-purchase-entity** 상신(도메인 판정 필요).

### §db-any-escape-hatch 첫 실증 — any 를 풀면 무엇이 드러나는가

| 대상 | typed 전환 후 새로 드러난 타입 오류 |
|---|---|
| `quote-lists` 4라우트 | **1건** (`title` required) |
| `inventory/scan-label` | **0건** |
| `purchase` 2파일 | **8건** (모델 자체가 틀렸음이 드러남) |

⚠️ **그러나 typed client 도 전부 잡지는 못했다.** `message`/`snapshot`/`vendor` 오류는
컴파일러가 잡지 않았다 — 이유:

- `items.map(...)` 의 반환값은 **fresh object literal 이 아니라** excess property check 가
  적용되지 않는다.
- `...(x !== undefined && { x })` 조건부 spread 도 마찬가지로 우회한다.

→ **any 해제는 필요조건이지 충분조건이 아니다.** 두 패턴 안의 필드는 여전히 수동 대조가
필요하며, 해당 지점에 그 사실을 주석으로 남겼다. 전면 해제를 판단할 때 이 한계를 비용에 넣어야 한다.

### 항목별 `vendor` — 매핑 아님, **스키마 부족** (상신)

워크벤치 패널은 **항목별 vendor 를 표시한다** — `item.vendorName`/`item.vendorId`,
"공급사 N개" 집계, CSV 내보내기, vendor 그룹화. 즉 항목마다 다른 vendor 다.

그런데 `QuoteListItem` 에는 초안 단계 vendor 문자열 컬럼이 **없다**
(`selectedVendorRequestId` 는 §quote-item-vendor-selection 의 **확정** truth 로 성격이 다르다).

지시대로 **견적 단위 `Quote.vendor` 로 복제하지 않았다** — 복제하는 순간 화면이 거짓을 말한다.
유실만 막기 위해 스냅샷 blob(`raw`) 안에 `vendorName` 으로 보존하고, **표시 경로는 배선하지 않았다.**
→ **§quote-item-vendor-column** 상신.

## 3-4. 왕복 스모크 — **미수행** (연결 DB 가 프로덕션)

호영님 지시: 개발/로컬 DB 면 create→read→update→delete 왕복 1회로 매핑을 기계 증명하고,
**프로덕션이면 하지 말고 `prisma validate` + 스키마 대조로 대체 + 미수행을 기록**할 것.

### 판정 — 프로덕션이다 (→ §dev-prod-db-separation 발원)

```
DATABASE_URL host = aws-1-ap-northeast-1.pooler.supabase.com:6543
DIRECT_URL   host = aws-1-ap-northeast-1.pooler.supabase.com:5432
```

로컬이 아니라 Supabase 원격이다. **왕복 스모크를 수행하지 않았다.**

### 대체 검증 — 기계적 필드 대조

`prisma validate` → `The schema at prisma\schema.prisma is valid`.

스키마에서 모델 필드 집합을 추출해 코드가 쓰는 필드명과 대조했다(사람 눈이 아니라 기계).

| 대조 대상 | 결과 |
|---|---|
| `Quote.create` data (guestKey/title/description/items/totalAmount) | **OK 5/5** |
| `Quote.update` data (title/description/status/totalAmount) | **OK 4/4** |
| `Quote.findFirst` where (id/guestKey) | **OK 2/2** |
| `QuoteListItem.create` data (productId/name/brand/catalogNumber/unitPrice/quantity/lineTotal/notes/raw) | **OK 9/9** |
| 옛 필드 `message`/`snapshot` 이 스키마에 존재하는가 | **없음**(제거가 맞음) |
| `vendor` | `Quote` 에만 존재, `QuoteListItem` 에는 **없음** — 항목별 복제 금지 판단이 스키마로 확인됨 |

### ⚠️ 대조가 잡아낸 잔여 위험 1건 — `Quote.status` 는 enum

`status` 는 `QuoteStatus` **enum** 인데 PATCH 는 body 값을 그대로 넘겼다.
조건부 spread 라 typed client 도 잡지 못하는 자리다(§3-3 한계).
enum 값 검증을 명시 추가했다 — 잘못된 값은 무시되고 런타임 실패로 가지 않는다.

### 한계

필드 **이름**은 기계로 검증했으나 **값의 형태**(예: `raw` JSON 구조, `quantity` 정수성)는
왕복 없이는 확인되지 않는다. 이 부분은 미검증으로 남는다.

## 3-5. item vendor 현재 화면 실측 — §fabricated-data-surface 약한 형태 2건

호영님 지시로 "지금 무엇을 렌더하는가" 를 실측했다. **두 곳이 정보 부재를 정보 있음처럼
보여주고 있었다.**

| 위치 | 이전 | 문제 |
|---|---|---|
| 워크벤치 헤더 "공급사 N개" | `new Set(...).size \|\| 1` | vendor 가 하나도 없으면 size 0 → **`\|\| 1` 폴백이 "공급사 1개" 로 위장** |
| CSV 내보내기 "벤더" 열 | `item.vendorName \|\| ""` | **빈 열은 받는 쪽이 "공급사 없음" 으로 읽는다** |

교정: 집계는 0 이면 **"공급사 미지정"**, CSV 는 빈 문자열 대신 **"미지정"**.
`§quote-item-vendor-column` 이 들어오기 전까지의 정직한 표시다.

⚠️ `|| 1` 폴백은 특히 나쁘다 — 0 을 1 로 바꾸는 것은 없는 것을 있다고 말하는 것이고,
숫자라서 사용자가 의심할 여지가 없다.

## 3-6. `compliance_link` 표면 차단 (2026-08-12) — **페이지 삭제는 보류**

### 처리 완료

| 대상 | 처리 |
|---|---|
| `api/compliance-links/route.ts` | **삭제** |
| `api/compliance-links/[id]/route.ts` | **삭제** |
| `csrf-route-registry.ts` 등재분 | 제거 |
| `products/[id]/page.tsx` 규제 링크 조회 | **미생성** (아래) |

ratchet: `LEGACY_PHANTOM` **4 → 3** (`complianceLink` 호출 소멸).

### 제품 상세는 화면 전체를 깨뜨리지 않았다 — **조용히 삼키고 있었다**

호영님이 지시한 실측(화면 전체 파괴인가 부분 실패인가)의 답:

```ts
const response = await fetch(`/api/compliance-links?productId=${id}`);
if (!response.ok) return { links: [] };      // ← 실패를 빈 목록으로 바꾼다
```

렌더 블록도 `length > 0` 일 때만 그리므로, **항상 실패하는 조회가 "규제 링크 없음" 으로
보였다.** 조회 실패와 링크 부재를 구분할 수 없는 상태이며, 안전·규제 축에서는 특히
위험하다 — §fabricated-data-surface 의 조용한 형태다.

→ 조회 자체를 **미생성**으로 되돌렸다. 빈 목록을 그리면 같은 거짓이 반복된다.
모델이 신설되면 블록을 되살린다.

### ⚠️ 보류 — `settings/compliance-links` 페이지 삭제

호영님 지시는 "컴플라이언스 설정 화면 미생성" 이었으나, 실행 중 **committed sentinel
2개가 이 화면을 잠그고 있음**이 드러났다.

| sentinel | 범위 |
|---|---|
| `settings-compliance-aria-label-270b.test.ts` (85줄) | **compliance-links 전용** — X 버튼 aria-label |
| `settings-x-button-touch-target-270.test.ts` (117줄) | 3파일 중 1개가 compliance-links — 터치 영역 |

메모리 규칙(**결정 교체는 명시 승인 — 충돌 시 구현 전 상신·halt**)에 따라
**페이지 삭제를 멈추고 상신한다.** 지시 시점에 알 수 없던 사실이다.

판단 요청:
- (a) 페이지 삭제 + §11.270b 은퇴 + §11.270 에서 compliance 대상만 제거
  (나머지 2파일 잠금은 유지) — 지시 그대로. 접근성 **정책**은 다른 화면에서 계속 잠긴다.
- (b) 모델 신설까지 페이지 존치 — 지금은 API 가 없어 404 로 실패한다(이전엔 500).
  어느 쪽이든 화면은 동작하지 않는다.

현 상태는 (b) 다 — API 만 사라져 페이지는 남아 있다.

## 4. sentinel

`src/__tests__/ops/phantom-model-call.test.ts` — P1(ratchet) / P2(공허 GREEN 방지).

- `LEGACY_PHANTOM` 6종을 고정. **줄어들기만 한다.**
- corrupt→RED: 존재하지 않는 모델 호출(`db.ghostModelXyz.findMany`) 주입 → P1 RED.

## 5. ⚠️ 판정기의 한계 (먼저 적어둔다)

정규식 한계를 두 번 겪었으므로 이번엔 한계를 선언한다.

- 변수명이 `db`/`prisma`/`tx`/`dbAny` 인 것만 본다. 다른 이름으로 alias 하면 못 본다.
- 동적 접근(`db[modelName]`)은 못 본다.
- raw SQL(`$queryRawUnsafe` 90 / `$executeRawUnsafe` 46) 안의 테이블명은 대상이 아니다.
- 모델 목록을 **생성된 Client 가 아니라 `schema.prisma`** 에서 읽는다(테스트가 DB 연결
  없이 돌아야 하므로). 생성이 밀려 있으면 둘이 갈릴 수 있다.
  실측 시점에는 schema 105 = client 105 로 일치했다.

## 6. 처리 순서 (호영님 2026-08-10)

1. **전수 + sentinel** — 완료(이 문서).
1-b. **quote-lists 실측 + 크론 확인** — 완료(§3-1, §3-2).
2. **차단** — `ComplianceLink` 표면 미생성 + 라우트 삭제 + csrf 레지스트리 정리.
3. **스키마 설계 상신** — 차집합 결과를 **한 번에** 설계한다.
   `ComplianceLink` 뿐 아니라 `InventoryAlertSetting`/`InventoryAlertLog` 도 같은 상신에 포함.
   (나) 3종을 따로 설계하면 세 번 한다.
4. **(가) 3종 이름 교정** — 마이그레이션 없이 가능하나 필드 대응 확인 필요. 별도.
5. 마이그레이션.

## 7. 상신 사항

- **§compliance-link-model-missing** → 이 문서로 흡수. 스키마 설계 시
  필드 / `Product` 관계 / **소유권 축**을 상신한다. 소유권은 SDS 정책과 같은 규칙을
  따라야 한다 — 개인 등록을 허용하면 오매칭 위험이 재현된다(호영님).
- **§inventory-alert-model-missing** (신규) — 재고 알림 설정·이력 2 모델 부재.
  위 설계 상신에 합류.
- **§quote-list-model-mismatch** — **부분 종결**(호영님 2026-08-10):
  **필드명 검증 완료 / 값 형태 미검증**. 오기 판정·교정은 끝났으나 왕복 스모크를
  못 돌려(운영 DB) `raw` JSON 구조·`quantity` 정수성은 확인되지 않았다.
  개발 DB 분리 후 왕복으로 닫는다 → §dev-prod-db-separation.
- **§ai-pipeline-purchase-entity** (신규) — `purchase` 2건. **3종 스키마 상신과 분리 유지**
  (호영님): compliance_link·inventory_alert_* 는 "무엇을 저장할지 명확한데 모델이 없는"
  경우이나, purchase 는 **무엇을 저장하려 했는지가 불명**이다. 그 상태로 모델을 만들면
  두 번 만든다. ratchet 에 4건으로 남겨 미해결이 보이는 상태를 유지한다.
  **선결 실측 2가지(지금 하지 않음)**:
  ① 이 processor 가 무엇에서 호출되는가 — 크론/업로드 파이프라인/죽은 코드
  ② 산출물이 무엇인가 — 인보이스 파싱 결과라면 대상은 구매 기록이 아니라 **문서**일 수 있다
- **§quote-item-vendor-column** (신규) — `QuoteListItem` 항목별 vendor 컬럼 부재.
  **4종 스키마 상신에 합류**(호영님): 컬럼 추가라 모델 신설보다 가볍고, 워크벤치
  실사용 경로이며, 마이그레이션을 묶으면 배포 횟수가 준다. 독립성 확인 필요.
- **§source-encoding-drift** (신규) — UTF-16/BOM 3파일 **+ mojibake 3파일 통합**.
  sentinel ratchet 은 이 트랙에 이미 심었다. 교정은 별도.
- **§raw-sql-audit** (신규, 등재만) — `$queryRawUnsafe` 90 + `$executeRawUnsafe` 46 = **136회**.
  이 sentinel 의 사각지대이며, **유령 모델보다 주입 위험이 본체**다.
  착수는 §audit-foundation 이후 — 지금 열면 끝이 안 난다(호영님).
- **§db-any-escape-hatch** — `db as any` 4 / `dbAny` 3. 위 136회와 함께 규모 기록.

---

## 4. §sso-phantom-wiring — **필드판** 유령 (2026-08-12 실측)

§onboarding-blocker #2 강등 검토 중 지시받은 실측
(*"`lib/auth/sso-config.ts` 가 실제 배선인지 미완인지"*)에서 나왔다.
**모델이 아니라 컬럼이 유령**이고, 그 위에 로그인 배선까지 끊겨 있다.

### 두 층이 동시에 끊겼다

| 층 | 실측 |
|---|---|
| **스키마** | `Organization` 에 `ssoEnabled` · `ssoConfig` · `ssoProvider` · `ssoMetadataUrl` · `ssoEntityId` · `ssoCertificate` — **6개 전부 없다**(`schema.prisma` 전역 grep 0) |
| **저장** | `api/organizations/[id]/sso/route.ts:155` 가 그 6개에 `db.organization.update` 를 건다 → **런타임 거부** |
| **조회** | 같은 라우트 GET 이 `select: { ssoConfig: true }` → 동일 |
| **로그인** | `auth.ts` 가 `convertSSOConfigToProvider` 를 **import 만 하고 호출 0**(repo 전수). 설정이 저장돼도 **provider 로 등록되지 않는다** |
| **UI** | `dashboard/settings/enterprise` 가 이 라우트를 **실제로 호출**(라이브 표면) |

### 왜 안 잡혔나 — 이 문서 §0 과 같은 이유

`db` 가 `any` 라 **없는 컬럼에 쓰는 코드가 컴파일된다.** §phantom-model-call 이
모델명 오기를 잡았듯, 같은 탈출구가 **컬럼 오기/미생성**도 통과시킨다.
`dbTyped` 로 바꿨다면 6개 모두 타입 에러로 드러났을 것이다.

⚠️ 그리고 §3(타입 검사 무력화 탈출구)에 **필드 단위 사례**가 처음 기록된 것이다 —
지금까지는 모델 단위만 봤다.

### 판정 — 교정하지 않는다 (등재만)

- SSO 는 **엔터프라이즈 기능**이고 첫 고객 경로가 아니다(#2 강등과 같은 근거)
- 고치려면 **스키마 6컬럼 추가**가 필요하다 → Supabase 이후(3c 계열)
- 지금 할 수 있는 최소는 **거짓 성공 차단**인데, #7(초대)과 달리
  이 화면은 저장이 **실패로 드러난다**(런타임 거부) — 성공처럼 보이지 않는다.
  ⚠️ 단 미실측: 그 실패가 사용자에게 **어떤 문구로** 보이는지는 확인하지 않았다.
  "저장 실패" 로 보이면 정직하고, 삼켜지면 §placeholder-success 대상이 된다.

### 착수 조건

1. Supabase(3c) 이후 — 스키마 6컬럼
2. `auth.ts` 의 provider 등록 배선 (지금은 import 만 있다)
3. 그 전까지는 **엔터프라이즈 SSO 설정 UI 를 열어두지 않는 편이 정직**하다
   — #7 과 같은 판단이 필요할 수 있다(별도 지시 대기)
