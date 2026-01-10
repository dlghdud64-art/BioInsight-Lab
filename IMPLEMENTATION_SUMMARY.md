# Time-Based Inventory Estimation System - Implementation Summary

## 🎯 Mission Accomplished

**"사용할 때마다 입력하세요"** 방식은 연구실 현장에서 100% 실패합니다.

이 시스템은 **"시간을 세는"** 방식으로 재고를 자동 추정하여, 사용자 입력 없이 재고 부족을 선제적으로 알려줍니다.

---

## 📦 Deliverables

### 1. Core Algorithm (`time-based-estimation.ts`)

**위치:** `apps/web/src/lib/inventory/time-based-estimation.ts`

**핵심 함수:**

```typescript
// [1] 평균 구매 주기 계산 (학습)
calculatePurchaseCycle(tx, userId, catalogNumber)
→ { averageCycleDays: 30, purchaseCount: 5, confidence: "HIGH" }

// [2] 시간 기반 잔여량 추정 (추정)
estimateInventoryStatus(cycleData, now)
→ { estimatedPercentage: 50, estimatedStatus: "MEDIUM", alertLevel: "INFO" }

// [3] 일괄 처리 (성능 최적화)
batchEstimateInventoryStatus(tx, userId, inventories)
→ Map<inventoryId, estimation>

// [4] 알림 메시지 생성
generateAlertMessage(estimation, productName)
→ "🟠 [경고] Ethanol - 재고가 부족합니다 (17% 남음)"
```

**로직:**
- **Cycle Calculation:** 과거 Order 데이터의 `actualDelivery` 날짜 간격 분석 → 평균 구매 주기 산출
- **Decay Algorithm:** `잔여량(%) = 100 - (경과일수 / 평균주기 * 100)`
- **Status Mapping:** HIGH (>70%), MEDIUM (30~70%), LOW (10~30%), CRITICAL (<10%)

---

### 2. API Endpoints

#### A. `GET /api/user-inventory` (Enhanced)

**변경 사항:**
- 기존 인벤토리 조회 API에 `estimation` 필드 추가
- 시간 기반 추정 데이터 자동 포함

**응답 예시:**
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

#### B. `GET /api/inventory/alerts` (New)

**위치:** `apps/web/src/app/api/inventory/alerts/route.ts`

**기능:**
- 사용자의 모든 인벤토리를 분석하여 재고 부족 알림 목록 반환
- WARNING, CRITICAL 알림만 필터링 (HIGH는 제외)
- 우선순위 정렬 (CRITICAL > WARNING > INFO)

**응답 예시:**
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

---

### 3. UI Components

#### A. `BatteryIndicator` Component

**위치:** `apps/web/src/components/inventory/battery-indicator.tsx`

**기능:**
- 재고 상태를 배터리 아이콘으로 시각화
- 4가지 상태: 🔋 HIGH, 🪫 MEDIUM/LOW, 🔴 CRITICAL
- 크기 옵션: sm, md, lg

**사용 예시:**
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

#### B. `BatteryIndicatorCompact` Component

**기능:**
- 공간이 제한된 곳에 사용하는 간소화 버전
- 이모지 + 퍼센트만 표시

**사용 예시:**
```tsx
<BatteryIndicatorCompact
  percentage={17}
  status="LOW"
  showPercentage={true}
  size="sm"
/>
// 렌더링: 🪫 17%
```

---

### 4. Documentation

**위치:** `docs/TIME_BASED_INVENTORY_ESTIMATION.md`

**내용:**
- 시스템 개요 및 핵심 아이디어
- 아키텍처 설명 (Cycle Calculation, Decay Algorithm, Status Mapping)
- API 사용 가이드
- UI 컴포넌트 사용 가이드
- 신뢰도 계산 방식
- 사용자 경험(UX) 플로우
- 확장 가능성 (Auto-Reorder, ML Enhancement)

---

## 🔍 How It Works

### 시나리오: 에탄올 시약 (CatalogNumber: E7023)

| 날짜 | 이벤트 | 시스템 동작 |
|------|--------|------------|
| **2024-01-01** | 에탄올 주문 (배송 완료) | `lastPurchaseDate` 기록 |
| **2024-02-05** | 에탄올 재주문 (배송 완료) | 간격: 35일 |
| **2024-03-10** | 에탄올 재주문 (배송 완료) | 간격: 33일 |
| **계산 결과** | - | `averageCycleDays = 34일` |

### 추정 로직

**현재 시각: 2024-04-01 (마지막 구매 후 22일 경과)**

```typescript
// 1. 경과 일수
daysSinceLastPurchase = 22

// 2. 잔여량 계산
estimatedPercentage = 100 - (22 / 34 * 100) = 35%

// 3. 상태 분류
35% → MEDIUM (30~70%)

// 4. 알림 레벨
MEDIUM → INFO (정보 알림)

// 5. 알림 메시지
"🟡 [정보] Ethanol - 재고가 절반 이하입니다 (35% 남음). 벌써 다 쓰셨나요?"
```

