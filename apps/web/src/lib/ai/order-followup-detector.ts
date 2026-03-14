/**
 * Order Follow-up Detection Service
 *
 * 회신 지연 주문을 자동 감지하여 AiActionItem(FOLLOWUP_DRAFT)을 생성합니다.
 *
 * 대상 조건:
 *   1. 주문 상태가 ORDERED 또는 CONFIRMED
 *   2. 마지막 회신(VendorRequest.respondedAt) 이후 N일 경과, 또는 회신 자체가 없음
 *   3. 동일 주문에 대한 PENDING FOLLOWUP_DRAFT가 이미 없음 (중복 방지)
 *
 * 설계 원칙:
 *   - 외부 발송 자동화 절대 금지 → 초안 생성(PENDING)까지만 수행
 *   - 승인/발송은 반드시 Human-in-the-Loop 경로를 통과
 */

import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { createActivityLog, getActorRole } from "@/lib/activity-log";

// ── Configuration ──

/** 주문 후 최초 follow-up 까지 대기일 */
const INITIAL_FOLLOWUP_DAYS = 3;
/** 마지막 회신 후 재 follow-up 까지 대기일 */
const RE_FOLLOWUP_DAYS = 5;
/** 한 번에 감지할 최대 주문 수 */
const DETECTION_BATCH_SIZE = 50;

// ── Types ──

