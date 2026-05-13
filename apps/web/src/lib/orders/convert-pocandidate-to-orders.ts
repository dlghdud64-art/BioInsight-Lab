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

/**
 * caller 가 전달하는 db client. PrismaClient (자체 tx 만듦) 또는
 * TransactionClient (이미 tx 안, nested transaction 회피).
 *
 * `typeof db` 로 두면 TransactionClient 는 호환 가능하지만 `$transaction`
 * 메서드 호출 회피가 핵심 — caller 가 tx 전달 시 service 가 자체
 * `$transaction` 만들지 않음.
 */
type DbClient = typeof db;

export interface ConvertPOCandidatesParams {
  quoteId: string;
  userId: string;
  organizationId?: string | null;
  /** 결재 통과한 POCandidate (items 포함). vendor 별 1개씩. */
  candidates: Array<POCandidate & { items?: POCandidateItem[] }>;
}

export interface ConvertPOCandidatesOptions {
  /**
   * caller 가 이미 outer transaction 안에 있을 때 tx 전달. service 가
   * 자체 `$transaction` 만들지 않고 외부 tx 안에서 동작 (nested 회피).
   * 미전달 시 service 가 자체 transaction 만듦 (default).
   */
  client?: DbClient;
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
 *
 * caller 가 outer tx 전달 시 service 는 nested $transaction 만들지 않음
 * (caller 의 atomic mutation 보호).
 */
export async function convertPOCandidatesToOrders(
  params: ConvertPOCandidatesParams,
  options: ConvertPOCandidatesOptions = {},
): Promise<ConvertPOCandidatesResult> {
  const { quoteId, userId, organizationId, candidates } = params;
  const client: DbClient = options.client ?? db;
  const inOuterTx = options.client != null; // caller 가 tx 전달 시 nested 회피
  const created: ConvertPOCandidatesResult["created"] = [];
  const skipped: ConvertPOCandidatesResult["skipped"] = [];

  for (const candidate of candidates) {
    // POCandidate.vendor (string) → Vendor master (id) 매핑
    let vendorId: string | null = null;
    const vendorName = candidate.vendor?.trim();
    if (vendorName) {
      const vendor = await client.vendor.findFirst({
        where: { name: vendorName },
        select: { id: true },
      });
      vendorId = vendor?.id ?? null;
    }

    // duplicate prevention — composite (quoteId, vendorId)
    const existing = await client.order.findFirst({
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

    // caller 가 tx 전달 시 nested transaction 회피, 미전달 시 자체 tx
    const runWork = async (tx: DbClient) => {
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
    };
    const result = inOuterTx
      ? await runWork(client)
      // §11.238 — TransactionClient implicit any cast.
      : await db.$transaction(async (tx: any) => runWork(tx as unknown as DbClient));

    created.push({
      orderId: result.orderId,
      orderNumber: result.orderNumber,
      vendorId,
      poCandidateId: candidate.id,
    });

    // audit log — try/catch graceful (mutation atomic 외).
    // #audit-event-type-order — dedicated enum `ORDER_CREATED_FROM_POCANDIDATE`
    // 사용 (직전 SETTINGS_CHANGED 재사용 → cleanup 정합).
    await createAuditLog({
      userId,
      organizationId: organizationId ?? undefined,
      eventType: "ORDER_CREATED_FROM_POCANDIDATE",
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