---

## 🎨 User Experience Flow

### 1. 재고 조회 화면

```
┌─────────────────────────────────────────────┐
│ 내 인벤토리                                  │
├─────────────────────────────────────────────┤
│ Ethanol (E7023)                             │
│ 🪫 부족 (17%)                               │
│ 예상 구매일: 2024-01-30                     │
│ [지금 주문] [나중에]                        │
└─────────────────────────────────────────────┘
```

### 2. 알림 대시보드

```
┌─────────────────────────────────────────────┐
│ 재고 부족 알림 (3건)                        │
├─────────────────────────────────────────────┤
│ 🔴 [긴급] PBS Buffer - 5% 남음              │
│    → 지금 주문 안 하면 실험 멈춥니다!       │
│                                             │
│ 🟠 [경고] Ethanol - 17% 남음                │
│    → 조만간 주문을 고려하세요               │
│                                             │
│ 🟡 [정보] DMSO - 45% 남음                   │
│    → 벌써 다 쓰셨나요?                      │
└─────────────────────────────────────────────┘
```

---

## 📊 Performance & Optimization

### Batch Processing

- **문제:** N개의 인벤토리 → N번의 DB 쿼리 → 느림
- **해결:** `batchEstimateInventoryStatus` 함수로 일괄 처리
  1. 고유한 `catalogNumber` 추출
  2. 병렬로 `calculatePurchaseCycle` 실행 (Promise.all)
  3. Map 구조로 결과 캐싱 → O(1) 조회

### Database Indexing

활용되는 인덱스:
- `Order.status` + `Order.actualDelivery` (배송 완료된 주문만 필터링)
- `UserInventory.userId` (사용자별 인벤토리 조회)
- `UserInventory.catalogNumber` (제품별 재고 조회)

---

## 🚀 Next Steps (Future Enhancements)

### Phase 2: 자동 주문 (Auto-Reorder)

```typescript
// CRITICAL 상태 도달 시 자동으로 장바구니에 추가
if (estimation.alertLevel === "CRITICAL" && autoReorderEnabled) {
  await addToCart(catalogNumber, defaultQuantity);
  await sendNotification("장바구니에 자동 추가되었습니다.");
}
```

### Phase 3: 머신러닝 강화 (ML Enhancement)

- **계절성 고려:** 여름에 더 많이 사용하는 시약 (예: 냉각제)
- **프로젝트 기반:** 새 프로젝트 시작 시 소비량 급증 패턴 학습
- **팀 단위 공유:** 랩 전체의 재고 패턴 분석

### Phase 4: 알림 채널 확장

- 이메일 알림 (Daily Digest)
- Slack/Discord 통합
- 모바일 푸시 알림

---

## 🛠️ Technical Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Next.js 15 App Router |
| **Database** | PostgreSQL + Prisma ORM |
| **Algorithm** | TypeScript (Pure Functions) |
| **UI** | React Server Components + Tailwind CSS |
| **Performance** | Batch Processing + Transaction |

---

## ✅ Key Benefits

1. **입력 제로 (Zero Input):** 사용자는 아무것도 입력하지 않습니다.
2. **자동 학습 (Auto Learning):** 구매 패턴을 자동으로 학습합니다.
3. **선제적 알림 (Proactive Alerts):** 재고가 떨어지기 전에 미리 알려줍니다.
4. **실험 중단 방지 (Continuity):** "실험 중 시약 없음" 상황을 사전에 차단합니다.

---

## 📁 File Structure

```
apps/web/
├── src/
│   ├── lib/inventory/
│   │   └── time-based-estimation.ts       # 핵심 로직 (426 lines)
│   ├── app/api/
│   │   ├── user-inventory/route.ts        # 인벤토리 조회 (Enhanced)
│   │   └── inventory/alerts/route.ts      # 알림 API (New, 158 lines)
│   └── components/inventory/
│       └── battery-indicator.tsx          # 배터리 UI (177 lines)
└── docs/
    └── TIME_BASED_INVENTORY_ESTIMATION.md # 문서 (400+ lines)
```

---

## 🎓 Conclusion

**Powered by Time, Not Quantity.** ⏱️

이 시스템은 "물건(Quantity)을 세지 말고, 시간(Time)을 세라"는 발상의 전환으로 연구실 재고 관리 문제를 해결합니다.

연구원들은 더 이상 재고 수량을 입력할 필요가 없습니다. 시스템이 자동으로 학습하고, 필요할 때 알려줍니다.

**Result:** 실험 중단 제로, 연구 생산성 극대화. 🚀
