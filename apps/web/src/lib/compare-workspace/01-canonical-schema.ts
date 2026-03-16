/**
 * Compare & Decision Workspace — Canonical Schema Draft
 *
 * Track B 설계 문서 #2
 *
 * L1 (문서 수집) + L2 (정규화) 레이어의 데이터 계약.
 * 원본 문서를 canonical fields로 변환할 때의 스키마를 정의한다.
 *
 * 원칙:
 *   - raw source와 normalized field를 연결해 provenance 유지
 *   - 추정값과 확정값을 구분 (confidence)
 *   - 신뢰도 표시 가능하게 설계
 */

import type { DocumentCategory } from "./00-workspace-ia";

// ══════════════════════════════════════════════════════════════════════════════
// L1: 문서 수집 — Document Record
// ══════════════════════════════════════════════════════════════════════════════

export interface DocumentRecord {
  documentId: string;
  category: DocumentCategory;
  title: string;
  sourceType: DocumentSourceType;
  sourceUrl?: string | null;
  fileKey?: string | null;         // S3/storage key
  mimeType: string;
  fileSizeBytes: number;
  version: number;
  previousVersionId?: string | null;
  uploadedBy: string;
  organizationId?: string | null;
  linkedEntityType?: string | null; // "PRODUCT" | "QUOTE" | "ORDER" etc.
  linkedEntityId?: string | null;
  provenance: DocumentProvenance;
  createdAt: Date;
  updatedAt: Date;
}

export type DocumentSourceType =
  | "UPLOAD"        // 직접 업로드
  | "EMAIL_ATTACH"  // 이메일 첨부
  | "URL_LINK"      // URL 연결
  | "API_FETCH"     // API 자동 수집
  | "SYSTEM_GEN";   // 시스템 생성

export interface DocumentProvenance {
  originalFilename: string;
  receivedFrom?: string | null;    // vendor name, email sender, etc.
  receivedAt?: Date | null;
  hashSha256: string;              // 무결성 검증용
  parsingMethod?: string | null;   // "AI_EXTRACT" | "STRUCTURED_PARSE" | "MANUAL"
  parsingConfidence?: number | null; // 0.0–1.0
}

// ══════════════════════════════════════════════════════════════════════════════
// L2: 정규화 — Canonical Fields
// ══════════════════════════════════════════════════════════════════════════════

/**
 * 모든 문서/제품/견적에서 추출 가능한 정규화 필드 목록.
 * 각 필드는 CanonicalFieldValue로 감싸서
 * raw source 연결 + 신뢰도 정보를 유지한다.
 */
export interface NormalizedEntity {
  entityId: string;
  sourceDocumentId: string;
  entityType: NormalizedEntityType;
  fields: NormalizedFieldSet;
  extractedAt: Date;
  extractedBy: string;  // "AI_PIPELINE" | "MANUAL" | operator ID
}

export type NormalizedEntityType =
  | "PRODUCT"
  | "VENDOR_QUOTE_LINE"
  | "SDS_ENTRY"
  | "COA_RESULT"
  | "PROTOCOL_STEP";

/**
 * 정규화된 필드 집합.
 * 모든 필드는 optional — 문서 유형에 따라 채워지는 필드가 다르다.
 */
export interface NormalizedFieldSet {
  manufacturer?: CanonicalFieldValue<string>;
  supplier?: CanonicalFieldValue<string>;
  catalogNumber?: CanonicalFieldValue<string>;
  productName?: CanonicalFieldValue<string>;
  packSize?: CanonicalFieldValue<string>;
  unit?: CanonicalFieldValue<string>;
  concentration?: CanonicalFieldValue<string>;
  purity?: CanonicalFieldValue<string>;
  grade?: CanonicalFieldValue<string>;
  storageCondition?: CanonicalFieldValue<string>;
  safetyClassification?: CanonicalFieldValue<string>;
  casNumber?: CanonicalFieldValue<string>;
  lotNumber?: CanonicalFieldValue<string>;
  expiryDate?: CanonicalFieldValue<string>;   // ISO date string
  quoteAmount?: CanonicalFieldValue<number>;
  currency?: CanonicalFieldValue<string>;
  leadTimeDays?: CanonicalFieldValue<number>;
  moq?: CanonicalFieldValue<number>;          // minimum order quantity
  hazardStatements?: CanonicalFieldValue<string[]>;
  precautionaryStatements?: CanonicalFieldValue<string[]>;
}

// ══════════════════════════════════════════════════════════════════════════════
// Canonical Field Value — provenance wrapper
// ══════════════════════════════════════════════════════════════════════════════

export interface CanonicalFieldValue<T> {
  value: T;
  confidence: FieldConfidence;
  source: FieldSource;
  isEstimated: boolean;            // true = AI 추정, false = 문서에서 직접 추출
  rawText?: string | null;         // 원본 문서의 해당 텍스트
  rawLocation?: FieldLocation | null; // 원본 문서 내 위치
}

export type FieldConfidence =
  | "HIGH"       // 0.9+ — 문서에서 명확히 추출
  | "MEDIUM"     // 0.7–0.9 — 맥락 추론 포함
  | "LOW"        // 0.5–0.7 — 불확실, 검토 필요
  | "UNVERIFIED"; // 수동 검증 필요

export interface FieldSource {
  documentId: string;
  pageNumber?: number | null;
  sectionName?: string | null;
  extractionMethod: "STRUCTURED_PARSE" | "AI_EXTRACT" | "REGEX" | "MANUAL" | "LOOKUP";
}

export interface FieldLocation {
  pageNumber: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  lineRange?: {
    start: number;
    end: number;
  } | null;
}

// ══════════════════════════════════════════════════════════════════════════════
// Canonical Field Keys (for type-safe iteration)
// ══════════════════════════════════════════════════════════════════════════════

export const CANONICAL_FIELD_KEYS = [
  "manufacturer",
  "supplier",
  "catalogNumber",
  "productName",
  "packSize",
  "unit",
  "concentration",
  "purity",
  "grade",
  "storageCondition",
  "safetyClassification",
  "casNumber",
  "lotNumber",
  "expiryDate",
  "quoteAmount",
  "currency",
  "leadTimeDays",
  "moq",
  "hazardStatements",
  "precautionaryStatements",
] as const;

export type CanonicalFieldKey = (typeof CANONICAL_FIELD_KEYS)[number];

export const CANONICAL_FIELD_LABELS: Record<CanonicalFieldKey, string> = {
  manufacturer: "제조사",
  supplier: "공급사",
  catalogNumber: "카탈로그 번호",
  productName: "제품명",
  packSize: "포장 규격",
  unit: "단위",
  concentration: "농도",
  purity: "순도",
  grade: "등급",
  storageCondition: "보관 조건",
  safetyClassification: "안전 분류",
  casNumber: "CAS 번호",
  lotNumber: "Lot 번호",
  expiryDate: "유효기한",
  quoteAmount: "견적 금액",
  currency: "통화",
  leadTimeDays: "리드타임 (일)",
  moq: "최소주문수량",
  hazardStatements: "위험 문구 (H-statements)",
  precautionaryStatements: "예방 문구 (P-statements)",
};
