# §enum-input-validation — 사용자 입력이 검증 없이 enum 컬럼으로 흘러간다

작성: 2026-08-10
상태: **계수 1회 완료 / 교정 미착수**(규모를 본 뒤 판단 — 호영님)
발원: §phantom-model-call 대조 검증이 `Quote.status` 를 잡은 뒤 일반화

---

## 0. 클래스

`body.*` 에서 꺼낸 값이 Prisma **enum 컬럼**으로 검증 없이 전달되는 지점.

Prisma 가 런타임에 거부하므로 **데이터 오염은 없다.** 대신 사용자가 **원인 불명의 500**
을 본다 — `vendor/requests/[id]/respond` 의 ZodError 500 과 같은 클래스다.

### 왜 컴파일러가 못 잡는가

`Quote.status` 사례가 전형이다.

```ts
...(status !== undefined && { status }),   // 조건부 spread
```

조건부 spread 는 **excess property check 를 우회**한다. `dbTyped`(타입 있는 client)로
바꿔도 잡히지 않는다. `items.map(...)` 반환값도 같은 이유로 우회된다
(§phantom-model-call §3-3 — "any 해제는 필요조건이지 충분조건이 아니다").

## 1. 계수 (2026-08-10, 1회)

Prisma enum **43종** / enum 타입 필드명 **27종**.

`src/app/api/**` 에서 body 구조분해 이름이 enum 필드명과 일치하고
근처에 검증(`z.enum`/`z.nativeEnum`/`Object.values(..).includes`/리터럴 비교)이
보이지 않는 지점: **17파일 19건.**

| route | 필드 |
|---|---|
| `activity-logs` | `activityType`, `entityType` |
| `admin/orders/[id]/status` | `status` |
| `admin/orders/bulk-status` | `status` |
| `ai-ops/promote` | `documentType` |
| `analytics/search-history` | `category` |
| `billing` | `plan` |
| `compliance-links` | `priority` |
| `governance/event-dedupe` | `eventType` |
| `ingestion` | `sourceType` |
| `inventory/[id]/inspection` | `result` |
| `inventory` | `category` |
| `organizations/[id]/invites` | **`role`** |
| `po-candidates` | `approvalStatus`, `stage` |
| `purchases` | `category` |
| `team/[id]/members` | **`role`** |
| `team/invite` | **`role`** |
| `work-queue/assignment` | `action` |

교정 완료(계수 이전): `quote-lists/[id]` 의 `status` — `Object.values(QuoteStatus).includes` 명시.

## 2. ⚠️ 이 계수의 한계 (먼저 적어둔다)

- **근사치다.** 구조분해 이름이 enum 필드명과 **문자열로 일치**하는지만 본다.
  이름이 다르면 못 보고(하한), 이름만 같고 enum 으로 안 가면 오탐이다(상한).
- `validateJsonBody(request, SomeSchema)` 처럼 **별도 스키마 모듈에서 검증**하는 경우를
  같은 파일에서 못 찾으면 오탐으로 잡힌다. 실제 교정 시 건별 확인이 필요하다.
- 따라서 **19건은 확정 결함 수가 아니라 조사 대상 수**다.

## 3. 우선순위 관찰 (교정 판단용)

`role` 3건(`organizations/[id]/invites`, `team/[id]/members`, `team/invite`)은
**권한 부여 경로**다. 잘못된 값이 Prisma 에서 거부되므로 권한 상승은 아니지만,
초대·역할 변경이 원인 불명 500 으로 실패하면 운영이 막힌다. 조사 시 여기부터.

## 4. 교정 방식 (착수 시)

`z.nativeEnum(PrismaEnum)` 을 입력 스키마에 넣는 것이 가장 얇다 —
런타임 검증 + 타입 추론이 함께 붙고, 조건부 spread 우회 문제도 입구에서 끝난다.
개별 `Object.values().includes` 는 검증이 흩어져 다음에 또 빠뜨린다.
