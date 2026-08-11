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

### 부수 관측 — 인코딩 이탈 3파일

전수 스캔 중 UTF-8 이 아닌 소스가 나왔다.
`components/ui/data-table.tsx`(**UTF-16**), `_components/demo-flow-switcher.tsx`(UTF-8 BOM),
`_components/home/demo-flow-switcher.tsx`(UTF-8 BOM).
도구가 파일을 읽지 못해 **스캔에서 조용히 빠질 수 있다**(이번 스캐너는 대응했다).
별건 등재 대상.

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
- **§source-encoding-drift** (신규) — UTF-16/BOM 3파일.
