/**
 * Ontology Domain Types — Phase 1
 *
 * Prisma/Supabase 모델과 분리된 비즈니스 도메인 객체 정의.
 * DB 스키마가 바뀌어도 이 레이어가 UI와 AI에 안정적인 인터페이스를 제공한다.
 *
 * 규칙:
 * 1. DB 컬럼명(snake_case)이 아닌 비즈니스 속성명(camelCase + semantic) 사용
 * 2. 상태 값은 governance-grammar-registry의 vocabulary만 사용
 * 3. 계산 필드는 Domain Object에 포함하되, 변환 로직은 mapper에 위임
 * 4. optional 필드는 비즈니스 의미가 있을 때만 허용 (DB nullable과 다름)
 */

// ══════════════════════════════════════════════════════════════════════════════
// Object Identity — 모든 Domain Object의 기본
// ══════════════════════════════════════════════════════════════════════════════

export interface ObjectIdentity {
  /** 도메인 객체 고유 ID */
  readonly objectId: string;
  /** 객체 유형 (ontology registry에 등록된 타입명) */
  readonly objectType: OntologyObjectType;
  /** 생성 시각 (ISO 8601) */
  readonly createdAt: string;
  /** 최종 수정 시각 (ISO 8601) */
  readonly updatedAt: string;
}

export type OntologyObjectType =
  | "Product"
  | "Vendor"
  | "Budget"
  | "Quote"
  | "QuoteLine"
  | "PurchaseOrder"
  | "PurchaseOrderLine"
  | "Inventory"
  | "DispatchPackage"
  | "ReceivingRecord"
  | "QuoteComparison"
  | "BomParseSession";

// ══════════════════════════════════════════════════════════════════════════════
// Link — 객체 간 관계 (Prisma FK 대신 명시적 그래프)
// ══════════════════════════════════════════════════════════════════════════════

export interface OntologyLink {
  /** 관계 유형 */
  linkType: OntologyLinkType;
  /** 출발 객체 */
  sourceId: string;
  sourceType: OntologyObjectType;
  /** 도착 객체 */
  targetId: string;
  targetType: OntologyObjectType;
  /** 관계 메타데이터 (예: 수량, 역할 등) */
  metadata?: Record<string, unknown>;
}

export type OntologyLinkType =
  | "quote_for_product"           // Quote → Product
  | "quote_from_vendor"           // Quote → Vendor
  | "po_from_quote"               // PO → Quote (승인된 견적)
  | "po_to_vendor"                // PO → Vendor (발주 대상)
  | "po_funded_by_budget"         // PO → Budget (예산 출처)
  | "dispatch_for_po"             // Dispatch → PO
  | "receiving_for_dispatch"      // Receiving → Dispatch
  | "inventory_from_receiving"    // Inventory → Receiving
  | "reorder_for_inventory"       // Reorder Decision → Inventory
  | "comparison_produces_quote"   // QuoteComparison → Quote
  | "comparison_includes_vendor"  // QuoteComparison → Vendor
  | "bom_matched_product";        // BomParseSession → Product

// ══════════════════════════════════════════════════════════════════════════════
// Domain Objects
// ══════════════════════════════════════════════════════════════════════════════

/** 제품 — 연구실 시약/장비/소모품의 비즈니스 표현 */
export interface ProductObject extends ObjectIdentity {
  objectType: "Product";
  /** 제품명 (한글) */
  displayName: string;
  /** 제품명 (영문, 검색/매칭용) */
  displayNameEn: string | null;
  /** 카탈로그 번호 (CAS, Cat# 등) */
  catalogNumber: string | null;
  /** 분류 */
  category: ProductCategory;
  /** 브랜드/제조사 */
  brand: string | null;
  manufacturer: string | null;
  /** 안전 등급 — GHS 기반 */
  safetyProfile: SafetyProfile | null;
  /** 보관 조건 */
  storageCondition: string | null;
  /** 규격/표준 (USP, EP 등) */
  pharmacopoeia: string | null;
  /** 원산지 */
  countryOfOrigin: string | null;
}

export type ProductCategory = "reagent" | "equipment" | "tool" | "raw_material";

