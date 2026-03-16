/**
 * Compare & Decision Workspace — Diff Output Spec
 *
 * Track B 설계 문서 #4
 *
 * L3 (비교 엔진) 레이어의 출력 계약.
 * 두 문서/제품/견적/스펙 간 차이를 구조적으로 추출한다.
 *
 * 비교 출력: raw diff → structured diff → significance → actionability hint
 */

import type { CanonicalFieldKey } from "./01-canonical-schema";
import type { OntologyRelationType } from "./02-ontology-draft";

// ══════════════════════════════════════════════════════════════════════════════
// 비교 요청
// ══════════════════════════════════════════════════════════════════════════════

export interface CompareRequest {
  compareId: string;
  sourceEntityId: string;     // 비교 기준 (A)
  targetEntityId: string;     // 비교 대상 (B)
  compareType: CompareType;
  requestedBy: string;
  requestedAt: Date;
  options?: CompareOptions;
}

export type CompareType =
  | "PRODUCT_VS_PRODUCT"
  | "QUOTE_VS_QUOTE"
  | "PRODUCT_VS_SPEC"
  | "SDS_VS_SDS"
  | "COA_VS_COA"
  | "QUOTE_VS_CATALOG";

export interface CompareOptions {
  fieldsToCompare?: CanonicalFieldKey[];  // null = 전체
  ignoreFields?: CanonicalFieldKey[];
  significanceThreshold?: DiffSignificance;
}

// ══════════════════════════════════════════════════════════════════════════════
// 비교 결과
// ══════════════════════════════════════════════════════════════════════════════

export interface DiffResult {
  compareId: string;
  sourceEntityId: string;
  targetEntityId: string;
  compareType: CompareType;
  totalFieldsCompared: number;
  totalDifferences: number;
  items: DiffItem[];
  summary: DiffSummary;
  ontologyHints: OntologyHint[];
  computedAt: Date;
}

// ══════════════════════════════════════════════════════════════════════════════
// 개별 Diff 항목
// ══════════════════════════════════════════════════════════════════════════════

export interface DiffItem {
  fieldKey: CanonicalFieldKey;
  fieldLabel: string;
  diffType: DiffType;
  sourceValue: unknown;
  targetValue: unknown;
  sourceRawText?: string | null;
  targetRawText?: string | null;
  significance: DiffSignificance;
  actionability: DiffActionability;
  note?: string | null;
}

export type DiffType =
  | "IDENTICAL"       // 동일
  | "DIFFERENT"       // 값이 다름
  | "SOURCE_ONLY"     // A에만 존재
  | "TARGET_ONLY"     // B에만 존재
  | "FORMAT_DIFF"     // 값은 같지만 표기가 다름 (예: "100 mL" vs "0.1 L")
  | "UNIT_DIFF";      // 단위가 달라 직접 비교 불가

// ══════════════════════════════════════════════════════════════════════════════
// Significance (중요도)
// ══════════════════════════════════════════════════════════════════════════════

export type DiffSignificance =
  | "CRITICAL"   // 사용/구매 결정에 직접 영향 (규격, 안전, 호환성)
  | "HIGH"       // 비용/일정에 영향 (가격, 리드타임)
  | "MEDIUM"     // 참고 사항 (포장, 등급)
  | "LOW"        // 표기 차이 (약어, 형식)
  | "INFO";      // 정보성 (CAS 번호 차이 등)

export const SIGNIFICANCE_LABELS: Record<DiffSignificance, string> = {
  CRITICAL: "치명적",
  HIGH: "높음",
  MEDIUM: "보통",
  LOW: "낮음",
  INFO: "참고",
};

export const SIGNIFICANCE_BADGE_COLORS: Record<DiffSignificance, string> = {
  CRITICAL: "bg-red-100 text-red-800",
  HIGH: "bg-orange-100 text-orange-800",
  MEDIUM: "bg-yellow-100 text-yellow-800",
  LOW: "bg-blue-100 text-blue-800",
  INFO: "bg-gray-100 text-gray-600",
};

// ══════════════════════════════════════════════════════════════════════════════
// Actionability (실행 가능성)
// ══════════════════════════════════════════════════════════════════════════════

export type DiffActionability =
  | "REQUIRES_DECISION"     // 사용자 판단 필요
  | "REQUIRES_REVIEW"       // 전문가 검토 필요
  | "REQUIRES_INQUIRY"      // 공급사 문의 필요
  | "AUTO_RESOLVABLE"       // 시스템이 자동 해석 가능
  | "INFORMATIONAL";        // 조치 불필요

export const ACTIONABILITY_LABELS: Record<DiffActionability, string> = {
  REQUIRES_DECISION: "판단 필요",
  REQUIRES_REVIEW: "검토 필요",
  REQUIRES_INQUIRY: "문의 필요",
  AUTO_RESOLVABLE: "자동 해석",
  INFORMATIONAL: "참고",
};

// ══════════════════════════════════════════════════════════════════════════════
// 대표 diff 항목별 기본 significance 매핑
// ══════════════════════════════════════════════════════════════════════════════

export const DEFAULT_FIELD_SIGNIFICANCE: Record<CanonicalFieldKey, DiffSignificance> = {
  manufacturer: "HIGH",
  supplier: "MEDIUM",
  catalogNumber: "HIGH",
  productName: "HIGH",
  packSize: "MEDIUM",
  unit: "MEDIUM",
  concentration: "CRITICAL",
  purity: "CRITICAL",
  grade: "HIGH",
  storageCondition: "CRITICAL",
  safetyClassification: "CRITICAL",
  casNumber: "INFO",
  lotNumber: "LOW",
  expiryDate: "MEDIUM",
  quoteAmount: "HIGH",
  currency: "HIGH",
  leadTimeDays: "HIGH",
  moq: "MEDIUM",
  hazardStatements: "CRITICAL",
  precautionaryStatements: "CRITICAL",
};

// ══════════════════════════════════════════════════════════════════════════════
// Diff Summary
// ══════════════════════════════════════════════════════════════════════════════

export interface DiffSummary {
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
  overallVerdict: DiffVerdict;
  verdictReason: string;
}

export type DiffVerdict =
  | "EQUIVALENT"           // 실질적으로 동일
  | "MINOR_DIFFERENCES"    // 경미한 차이, 대체 가능
  | "SIGNIFICANT_DIFFERENCES" // 중요한 차이, 검토 필요
  | "INCOMPATIBLE"         // 대체 불가
  | "REQUIRES_EXPERT";     // 전문가 판단 필요

// ══════════════════════════════════════════════════════════════════════════════
// Ontology Hint (비교 엔진 → 온톨로지 레이어 연결)
// ══════════════════════════════════════════════════════════════════════════════

export interface OntologyHint {
  suggestedRelation: OntologyRelationType;
  confidence: number;  // 0.0–1.0
  basedOn: CanonicalFieldKey[];
  explanation: string;
}
