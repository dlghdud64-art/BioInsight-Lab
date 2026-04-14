/**
 * Master Data / Catalog 운영 허브 중앙 계약
 *
 * 핵심 원칙: Master Data는 전체 운영의 정본(canonical reference)이다.
 * 카탈로그 항목은 search, compare, quote, purchase, inventory, document가
 * 공유하는 엔티티이며, 데이터 품질 이슈는 운영 큐에 노출되어야 하고 숨겨져서는 안 된다.
 */

// ═══════════════════════════════════════════════════
// 1. Catalog Page Section Order
// ═══════════════════════════════════════════════════

/** 카탈로그 페이지의 필수 섹션 순서. 모든 카탈로그 페이지는 이 순서를 따른다. */
export const CATALOG_PAGE_SECTIONS = [
  "header",
  "healthSummary",
  "qualityIssues",
  "catalogList",
  "selectedItemDetail",
  "relationsDocuments",
  "relatedFlows",
  "auditGovernance",
] as const;

/** 카탈로그 페이지 섹션 타입 */
export type CatalogPageSection = (typeof CATALOG_PAGE_SECTIONS)[number];

// ═══════════════════════════════════════════════════
// 2. Catalog Lifecycle State
// ═══════════════════════════════════════════════════

/** 카탈로그 항목의 생애주기 상태 */
export type CatalogLifecycleState =
  | "draft"
  | "active"
  | "review_required"
  | "deprecated"
  | "archived"
  | "superseded";

// ═══════════════════════════════════════════════════
// 3. Canonical Item
// ═══════════════════════════════════════════════════

/**
 * 정본 항목 — 플랫폼 전체에서 공유하는 단일 제품 엔티티.
 * 검색, 비교, 견적, 구매, 재고, 문서 모두 이 엔티티를 참조한다.
 */
export interface CanonicalItem {
  /** 고유 식별자 */
  id: string;
  /** 정본 제품명 (한국어) */
  canonicalName: string;
  /** 영문 제품명 */
  nameEn?: string;
  /** 제조사 */
  manufacturer: string;
  /** 카탈로그 번호 */
  catalogNumber: string;
  /** CAS 번호 */
  casNumber?: string;
  /** 로트 번호 */
  lotNumber?: string;
  /** 카테고리 */
  category: string;
  /** 세부 카테고리 */
  subcategory?: string;
  /** 생애주기 상태 */
  lifecycleState: CatalogLifecycleState;
  /** 분류 경로 (예: ["시약", "세포배양", "배지"]) */
  taxonomyPath: string[];
  /** 카테고리별 속성 스키마 (key → 값) */
  attributeSchema: Record<string, string | number | boolean>;
  /** 정규화된 식별자 목록 */
  identifiers: { type: string; value: string; normalized: string }[];
  /** 별칭 목록 */
  aliases: string[];
  /** 동의어 목록 */
  synonyms: string[];
  /** 설명 */
  description?: string;
  /** 생성 시각 (ISO 8601) */
  createdAt: string;
  /** 최종 수정 시각 (ISO 8601) */
  updatedAt: string;
  /** 생성자 ID */
  createdBy: string;
  /** 소유자 ID */
  ownerId?: string;
}

// ═══════════════════════════════════════════════════
// 4. Source Record
// ═══════════════════════════════════════════════════

/**
 * 원본 레코드 — canonical 항목에 매핑된 데이터 출처.
 * 검색 결과, 엑셀 가져오기, 프로토콜 추출 등 다양한 경로에서 유입된 원본을 추적한다.
 */