export interface SafetyProfile {
  hazardCodes: string[];
  pictograms: string[];
  ppe: string[];
  storageClass: string | null;
}

/** 공급사 — vendor master 비즈니스 표현 */
export interface VendorObject extends ObjectIdentity {
  objectType: "Vendor";
  displayName: string;
  displayNameEn: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  website: string | null;
  country: string | null;
  defaultCurrency: string;
  /** 거래 상태 */
  tradingStatus: VendorTradingStatus;
  /** 공급 가능 카테고리 */
  supplyCategories: ProductCategory[];
}

export type VendorTradingStatus = "active" | "suspended" | "inactive" | "pending_review";

/** 예산 — 부서/프로젝트별 예산 통제 비즈니스 표현 */
export interface BudgetObject extends ObjectIdentity {
  objectType: "Budget";
  displayName: string;
  /** 총 배정 금액 */
  allocatedAmount: number;
  currency: string;
  /** 기간 */
  periodStart: string;
  periodEnd: string;
  /** 소속 */
  departmentName: string | null;
  projectName: string | null;
  /** 통제 상태 — 계산 필드 (mapper에서 산출) */
  controlState: BudgetControlState;
}

export interface BudgetControlState {
  /** 집행 요청 중 (미확정) */
  reserved: number;
  /** PO 발행으로 확정 */
  committed: number;
  /** 실제 집행 완료 */
  actual: number;
  /** 사용 가능 잔액 = allocated - reserved - committed */
  available: number;
  /** 소진율 (%) */
  burnRate: number;
  /** 위험 수준 */
  riskLevel: BudgetRiskLevel;
}

export type BudgetRiskLevel = "safe" | "warning" | "critical" | "over" | "ended" | "upcoming";

/** 견적 — 견적 요청/응답의 비즈니스 표현 */
export interface QuoteObject extends ObjectIdentity {
  objectType: "Quote";
  /** 견적 제목 */
  title: string;
  /** 상태 (governance grammar 준수) */
  quoteStatus: QuoteBusinessStatus;
  /** 요청자 */
  requestedBy: string;
  /** 대상 공급사 */
  vendorId: string;
  vendorName: string;
  /** 합계 */
  totalAmount: number;
  currency: string;
  /** 유효 기간 */
  validUntil: string | null;
  /** 라인 아이템 수 */
  lineCount: number;
}

export type QuoteBusinessStatus =
  | "draft"
  | "sent_to_vendor"
  | "vendor_responded"
  | "under_review"
  | "shortlisted"
  | "approved"
  | "rejected"
  | "expired"
  | "cancelled";

/** 발주서 — PO의 비즈니스 표현 */
export interface PurchaseOrderObject extends ObjectIdentity {
  objectType: "PurchaseOrder";
  /** PO 번호 (운영 식별자) */
  poNumber: string;
  /** 상태 (governance grammar 준수) */
  poStatus: POBusinessStatus;
  /** 승인 상태 */
  approvalStatus: ApprovalBusinessStatus;
  /** 공급사 */
  vendorId: string;
  vendorName: string;
  /** 금액 */
  totalAmount: number;
  currency: string;
  /** 예산 출처 — Object Link Graph */
  budgetId: string | null;
  budgetName: string | null;
  /** 재고 참조 — Object Link Graph (수령 후 반영 대상) */
  inventoryIds: string[];
  /** 요청자 / 승인자 */
  requestedBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
  /** 라인 수 */
  lineCount: number;
  /** Dispatch 준비 상태 — 계산 필드 */
  dispatchReadiness: DispatchReadinessLevel;
  /** 계산 속성 — UI 힌트 */
  computed: PurchaseOrderComputed;
}

/** PO 계산 속성 — domain mapper가 산출 */
export interface PurchaseOrderComputed {
  /** 다음 필요 작업 */
  nextAction: string;
  /** 상태 표시 색상 */
  statusColor: "gray" | "blue" | "amber" | "green" | "red" | "purple";
  /** 예산 소진율 (연결된 budget 기준, %) */
  budgetBurnRate: number | null;
  /** 수령 가능 여부 */
  canReceive: boolean;
  /** 발송 가능 여부 */
  canDispatch: boolean;
}

