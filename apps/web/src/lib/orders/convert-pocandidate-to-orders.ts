/**
 * #post-approval-purchase-order-flow Phase 1.3 — POCandidate → Order
 * vendor-aware conversion service.
 *
 * canonical truth = Order (DB). 1 Quote → N Order (vendor 별, option A).
 * 결재 통과한 POCandidate[] 를 vendor 별 Order N개로 변환. legacy fallback —
 * vendor name 매핑 실패 시 Order.vendorId NULL (UI "지정 없음" 표기).
 *
 * Lock:
 *   - duplicate prevention (§pocandidate-root-fix — 2단 dup-guard):
 *     1차 `poCandidateId` 기반 — candidate 단위가 진짜 중복 식별자
 *     (DB `@@unique([poCandidateId])` 정합). 이미 변환된 candidate 는
 *     reason "already_converted" 로 skip.
 *     2차 composite (quoteId, vendorId) — DB `@@unique([quoteId, vendorId])`
 *     선방어. **vendorId NULL 은 2차 검사 제외** — NULL 은 Postgres
 *     NULL-distinct 라 DB 충돌이 없고, 매핑 실패 candidate 2건 이상이
 *     서로를 duplicate 로 오판해 유실되는 §pocandidate-null-vendor-collapse
 *     의 원천이었다.
 *   - empty-items 거부: items 0건 candidate 는 변환 skip
 *     (reason "empty_items", §pocandidate-empty-items-order 이중 방어)
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
    /**
     * §pocandidate-root-fix — skip 사유 구분값 (placeholder success 금지:
     * 사유를 "duplicate" 하나로 뭉개지 않는다).
     * - "already_converted": 이 candidate 로 이미 Order 존재 (poCandidateId 1차 가드)
     * - "duplicate": 같은 (quoteId, vendorId) Order 존재 (composite 2차 가드, vendorId non-NULL 한정)
     * - "empty_items": items 0건 — 내역 없는 발주서 생성 차단
     */
    reason: "already_converted" | "duplicate" | "empty_items";
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
    // §pocandidate-empty-items-order — 변환부 거부 (입구 가드와 이중 방어).
    // items 0건 candidate 는 내역 없는 발주서가 되므로 변환하지 않는다.
    const items = candidate.items ?? [];
    if (items.length === 0) {
      skipped.push({
        poCandidateId: candidate.id,
        vendorId: null,
        reason: "empty_items",
      });
      continue;
    }

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

    // §pocandidate-root-fix dup-guard 1차 — poCandidateId 기반.
    // candidate 단위가 진짜 중복 식별자 (DB @@unique([poCandidateId]) 정합).
    // 재변환 시 이 candidate 로 만든 Order 가 이미 있으면 skip.
    const alreadyConverted = await client.order.findFirst({
      where: { poCandidateId: candidate.id },
      select: { id: true },
    });
    if (alreadyConverted) {
      skipped.push({
        poCandidateId: candidate.id,
        vendorId,
        reason: "already_converted",
      });
      continue;
    }

    // dup-guard 2차 — composite (quoteId, vendorId). DB @@unique([quoteId,
    // vendorId]) 위반을 tx throw 전에 skip 으로 선방어. vendorId NULL 은 제외 —
    // NULL 은 NULL-distinct(DB 충돌 없음)이며, 여기 NULL 을 포함시키면 매핑
    // 실패 candidate 2건 이상이 서로를 duplicate 로 오판해 둘째가 유실된다
    // (§pocandidate-null-vendor-collapse 근본 원인).
    if (vendorId !== null) {
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
    }

    // atomic per-candidate — Order + OrderItem 동시 INSERT
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
