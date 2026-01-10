# Time-Based Inventory Estimation System

## 개요 (Overview)

**"사용할 때마다 입력하세요"**라는 접근은 연구실 현장에서 실패합니다. 연구원들은 바쁘고, 수동 입력은 귀찮기 때문에 절대 사용하지 않습니다.

이 시스템은 **"시간을 세는"** 방식으로 재고를 추정합니다. 사용자의 수동 입력 없이, 과거 구매 패턴을 학습하여 현재 재고 상태를 자동으로 추정합니다.

## 핵심 아이디어 (Core Concept)

> **"재고는 '양'이 아니라 '기간'이다."**

물건의 개수(Quantity)를 세지 말고, 구매 주기(Time Cycle)를 세는 방식입니다.

### 예시 시나리오

| 날짜 | 상황 | 배터리 상태 | 알림 |
|------|------|------------|------|
| 1월 1일 | 시약 구매 (평균 주기: 30일) | 🔋 초록색 (100%) | 없음 |
| 1월 10일 | 10일 경과 | 🔋 초록색 (67%) | 없음 |
| 1월 25일 | 25일 경과 | 🪫 주황색 (17%) | "벌써 다 쓰셨나요?" |
| 1월 30일 | 30일 경과 | 🔴 빨간색 (0%) | "지금 주문 안 하면 실험 멈춥니다!" |

## 아키텍처 (Architecture)

### 1. Cycle Calculation (학습)

특정 시약(CatalogNumber)의 과거 Order 기록을 분석하여 **평균 구매 주기**를 계산합니다.

```typescript
// 예시: 에탄올의 구매 기록
// 2024-01-01, 2024-02-05, 2024-03-10 → 간격: 35일, 33일
// 평균 주기: 34일
```

**알고리즘:**
1. 해당 `catalogNumber`의 모든 `Order` (status=DELIVERED) 조회
2. `actualDelivery` 날짜 간격 계산
3. 평균값 산출 → `averageCycleDays`

**초기값:**
- 구매 기록이 없으면: 30일 (기본 가정)
- 구매 기록이 쌓이면: 실제 데이터로 업데이트

### 2. Decay Algorithm (추정)

마지막 구매일로부터 경과 시간을 기반으로 **잔여량(%)을 추정**합니다.

```typescript
// 잔여량(%) = 100 - (경과 일수 / 평균 주기 * 100)

// 예시:
// 평균 주기: 30일
// 경과 일수: 15일
// 잔여량: 100 - (15 / 30 * 100) = 50%
```

### 3. Status Mapping (상태 분류)

| 잔여량(%) | 상태 | 배터리 | 알림 레벨 |
|-----------|------|--------|-----------|
| > 70% | HIGH | 🔋 초록색 | NONE |
| 30~70% | MEDIUM | 🪫 노란색 | INFO |
| 10~30% | LOW | 🪫 주황색 | WARNING |
| < 10% | CRITICAL | 🔴 빨간색 | CRITICAL |

## 구현 (Implementation)

### 파일 구조

```
apps/web/src/
├── lib/inventory/
│   └── time-based-estimation.ts       # 핵심 로직
├── app/api/
│   ├── user-inventory/route.ts        # 인벤토리 조회 (추정 포함)
│   └── inventory/alerts/route.ts      # 재고 부족 알림 API
└── components/inventory/
    └── battery-indicator.tsx          # 배터리 UI 컴포넌트
```

### API 사용법

#### 1. 인벤토리 조회 (추정 포함)

```bash
GET /api/user-inventory?page=1&limit=20
```

**응답:**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "inv_123",
        "productName": "Ethanol",
        "catalogNumber": "E7023",
        "quantity": 1,
        "estimation": {
          "estimatedStatus": "LOW",
          "estimatedPercentage": 17,
          "daysSinceLastPurchase": 25,
          "averageCycleDays": 30,
          "nextPurchaseDue": "2024-01-30T00:00:00Z",
          "confidence": "HIGH",
          "alertLevel": "WARNING"
        }
      }
    ]
  }
}
```

#### 2. 재고 부족 알림 조회

```bash
GET /api/inventory/alerts
```

**응답:**

```json
{
  "success": true,
  "data": {
    "alerts": [
      {
        "inventoryId": "inv_123",
        "productName": "Ethanol",
        "catalogNumber": "E7023",
        "alertLevel": "WARNING",
        "message": "🟠 [경고] Ethanol - 재고가 부족합니다 (17% 남음). 예상 구매일: 2024년 1월 30일. 조만간 주문을 고려하세요.",
        "estimatedPercentage": 17,
        "nextPurchaseDue": "2024-01-30T00:00:00Z",
        "daysSinceLastPurchase": 25,
        "averageCycleDays": 30,
        "confidence": "HIGH"
      }
    ],
    "summary": {
      "total": 1,
      "critical": 0,
      "warning": 1,
      "info": 0
    }
  }
}
```

### UI 컴포넌트 사용법

```tsx
import { BatteryIndicator } from "@/components/inventory/battery-indicator";