export interface SourceRecord {
  /** 고유 식별자 */
  id: string;
  /** 연결된 정본 항목 ID */
  canonicalItemId: string;
  /** 데이터 출처 */
  source: "search" | "excel_import" | "protocol_extract" | "manual" | "integration";
  /** 원본 제품명 */
  rawName: string;
  /** 원본 제조사 */
  rawManufacturer?: string;
  /** 원본 카탈로그 번호 */
  rawCatalogNumber?: string;
  /** 원본 속성 (비정형) */
  rawAttributes: Record<string, string>;
  /** 매핑 신뢰도 */
  matchConfidence: "exact" | "high" | "medium" | "low" | "unmatched";
  /** 가져온 시각 (ISO 8601) */
  importedAt: string;
  /** 가져온 사용자 ID */
  importedBy: string;
}

// ═══════════════════════════════════════════════════
// 5. Vendor Offer
// ═══════════════════════════════════════════════════

/**
 * 공급사 제안 — 정본 항목에 연결된 공급사별 가격/납기 정보.
 * 견적 비교 시 참조하며, 재고 상태 및 유효기간을 포함한다.
 */
export interface VendorOffer {
  /** 고유 식별자 */
  id: string;
  /** 연결된 정본 항목 ID */
  canonicalItemId: string;
  /** 공급사 ID */
  vendorId: string;
  /** 공급사명 */
  vendorName: string;
  /** 공급사 측 제품명 */
  offeredProductName: string;
  /** 포장 단위 (예: "500mL", "1kg") */
  packSize: string;
  /** 단가 */
  unitPrice: number;
  /** 통화 */
  currency: string;
  /** 납기 (영업일) */
  leadTimeDays?: number;
  /** 재고 상태 */
  stockStatus: "in_stock" | "limited" | "backorder" | "made_to_order" | "unknown";
  /** 마지막 견적 일시 (ISO 8601) */
  lastQuotedAt?: string;
  /** 견적 유효 기한 (ISO 8601) */
  validUntil?: string;
  /** 선호 공급사 제안 여부 */
  isPreferredOffer: boolean;
}

// ═══════════════════════════════════════════════════
// 6. Inventory Reference
// ═══════════════════════════════════════════════════

/**
 * 재고 참조 — 정본 항목과 연결된 재고 현황.
 * 실제 재고 데이터의 스냅샷이며, 재고 상세는 별도 모듈에서 관리한다.
 */
export interface InventoryReference {
  /** 연결된 정본 항목 ID */
  canonicalItemId: string;
  /** 재고 항목 ID */
  inventoryItemId: string;
  /** 보관 위치 */
  location: string;
  /** 현재 재고 수량 */
  currentQuantity: number;
  /** 단위 */
  unit: string;
  /** 안전 재고 수량 */
  safetyStock?: number;
  /** 유효기한 (ISO 8601) */
  expiryDate?: string;
  /** 마지막 검증 시각 (ISO 8601) */
  lastVerifiedAt?: string;
}

// ═══════════════════════════════════════════════════
// 7. Item Relation
// ═══════════════════════════════════════════════════

/** 항목 간 관계 유형 */
export type ItemRelationType =
  | "substitute"
  | "compatible"
  | "supersedes"
  | "component_of"
  | "variant_of";

/**
 * 항목 간 관계 — 대체, 호환, 후속 등 관계를 정의한다.
 * 관계는 방향성을 가질 수 있으며, 검증 상태를 추적한다.
 */
export interface ItemRelation {
  /** 고유 식별자 */
  id: string;
  /** 출발 항목 ID */
  fromItemId: string;
  /** 도착 항목 ID */
  toItemId: string;
  /** 관계 유형 */
  relationType: ItemRelationType;
  /** 방향성 */
  direction: "unidirectional" | "bidirectional";
  /** 관계 설명 메모 */
  note?: string;
  /** 검증자 ID */
  verifiedBy?: string;
  /** 검증 일시 (ISO 8601) */
  verifiedAt?: string;
}

// ═══════════════════════════════════════════════════
// 8. Relation Type Descriptions
// ═══════════════════════════════════════════════════

/** 관계 유형별 레이블, 설명, 예시 (한국어) */
export const RELATION_TYPE_DESCRIPTIONS: Record<
  ItemRelationType,
  { label: string; description: string; example: string }
