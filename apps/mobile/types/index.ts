// ─── 공용 타입 정의 ────────────────────────────────────────────────

export interface Quote {
  id: string;
  title: string;
  status: "DRAFT" | "PENDING" | "SENT" | "IN_PROGRESS" | "RESPONDED" | "COMPLETED" | "CANCELLED" | "ON_HOLD" | "PURCHASED" | "VENDOR_INQUIRY" | "WAITING_REPLY";
  totalAmount?: number;
  createdAt: string;
  updatedAt: string;
  requesterName?: string;
  itemCount?: number;
  organizationId?: string;
}

export interface QuoteItem {
  id: string;
  productName: string;
  quantity: number;
  unit?: string;
  unitPrice?: number;
  totalPrice?: number;
  brand?: string;
  catalogNumber?: string;
}

export interface QuoteDetail extends Quote {
  items: QuoteItem[];
  description?: string;
  notes?: string;
  vendorResponses?: VendorResponse[];
}

/**
 * §11.209d-mobile Phase 2 — quote 결재 정보 (web 의 §11.209d cluster 와
 * 동일 source). /api/quotes/[id] response.approval 매핑.
 */
export interface QuoteApproval {
  internalApprovalStatus: "NOT_REQUIRED" | "PENDING" | "APPROVED" | "REJECTED";
  latestPendingRequestId: string | null;
  approvalRequestedAt: string | null;
  approverName: string | null;
  /** §11.209d-contact — approver email (mailto: 링크 가능). */
  approverEmail: string | null;
  /** §11.209d-contact — approver phone (tel: 링크 가능, optional). */
  approverPhone: string | null;
  approvalDecidedAt: string | null;
  rejectionReason: string | null;
  /** §11.209d-history-expand — chronological history list (newest first,
      CANCELLED 포함). length > 1 시 "이전 결재 이력 N건 보기" expand. */
  historyEntries?: ApprovalHistoryEntry[];
  /**
   * §11.209d-mobile-mutation — current user 의 결재 권한 visibility 분기.
   * server-side computed: PENDING + (current user.id 가 같은 team 의
   * ADMIN role) 일 때만 true. mobile UI 가 "승인" / "반려" Pressable
   * visibility 결정에 사용. canonical 권한은 server enforceAction +
   * teamMember.role === ADMIN — 본 field 는 dead button 0 visibility 만 보장.
   */
  canApprove?: boolean;
}

/**
 * §11.209d-history-expand — chronological history entry. mobile timeline
 * expand UI 가 사용. ISO string for dates (JSON serialization).
 */
export interface ApprovalHistoryEntry {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | string;
  requestedAt: string;
  approverName: string | null;
  decidedAt: string | null;
  rejectionReason: string | null;
}

export interface QuoteDetailWithApproval {
  quote: QuoteDetail;
  approval: QuoteApproval | null;
}

export interface VendorResponse {
  id: string;
  vendorName: string;
  totalAmount: number;
  deliveryDays?: number;
  notes?: string;
}

export interface QuoteStatusHistory {
  id: string;
  previousStatus: string | null;
  newStatus: string | null;
  reason: string | null;
  changedBy: string;
  createdAt: string;
}

export interface PurchaseRecord {
  id: string;
  productName: string;
  vendor?: string;
  amount: number;
  quantity?: number;
  unit?: string;
  purchasedAt: string;
  category?: string;
  followUpStatus?: string;
  scopeKey?: string;
  notes?: string;
  catalogNumber?: string;
  currency?: string;
}

export type InspectionResult = "PASS" | "CAUTION" | "FAIL";

export interface InspectionChecklist {
  storageOk: boolean;
  labelOk: boolean;
  expiryOk: boolean;
  conditionOk: boolean;
}

export interface Inspection {
  id: string;
  inventoryId: string;
  result: InspectionResult;
  checklist: InspectionChecklist;
  notes?: string;
  inspectedAt: string;
  user?: { name: string };
}

export interface ProductInventory {
  id: string;
  productId?: string;
  productName: string;
  brand?: string;
  catalogNumber?: string;
  quantity: number;
  unit: string;
  location?: string;
  status: "NORMAL" | "LOW_STOCK" | "OUT_OF_STOCK" | "EXPIRED";
  safetyStock?: number;
  expiryDate?: string;
  storageCondition?: string;
  lotNumber?: string;
  lastInspectedAt?: string;
  lots?: InventoryLot[];
  product?: {
    id: string;
    name: string;
    nameEn?: string;
    brand?: string;
    catalogNumber?: string;
    msdsUrl?: string;
    hazardCodes?: string[];
    pictograms?: string[];
    storageCondition?: string;
    ppe?: string[];
    safetyNote?: string;
  };
}

export interface InventoryLot {
  id: string;
  lotNumber: string;
  quantity: number;
  unit: string;
  expiryDate?: string;
  location?: string;
  storageCondition?: string;
  receivedAt?: string;
  status: string;
}

export interface DashboardSummary {
  pendingQuotes: number;
  lowStockItems: number;
  pendingInspections: number;
  recentPurchases: number;
}
