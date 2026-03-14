/**
 * Inventory Restock / Lot Risk Detection Service
 *
 * 재고 부족 및 유효기한 위험 품목을 자동 감지하여 AiActionItem을 생성합니다.
 *
 * 감지 대상:
 *   1. REORDER_SUGGESTION: currentQuantity <= safetyStock, 소진 예상일 계산
 *   2. EXPIRY_ALERT: lot 유효기한 30일 이내 임박
 *
 * 설계 원칙:
 *   - 자동 발주 절대 금지 → 제안(PENDING)까지만 수행
 *   - 동일 품목+사유에 대한 중복 Task 생성 방지
 *   - Lot 위험으로 인한 실질 가용 재고 감소분을 재발주 수량에 반영
 */

import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { createActivityLog, getActorRole } from "@/lib/activity-log";

// ── Configuration ──

/** 유효기한 위험 판단 기준 (일) */
const EXPIRY_WARNING_DAYS = 30;
/** 한 번에 감지할 최대 품목 수 */
const DETECTION_BATCH_SIZE = 100;

// ── Types ──

export interface RestockCandidate {
  inventoryId: string;
  productName: string;
  brand: string | null;
  catalogNumber: string | null;
  currentQuantity: number;
  safetyStock: number;
  unit: string;
  location: string | null;
  userId: string;
  organizationId: string | null;
  /** 일평균 사용량 */
  averageDailyUsage: number;
  /** 예상 소진 일수 (0 이하 = 이미 부족) */
  estimatedDepletionDays: number;
  /** 권장 발주 수량 */
  recommendedQty: number;
  /** 긴급도 */
  urgency: "urgent" | "high" | "medium";
  /** 추천 벤더 */
  suggestedVendor: string | null;
  suggestedVendorPrice: number | null;
  /** Lot 위험 카운트 */
  lotRiskCount: number;
  /** 유효기한 위험 여부 */
  expiryRisk: boolean;
  /** 만료 임박 lot으로 인한 실질 부족분 */
  expiryAdjustedShortfall: number;
  /** 최소 주문 수량 */
  minOrderQty: number;
  /** 리드타임 (일) */
  leadTimeDays: number | null;
}

export interface ExpiryCandidate {
  inventoryId: string;
  productName: string;
  brand: string | null;
  lotNumber: string | null;
  expiryDate: Date;
  daysUntilExpiry: number;
  currentQuantity: number;
  unit: string;
  location: string | null;
  userId: string;
  organizationId: string | null;
  /** 해당 lot 수량 (전체가 아닌 만료 임박 lot 분) */
  atRiskQuantity: number;
  /** 권장 조치 */
  suggestedAction: "prioritize_use" | "dispose" | "inspect";
}

export interface DetectionResult {
  restockCandidates: RestockCandidate[];
  expiryCandidates: ExpiryCandidate[];
  actionsCreated: number;
  skippedDuplicate: number;
  errors: string[];
}

// ── Detection Logic ──

/**
 * 재고 부족 및 유효기한 위험 품목 감지 후 AiActionItem 생성
 */
export async function detectInventoryIssues(
  triggerUserId?: string | null,
  organizationId?: string | null
): Promise<DetectionResult> {
  const result: DetectionResult = {
    restockCandidates: [],
    expiryCandidates: [],
    actionsCreated: 0,
    skippedDuplicate: 0,
    errors: [],
  };

  try {
    // 1. 재고 부족 감지
    const restockCandidates = await findRestockCandidates(organizationId);
    result.restockCandidates = restockCandidates;

    for (const candidate of restockCandidates) {
      try {
        const created = await createRestockAction(candidate, triggerUserId);
        if (created) result.actionsCreated++;
        else result.skippedDuplicate++;
      } catch (err) {
        result.errors.push(`Restock ${candidate.productName}: ${String(err)}`);
      }
    }

    // 2. 유효기한 위험 감지
    const expiryCandidates = await findExpiryCandidates(organizationId);
    result.expiryCandidates = expiryCandidates;

    for (const candidate of expiryCandidates) {
      try {
        const created = await createExpiryAction(candidate, triggerUserId);
        if (created) result.actionsCreated++;
        else result.skippedDuplicate++;
      } catch (err) {
        result.errors.push(`Expiry ${candidate.productName}: ${String(err)}`);
      }
    }
  } catch (err) {
    result.errors.push(`Detection failed: ${String(err)}`);
  }

  return result;
}