> = {
  substitute: {
    label: "대체품",
    description: "기능적으로 동일한 대체 가능 제품",
    example: "같은 등급 다른 제조사 FBS",
  },
  compatible: {
    label: "호환품",
    description: "함께 사용 가능하지만 직접 대체는 아님",
    example: "동일 시스템용 다른 시약",
  },
  supersedes: {
    label: "후속품",
    description: "이전 제품을 대체하는 신규 버전",
    example: "카탈로그 번호 변경 후속 제품",
  },
  component_of: {
    label: "구성품",
    description: "키트나 세트의 개별 구성 요소",
    example: "세포배양 키트 내 개별 시약",
  },
  variant_of: {
    label: "변형품",
    description: "용량/포장만 다른 동일 제품",
    example: "500mL vs 1L 동일 시약",
  },
};

// ═══════════════════════════════════════════════════
// 9. Lifecycle Gating Rules
// ═══════════════════════════════════════════════════

/**
 * 생애주기 상태별 운영 흐름 자격 규칙.
 * 각 상태에서 검색/견적/발주/비교 가능 여부를 결정한다.
 */
export const LIFECYCLE_GATING_RULES: Record<
  CatalogLifecycleState,
  {
    /** 검색 결과 노출 여부 */
    searchVisible: boolean;
    /** 견적 요청 가능 여부 */
    quoteAllowed: boolean;
    /** 발주 가능 여부 */
    orderAllowed: boolean;
    /** 비교 작업 포함 가능 여부 */
    compareVisible: boolean;
    /** 상태 레이블 */
    label: string;
    /** 상태 설명 */
    description: string;
  }
> = {
  draft: {
    searchVisible: false,
    quoteAllowed: false,
    orderAllowed: false,
    compareVisible: false,
    label: "초안",
    description: "등록 진행 중, 운영에 미노출",
  },
  active: {
    searchVisible: true,
    quoteAllowed: true,
    orderAllowed: true,
    compareVisible: true,
    label: "활성",
    description: "정상 운영 상태",
  },
  review_required: {
    searchVisible: true,
    quoteAllowed: true,
    orderAllowed: false,
    compareVisible: true,
    label: "검토 필요",
    description: "속성 또는 관계 검토 필요, 발주 보류",
  },
  deprecated: {
    searchVisible: true,
    quoteAllowed: false,
    orderAllowed: false,
    compareVisible: true,
    label: "단종 예정",
    description: "검색 가능하나 신규 견적/발주 불가",
  },
  archived: {
    searchVisible: false,
    quoteAllowed: false,
    orderAllowed: false,
    compareVisible: false,
    label: "보관",
    description: "운영에서 제외, 이력 조회만 가능",
  },
  superseded: {
    searchVisible: true,
    quoteAllowed: false,
    orderAllowed: false,
    compareVisible: true,
    label: "대체됨",
    description: "후속품으로 대체, 검색 시 후속품 안내",
  },
};

// ═══════════════════════════════════════════════════
// 10. Catalog Quality Issue Type
// ═══════════════════════════════════════════════════

/** 카탈로그 데이터 품질 이슈 유형 */
export type CatalogQualityIssueType =
  | "duplicate_suspected"
  | "missing_attribute"
  | "missing_document"
  | "mapping_conflict"
  | "identifier_mismatch"
  | "stale_offer"
  | "orphan_source"
  | "relation_unverified";

// ═══════════════════════════════════════════════════
// 11. Catalog Quality Issue
// ═══════════════════════════════════════════════════

/**
 * 카탈로그 품질 이슈 — 데이터 품질 문제를 운영 큐에 노출하기 위한 구조.
 * 이슈는 자동 감지되며, 해결 액션 경로를 함께 제공한다.
 */
