# Scoping: 제품 상세 §3 거래 맥락 · §4 재발주 배너 배선

- **Status:** 📋 Scoping (착수 전 — 실측 보고)
- **Date:** 2026-08-09
- **Upstream:** §product-detail-sourcing-v21 (커밋 `1c332358`) — §1·§2·§5·§6·§7 반영 완료, §3·§4 는 API 신설 필요로 분리

> ⚠️ **2026-08-12 상태 되돌림 (호영님).** upstream §product-detail-sourcing-v21 의
> "반영 완료" 는 **코드 반영 완료**이지 동작 검증이 아니다. 이 세션에서 같은 형태의
> 사고가 반복 확인됐다(렌더되지만 저장은 실패, 유령 모델 호출, mock 데이터 렌더).
>
> **§product-detail-sourcing-v21 의 상태를 "동작 미검증" 으로 되돌린다.**
> 진짜 마감 조건은 실데이터 왕복 1회다 — **견적 담기 → 견적함 → 견적 요청 발송**.
> 여기에 §phantom-model-call 의 미검증분(`quote-lists` 의 `raw` JSON 구조 ·
> `quantity` 정수성)을 **같은 세션에 묶어** 확인한다.
>
> 선결: 개발 DB 분리(§dev-prod-db-separation) — 운영 DB 에 실데이터를 쓸 수 없다.
> 로그인 수단은 §auth-dev-login 으로 확보했다(개발 DB 전환 시 자동 활성).
- **목적:** 신설 최소 범위 산정. 구현 착수 판단은 호영님.

---

## 0. 요약 (판정)

| 항목 | 데이터 | 제품 단위 연결 | 기존 API 커버 | 판정 |
| :--- | :--- | :--- | :--- | :--- |
| §3-1 우리 조직 재고 | **10건 실재** | `ProductInventory.productId` **FK** | ❌ 필터 부재 | ✅ **최소 신설**(GET 파라미터 1개) |
| §3-2 최근 구매 | 소스별 상이 ↓ | **소스 갈림길** | ❌ | ⚠️ **소스 결정 필요** |
| §3-3 구매가 이력 | 소스별 상이 ↓ | **소스 갈림길** | ❌ | ⚠️ **소스 결정 필요** |
| §4 재발주 배너 | — | 텍스트 매칭 한계 | 🔶 **절반 기존재** | ⚠️ **가정 일부 정정** |

**한 줄**: §3-1 은 지금 바로 얹을 수 있고, §3-2·§3-3 은 "정확한 소스는 비어 있고 데이터 있는 소스는 부정확"한 갈림길이며, §4 의 합류 mutation 은 **이미 있다**.

---

## 1. §3-1 — 우리 조직 재고 ✅ 최소 신설

**데이터**: `ProductInventory` prod **10건**. `Product.inventories` 역관계 실재 = `productId` FK 로 정확 조회 가능.

**기존 API 실측**:
- `GET /api/inventory` 필터 = `organizationId · search · status · location · category · lowStock` — **`productId` 없음**
  (라우트 내 `productId` 출현은 전부 POST 생성 경로)
- `GET /api/inventory/lookup` — `catalogNumber`/`productName` 만 받고 **`{ inventoryId }` 하나만** 반환.
  스마트입고 매칭 헬퍼이지 재고 조회가 아니다. **§3-1 에 사용 불가.**
- `GET /api/products/[id]/usage` — **AI 용도 설명 생성** API. 사용 이력과 무관. **오인 주의.**
- `GET /api/inventory/usage` — `inventoryId` 기준 사용 이력. productId 진입점이 아니다(체이닝 필요).

**신설 최소 범위**: `GET /api/inventory` 에 **`productId` 필터 1개 추가**(additive, 기존 호출부 무영향).
응답은 이미 `product`·`restockRecords`(lot/유효기한/수량) 를 include 하므로 블록 렌더에 충분.

> 비용: 라우트 1곳 where 절 + 테스트. **가장 싼 항목.**

---

## 2. §3-2 최근 구매 · §3-3 구매가 이력 ⚠️ 소스 갈림길

두 항목은 같은 소스를 쓰므로 함께 결정해야 한다.

### 후보 A — `OrderItem` (앱 내 발주)
```
OrderItem { productId String?  @@index([productId])   ← FK + 인덱스
            unitPrice, lineTotal, quantity, catalogNumber }
  → Order (status, 일자, vendor, organizationId)
```
- ✅ **정확**: productId 로 결속. 동명이품 오매칭 0.
- ❌ **prod 데이터 0건** (`Order` 0 · `OrderItem` 0 · productId 보유 0).
  → §3 계약("데이터 없으면 블록 숨김")상 **블록이 영구히 안 보인다**. 배선해도 화면 변화 0.

### 후보 B — `PurchaseRecord` (외부 import 구매 이력)
```
PurchaseRecord { itemName String   ← 제품을 **텍스트**로만 참조
                 catalogNumber String?, unitPrice, amount, qty, purchasedAt, vendorName }
  ⚠️ productId 없음
```
- ✅ **prod 15건 실재** — 유일하게 데이터가 있는 소스.
- ❌ **부정확**: 제품 결속이 없어 텍스트 매칭만 가능.
  기존 선례 = `reorder-recommendation` 이 `itemName: { contains: productName, mode: "insensitive" }` 사용.
  → **동명이품·부분일치 오매칭 위험**을 그대로 승계한다.

