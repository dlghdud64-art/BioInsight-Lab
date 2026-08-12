# §phantom-model-call — 존재하지 않는 Prisma 모델을 호출하는 지점

작성: 2026-08-10
상태: **전수 실측 완료 / sentinel 등재 / 교정 미착수**
발원: §audit-foundation ① 검증 ①이 `ComplianceLink` 를 잡은 뒤 호영님 지시로 전수

---

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
| `quoteList` | 7 | `Quote` / `QuoteListItem` 추정 | `api/quote-lists/route.ts`(create)<br>`api/quote-lists/[id]/route.ts`(findFirst, update)<br>`api/quote-lists/[id]/items/route.ts`(findFirst, update)<br>`api/quote-lists/[id]/export/route.ts`(findFirst) |
| `inventoryAlertSetting` | 2 | **없음** | `api/inventory/alerts/send/route.ts`(findUnique, update) |
| `purchase` | 2 | `PurchaseRecord` | `lib/ai-pipeline/processors/entity-linking-processor.ts`<br>`lib/ai-pipeline/processors/verification-processor.ts` |
| `inventory` | 1 | `ProductInventory` | `api/inventory/scan-label/route.ts`(findFirst) |
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
- **§quote-list-model-mismatch** (신규) — `quoteList` 7회. 모델명 오기인지
  설계 잔재인지 판정 필요. 워크벤치 견적 패널이 호출한다.
- **§source-encoding-drift** (신규) — UTF-16/BOM 3파일 **+ mojibake 3파일 통합**.
  sentinel ratchet 은 이 트랙에 이미 심었다. 교정은 별도.
- **§raw-sql-audit** (신규, 등재만) — `$queryRawUnsafe` 90 + `$executeRawUnsafe` 46 = **136회**.
  이 sentinel 의 사각지대이며, **유령 모델보다 주입 위험이 본체**다.
  착수는 §audit-foundation 이후 — 지금 열면 끝이 안 난다(호영님).
- **§db-any-escape-hatch** — `db as any` 4 / `dbAny` 3. 위 136회와 함께 규모 기록.