/**
 * 재고 부족 후보 조회
 *
 * 조건: currentQuantity <= safetyStock AND safetyStock > 0
 */
async function findRestockCandidates(
  organizationId?: string | null
): Promise<RestockCandidate[]> {
  const where: Prisma.ProductInventoryWhereInput = {
    safetyStock: { gt: 0 },
    ...(organizationId ? { organizationId } : {}),
  };

  const inventories = await db.productInventory.findMany({
    where,
    take: DETECTION_BATCH_SIZE,
    include: {
      product: {
        select: {
          name: true,
          nameEn: true,
          brand: true,
          catalogNumber: true,
          vendors: {
            include: { vendor: true },
            take: 1,
            orderBy: { priceInKRW: "asc" },
          },
        },
      },
      usageRecords: {
        orderBy: { usageDate: "desc" },
        take: 30,
        select: { quantity: true, usageDate: true },
      },
      restockRecords: {
        where: {
          expiryDate: {
            lte: new Date(Date.now() + EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000),
            gte: new Date(),
          },
        },
        select: { quantity: true, expiryDate: true, lotNumber: true },
      },
    },
  });

  const candidates: RestockCandidate[] = [];
  const now = new Date();

  for (const inv of inventories) {
    const currentQty = inv.currentQuantity;
    const safetyStock = inv.safetyStock || 0;

    // 현재 수량이 safety stock 이하인 경우만
    if (currentQty > safetyStock) continue;

    // 일평균 사용량 계산
    let avgDailyUsage = inv.averageDailyUsage || 0;
    if (inv.usageRecords.length > 0) {
      const totalUsage = inv.usageRecords.reduce(
        (sum: number, rec: { quantity: number }) => sum + rec.quantity,
        0
      );
      const oldestRecord = inv.usageRecords[inv.usageRecords.length - 1] as { usageDate: Date };
      const days = Math.max(
        1,
        Math.floor(
          (now.getTime() - oldestRecord.usageDate.getTime()) / (1000 * 60 * 60 * 24)
        )
      );
      avgDailyUsage = totalUsage / days;
    }

    // 소진 예상일
    const estimatedDepletionDays = avgDailyUsage > 0
      ? Math.floor(currentQty / avgDailyUsage)
      : currentQty <= 0 ? 0 : 999;

    // Lot 위험 수량 (만료 임박 lot의 총 수량)
    const expiryRiskLots = inv.restockRecords || [];
    const lotRiskCount = expiryRiskLots.length;
    const expiryRiskQty = expiryRiskLots.reduce(
      (sum: number, lot: { quantity: number }) => sum + lot.quantity,
      0
    );

    // 실질 가용 재고 = 현재 재고 - 만료 임박 lot 수량
    const effectiveStock = Math.max(0, currentQty - expiryRiskQty);
    const expiryAdjustedShortfall = Math.max(0, safetyStock - effectiveStock);

    // 권장 발주 수량 = 안전재고 + 1개월 예상 사용량 - 실질 가용 재고
    const monthlyUsage = avgDailyUsage * 30;
    const recommendedQty = Math.max(
      inv.minOrderQty || 1,
      Math.ceil(safetyStock + monthlyUsage - effectiveStock)
    );

    // 긴급도
    let urgency: "urgent" | "high" | "medium" = "medium";
    if (currentQty <= 0 || estimatedDepletionDays <= 0) urgency = "urgent";
    else if (currentQty <= safetyStock * 0.5 || estimatedDepletionDays <= 7) urgency = "high";

    // 추천 벤더
    const topVendor = inv.product?.vendors?.[0];

    candidates.push({
      inventoryId: inv.id,
      productName: inv.product?.name || "알 수 없는 품목",
      brand: inv.product?.brand || null,
      catalogNumber: inv.product?.catalogNumber || null,
      currentQuantity: currentQty,
      safetyStock,
      unit: inv.unit || "ea",
      location: inv.location,
      userId: inv.userId,
      organizationId: inv.organizationId,
      averageDailyUsage: Math.round(avgDailyUsage * 100) / 100,
      estimatedDepletionDays,
      recommendedQty,
      urgency,
      suggestedVendor: topVendor?.vendor?.name || null,
      suggestedVendorPrice: topVendor?.priceInKRW || null,
      lotRiskCount,
      expiryRisk: lotRiskCount > 0,
      expiryAdjustedShortfall,
      minOrderQty: inv.minOrderQty || 1,
      leadTimeDays: inv.leadTimeDays,
    });
  }

  // 긴급도 순 정렬
  candidates.sort((a, b) => {
    const order = { urgent: 0, high: 1, medium: 2 };
    return order[a.urgency] - order[b.urgency];
  });

  return candidates;
}

