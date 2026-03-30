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
