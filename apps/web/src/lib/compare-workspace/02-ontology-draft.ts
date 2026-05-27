/**
 * Compare & Decision Workspace — Ontology Entity/Relation Draft
 *
 * Track B 설계 문서 #3
 *
 * L4 (온톨로지 매핑) 레이어의 엔터티·관계 타입 정의.
 * 표기가 달라도 같은 엔터티인지, 대체 가능성이 있는지 해석한다.
 */

// ══════════════════════════════════════════════════════════════════════════════
// 핵심 엔터티 타입
// ══════════════════════════════════════════════════════════════════════════════

export type OntologyEntityType =
  | "MANUFACTURER"           // 제조사
  | "SUPPLIER"               // 공급사
  | "PRODUCT"                // 제품
  | "MATERIAL_REAGENT_CLASS" // 시약/재료 분류
  | "EQUIPMENT_CATEGORY"     // 장비 카테고리
  | "SPEC_ATTRIBUTE"         // 규격 속성
  | "PACK_UNIT"              // 포장/단위
  | "STORAGE_REQUIREMENT"    // 보관 조건
  | "HAZARD_SAFETY_CLASS"    // 위험/안전 분류
  | "SUBSTITUTION_GROUP";    // 대체 그룹

export interface OntologyEntity {
  entityId: string;
  entityType: OntologyEntityType;
  canonicalName: string;
  aliases: string[];              // 동의어, 약어, 다국어 표기
  externalIds: ExternalId[];      // CAS, UNSPSC, HS Code 등
  attributes: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExternalId {
  system: string;   // "CAS" | "UNSPSC" | "HS_CODE" | "PUBCHEM" | "ECHA"
  value: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// 핵심 관계 타입
// ══════════════════════════════════════════════════════════════════════════════

export type OntologyRelationType =
  | "SAME_AS"                // 동일 엔터티 (표기만 다름)
  | "SUPPLIED_BY"            // 제품 ← 공급사
  | "MANUFACTURED_BY"        // 제품 ← 제조사
  | "VARIANT_OF"             // 동일 제품의 다른 규격/포장
  | "SUBSTITUTE_FOR"         // 대체 가능 (기능적 동등)
  | "INCOMPATIBLE_WITH"      // 함께 사용 불가
  | "REQUIRES_REVIEW_FOR"    // 대체 시 전문가 검토 필요
  | "BELONGS_TO_CLASS"       // 분류 계층 소속
  | "HAS_SPEC"               // 제품 → 규격 속성
  | "STORED_UNDER";          // 제품 → 보관 조건

export interface OntologyRelation {
  relationId: string;
  relationType: OntologyRelationType;
  sourceEntityId: string;
  targetEntityId: string;
  confidence: RelationConfidence;
  evidence: RelationEvidence[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  verifiedAt?: Date | null;
  verifiedBy?: string | null;
}

export type RelationConfidence =
  | "CONFIRMED"     // 사람이 확인
  | "HIGH"          // AI 높은 확신
  | "MEDIUM"        // AI 중간 확신, 검토 권장
  | "LOW"           // AI 낮은 확신, 검토 필수
  | "REJECTED";     // 사람이 거부

export interface RelationEvidence {
  evidenceType: "DOCUMENT" | "CAS_MATCH" | "NAME_SIMILARITY" | "SPEC_MATCH" | "MANUAL";
  sourceDocumentId?: string | null;
  description: string;
  score?: number | null;  // 0.0–1.0
}

// ══════════════════════════════════════════════════════════════════════════════
// 엔터티 해석 결과 (Entity Resolution)
// ══════════════════════════════════════════════════════════════════════════════

export interface EntityResolution {
  resolutionId: string;
  queryEntityId: string;         // 비교 대상 A
  candidateEntityId: string;     // 비교 대상 B
  resolvedRelation: OntologyRelationType | null;
  confidence: RelationConfidence;
  evidence: RelationEvidence[];
  requiresHumanReview: boolean;
  reviewNote?: string | null;
}

// ══════════════════════════════════════════════════════════════════════════════
// 관계 타입별 의미와 액션 연결
// ══════════════════════════════════════════════════════════════════════════════

export interface RelationTypeDefinition {
  relationType: OntologyRelationType;
  label: string;
  description: string;
  bidirectional: boolean;
  actionHint: string;
}

export const RELATION_TYPE_DEFINITIONS: RelationTypeDefinition[] = [
  {
    relationType: "SAME_AS",
    label: "동일",
    description: "동일 엔터티의 다른 표기 (예: Sigma-Aldrich = MilliporeSigma)",
    bidirectional: true,
    actionHint: "자동 병합 가능",
  },
  {
    relationType: "SUPPLIED_BY",
    label: "공급",
    description: "특정 공급사가 해당 제품을 공급",
    bidirectional: false,
    actionHint: "공급사별 가격/리드타임 비교",
  },
  {
    relationType: "MANUFACTURED_BY",
    label: "제조",
    description: "특정 제조사가 해당 제품을 생산",
    bidirectional: false,
    actionHint: "제조사 정보 표시",
  },
  {
    relationType: "VARIANT_OF",
    label: "변종",
    description: "동일 제품의 다른 규격/포장 (예: 100mL vs 500mL)",
    bidirectional: true,
    actionHint: "규격 비교 테이블 표시",
  },
  {
    relationType: "SUBSTITUTE_FOR",
    label: "대체 가능",
    description: "기능적으로 동등하여 대체 사용 가능",
    bidirectional: true,
    actionHint: "대체 제품 추천, 가격/납기 비교",
  },
  {
    relationType: "INCOMPATIBLE_WITH",
    label: "비호환",
    description: "함께 사용 시 문제 발생 가능",
    bidirectional: true,
    actionHint: "경고 표시, 동시 주문 차단",
  },
  {
    relationType: "REQUIRES_REVIEW_FOR",
    label: "검토 필요",
    description: "대체 시 전문가 검토가 필요한 관계",
    bidirectional: false,
    actionHint: "검토 요청 CTA 활성화",
  },
  {
    relationType: "BELONGS_TO_CLASS",
    label: "분류 소속",
    description: "상위 분류 체계에 소속",
    bidirectional: false,
    actionHint: "분류별 탐색 지원",
  },
  {
    relationType: "HAS_SPEC",
    label: "규격 보유",
    description: "제품이 특정 규격 속성을 가짐",
    bidirectional: false,
    actionHint: "규격 필터링",
  },
  {
    relationType: "STORED_UNDER",
    label: "보관 조건",
    description: "제품의 보관 조건 요구사항",
    bidirectional: false,
    actionHint: "보관 조건 경고/필터",
  },
];