/**
 * 유효기한 임박 후보 조회
 */
async function findExpiryCandidates(
  organizationId?: string | null
): Promise<ExpiryCandidate[]> {
  const expiryThreshold = new Date(
    Date.now() + EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000
  );
  const now = new Date();

  // ProductInventory 자체에 expiryDate가 있는 경우
  const inventories = await db.productInventory.findMany({
    where: {
      expiryDate: { lte: expiryThreshold, gte: now },
      ...(organizationId ? { organizationId } : {}),
    },
    take: DETECTION_BATCH_SIZE,
    include: {
      product: {
        select: { name: true, brand: true, catalogNumber: true },
      },
    },
  });

  const candidates: ExpiryCandidate[] = [];

  for (const inv of inventories) {
    if (!inv.expiryDate) continue;

    const daysUntilExpiry = Math.floor(
      (inv.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    let suggestedAction: "prioritize_use" | "dispose" | "inspect" = "prioritize_use";
    if (daysUntilExpiry <= 7) suggestedAction = "dispose";
    else if (daysUntilExpiry <= 14) suggestedAction = "inspect";

    candidates.push({
      inventoryId: inv.id,
      productName: inv.product?.name || "알 수 없는 품목",
      brand: inv.product?.brand || null,
      lotNumber: inv.lotNumber,
      expiryDate: inv.expiryDate,
      daysUntilExpiry,
      currentQuantity: inv.currentQuantity,
      unit: inv.unit || "ea",
      location: inv.location,
      userId: inv.userId,
      organizationId: inv.organizationId,
      atRiskQuantity: inv.currentQuantity, // 전체 수량이 위험
      suggestedAction,
    });
  }

  // 임박 순 정렬
  candidates.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

  return candidates;
}

/**
 * 재발주 제안 AiActionItem 생성 (중복 방지)
 */
async function createRestockAction(
  candidate: RestockCandidate,
  triggerUserId?: string | null
): Promise<boolean> {
  // 중복 체크
  const existing = await db.aiActionItem.findFirst({
    where: {
      type: "REORDER_SUGGESTION",
      status: "PENDING",
      relatedEntityType: "INVENTORY",
      relatedEntityId: candidate.inventoryId,
    },
    select: { id: true },
  });
  if (existing) return false;

  const priority = candidate.urgency === "urgent" ? "HIGH"
    : candidate.urgency === "high" ? "HIGH"
    : "MEDIUM";

  const actionItem = await db.aiActionItem.create({
    data: {
      type: "REORDER_SUGGESTION",
      status: "PENDING",
      priority: priority as "HIGH" | "MEDIUM" | "LOW",
      userId: candidate.userId,
      organizationId: candidate.organizationId,
      title: `${candidate.productName} 재발주 필요`,
      description: candidate.estimatedDepletionDays <= 0
        ? `재고 소진 · 현재 ${candidate.currentQuantity}${candidate.unit} / 안전재고 ${candidate.safetyStock}${candidate.unit}`
        : `소진 예상 ${candidate.estimatedDepletionDays}일 · 현재 ${candidate.currentQuantity}${candidate.unit}`,
      payload: {
        inventoryId: candidate.inventoryId,
        productName: candidate.productName,
        brand: candidate.brand,
        catalogNumber: candidate.catalogNumber,
        currentStock: candidate.currentQuantity,
        safetyStock: candidate.safetyStock,
        unit: candidate.unit,
        averageDailyUsage: candidate.averageDailyUsage,
        estimatedDepletionDays: candidate.estimatedDepletionDays,
        recommendedOrderQty: candidate.recommendedQty,
        minOrderQty: candidate.minOrderQty,
        leadTimeDays: candidate.leadTimeDays,
        suggestedVendor: candidate.suggestedVendor,
        suggestedVendorPrice: candidate.suggestedVendorPrice,
        lotRiskCount: candidate.lotRiskCount,
        expiryRisk: candidate.expiryRisk,
        expiryAdjustedShortfall: candidate.expiryAdjustedShortfall,
        urgency: candidate.urgency,
        location: candidate.location,
      } as unknown as Prisma.JsonObject,
      relatedEntityType: "INVENTORY",
      relatedEntityId: candidate.inventoryId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  // 활동 로그
  const actorRole = await getActorRole(candidate.userId, candidate.organizationId);
  await createActivityLog({
    activityType: "INVENTORY_RESTOCK_SUGGESTED",
    entityType: "INVENTORY",
    entityId: candidate.inventoryId,
    taskType: "REORDER_SUGGESTION",
    afterStatus: "PENDING",
    userId: triggerUserId || candidate.userId,
    organizationId: candidate.organizationId,
    actorRole: triggerUserId ? null : actorRole,
    metadata: {
      actionItemId: actionItem.id,
      productName: candidate.productName,
      currentStock: candidate.currentQuantity,
      safetyStock: candidate.safetyStock,
      recommendedQty: candidate.recommendedQty,
      estimatedDepletionDays: candidate.estimatedDepletionDays,
      urgency: candidate.urgency,
      trigger: triggerUserId ? "manual" : "cron",
    },
  });

  return true;
}

/**
 * 유효기한 경고 AiActionItem 생성 (중복 방지)
 */
async function createExpiryAction(
  candidate: ExpiryCandidate,
  triggerUserId?: string | null
): Promise<boolean> {
  const existing = await db.aiActionItem.findFirst({
    where: {
      type: "EXPIRY_ALERT",
      status: "PENDING",
      relatedEntityType: "INVENTORY",
      relatedEntityId: candidate.inventoryId,
    },
    select: { id: true },
  });
  if (existing) return false;

  const priority = candidate.daysUntilExpiry <= 7 ? "HIGH"
    : candidate.daysUntilExpiry <= 14 ? "HIGH"
    : "MEDIUM";

  const actionLabels = {
    prioritize_use: "우선 사용 권장",
    dispose: "폐기 검토 필요",
    inspect: "품질 검사 필요",
  };

  const actionItem = await db.aiActionItem.create({
    data: {
      type: "EXPIRY_ALERT",
      status: "PENDING",
      priority: priority as "HIGH" | "MEDIUM" | "LOW",
      userId: candidate.userId,
      organizationId: candidate.organizationId,
      title: `${candidate.productName} 유효기한 임박 (D-${candidate.daysUntilExpiry})`,
      description: `${candidate.lotNumber ? `Lot ${candidate.lotNumber} · ` : ""}만료 ${candidate.expiryDate.toLocaleDateString("ko-KR")} · ${actionLabels[candidate.suggestedAction]}`,
      payload: {
        inventoryId: candidate.inventoryId,
        productName: candidate.productName,
        brand: candidate.brand,
        lotNumber: candidate.lotNumber,
        expiryDate: candidate.expiryDate.toISOString(),
        daysUntilExpiry: candidate.daysUntilExpiry,
        currentQuantity: candidate.currentQuantity,
        atRiskQuantity: candidate.atRiskQuantity,
        unit: candidate.unit,
        location: candidate.location,
        suggestedAction: candidate.suggestedAction,
      } as unknown as Prisma.JsonObject,
      relatedEntityType: "INVENTORY",
      relatedEntityId: candidate.inventoryId,
      expiresAt: candidate.expiryDate, // 만료일에 자동 만료
    },
  });

  // 활동 로그 — INVENTORY_RESTOCK_SUGGESTED 재활용 (expiry variant)
  await createActivityLog({
    activityType: "INVENTORY_RESTOCK_SUGGESTED",
    entityType: "INVENTORY",
    entityId: candidate.inventoryId,
    taskType: "EXPIRY_ALERT",
    afterStatus: "PENDING",
    userId: triggerUserId || candidate.userId,
    organizationId: candidate.organizationId,
    metadata: {
      actionItemId: actionItem.id,
      productName: candidate.productName,
      lotNumber: candidate.lotNumber,
      daysUntilExpiry: candidate.daysUntilExpiry,
      suggestedAction: candidate.suggestedAction,
      trigger: triggerUserId ? "manual" : "cron",
    },
  });

  return true;
}
