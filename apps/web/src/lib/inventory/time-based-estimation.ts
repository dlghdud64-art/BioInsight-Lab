/**
 * Time-Based Inventory Estimation (시간 기반 재고 추정)
 *
 * Mission: "사용자가 수량을 입력하지 않아도, 구매 주기를 기반으로 재고 상태를 자동 추정한다."
 *
 * Core Logic:
 * 1. Cycle Calculation (학습): 과거 Order 데이터에서 평균 구매 주기를 계산
 * 2. Decay Algorithm (추정): 마지막 구매일로부터 경과 시간 기반으로 잔여량 추정
 * 3. Status Mapping: HIGH (>70%), MEDIUM (30~70%), LOW (10~30%), CRITICAL (<10%)
 */

import { Prisma } from "@prisma/client";

// =====================================================
// 타입 정의
// =====================================================

export type EstimatedStatus = "HIGH" | "MEDIUM" | "LOW" | "CRITICAL" | "UNKNOWN";

export interface PurchaseCycleData {
  catalogNumber: string;
  averageCycleDays: number; // 평균 구매 주기 (일)
  purchaseCount: number; // 구매 횟수
  lastPurchaseDate: Date | null; // 마지막 구매일
  confidence: "HIGH" | "MEDIUM" | "LOW"; // 신뢰도
}

export interface InventoryEstimation {
  estimatedStatus: EstimatedStatus;
  estimatedPercentage: number; // 0~100 (추정 잔여량 %)
  daysSinceLastPurchase: number;
  averageCycleDays: number;
  nextPurchaseDue: Date | null; // 다음 구매 예상일
  confidence: "HIGH" | "MEDIUM" | "LOW";
  alertLevel: "NONE" | "INFO" | "WARNING" | "CRITICAL";
}

// =====================================================
// [1] Cycle Calculation (학습): 평균 구매 주기 계산
// =====================================================

/**
 * 특정 카탈로그 번호의 과거 주문 기록을 분석하여 평균 구매 주기를 계산합니다.
 *
 * @param tx - Prisma Transaction Client
 * @param userId - 사용자 ID
 * @param catalogNumber - 카탈로그 번호 (시약 식별자)
 * @returns PurchaseCycleData
 */
export async function calculatePurchaseCycle(
  tx: Prisma.TransactionClient,
  userId: string,
  catalogNumber: string
): Promise<PurchaseCycleData> {
  // 해당 카탈로그 번호의 모든 주문 기록 조회 (배송 완료된 것만)
  const orders = await tx.order.findMany({
    where: {
      userId,
      status: "DELIVERED", // 실제 입고된 것만 카운트
      items: {
        some: {
          catalogNumber,
        },
      },
    },
    select: {
      actualDelivery: true,
      createdAt: true,
    },
    orderBy: {
      actualDelivery: "asc",
    },
  });

  const purchaseCount = orders.length;

  // 데이터가 없는 경우: 기본값 30일 (초기 가정)
  if (purchaseCount === 0) {
    return {
      catalogNumber,
      averageCycleDays: 30,
      purchaseCount: 0,
      lastPurchaseDate: null,
      confidence: "LOW",
    };
  }

  // 데이터가 1개만 있는 경우: 기본값 30일
  if (purchaseCount === 1) {
    const lastPurchaseDate = orders[0].actualDelivery || orders[0].createdAt;
    return {
      catalogNumber,
      averageCycleDays: 30,
      purchaseCount: 1,
      lastPurchaseDate,
      confidence: "LOW",
    };
  }

  // 데이터가 2개 이상인 경우: 실제 간격 계산
  const intervals: number[] = [];
  for (let i = 1; i < orders.length; i++) {
    const prevDate = orders[i - 1].actualDelivery || orders[i - 1].createdAt;
    const currDate = orders[i].actualDelivery || orders[i].createdAt;
    const daysDiff = Math.floor(
      (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysDiff > 0) {
      intervals.push(daysDiff);
    }
  }

  // 평균 계산
  const averageCycleDays =
    intervals.length > 0
      ? Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length)
      : 30;

  const lastPurchaseDate =
    orders[orders.length - 1].actualDelivery || orders[orders.length - 1].createdAt;

  // 신뢰도 계산
  let confidence: "HIGH" | "MEDIUM" | "LOW";
  if (purchaseCount >= 5) {
    confidence = "HIGH";
  } else if (purchaseCount >= 3) {
    confidence = "MEDIUM";
  } else {
    confidence = "LOW";
  }

  return {
    catalogNumber,
    averageCycleDays,
    purchaseCount,
    lastPurchaseDate,
    confidence,
  };
}

// =====================================================
// [2] Decay Algorithm (추정): 시간 기반 잔여량 추정
// =====================================================

/**
 * 마지막 구매일로부터 경과 시간을 기반으로 현재 재고 상태를 추정합니다.
 *
 * Logic:
 * - estimatedPercentage = 100 - (daysSinceLastPurchase / averageCycleDays * 100)
 * - 음수인 경우 0으로 처리 (이미 기간 초과)
 * - 100을 초과하는 경우 100으로 제한 (아직 주기 시작 전)
 *
 * @param cycleData - calculatePurchaseCycle의 결과
 * @param now - 현재 시각 (테스트 용이성을 위해 파라미터로 전달)
 * @returns InventoryEstimation
 */