export type POBusinessStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "po_created"
  | "dispatch_prep"
  | "ready_to_send"
  | "scheduled"
  | "sent"
  | "confirmed"
  | "receiving"
  | "completed"
  | "cancelled";

export type ApprovalBusinessStatus =
  | "not_required"
  | "pending"
  | "approved"
  | "rejected"
  | "reapproval_needed";

export type DispatchReadinessLevel =
  | "not_evaluated"
  | "blocked"
  | "needs_review"
  | "ready_to_send"
  | "scheduled"
  | "sent";

/** 재고 — 실물 재고의 비즈니스 표현 */
export interface InventoryObject extends ObjectIdentity {
  objectType: "Inventory";
  /** 제품 참조 */
  productId: string;
  productName: string;
  /** 수량 */
  currentQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  unit: string;
  /** LOT 관리 */
  lotNumber: string | null;
  expiryDate: string | null;
  /** 위치 */
  storageLocation: string | null;
  /** 상태 */
  stockStatus: InventoryStockStatus;
  /** 재주문점 */
  reorderPoint: number | null;
  reorderQuantity: number | null;
}

export type InventoryStockStatus =
  | "in_stock"
  | "low_stock"
  | "out_of_stock"
  | "expired"
  | "reserved"
  | "on_order";

/** 발송 패키지 — supplier-facing outbound 단위 */
export interface DispatchPackageObject extends ObjectIdentity {
  objectType: "DispatchPackage";
  /** 연결된 PO */
  purchaseOrderId: string;
  poNumber: string;
  /** 수신자 */
  primaryRecipient: DispatchRecipientInfo;
  ccRecipients: DispatchRecipientInfo[];
  /** 발송 채널 */
  sendChannel: "email" | "fax" | "portal" | "manual";
  /** outbound payload 상태 */
  payloadStatus: "draft" | "reviewed" | "finalized" | "sent";
  /** 첨부 문서 */
  attachments: DispatchAttachment[];
  /** 발송 예정일/실제 발송일 */
  scheduledAt: string | null;
  sentAt: string | null;
  /** supplier-facing 메모 */
  supplierNote: string;
}

export interface DispatchRecipientInfo {
  name: string;
  email: string;
  role: "primary" | "cc";
  isValid: boolean;
}

export interface DispatchAttachment {
  id: string;
  name: string;
  type: "po_document" | "supporting" | "specification" | "optional";
  included: boolean;
}

/** 입고 기록 — receiving execution 결과 */
export interface ReceivingRecordObject extends ObjectIdentity {
  objectType: "ReceivingRecord";
  /** 연결된 PO */
  purchaseOrderId: string;
  poNumber: string;
  /** 연결된 Dispatch */
  dispatchPackageId: string | null;
  /** 수령 정보 */
  receivedQuantity: number;
  expectedQuantity: number;
  unit: string;
  /** LOT 정보 */
  lotNumber: string | null;
  expiryDate: string | null;
  /** 검수 결과 */
  inspectionResult: ReceivingInspectionResult;
  inspectionNote: string | null;
  /** 수령자/일시 */
  receivedBy: string;
  receivedAt: string;
  /** 재고 반영 여부 */
  inventoryUpdated: boolean;
  /** 반영된 재고 ID */
  inventoryId: string | null;
}

export type ReceivingInspectionResult =
  | "accepted"
  | "accepted_with_note"
  | "partial_received"
  | "rejected"
  | "damaged";

// ══════════════════════════════════════════════════════════════════════════════
// State Transition Rule — 상태 전이 제약
// ══════════════════════════════════════════════════════════════════════════════

export interface StateTransitionRule<TStatus extends string> {
  from: TStatus;
  to: TStatus;
  /** 전이에 필요한 조건 */
  requires: string[];
  /** 전이를 수행하는 Action 이름 */
  actionName: string;
  /** 비가역인지 여부 */
  irreversible: boolean;
}

// ══════════════════════════════════════════════════════════════════════════════
// Re-exports
// ══════════════════════════════════════════════════════════════════════════════

export type { OntologyAdapter } from "../../ai-pipeline/runtime/core/ontology/types";