export interface CatalogQualityIssue {
  /** 고유 식별자 */
  id: string;
  /** 영향받는 정본 항목 ID (전체 이슈인 경우 undefined) */
  canonicalItemId?: string;
  /** 이슈 유형 */
  issueType: CatalogQualityIssueType;
  /** 이슈 제목 (한국어) */
  title: string;
  /** 이슈 설명 (한국어) */
  description: string;
  /** 심각도 */
  severity: "critical" | "high" | "medium";
  /** 감지 시각 (ISO 8601) */
  detectedAt: string;
  /** 조치 버튼 레이블 */
  actionLabel: string;
  /** 조치 링크 */
  actionHref: string;
  /** 관련 항목 ID 목록 */
  relatedItemIds?: string[];
}

// ═══════════════════════════════════════════════════
// 12. Identifier Normalization Rule
// ═══════════════════════════════════════════════════

/** 식별자 정규화 규칙 — 카탈로그 번호, CAS 번호, 제조사명 정규화에 사용 */
export interface IdentifierNormalizationRule {
  /** 대상 필드명 (예: "catalogNumber", "casNumber") */
  fieldName: string;
  /** 제거할 패턴 (정규식 문자열) */
  stripPatterns: string[];
  /** 영문 대문자 변환 여부 */
  uppercaseLetters: boolean;
  /** 공백 제거 여부 */
  removeSpaces: boolean;
  /** 정규화 예시 */
  example: { raw: string; normalized: string };
}

// ═══════════════════════════════════════════════════
// 13. Default Normalization Rules
// ═══════════════════════════════════════════════════

/** 플랫폼 표준 식별자 정규화 규칙 목록 */
export const DEFAULT_NORMALIZATION_RULES: IdentifierNormalizationRule[] = [
  {
    fieldName: "catalogNumber",
    stripPatterns: ["[\\-\\s/]"],
    uppercaseLetters: true,
    removeSpaces: true,
    example: { raw: "ab-123 / A", normalized: "AB123A" },
  },
  {
    fieldName: "casNumber",
    stripPatterns: ["[^\\d\\-]"],
    uppercaseLetters: false,
    removeSpaces: true,
    example: { raw: "7732 - 18 - 5", normalized: "7732-18-5" },
  },
  {
    fieldName: "manufacturer",
    stripPatterns: [],
    uppercaseLetters: false,
    removeSpaces: false,
    example: { raw: "Thermo  Fisher ", normalized: "Thermo Fisher" },
  },
];

// ═══════════════════════════════════════════════════
// 14. High Impact Edit Type
// ═══════════════════════════════════════════════════

/** 고영향 편집 유형 — 확인/승인/감사가 필요한 편집 작업 */
export type HighImpactEditType =
  | "merge"
  | "split"
  | "deprecate"
  | "supersede"
  | "relation_change"
  | "lifecycle_change";

// ═══════════════════════════════════════════════════
// 15. High Impact Edit Guardrail
// ═══════════════════════════════════════════════════

/**
 * 고영향 편집 가드레일 — 위험도가 높은 편집에 대한 보호 규칙.
 * 확인, 승인, 감사 요구 수준과 영향받는 영역을 명시한다.
 */
export interface HighImpactEditGuardrail {
  /** 편집 유형 */
  editType: HighImpactEditType;
  /** 사용자 확인 필요 여부 */
  requiresConfirmation: boolean;
  /** 검토자 승인 필요 여부 */
  requiresReviewerApproval: boolean;
  /** 영향 설명 (한국어) */
  impactDescription: string;
  /** 영향받는 영역 (한국어) */
  affectedAreas: string[];
  /** 감사 기록 필요 여부 */
  auditRequired: boolean;
}

// ═══════════════════════════════════════════════════
// 16. Catalog Health Thresholds
// ═══════════════════════════════════════════════════