export function estimateInventoryStatus(
  cycleData: PurchaseCycleData,
  now: Date = new Date()
): InventoryEstimation {
  const { averageCycleDays, lastPurchaseDate, confidence } = cycleData;

  // 마지막 구매일이 없는 경우: UNKNOWN
  if (!lastPurchaseDate) {
    return {
      estimatedStatus: "UNKNOWN",
      estimatedPercentage: 0,
      daysSinceLastPurchase: 0,
      averageCycleDays,
      nextPurchaseDue: null,
      confidence,
      alertLevel: "NONE",
    };
  }

  // 경과 일수 계산
  const daysSinceLastPurchase = Math.floor(
    (now.getTime() - lastPurchaseDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // 잔여량 추정 (%)
  const rawPercentage = 100 - (daysSinceLastPurchase / averageCycleDays) * 100;
  const estimatedPercentage = Math.max(0, Math.min(100, rawPercentage));

  // 상태 매핑
  let estimatedStatus: EstimatedStatus;
  let alertLevel: "NONE" | "INFO" | "WARNING" | "CRITICAL";

  if (estimatedPercentage > 70) {
    estimatedStatus = "HIGH";
    alertLevel = "NONE";
  } else if (estimatedPercentage > 30) {
    estimatedStatus = "MEDIUM";
    alertLevel = "INFO";
  } else if (estimatedPercentage > 10) {
    estimatedStatus = "LOW";
    alertLevel = "WARNING";
  } else {
    estimatedStatus = "CRITICAL";
    alertLevel = "CRITICAL";
  }

  // 다음 구매 예상일 계산
  const nextPurchaseDue = new Date(lastPurchaseDate);
  nextPurchaseDue.setDate(nextPurchaseDue.getDate() + averageCycleDays);

  return {
    estimatedStatus,
    estimatedPercentage: Math.round(estimatedPercentage),
    daysSinceLastPurchase,
    averageCycleDays,
    nextPurchaseDue,
    confidence,
    alertLevel,
  };
}

// =====================================================
// [3] Batch Estimation (일괄 처리)
// =====================================================

/**
 * 사용자의 모든 인벤토리에 대해 재고 상태를 추정합니다.
 *
 * @param tx - Prisma Transaction Client
 * @param userId - 사용자 ID
 * @param inventories - 인벤토리 목록 (catalogNumber 필요)
 * @returns Map<inventoryId, InventoryEstimation>
 */
export async function batchEstimateInventoryStatus(
  tx: Prisma.TransactionClient,
  userId: string,
  inventories: Array<{ id: string; catalogNumber: string | null }>
): Promise<Map<string, InventoryEstimation>> {
  const estimationMap = new Map<string, InventoryEstimation>();

  // 고유한 카탈로그 번호 추출
  const uniqueCatalogNumbers = Array.from(
    new Set(
      inventories
        .map((inv) => inv.catalogNumber)
        .filter((cn): cn is string => cn !== null)
    )
  );

  // 카탈로그 번호별 구매 주기 계산 (병렬 처리)
  const cycleDataMap = new Map<string, PurchaseCycleData>();
  await Promise.all(
    uniqueCatalogNumbers.map(async (catalogNumber) => {
      const cycleData = await calculatePurchaseCycle(tx, userId, catalogNumber);
      cycleDataMap.set(catalogNumber, cycleData);
    })
  );

  // 각 인벤토리에 대해 추정
  const now = new Date();
  for (const inventory of inventories) {
    if (!inventory.catalogNumber) {
      // 카탈로그 번호가 없는 경우 UNKNOWN
      estimationMap.set(inventory.id, {
        estimatedStatus: "UNKNOWN",
        estimatedPercentage: 0,
        daysSinceLastPurchase: 0,
        averageCycleDays: 30,
        nextPurchaseDue: null,
        confidence: "LOW",
        alertLevel: "NONE",
      });
      continue;
    }

    const cycleData = cycleDataMap.get(inventory.catalogNumber);
    if (!cycleData) {
      // 데이터 없음 (이론적으로 발생하지 않음)
      estimationMap.set(inventory.id, {
        estimatedStatus: "UNKNOWN",
        estimatedPercentage: 0,
        daysSinceLastPurchase: 0,
        averageCycleDays: 30,
        nextPurchaseDue: null,
        confidence: "LOW",
        alertLevel: "NONE",
      });
      continue;
    }

    const estimation = estimateInventoryStatus(cycleData, now);
    estimationMap.set(inventory.id, estimation);
  }

  return estimationMap;
}

// =====================================================
// [4] Alert Message Generator (알림 메시지 생성)
// =====================================================

/**
 * 추정 결과를 기반으로 사용자에게 표시할 알림 메시지를 생성합니다.
 */
export function generateAlertMessage(estimation: InventoryEstimation, productName: string): string | null {
  const { estimatedStatus, estimatedPercentage, nextPurchaseDue, confidence } = estimation;

  if (estimatedStatus === "CRITICAL") {
    const dueDate = nextPurchaseDue ? nextPurchaseDue.toLocaleDateString("ko-KR") : "알 수 없음";
    return `🔴 [긴급] ${productName} - 재고 소진 예상 (${estimatedPercentage}% 남음). 예상 구매일: ${dueDate}. 지금 주문하지 않으면 실험이 중단될 수 있습니다!`;
  }

  if (estimatedStatus === "LOW") {
    const dueDate = nextPurchaseDue ? nextPurchaseDue.toLocaleDateString("ko-KR") : "알 수 없음";
    return `🟠 [경고] ${productName} - 재고가 부족합니다 (${estimatedPercentage}% 남음). 예상 구매일: ${dueDate}. 조만간 주문을 고려하세요.`;
  }

  if (estimatedStatus === "MEDIUM" && confidence !== "LOW") {
    return `🟡 [정보] ${productName} - 재고가 절반 이하입니다 (${estimatedPercentage}% 남음). 벌써 다 쓰셨나요?`;
  }

  // HIGH 또는 신뢰도가 낮은 경우: 알림 없음
  return null;
}
