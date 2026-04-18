/**
 * Ontology Domain Mappers — Phase 1
 *
 * DB 행(Supabase row / Prisma model) ↔ Domain Object 변환.
 * 변환 로직을 한 곳에 모아 Store/API에서 인라인 매핑을 제거한다.
 *
 * 규칙:
 * 1. mapper는 pure function — side effect 없음
 * 2. null/undefined 방어는 mapper 안에서 처리 (호출자가 걱정하지 않게)
 * 3. 계산 필드(BudgetControlState 등)는 mapper가 산출
 * 4. DB 컬럼 추가/제거 시 mapper만 수정하면 Domain Object는 안정
 */

import type {
  ProductObject,
  ProductCategory,
  SafetyProfile,
  VendorObject,
  VendorTradingStatus,
  BudgetObject,
  BudgetControlState,
  BudgetRiskLevel,
  QuoteObject,
  QuoteBusinessStatus,
  PurchaseOrderObject,
  InventoryObject,
  InventoryStockStatus,
  OntologyLink,
  OntologyLinkType,
} from "../types";

// ══════════════════════════════════════════════════════════════════════════════
// Supabase Row Interfaces (DB 계층 — 이 파일 안에서만 사용)
// ══════════════════════════════════════════════════════════════════════════════

/** Supabase products 테이블 행 */
export interface SupabaseProductRow {
  id: string;
  name: string;
  name_en?: string | null;
  catalog_number?: string | null;
  category: string;
  brand?: string | null;
  manufacturer?: string | null;
  hazard_codes?: string[] | null;
  pictograms?: string[] | null;
  ppe?: string[] | null;
  storage_condition?: string | null;
  pharmacopoeia?: string | null;
  country_of_origin?: string | null;
  created_at: string;
  updated_at: string;
}

/** Supabase vendors 테이블 행 */
export interface SupabaseVendorRow {
  id: string;
  name: string;
  name_en?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  country?: string | null;
  currency?: string | null;
  status?: string | null;
  created_at: string;
  updated_at: string;
}

/** Supabase budgets 테이블 행 */
export interface SupabaseBudgetRow {
  id: string;
  name: string;
  amount: number;
  currency: string;
  period_start: string;
  period_end: string;
  organization_id?: string | null;
  target_department?: string | null;
  project_name?: string | null;
  description?: string | null;
  total_spent: number;
  total_reserved?: number | null;
  total_committed?: number | null;
  burn_rate?: number | null;
  status?: string | null;
  created_at: string;
  updated_at: string;
}

/** Supabase quotes 테이블 행 (simplified) */
export interface SupabaseQuoteRow {
  id: string;
  title: string;
  status: string;
  requested_by: string;
  vendor_id: string;
  vendor_name?: string | null;
  total_amount: number;
  currency: string;
  valid_until?: string | null;
  line_count: number;
  created_at: string;
  updated_at: string;
}