export interface FollowupCandidate {
  orderId: string;
  orderNumber: string;
  userId: string;
  organizationId: string | null;
  status: string;
  totalAmount: number;
  createdAt: Date;
  daysSinceOrder: number;
  daysSinceLastReply: number | null;
  vendorName: string | null;
  vendorEmail: string | null;
  quoteId: string;
  quoteTitle: string | null;
  itemCount: number;
  items: Array<{
    name: string;
    brand: string | null;
    catalogNumber: string | null;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  /** 확인이 필요한 항목 목록 */
  pendingChecks: string[];
}

export interface DetectionResult {
  candidates: FollowupCandidate[];
  actionsCreated: number;
  skippedDuplicate: number;
  errors: string[];
}

// ── Detection Logic ──

/**
 * Follow-up 대상 주문을 탐지하고 AiActionItem(FOLLOWUP_DRAFT)을 생성합니다.
 *
 * @param triggerUserId  크론 트리거 또는 수동 호출 사용자 ID (null = 시스템)
 * @param organizationId 특정 조직으로 범위 제한 (null = 전체)
 */
export async function detectAndCreateFollowups(
  triggerUserId?: string | null,
  organizationId?: string | null
): Promise<DetectionResult> {
  const result: DetectionResult = {
    candidates: [],
    actionsCreated: 0,
    skippedDuplicate: 0,
    errors: [],
  };

  try {
    // 1. Follow-up 대상 주문 조회
    const candidates = await findFollowupCandidates(organizationId);
    result.candidates = candidates;

    // 2. 각 후보에 대해 AiActionItem 생성 (중복 체크 포함)
    for (const candidate of candidates) {
      try {
        const created = await createFollowupAction(candidate, triggerUserId);
        if (created) {
          result.actionsCreated++;
        } else {
          result.skippedDuplicate++;
        }
      } catch (err) {
        result.errors.push(
          `Order ${candidate.orderNumber}: ${String(err)}`
        );
      }
    }
  } catch (err) {
    result.errors.push(`Detection failed: ${String(err)}`);
  }

  return result;
}

/**
 * Follow-up 대상 주문 조회
 *
 * 조건:
 *   - status IN (ORDERED, CONFIRMED)
 *   - 주문일로부터 INITIAL_FOLLOWUP_DAYS일 경과
 *   - 마지막 벤더 회신 이후 RE_FOLLOWUP_DAYS일 경과 (또는 회신 없음)
 */
async function findFollowupCandidates(
  organizationId?: string | null
): Promise<FollowupCandidate[]> {
  const now = new Date();
  const initialThreshold = new Date(
    now.getTime() - INITIAL_FOLLOWUP_DAYS * 24 * 60 * 60 * 1000
  );

  const where: Prisma.OrderWhereInput = {
    status: { in: ["ORDERED", "CONFIRMED"] },
    createdAt: { lte: initialThreshold },
    ...(organizationId ? { organizationId } : {}),
  };

  const orders = await db.order.findMany({
    where,
    take: DETECTION_BATCH_SIZE,
    orderBy: { createdAt: "asc" }, // 오래된 주문 우선
    include: {
      items: true,
      quote: {
        select: {
          id: true,
          title: true,
          vendorRequests: {
            select: {
              id: true,
              vendorName: true,
              vendorEmail: true,
              status: true,
              respondedAt: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });

  const candidates: FollowupCandidate[] = [];

  for (const order of orders) {
    const daysSinceOrder = Math.floor(
      (now.getTime() - order.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    // 벤더 요청에서 최신 회신일 계산
    type VendorReqRow = { id: string; vendorName: string | null; vendorEmail: string | null; status: string; respondedAt: Date | null; createdAt: Date };
    const vendorRequests: VendorReqRow[] = order.quote?.vendorRequests || [];
    const latestReply = vendorRequests
      .filter((vr: VendorReqRow) => vr.respondedAt)
      .sort((a: VendorReqRow, b: VendorReqRow) =>
        (b.respondedAt?.getTime() || 0) - (a.respondedAt?.getTime() || 0)
      )[0];

    let daysSinceLastReply: number | null = null;
    if (latestReply?.respondedAt) {
      daysSinceLastReply = Math.floor(
        (now.getTime() - latestReply.respondedAt.getTime()) /
          (1000 * 60 * 60 * 24)
      );
      // 회신이 있었고, 아직 RE_FOLLOWUP_DAYS가 지나지 않았으면 스킵
      if (daysSinceLastReply < RE_FOLLOWUP_DAYS) continue;
    }

    // 확인이 필요한 항목 리스트 생성
    const pendingChecks: string[] = [];
    const sentRequests = vendorRequests.filter((vr: VendorReqRow) => vr.status === "SENT");
    const repliedRequests = vendorRequests.filter((vr: VendorReqRow) => vr.respondedAt);

    if (sentRequests.length > 0 && repliedRequests.length === 0) {
      pendingChecks.push("벤더 회신 없음");
    }
    if (order.status === "ORDERED") {
      pendingChecks.push("주문 확인 대기");
    }
    if (!order.expectedDelivery) {
      pendingChecks.push("납기일 미확인");
    }
    if (order.expectedDelivery && order.expectedDelivery < now) {
      pendingChecks.push("납기일 초과");
    }

    // 대표 벤더 정보
    const primaryVendor = vendorRequests[0];

    candidates.push({
      orderId: order.id,
      orderNumber: order.orderNumber,
      userId: order.userId,
      organizationId: order.organizationId,
      status: order.status,
      totalAmount: order.totalAmount,
      createdAt: order.createdAt,
      daysSinceOrder,
      daysSinceLastReply,
      vendorName: primaryVendor?.vendorName || null,
      vendorEmail: primaryVendor?.vendorEmail || null,
      quoteId: order.quoteId,
      quoteTitle: order.quote?.title || null,
      itemCount: order.items.length,
      items: order.items.map((item: { name: string; brand: string | null; catalogNumber: string | null; quantity: number; unitPrice: number; lineTotal: number }) => ({
        name: item.name,
        brand: item.brand,
        catalogNumber: item.catalogNumber,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
      })),
      pendingChecks,
    });
  }

  return candidates;
}

/**
 * 단일 후보에 대해 AiActionItem(FOLLOWUP_DRAFT) 생성
 *
 * 중복 방지: 동일 orderId에 PENDING인 FOLLOWUP_DRAFT가 이미 존재하면 건너뜀.
 * @returns true = 생성됨, false = 중복으로 건너뜀
 */
async function createFollowupAction(
  candidate: FollowupCandidate,
  triggerUserId?: string | null
): Promise<boolean> {
  // 중복 체크: 동일 주문에 대한 PENDING FOLLOWUP_DRAFT 존재 여부
  const existingPending = await db.aiActionItem.findFirst({
    where: {
      type: "FOLLOWUP_DRAFT",
      status: "PENDING",
      relatedEntityType: "ORDER",
      relatedEntityId: candidate.orderId,
    },
    select: { id: true },
  });

  if (existingPending) return false;

  // 우선순위 결정
  let priority: "HIGH" | "MEDIUM" | "LOW" = "MEDIUM";
  if (candidate.daysSinceOrder >= 7 || candidate.pendingChecks.includes("납기일 초과")) {
    priority = "HIGH";
  } else if (candidate.daysSinceOrder <= 4) {
    priority = "LOW";
  }

  const delayDesc = candidate.daysSinceLastReply != null
    ? `마지막 회신 후 ${candidate.daysSinceLastReply}일 경과`
    : `주문 후 ${candidate.daysSinceOrder}일 경과, 회신 없음`;

  const actionItem = await db.aiActionItem.create({
    data: {
      type: "FOLLOWUP_DRAFT",
      status: "PENDING",
      priority,
      userId: candidate.userId,
      organizationId: candidate.organizationId,
      title: `${candidate.vendorName || "벤더"} Follow-up — ${candidate.orderNumber}`,
      description: `${delayDesc} · ${candidate.pendingChecks.join(", ") || "진행 상황 확인 필요"}`,
      payload: {
        orderId: candidate.orderId,
        orderNumber: candidate.orderNumber,
        quoteId: candidate.quoteId,
        quoteTitle: candidate.quoteTitle,
        vendorName: candidate.vendorName,
        vendorEmail: candidate.vendorEmail,
        daysSinceOrder: candidate.daysSinceOrder,
        daysSinceLastReply: candidate.daysSinceLastReply,
        totalAmount: candidate.totalAmount,
        itemCount: candidate.itemCount,
        items: candidate.items,
        pendingChecks: candidate.pendingChecks,
        status: candidate.status,
      } as unknown as Prisma.JsonObject,
      relatedEntityType: "ORDER",
      relatedEntityId: candidate.orderId,
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14일 유효
    },
  });

  // 활동 로그: Follow-up 감지
  const actorRole = await getActorRole(
    candidate.userId,
    candidate.organizationId
  );
  await createActivityLog({
    activityType: "ORDER_FOLLOWUP_GENERATED",
    entityType: "ORDER",
    entityId: candidate.orderId,
    taskType: "FOLLOWUP_DRAFT",
    afterStatus: "PENDING",
    userId: triggerUserId || candidate.userId,
    organizationId: candidate.organizationId,
    actorRole: triggerUserId ? null : actorRole, // 시스템 트리거면 역할 없음
    metadata: {
      actionItemId: actionItem.id,
      orderNumber: candidate.orderNumber,
      vendorName: candidate.vendorName,
      daysSinceOrder: candidate.daysSinceOrder,
      daysSinceLastReply: candidate.daysSinceLastReply,
      pendingChecks: candidate.pendingChecks,
      trigger: triggerUserId ? "manual" : "cron",
    },
  });

  return true;
}

/**
 * 단일 주문에 대해 수동으로 follow-up 탐지 및 생성
 * (대시보드 또는 AI 패널에서 "Follow-up 초안 생성" 버튼 클릭 시 호출)
 */
export async function createFollowupForOrder(
  orderId: string,
  userId: string
): Promise<{ actionItem: { id: string; title: string } | null; skipped: boolean }> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      quote: {
        select: {
          id: true,
          title: true,
          vendorRequests: {
            select: {
              vendorName: true,
              vendorEmail: true,
              status: true,
              respondedAt: true,
            },
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });

  if (!order) throw new Error("ORDER_NOT_FOUND");

  // 중복 체크
  const existingPending = await db.aiActionItem.findFirst({
    where: {
      type: "FOLLOWUP_DRAFT",
      status: "PENDING",
      relatedEntityType: "ORDER",
      relatedEntityId: orderId,
    },
    select: { id: true, title: true },
  });

  if (existingPending) {
    return { actionItem: existingPending, skipped: true };
  }

  const now = new Date();
  const daysSinceOrder = Math.floor(
    (now.getTime() - order.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  type VR = { vendorName: string | null; vendorEmail: string | null; status: string; respondedAt: Date | null };
  const vendorRequests: VR[] = order.quote?.vendorRequests || [];
  const primaryVendor = vendorRequests[0];

  const latestReply = vendorRequests
    .filter((vr: VR) => vr.respondedAt)
    .sort((a: VR, b: VR) =>
      (b.respondedAt?.getTime() || 0) - (a.respondedAt?.getTime() || 0)
    )[0];

  const daysSinceLastReply = latestReply?.respondedAt
    ? Math.floor(
        (now.getTime() - latestReply.respondedAt.getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : null;

  const pendingChecks: string[] = [];
  if (!latestReply) pendingChecks.push("벤더 회신 없음");
  if (order.status === "ORDERED") pendingChecks.push("주문 확인 대기");
  if (!order.expectedDelivery) pendingChecks.push("납기일 미확인");

  const candidate: FollowupCandidate = {
    orderId: order.id,
    orderNumber: order.orderNumber,
    userId: order.userId,
    organizationId: order.organizationId,
    status: order.status,
    totalAmount: order.totalAmount,
    createdAt: order.createdAt,
    daysSinceOrder,
    daysSinceLastReply,
    vendorName: primaryVendor?.vendorName || null,
    vendorEmail: primaryVendor?.vendorEmail || null,
    quoteId: order.quoteId,
    quoteTitle: order.quote?.title || null,
    itemCount: order.items.length,
    items: order.items.map((item: { name: string; brand: string | null; catalogNumber: string | null; quantity: number; unitPrice: number; lineTotal: number }) => ({
      name: item.name,
      brand: item.brand,
      catalogNumber: item.catalogNumber,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
    })),
    pendingChecks,
  };

  const created = await createFollowupAction(candidate, userId);
  if (!created) return { actionItem: null, skipped: true };

  // 방금 생성된 항목 조회
  const newAction = await db.aiActionItem.findFirst({
    where: {
      type: "FOLLOWUP_DRAFT",
      status: "PENDING",
      relatedEntityType: "ORDER",
      relatedEntityId: orderId,
    },
    select: { id: true, title: true },
    orderBy: { createdAt: "desc" },
  });

  return { actionItem: newAction, skipped: false };
}