/** 카탈로그 건강 지표 임계값 — 경고/위험 수준을 정의한다 */
export const CATALOG_HEALTH_THRESHOLDS = {
  /** 중복 의심 비율 (%) */
  duplicateSuspectedPercent: { warning: 3, danger: 8 },
  /** 속성 누락 비율 (%) */
  missingAttributePercent: { warning: 10, danger: 25 },
  /** 공급사 제안 유효 경과 일수 */
  staleOfferDays: { warning: 90, danger: 180 },
} as const;

// ═══════════════════════════════════════════════════
// 17. Empty / Error / Unavailable Copy
// ═══════════════════════════════════════════════════

/** 카탈로그가 비어있을 때 표시할 문구 */
export const CATALOG_EMPTY_COPY = {
  title: "등록된 품목이 없습니다",
  description: "품목을 등록하면 검색, 비교, 견적에 활용할 수 있습니다",
  actionLabel: "품목 등록하기",
  actionHref: "/dashboard/catalog/new",
} as const;

/** 카탈로그 로드 에러 시 표시할 문구 */
export const CATALOG_ERROR_COPY = {
  title: "카탈로그 정보를 불러오지 못했습니다",
  description: "잠시 후 다시 시도해주세요",
  actionLabel: "다시 시도",
} as const;

/** 카탈로그 접근 불가 시 표시할 문구 */
export const CATALOG_UNAVAILABLE_COPY = {
  title: "현재 권한으로 카탈로그 관리에 접근할 수 없습니다",
  description: "카탈로그 관리자 권한이 필요합니다",
  actionLabel: "권한 요청하기",
  actionHref: "/dashboard/support-center?tab=ticket",
} as const;

// ═══════════════════════════════════════════════════
// 18. Anti-Patterns
// ═══════════════════════════════════════════════════

/** 카탈로그 운영에서 반드시 피해야 할 안티패턴 */
export const CATALOG_ANTI_PATTERNS: string[] = [
  "정본 항목 없이 검색 결과를 직접 견적/비교에 사용한다",
  "lifecycle 상태를 무시하고 모든 항목을 동일하게 노출한다",
  "중복 의심 항목을 운영 큐에 노출하지 않고 방치한다",
  "식별자(카탈로그 번호) 정규화 없이 문자열 비교만 수행한다",
  "공급사 제안 만료 여부를 확인하지 않고 견적에 포함한다",
  "고영향 편집(병합/분리/대체)에 확인/승인 없이 즉시 반영한다",
  "원본 레코드와 정본 항목의 매핑 이력을 추적하지 않는다",
  "품질 이슈를 UI에 노출하지 않아 데이터 문제가 숨겨진다",
];

// ═══════════════════════════════════════════════════
// 19. Code Review Checklist
// ═══════════════════════════════════════════════════

/** 카탈로그 관련 PR 코드 리뷰 시 확인할 체크리스트 */
export const catalogCodeReviewChecklist: string[] = [
  "카탈로그 번호 비교 시 normalizeIdentifier를 사용하는가?",
  "lifecycle 상태에 따른 gating 규칙(LIFECYCLE_GATING_RULES)을 참조하는가?",
  "고영향 편집 시 HighImpactEditGuardrail의 confirmation/approval/audit 요구사항을 따르는가?",
  "품질 이슈가 감지되면 qualityIssues 섹션에 노출하는가?",
  "원본 레코드(SourceRecord)와 정본 항목(CanonicalItem)의 매핑 이력을 보존하는가?",
  "공급사 제안(VendorOffer)의 validUntil과 stockStatus를 견적 생성 전에 확인하는가?",
  "항목 관계(ItemRelation) 변경 시 감사 기록을 남기는가?",
  "빈 상태/에러 상태에서 CATALOG_EMPTY_COPY, CATALOG_ERROR_COPY를 사용하는가?",
  "재고 참조(InventoryReference)의 safetyStock 경고를 표시하는가?",
  "CATALOG_HEALTH_THRESHOLDS 임계값을 기준으로 건강 지표 톤을 분류하는가?",
];
