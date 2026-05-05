/**
 * #post-approval-purchase-order-flow Phase 1.3 — POCandidate → Order
 * vendor-aware conversion service.
 *
 * canonical truth = Order (DB). 1 Quote → N Order (vendor 별, option A).
 * 결재 통과한 POCandidate[] 를 vendor 별 Order N개로 변환. legacy fallback —
 * vendor name 매핑 실패 시 Order.vendorId NULL (UI "지정 없음" 표기).
 *
 * Lock:
 *   - duplicate prevention: 이미 (quoteId, vendorId) Order 존재 시 skip
 *   - atomic per-candidate transaction (Order + OrderItem createMany)
 *   - audit log try/catch graceful (mutation atomic 외)
 *
 * caller (Phase 1.3 wiring 대상): 결재 통과 mutation 또는 bulk-po route 안에서
 * 호출 — 본 helper 는 service layer pure 호출 패턴 (route 가 session/auth
 * 검증 후 호출).
 */

import { db } from "@/lib/db";
import { generateOrderNumber } from "@/lib/api/order-number";
import { createAuditLog } from "@/lib/audit/audit-logger";
import type { POCandidate, POCandidateItem } from "@prisma/client";

export interface ConvertPOCandidatesParams {
  quoteId: string;
  userId: string;
  organizationId?: string | null;
  /** 결재 통과한 POCandidate (items 포함). vendor 별 1개씩. */
  candidates: Array<POCandidate & { items?: POCandidateItem[] }>;
}

export interface ConvertPOCandidatesResult {
  created: Array<{
    orderId: string;
    orderNumber: string;
    vendorId: string | null;
    poCandidateId: string;
  }>;
  skipped: Array<{
    poCandidateId: string;
    vendorId: string | null;
    reason: "duplicate";
  }>;
}

/**
 * POCandidate[] → vendor 별 Order N개 생성.
 * candidates 가 empty 면 created/skipped 모두 빈 배열 반환.
 */
export async function convertPOCandidatesToOrders(
  params: ConvertPOCandidatesParams,
): Promise<ConvertPOCandidatesResult> {
  const { quoteId, userId, organizationId, candidates } = params;
  const created: ConvertPOCandidatesResult["created"] = [];
  const skipped: ConvertPOCandidatesResult["skipped"] = [];

  for (const candidate of candidates) {
    // POCandidate.vendor (string) → Vendor master (id) 매핑
    let vendorId: string | null = null;
    const vendorName = candidate.vendor?.trim();
    if (vendorName) {
      const vendor = await db.vendor.findFirst({
        where: { name: vendorName },
        select: { id: true },
      });
      vendorId = vendor?.id ?? null;
    }

    // duplicate prevention — composite (quoteId, vendorId)
    const existing = await db.order.findFirst({
      where: { quoteId, vendorId },
      select: { id: true },
    });
    if (existing) {
      skipped.push({
        poCandidateId: candidate.id,
        vendorId,
        reason: "duplicate",
      });
      continue;
    }

    // atomic per-candidate — Order + OrderItem 동시 INSERT
    const items = candidate.items ?? [];
    const totalAmount = candidate.totalAmount;
    const tempNumber = `ORD-PENDING-${candidate.id.slice(-6)}`;

    const result = await db.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          userId,
          quoteId,
          vendorId,
          poCandidateId: candidate.id,
          organizationId: organizationId ?? null,
          orderNumber: tempNumber,
          totalAmount,
          status: "ORDERED",
          expectedDelivery: candidate.expectedDelivery,
        },
      });
      const orderNumber = generateOrderNumber(order.id);
      await tx.order.update({
        where: { id: order.id },
        data: { orderNumber },
      });
      if (items.length > 0) {
        await tx.orderItem.createMany({
          data: items.map((it) => ({
            orderId: order.id,
            name: it.name,
            catalogNumber: it.catalogNumber,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            lineTotal: it.lineTotal,
          })),
        });
      }
      return { orderId: order.id, orderNumber };
    });

    created.push({
      orderId: result.orderId,
      orderNumber: result.orderNumber,
      vendorId,
      poCandidateId: candidate.id,
    });

    // audit log — try/catch graceful (mutation atomic 외).
    // eventType 은 SETTINGS_CHANGED 재사용 (직전 Phase 4.1 Order PATCH 와
    // 동일 패턴). 신규 enum `ORDER_CREATED_FROM_POCANDIDATE` 추가는 별도
    // schema migration batch 로 분리.
    await createAuditLog({
      userId,
      organizationId: organizationId ?? undefined,
      eventType: "SETTINGS_CHANGED",
      entityType: "ORDER",
      entityId: result.orderId,
      action: "create",
      metadata: {
        kind: "order_created_from_pocandidate",
        quoteId,
        poCandidateId: candidate.id,
        vendorId,
        vendorName: vendorName ?? null,
        orderNumber: result.orderNumber,
        totalAmount,
        itemCount: items.length,
      },
    }).catch(() => {
      // audit log 실패는 mutation 영향 0 (Phase 4.1 패턴 정합)
    });
  }

  return { created, skipped };
}