### 결정이 필요한 지점
- **A 선택** → 정확하지만 지금은 항상 빈 블록. "발주 기능이 실사용되면 자동으로 채워진다"는 이연 전략.
- **B 선택** → 지금 데이터가 보이지만 텍스트 매칭 정확도를 감수. 최소한 `catalogNumber` 우선 매칭으로 완화 가능(있을 때만).
- **A+B 합집합** → 표시량은 최대지만 두 소스의 신뢰도가 달라 한 블록에 섞이면 "이 숫자가 뭔지" 가 흐려진다. 구매가 이력처럼 **금액을 보여주는 블록**에서는 특히 위험.

> ⚠️ 이 갈림길은 §supplier-onboarding 의 소유권 부재와 **같은 클래스**다 — 구조적 결속이 없어 텍스트로 때우는 상황. 임의 규칙을 굳히기 전에 결정이 필요하다.

**신설 최소 범위(소스 확정 후)**: `GET /api/products/[id]/purchase-history`
(최근 구매 N건 + 단가 시계열을 한 번에 반환 — §3-2·§3-3 이 같은 쿼리라 라우트 1개로 충분)

---

## 3. §4 재발주 배너 — 가정 일부 정정

> 원 가정(호영님): "`reorder-recommendation` 계열 위에 **제품 단위 조회 + 합류 mutation**만 얹으면 된다"

### ✅ 맞은 부분 — 합류 mutation 은 **이미 있다**
- `POST /api/inventory/auto-reorder` 실재 → 내부에서 `createQuote` 호출.
- §reorder-quote-handoff 계보가 **재발주 시트 → 견적 초안 생성 → `?prepare=` 발송 준비 패널** 경로를 이미 배선함.
- → **합류 mutation 신설 불요.** 기존 자산 재사용.

### ⚠️ 정정 — "제품 단위 조회"는 얹을 수 없다
- `GET /api/inventory/reorder-recommendation` 은 **`productName` 텍스트**를 받는다(필수 파라미터).
- 내부 쿼리가 `PurchaseRecord.itemName contains` 이고, **`PurchaseRecord` 에 `productId` 가 없다.**
- → productId 파라미터를 "얹는" 것이 불가능하다. 제품 단위 정확 조회를 하려면 §3-2/§3-3 과 **같은 소스 결정**이 선행돼야 한다.
- `useReorderRecommendation(productName)` 훅도 텍스트 기반 — 상세 페이지에서 호출하려면 제품명을 넘기면 **지금도 동작**한다(정확도는 텍스트 수준).

### 실질 최소 범위
- **텍스트 수준으로 만족한다면**: 신설 0. 기존 훅에 `product.name` 을 넘겨 배너를 렌더하면 끝.
- **정확도를 요구한다면**: §3-2/§3-3 소스 결정에 종속.

---

## 4. 단계적 배포 제안 (§3 계약 활용)

§3 계약이 **"데이터 없으면 블록 자체 숨김"** 이므로 항목별 분리 출고가 계약 위반이 아니다.

| 배치 | 범위 | 신설 | 선행 조건 |
| :--- | :--- | :--- | :--- |
| **B1** | §3-1 재고 블록 | `GET /api/inventory` 에 `productId` 필터 1개 | 없음 — **즉시 가능** |
| **B2** | §4 재발주 배너(텍스트 수준) | 0 (기존 훅 재사용) | 정확도 수용 여부 결정 |
| **B3** | §3-2·§3-3 구매/가격 | `GET /api/products/[id]/purchase-history` 1개 | **소스 결정(A/B/A+B)** |

B1 은 선행 조건이 없고 데이터도 있어 화면에 즉시 반영된다. B3 만 결정 대기.

---

## 5. 실측 근거 (2026-08-09, read-only)

```
prod row counts
  PurchaseRecord    15     ← 유일한 실 구매 데이터, productId 없음
  OrderItem          0     (productId 보유 0)
  Order              0
  ProductInventory  10     ← §3-1 소스, productId FK 실재
```

**API 표면 확인**: `inventory/*` 25 라우트 · `purchases/*` 6 · `orders/*` 6 · `products/[id]/*` 12 전수 확인.
`purchases`(`from·to·vendor·category`)·`purchases/summary`(`from·to`)·`orders`(`page·limit·status·organizationId`) **모두 productId 필터 0**.

---

## 6. Notes

- 이번 실측에서 **가정 3건이 뒤집혔다**: `inventory/lookup` 이 재고 조회일 것(❌ 매칭 헬퍼), `products/[id]/usage` 가 사용 이력일 것(❌ AI 용도 설명), §4 에 제품 단위 조회를 얹을 수 있을 것(❌ PurchaseRecord 에 productId 부재).
  API 이름만으로 역할을 추론하면 안 된다는 것이 반복 확인됐다.
- §3-2/§3-3 의 소스 갈림길은 §supplier-onboarding 의 제품 귀속 부재와 같은 뿌리다 — **구조적 결속 없이 텍스트로 때우는 구간**이 이 repo 에 복수 존재한다. 개별 결정으로 굳히기 전에 한 번은 묶어 볼 가치가 있다.
