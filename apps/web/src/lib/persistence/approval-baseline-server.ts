/**
 * Approval Baseline — Server Persistence Layer
 *
 * 목적:
 *   기존 sessionStorage 기반 approval-snapshot-store.ts 를 서버(Supabase)로 전환.
 *   approval 시점 PO baseline 을 DB 에 영속화하여 브라우저 세션 종료 후에도
 *   changedFields diff 계산이 가능하도록 한다.
 *
 * 고정 규칙:
 *   1. canonical truth 는 PurchaseOrderContract. 본 테이블은 ReadOnly snapshot.
 *   2. poNumber + approvalDecidedAt 복합 unique — 동일 approval 결정의 중복 저장 방지.
 *   3. invalidation 시 soft-delete (invalidatedAt 기록). hard delete 하지 않음.
 *   4. Supabase 접근 불가 시 sessionStorage fallback 유지.
 */

import { db } from "@/lib/db";

export interface ApprovalBaselineRecord {
  poNumber: string;
  approvalDecidedAt: string;
  capturedAt: string;
  totalAmount: number;
  vendorId: string;
  paymentTerms?: string;
  incoterms?: string;
  shippingRegion: string;
  billToEntity: string;
  shipToLocation: string;
  notes?: string;
  lineCount: number;
}

/**
 * approval 시점 baseline 을 서버에 저장한다.
 * 동일 (poNumber, approvalDecidedAt) 이 이미 있으면 skip (ensure 의미론).
 *
 * @returns true 이면 새로 기록됨, false 이면 기존 baseline 보존.
 */
export async function ensureApprovalBaselineServer(
  snapshot: ApprovalBaselineRecord,
): Promise<boolean> {
  try {
    const existing = await db.approvalBaseline.findUnique({
      where: {
        poNumber_approvalDecidedAt: {
          poNumber: snapshot.poNumber,
          approvalDecidedAt: snapshot.approvalDecidedAt,
        },
      },
    });

    if (existing && !existing.invalidatedAt) {
      return false; // 이미 존재하고 유효함
    }

    if (existing && existing.invalidatedAt) {
      // invalidated 된 snapshot 이 있으면 재활성화
      await db.approvalBaseline.update({
        where: { id: existing.id },
        data: {
          ...snapshot,
          invalidatedAt: null,
        },
      });
      return true;
    }

    await db.approvalBaseline.create({
      data: snapshot,
    });
    return true;
  } catch (e) {
    console.error("[approval-baseline-server] ensureApprovalBaselineServer 실패:", e);
    return false;
  }
}

/**
 * PO 에 대한 최신 유효 approval baseline 조회.
 * invalidatedAt 이 null 인 가장 최근 레코드.
 */
export async function getApprovalBaselineServer(
  poNumber: string,
): Promise<ApprovalBaselineRecord | null> {
  try {
    const record = await db.approvalBaseline.findFirst({
      where: {
        poNumber,
        invalidatedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });
    if (!record) return null;
    return {
      poNumber: record.poNumber,
      approvalDecidedAt: record.approvalDecidedAt,
      capturedAt: record.capturedAt,
      totalAmount: record.totalAmount,
      vendorId: record.vendorId,
      paymentTerms: record.paymentTerms ?? undefined,
      incoterms: record.incoterms ?? undefined,
      shippingRegion: record.shippingRegion,
      billToEntity: record.billToEntity,
      shipToLocation: record.shipToLocation,
      notes: record.notes ?? undefined,
      lineCount: record.lineCount,
    };
  } catch (e) {
    console.error("[approval-baseline-server] getApprovalBaselineServer 실패:", e);
    return null;
  }
}

/**
 * PO 의 approval baseline 을 무효화한다 (soft-delete).
 * reopen / approval invalidation 등 targeted invalidation 이벤트에서 호출.
 */
export async function invalidateApprovalBaselineServer(
  poNumber: string,
): Promise<void> {
  try {
    await db.approvalBaseline.updateMany({
      where: {
        poNumber,
        invalidatedAt: null,
      },
      data: {
        invalidatedAt: new Date(),
      },
    });
  } catch (e) {
    console.error("[approval-baseline-server] invalidateApprovalBaselineServer 실패:", e);
  }
}
