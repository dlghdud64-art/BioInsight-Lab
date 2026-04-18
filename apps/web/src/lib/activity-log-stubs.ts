/**
 * Activity Log Write Point Stubs — 주문/재고 확장 준비
 *
 * 견적 흐름 검증 완료 후, 아래 함수들을 각 API 엔드포인트에 연결한다.
 * 현재는 인터페이스만 정의하고 실제 구현은 P1/P1+ 스프린트에서 수행.
 *
 * ⚠️ 이 파일의 함수는 아직 어디에서도 호출되지 않음.
 *    연동 시점: 해당 API 라우트에 import → 적절한 위치에서 await 호출
 */

import { createActivityLog, getActorRole } from "@/lib/activity-log";
import { extractRequestMeta } from "@/lib/audit";

// ═══════════════════════════════════════════
// 주문 (Order) 확장 — P1+
// ═══════════════════════════════════════════

/**
 * 주문 후속 이메일 초안 생성
 * 연결 지점: POST /api/ai-actions/generate/order-followup (미구현)
 */
export async function logOrderFollowupGenerated(params: {
  entityId: string;
  userId: string;
  organizationId?: string | null;
  orderId: string;
  vendorName: string;
  request: { headers: { get: (k: string) => string | null } };
}) {
  const { ipAddress, userAgent } = extractRequestMeta(params.request);
  const actorRole = await getActorRole(params.userId, params.organizationId);
  await createActivityLog({
    activityType: "ORDER_FOLLOWUP_GENERATED",
    entityType: "AI_ACTION",
    entityId: params.entityId,
    taskType: "FOLLOWUP_DRAFT",
    afterStatus: "PENDING",
    userId: params.userId,
    organizationId: params.organizationId,
    actorRole,
    metadata: { orderId: params.orderId, vendorName: params.vendorName },
    ipAddress,
    userAgent,
  });
}

/**
 * 주문 상태 변경 제안
 * 연결 지점: 벤더 회신 파싱 후 AiActionItem 생성 시
 */
export async function logOrderStatusChangeProposed(params: {
  entityId: string;
  userId: string;
  organizationId?: string | null;
  orderId: string;
  proposedStatus: string;
  reason: string;
  request: { headers: { get: (k: string) => string | null } };
}) {
  const { ipAddress, userAgent } = extractRequestMeta(params.request);
  const actorRole = await getActorRole(params.userId, params.organizationId);
  await createActivityLog({
    activityType: "ORDER_STATUS_CHANGE_PROPOSED",
    entityType: "AI_ACTION",
    entityId: params.entityId,
    taskType: "STATUS_CHANGE_SUGGEST",
    afterStatus: "PENDING",
    userId: params.userId,
    organizationId: params.organizationId,
    actorRole,
    metadata: {
      orderId: params.orderId,
      proposedStatus: params.proposedStatus,
      reason: params.reason,
    },
    ipAddress,
    userAgent,
  });
}

/**
 * 주문 상태 변경 승인
 * 연결 지점: POST /api/ai-actions/[id]/approve (type=STATUS_CHANGE_SUGGEST 분기)
 */
export async function logOrderStatusChangeApproved(params: {
  entityId: string;
  userId: string;
  organizationId?: string | null;
  orderId: string;
  beforeStatus: string;
  afterStatus: string;
  request: { headers: { get: (k: string) => string | null } };
}) {
  const { ipAddress, userAgent } = extractRequestMeta(params.request);
  const actorRole = await getActorRole(params.userId, params.organizationId);
  await createActivityLog({
    activityType: "ORDER_STATUS_CHANGE_APPROVED",
    entityType: "AI_ACTION",
    entityId: params.entityId,
    taskType: "STATUS_CHANGE_SUGGEST",
    beforeStatus: params.beforeStatus,
    afterStatus: params.afterStatus,
    userId: params.userId,
    organizationId: params.organizationId,
    actorRole,
    metadata: { orderId: params.orderId },
    ipAddress,
    userAgent,
  });
}

// ═══════════════════════════════════════════
// 재고 (Inventory) 확장 — P1
// ═══════════════════════════════════════════

/**
 * 재발주 제안 생성
 * 연결 지점: POST /api/ai-actions/generate/reorder-suggestions (미구현)
 */
export async function logInventoryRestockSuggested(params: {
  entityId: string;
  userId: string;
  organizationId?: string | null;
  inventoryItemId: string;
  recommendedQty: number;
  estimatedDepletionDays: number;
  request: { headers: { get: (k: string) => string | null } };
}) {
  const { ipAddress, userAgent } = extractRequestMeta(params.request);
  const actorRole = await getActorRole(params.userId, params.organizationId);
  await createActivityLog({
    activityType: "INVENTORY_RESTOCK_SUGGESTED",
    entityType: "AI_ACTION",
    entityId: params.entityId,
    taskType: "REORDER_SUGGESTION",
    afterStatus: "PENDING",
    userId: params.userId,
    organizationId: params.organizationId,
    actorRole,
    metadata: {
      inventoryItemId: params.inventoryItemId,
      recommendedQty: params.recommendedQty,
      estimatedDepletionDays: params.estimatedDepletionDays,
    },
    ipAddress,
    userAgent,
  });
}

/**
 * 재발주 제안 검토 (승인/무시)
 * 연결 지점: POST /api/ai-actions/[id]/approve (type=REORDER_SUGGESTION 분기)
 */
export async function logInventoryRestockReviewed(params: {
  entityId: string;
  userId: string;
  organizationId?: string | null;
  decision: "APPROVED" | "DISMISSED";
  inventoryItemId: string;
  request: { headers: { get: (k: string) => string | null } };
}) {
  const { ipAddress, userAgent } = extractRequestMeta(params.request);
  const actorRole = await getActorRole(params.userId, params.organizationId);
  await createActivityLog({
    activityType: "INVENTORY_RESTOCK_REVIEWED",
    entityType: "AI_ACTION",
    entityId: params.entityId,
    taskType: "REORDER_SUGGESTION",
    beforeStatus: "PENDING",
    afterStatus: params.decision,
    userId: params.userId,
    organizationId: params.organizationId,
    actorRole,
    metadata: {
      decision: params.decision,
      inventoryItemId: params.inventoryItemId,
    },
    ipAddress,
    userAgent,
  });
}

/**
 * 구매 요청 생성 (재발주 승인 후)
 * 연결 지점: 재발주 승인 실행 로직 내부
 */
export async function logPurchaseRequestCreated(params: {
  entityId: string;
  userId: string;
  organizationId?: string | null;
  purchaseRequestId: string;
  itemCount: number;
  totalAmount: number;
  request: { headers: { get: (k: string) => string | null } };
}) {
  const { ipAddress, userAgent } = extractRequestMeta(params.request);
  const actorRole = await getActorRole(params.userId, params.organizationId);
  await createActivityLog({
    activityType: "PURCHASE_REQUEST_CREATED",
    entityType: "PURCHASE_REQUEST",
    entityId: params.purchaseRequestId,
    afterStatus: "PENDING",
    userId: params.userId,
    organizationId: params.organizationId,
    actorRole,
    metadata: {
      sourceEntityId: params.entityId,
      itemCount: params.itemCount,
      totalAmount: params.totalAmount,
    },
    ipAddress,
    userAgent,
  });
}