/** Supabase inventory 테이블 행 */
export interface SupabaseInventoryRow {
  id: string;
  product_id: string;
  product_name?: string | null;
  quantity: number;
  reserved_quantity?: number | null;
  unit: string;
  lot_number?: string | null;
  expiry_date?: string | null;
  storage_location?: string | null;
  status?: string | null;
  reorder_point?: number | null;
  reorder_quantity?: number | null;
  created_at: string;
  updated_at: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// Product Mapper
// ══════════════════════════════════════════════════════════════════════════════

const CATEGORY_MAP: Record<string, ProductCategory> = {
  REAGENT: "reagent",
  TOOL: "tool",
  EQUIPMENT: "equipment",
  RAW_MATERIAL: "raw_material",
  reagent: "reagent",
  tool: "tool",
  equipment: "equipment",
  raw_material: "raw_material",
};

export function mapProductRowToObject(row: SupabaseProductRow): ProductObject {
  const safetyProfile: SafetyProfile | null =
    row.hazard_codes?.length || row.pictograms?.length || row.ppe?.length
      ? {
          hazardCodes: row.hazard_codes ?? [],
          pictograms: row.pictograms ?? [],
          ppe: row.ppe ?? [],
          storageClass: null,
        }
      : null;

  return {
    objectId: row.id,
    objectType: "Product",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    displayName: row.name,
    displayNameEn: row.name_en ?? null,
    catalogNumber: row.catalog_number ?? null,
    category: CATEGORY_MAP[row.category] ?? "reagent",
    brand: row.brand ?? null,
    manufacturer: row.manufacturer ?? null,
    safetyProfile,
    storageCondition: row.storage_condition ?? null,
    pharmacopoeia: row.pharmacopoeia ?? null,
    countryOfOrigin: row.country_of_origin ?? null,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Vendor Mapper
// ══════════════════════════════════════════════════════════════════════════════

const VENDOR_STATUS_MAP: Record<string, VendorTradingStatus> = {
  active: "active",
  suspended: "suspended",
  inactive: "inactive",
  pending_review: "pending_review",
};

export function mapVendorRowToObject(row: SupabaseVendorRow): VendorObject {
  return {
    objectId: row.id,
    objectType: "Vendor",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    displayName: row.name,
    displayNameEn: row.name_en ?? null,
    contactEmail: row.email ?? null,
    contactPhone: row.phone ?? null,
    website: row.website ?? null,
    country: row.country ?? null,
    defaultCurrency: row.currency ?? "KRW",
    tradingStatus: VENDOR_STATUS_MAP[row.status ?? ""] ?? "active",
    supplyCategories: [],
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Budget Mapper (with control state computation)
// ══════════════════════════════════════════════════════════════════════════════

function computeBudgetRiskLevel(
  available: number,
  allocated: number,
  periodEnd: string,
): BudgetRiskLevel {
  const now = new Date();
  const end = new Date(periodEnd);
  if (end < now) return "ended";
  if (available < 0) return "over";

  const usageRate = allocated > 0 ? ((allocated - available) / allocated) * 100 : 0;
  if (usageRate >= 95) return "critical";
  if (usageRate >= 80) return "warning";

  const start = new Date(periodEnd);
  start.setMonth(start.getMonth() - 1);
  if (now < start && usageRate < 10) return "upcoming";

  return "safe";
}

export function mapBudgetRowToObject(row: SupabaseBudgetRow): BudgetObject {
  const reserved = row.total_reserved ?? 0;
  const committed = row.total_committed ?? 0;
  const actual = row.total_spent ?? 0;
  const available = Math.max(row.amount - reserved - committed, 0);
  const burnRate = row.burn_rate ?? (row.amount > 0 ? (actual / row.amount) * 100 : 0);

  const controlState: BudgetControlState = {
    reserved,
    committed,
    actual,
    available,
    burnRate,
    riskLevel: computeBudgetRiskLevel(available, row.amount, row.period_end),
  };

  return {
    objectId: row.id,
    objectType: "Budget",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    displayName: row.name,
    allocatedAmount: row.amount,
    currency: row.currency,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    departmentName: row.target_department ?? null,
    projectName: row.project_name ?? null,
    controlState,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Quote Mapper
// ══════════════════════════════════════════════════════════════════════════════

const QUOTE_STATUS_MAP: Record<string, QuoteBusinessStatus> = {
  PENDING: "draft",
  SENT: "sent_to_vendor",
  RESPONDED: "vendor_responded",
  COMPLETED: "approved",
  CANCELLED: "cancelled",
  draft: "draft",
  sent_to_vendor: "sent_to_vendor",
  vendor_responded: "vendor_responded",
  under_review: "under_review",
  shortlisted: "shortlisted",
  approved: "approved",
  rejected: "rejected",
  expired: "expired",
  cancelled: "cancelled",
};

export function mapQuoteRowToObject(row: SupabaseQuoteRow): QuoteObject {
  return {
    objectId: row.id,
    objectType: "Quote",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    title: row.title,
    quoteStatus: QUOTE_STATUS_MAP[row.status] ?? "draft",
    requestedBy: row.requested_by,
    vendorId: row.vendor_id,
    vendorName: row.vendor_name ?? "",
    totalAmount: row.total_amount,
    currency: row.currency,
    validUntil: row.valid_until ?? null,
    lineCount: row.line_count,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Inventory Mapper
// ══════════════════════════════════════════════════════════════════════════════

function computeStockStatus(
  quantity: number,
  reserved: number,
  reorderPoint: number | null,
  expiryDate: string | null,
): InventoryStockStatus {
  if (expiryDate && new Date(expiryDate) < new Date()) return "expired";
  if (quantity <= 0) return "out_of_stock";
  if (reserved > 0 && quantity - reserved <= 0) return "reserved";
  if (reorderPoint != null && quantity <= reorderPoint) return "low_stock";
  return "in_stock";
}

export function mapInventoryRowToObject(row: SupabaseInventoryRow): InventoryObject {
  const reserved = row.reserved_quantity ?? 0;
  const available = Math.max(row.quantity - reserved, 0);

  return {
    objectId: row.id,
    objectType: "Inventory",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    productId: row.product_id,
    productName: row.product_name ?? "",
    currentQuantity: row.quantity,
    reservedQuantity: reserved,
    availableQuantity: available,
    unit: row.unit,
    lotNumber: row.lot_number ?? null,
    expiryDate: row.expiry_date ?? null,
    storageLocation: row.storage_location ?? null,
    stockStatus: computeStockStatus(row.quantity, reserved, row.reorder_point ?? null, row.expiry_date ?? null),
    reorderPoint: row.reorder_point ?? null,
    reorderQuantity: row.reorder_quantity ?? null,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Link Builder — 객체 간 관계 생성
// ══════════════════════════════════════════════════════════════════════════════

export function buildLink(
  linkType: OntologyLinkType,
  sourceId: string,
  sourceType: OntologyLink["sourceType"],
  targetId: string,
  targetType: OntologyLink["targetType"],
  metadata?: Record<string, unknown>,
): OntologyLink {
  return { linkType, sourceId, sourceType, targetId, targetType, metadata };
}

/**
 * Quote → Product 링크 배치 생성
 * Quote 라인 아이템에서 제품 참조를 추출하여 링크 생성
 */
export function buildQuoteProductLinks(
  quoteId: string,
  lineItems: Array<{ productId: string }>,
): OntologyLink[] {
  return lineItems.map((item) =>
    buildLink("quote_for_product", quoteId, "Quote", item.productId, "Product"),
  );
}

/**
 * PO → Budget 링크 생성
 * 발주서가 참조하는 예산 출처 연결
 */
export function buildPOBudgetLink(
  poId: string,
  budgetId: string,
  amount: number,
  currency: string,
): OntologyLink {
  return buildLink("po_funded_by_budget", poId, "PurchaseOrder", budgetId, "Budget", {
    amount,
    currency,
  });
}
