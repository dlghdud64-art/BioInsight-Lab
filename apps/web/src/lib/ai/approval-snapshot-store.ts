/**
 * Approval Snapshot Store — approval 시점의 PO 본문을 poNumber 단위로 보관.
 *
 * 규칙:
 * 1. approval 승인 시점의 PO 상태를 baseline으로 보존한다.
 * 2. 이후 PO 변경이 baseline을 오염시키지 않는다.
 * 3. reopen / invalidation 이벤트에서만 clear된다.
 * 4. PersistenceAdapter 뒤에 숨겨져 storage 구현에 직접 의존하지 않는다.
 *    기본 구현은 SessionStorageAdapter. 추후 Supabase/DB adapter로 교체 가능.
 */

import { getApprovalBaselineAdapter } from "@/lib/persistence/persistence-adapter";

export interface ApprovalPoSnapshot {
  poNumber: string;
  approvalDecidedAt: string;
  capturedAt: string;
  totalAmount: number;
  vendorId: string;
  paymentTerms?: string | null;
  incoterms?: string | null;
  shippingRegion?: string | null;
  billToEntity?: string | null;
  shipToLocation?: string | null;
  notes?: string | null;
  lineCount: number;
}

/**
 * 동일 poNumber의 기존 snapshot이 없을 때만 기록한다.
 * 기록했으면 true, 기존 값 유지면 false 반환.
 */
export function ensureApprovalSnapshot(data: ApprovalPoSnapshot): boolean {
  const adapter = getApprovalBaselineAdapter();
  const existing = adapter.load(data.poNumber);
  if (existing) {
    // 기존 baseline 유지 — 매 변경마다 baseline을 밀면 누적 diff를 잃어버림
    if (existing.approvalDecidedAt === data.approvalDecidedAt) return false;
  }
  adapter.persist(data.poNumber, data);
  return true;
}

/**
 * poNumber로 baseline snapshot을 조회한다.
 */
export function getApprovalSnapshot(poNumber: string): ApprovalPoSnapshot | null {
  const adapter = getApprovalBaselineAdapter();
  return adapter.load(poNumber);
}

/**
 * reopen / invalidation 시 baseline을 clear한다.
 */
export function clearApprovalSnapshot(poNumber: string): void {
  const adapter = getApprovalBaselineAdapter();
  adapter.clear(poNumber);
}