<BatteryIndicator
  percentage={17}
  status="LOW"
  showLabel={true}
  size="md"
/>
// 렌더링: 🪫 부족 (17%)
```

## 신뢰도 (Confidence)

시스템은 데이터 양에 따라 추정 신뢰도를 자동 계산합니다.

| 구매 횟수 | 신뢰도 | 설명 |
|-----------|--------|------|
| 0~1회 | LOW | 기본값(30일) 사용 |
| 2~4회 | MEDIUM | 제한적 데이터 |
| 5회 이상 | HIGH | 신뢰할 수 있는 패턴 |

## 사용자 경험 (UX Flow)

### 1. 알림 없음 (HIGH)

```
재고: 🔋 풍부 (85%)
상태: 정상
액션: 없음
```

### 2. 정보 알림 (MEDIUM)

```
재고: 🪫 보통 (55%)
알림: "벌써 다 쓰셨나요?"
액션: 사용자 확인 요청 (빠르게 소진된 경우)
```

### 3. 경고 알림 (LOW)

```
재고: 🪫 부족 (15%)
알림: "조만간 주문을 고려하세요"
액션: 주문 버튼 제공
```

### 4. 긴급 알림 (CRITICAL)

```
재고: 🔴 긴급 (5%)
알림: "지금 주문 안 하면 실험 멈춥니다!"
액션: 즉시 주문 유도 (원클릭 재주문)
```

## 확장 가능성 (Future Enhancements)

### Phase 2: 자동 주문 (Auto-Reorder)

```typescript
// CRITICAL 상태 도달 시 자동으로 장바구니에 추가
if (estimation.alertLevel === "CRITICAL" && autoReorderEnabled) {
  await addToCart(catalogNumber, defaultQuantity);
  await sendNotification("장바구니에 자동 추가되었습니다.");
}
```

### Phase 3: 사용 패턴 학습 (ML Enhancement)

- 계절성 고려 (여름에 더 많이 사용하는 시약)
- 프로젝트 기반 변동 (새 프로젝트 시작 시 소비량 증가)
- 팀 단위 공유 재고 관리

## 기술 스택 (Tech Stack)

- **Backend:** Next.js 15 App Router, Prisma ORM
- **Database:** PostgreSQL (Order, UserInventory)
- **Algorithm:** TypeScript (순수 함수형, 테스트 가능)
- **UI:** React Server Components + Tailwind CSS

## 핵심 이점 (Key Benefits)

1. ✅ **입력 제로 (Zero Input):** 사용자는 아무것도 입력하지 않습니다.
2. ✅ **자동 학습 (Auto Learning):** 구매 패턴을 자동으로 학습합니다.
3. ✅ **선제적 알림 (Proactive Alerts):** 재고가 떨어지기 전에 미리 알려줍니다.
4. ✅ **실험 중단 방지 (Continuity):** "실험 중 시약 없음" 상황을 사전에 차단합니다.

---

## 개발자 가이드 (Developer Guide)

### 로컬 테스트

```bash
# 1. 의존성 설치
npm install

# 2. DB 마이그레이션 (이미 완료된 경우 스킵)
npx prisma migrate dev

# 3. 개발 서버 실행
npm run dev

# 4. API 테스트
curl http://localhost:3000/api/user-inventory
curl http://localhost:3000/api/inventory/alerts
```

### 단위 테스트 (예정)

```typescript
import { calculatePurchaseCycle, estimateInventoryStatus } from "@/lib/inventory/time-based-estimation";

test("30일 주기에서 15일 경과 시 50% 남음", () => {
  const cycleData = {
    catalogNumber: "E7023",
    averageCycleDays: 30,
    purchaseCount: 5,
    lastPurchaseDate: new Date("2024-01-01"),
    confidence: "HIGH" as const,
  };

  const now = new Date("2024-01-16"); // 15일 후
  const estimation = estimateInventoryStatus(cycleData, now);

  expect(estimation.estimatedPercentage).toBe(50);
  expect(estimation.estimatedStatus).toBe("MEDIUM");
});
```

---

**Powered by Time, Not Quantity.** ⏱️
