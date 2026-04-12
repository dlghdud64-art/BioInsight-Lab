/**
 * Approval Snapshot Store — approval 시점의 PO 본문을 poNumber 단위로 보관.
 *
 * 규칙:
 * 1. approval 승인 시점의 PO 상태를 baseline으로 보존한다.
 * 2. 이후 PO 변경이 baseline을 오염시키지 않는다.
 * 3. reopen / invalidation 이벤트에서만 clear된다.
 * 4. sessionStorage 기반 — 탭 단위 격리, 서버 영속은 별도 layer.
 */

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

const STORAGE_PREFIX = "labaxis:approval-snapshot:";

/**
 * 동일 poNumber의 기존 snapshot이 없을 때만 기록한다.
 * 기록했으면 true, 기존 값 유지면 false 반환.
 */
export function ensureApprovalSnapshot(data: ApprovalPoSnapshot): boolean {
  if (typeof window === "undefined") return false;
  const key = `${STORAGE_PREFIX}${data.poNumber}`;
  const existing = sessionStorage.getItem(key);
  if (existing) {
    // 기존 baseline 유지 — 매 변경마다 baseline을 밀면 누적 diff를 잃어버림
    try {
      const parsed = JSON.parse(existing) as ApprovalPoSnapshot;
      if (parsed.approvalDecidedAt === data.approvalDecidedAt) return false;
    } catch {
      // parse 실패 시 덮어쓰기
    }
  }
  sessionStorage.setItem(key, JSON.stringify(data));
  return true;
}

/**
 * poNumber로 baseline snapshot을 조회한다.
 */
export function getApprovalSnapshot(poNumber: string): ApprovalPoSnapshot | null {
  if (typeof window === "undefined") return null;
  const key = `${STORAGE_PREFIX}${poNumber}`;
  const raw = sessionStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ApprovalPoSnapshot;
  } catch {
    return null;
  }
}

/**
 * reopen / invalidation 시 baseline을 clear한다.
 */
export function clearApprovalSnapshot(poNumber: string): void {
  if (typeof window === "undefined") return;
  const key = `${STORAGE_PREFIX}${poNumber}`;
  sessionStorage.removeItem(key);
}
