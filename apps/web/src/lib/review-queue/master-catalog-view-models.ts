/**
 * Master Catalog UI ViewModel 타입 및 헬퍼 함수 정의
 *
 * master-catalog-contract.ts의 도메인 모델을 UI 렌더링에 필요한
 * ViewModel로 변환하기 위한 타입과 유틸리티를 제공한다.
 */

import type {
  CatalogLifecycleState,
  CatalogQualityIssueType,
} from "./master-catalog-contract";
import { DEFAULT_NORMALIZATION_RULES } from "./master-catalog-contract";

// ═══════════════════════════════════════════════════
// 1. CatalogHealthSummaryViewModel
// ═══════════════════════════════════════════════════

/**
 * 카탈로그 건강 요약 ViewModel.
 * Health Summary 카드에 필요한 모든 표시 데이터를 포함한다.
 */
export interface CatalogHealthSummaryViewModel {
  /** 전체 항목 수 */
  totalItems: number;
  /** 활성 항목 수 */
  activeItems: number;
  /** 초안 항목 수 */
  draftItems: number;
  /** 단종 예정 항목 수 */
  deprecatedItems: number;
  /** 보관 항목 수 */
  archivedItems: number;
  /** 중복 의심 건수 */
  duplicateSuspectedCount: number;
  /** 속성 누락 건수 */
  missingAttributeCount: number;
  /** 문서 누락 건수 */
  missingDocumentCount: number;
  /** 품질 점수 (0-100) */
  qualityScore: number;
  /** 품질 톤 */
  qualityTone: "healthy" | "warning" | "danger";
  /** 가장 시급한 이슈 레이블 (한국어) */
  topIssueLabel?: string;
}

// ═══════════════════════════════════════════════════
// 2. CatalogQualityIssueViewModel
// ═══════════════════════════════════════════════════

/**
 * 카탈로그 품질 이슈 ViewModel.
 * 품질 이슈 목록의 각 행에 필요한 표시 데이터를 포함한다.
 */
export interface CatalogQualityIssueViewModel {
  /** 이슈 ID */
  id: string;
  /** 이슈 유형 */
  issueType: CatalogQualityIssueType;
  /** 이슈 유형 레이블 (한국어) */
  issueTypeLabel: string;
  /** 이슈 제목 */
  title: string;
  /** 이슈 설명 */
  description: string;
  /** 심각도 */
  severity: "critical" | "high" | "medium";
  /** 심각도 레이블 (한국어) */
  severityLabel: string;
  /** 영향받는 항목 레이블 */
  itemLabel?: string;
  /** 조치 버튼 레이블 */
  actionLabel: string;
  /** 조치 링크 */
  actionHref: string;
  /** 감지 시각 상대 표현 (예: "3시간 전") */
  detectedLabel: string;
}

// ═══════════════════════════════════════════════════
// 3. CatalogItemListViewModel
// ═══════════════════════════════════════════════════

/**
 * 카탈로그 항목 목록 ViewModel.
 * 카탈로그 리스트의 각 행에 필요한 표시 데이터를 포함한다.
 */
export interface CatalogItemListViewModel {
  /** 항목 ID */
  id: string;
  /** 정본 제품명 */
  canonicalName: string;
  /** 제조사 */
  manufacturer: string;
  /** 카탈로그 번호 */
  catalogNumber: string;
  /** 카테고리 레이블 */
  categoryLabel: string;
  /** 생애주기 상태 레이블 */
  lifecycleLabel: string;
  /** 생애주기 상태 UI 톤 */
  lifecycleTone: string;
  /** 별칭 수 */
  aliasCount: number;
  /** 관계 수 */
  relationCount: number;
  /** 공급사 제안 수 */
  vendorOfferCount: number;
  /** 재고 연결 여부 */
  inventoryLinked: boolean;
  /** 품질 이슈 건수 */
  qualityIssueCount: number;
  /** 상세 페이지 링크 */
  href: string;
}

// ═══════════════════════════════════════════════════
// 4. CatalogItemDetailViewModel
// ═══════════════════════════════════════════════════

/**
 * 카탈로그 항목 상세 ViewModel.
 * 항목 상세 패널에 필요한 모든 표시 데이터를 포함한다.
 */
export interface CatalogItemDetailViewModel {
  /** 항목 ID */
  id: string;
  /** 정본 제품명 */
  canonicalName: string;
  /** 영문 제품명 */
  nameEn?: string;
  /** 제조사 */
  manufacturer: string;
  /** 카탈로그 번호 */
  catalogNumber: string;
  /** CAS 번호 */
  casNumber?: string;
  /** 카테고리 레이블 */
  categoryLabel: string;
  /** 분류 경로 */
  taxonomyPath: string[];
  /** 생애주기 상태 */
  lifecycleState: CatalogLifecycleState;
  /** 생애주기 상태 레이블 */
  lifecycleLabel: string;
  /** 생애주기 상태 UI 톤 */
  lifecycleTone: string;
  /** 속성 목록 */
  attributes: { key: string; label: string; value: string }[];
  /** 정규화된 식별자 목록 */
  identifiers: { type: string; normalizedValue: string }[];
  /** 별칭 목록 */
  aliases: string[];
  /** 동의어 목록 */
  synonyms: string[];
  /** 관련 항목 목록 */
  relations: {
    relationType: string;
    relationLabel: string;
    targetItemName: string;
    direction: string;
    verified: boolean;
  }[];
  /** 공급사 제안 목록 */
  vendorOffers: {
    vendorName: string;
    packSize: string;
    priceLabel: string;
    stockLabel: string;
    isPreferred: boolean;
  }[];
  /** 재고 참조 목록 */
  inventoryRefs: {
    location: string;
    quantityLabel: string;
    expiryLabel?: string;
  }[];
  /** 연결 문서 목록 */
  documents: {
    type: string;
    label: string;
    status: "attached" | "missing" | "expired";
  }[];
  /** 품질 이슈 목록 */
  qualityIssues: CatalogQualityIssueViewModel[];
  /** 감사 이력 */
  auditEntries: {
    actor: string;
    action: string;
    timeLabel: string;
  }[];
}

// ═══════════════════════════════════════════════════
// 5. MasterCatalogPageViewModel
// ═══════════════════════════════════════════════════

/**
 * 마스터 카탈로그 페이지 최상위 ViewModel.
 * 페이지 전체를 구성하는 모든 섹션의 ViewModel을 통합한다.
 */
export interface MasterCatalogPageViewModel {
  /** 페이지 헤더 */
  header: {
    /** 페이지 제목 */
    title: string;
    /** 페이지 목적 설명 */
    purposeDescription: string;
    /** 주요 액션 레이블 */
    primaryActionLabel?: string;
  };
  /** 건강 요약 */
  healthSummary: CatalogHealthSummaryViewModel;
  /** 품질 이슈 목록 */
  qualityIssues: CatalogQualityIssueViewModel[];
  /** 항목 목록 */
  items: CatalogItemListViewModel[];
  /** 선택된 항목 상세 (없으면 undefined) */
  selectedItem?: CatalogItemDetailViewModel;
  /** 페이지 상태 */
  pageState: {
    /** 데이터 없음 */
    isEmpty: boolean;
    /** 에러 발생 */
    hasError: boolean;
    /** 접근 불가 */
    isUnavailable: boolean;
  };
}

// ═══════════════════════════════════════════════════
// 6. normalizeIdentifier 헬퍼
// ═══════════════════════════════════════════════════

/**
 * 식별자 값을 DEFAULT_NORMALIZATION_RULES에 따라 정규화한다.
 *
 * @param value - 원본 식별자 값
 * @param fieldName - 필드명 (예: "catalogNumber", "casNumber", "manufacturer")
 * @returns 정규화된 식별자 값. 규칙이 없으면 trim만 적용.
 *
 * @example
 * normalizeIdentifier("ab-123 / A", "catalogNumber") // "AB123A"
 * normalizeIdentifier("7732 - 18 - 5", "casNumber")   // "7732-18-5"
 * normalizeIdentifier("Thermo  Fisher ", "manufacturer") // "Thermo Fisher"
 */
export function normalizeIdentifier(value: string, fieldName: string): string {
  const rule = DEFAULT_NORMALIZATION_RULES.find((r) => r.fieldName === fieldName);
  if (!rule) {
    return value.trim();
  }

  let result = value;

  // stripPatterns 적용
  for (const pattern of rule.stripPatterns) {
    result = result.replace(new RegExp(pattern, "g"), "");
  }

  // 공백 제거 또는 축소
  if (rule.removeSpaces) {
    result = result.replace(/\s+/g, "");
  } else {
    result = result.trim().replace(/\s+/g, " ");
  }

  // 대문자 변환
  if (rule.uppercaseLetters) {
    result = result.toUpperCase();
  }

  return result.trim();
}

// ═══════════════════════════════════════════════════
// 7. detectDuplicateCandidates 헬퍼
// ═══════════════════════════════════════════════════

/**
 * 항목 목록에서 중복 의심 쌍을 탐지한다.
 * 카탈로그 번호 정규화 비교, 제조사 + CAS 번호 비교를 수행한다.
 *
 * @param items - 비교 대상 항목 목록
 * @returns 중복 의심 쌍 목록 (항목 ID 쌍 + 매칭 사유)
 */
export function detectDuplicateCandidates(
  items: {
    id: string;
    manufacturer: string;
    catalogNumber: string;
    casNumber?: string;
  }[],
): { itemA: string; itemB: string; matchReason: string }[] {
  const results: { itemA: string; itemB: string; matchReason: string }[] = [];

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];

      // 카탈로그 번호 정규화 비교
      const normA = normalizeIdentifier(a.catalogNumber, "catalogNumber");
      const normB = normalizeIdentifier(b.catalogNumber, "catalogNumber");
      if (normA && normB && normA === normB) {
        results.push({
          itemA: a.id,
          itemB: b.id,
          matchReason: "정규화된 카탈로그 번호 일치",
        });
        continue;
      }

      // 제조사 + CAS 번호 비교
      if (a.casNumber && b.casNumber) {
        const mfgA = normalizeIdentifier(a.manufacturer, "manufacturer");
        const mfgB = normalizeIdentifier(b.manufacturer, "manufacturer");
        const casA = normalizeIdentifier(a.casNumber, "casNumber");
        const casB = normalizeIdentifier(b.casNumber, "casNumber");
        if (mfgA === mfgB && casA === casB) {
          results.push({
            itemA: a.id,
            itemB: b.id,
            matchReason: "동일 제조사 + CAS 번호 일치",
          });
        }
      }
    }
  }

  return results;
}

// ═══════════════════════════════════════════════════
// 8. resolveLifecycleTone 헬퍼
// ═══════════════════════════════════════════════════

/**
 * 생애주기 상태를 UI 톤으로 변환한다.
 *
 * - active → "active"
 * - draft, review_required → "warning"
 * - deprecated, superseded → "danger"
 * - archived → "muted"
 *
 * @param state - 생애주기 상태
 * @returns UI 톤
 */
export function resolveLifecycleTone(
  state: CatalogLifecycleState,
): "active" | "warning" | "danger" | "muted" {
  switch (state) {
    case "active":
      return "active";
    case "draft":
    case "review_required":
      return "warning";
    case "deprecated":
    case "superseded":
      return "danger";
    case "archived":
      return "muted";
    default:
      return "muted";
  }
}

// ═══════════════════════════════════════════════════
// 9. calculateCatalogQualityScore 헬퍼
// ═══════════════════════════════════════════════════

/**
 * 카탈로그 품질 점수를 산출한다.
 *
 * 가중치: critical=3, high=2, medium=1
 * 점수 = max(0, 100 - (총 가중치 / 전체 항목 수) * 100)
 *
 * @param totalItems - 전체 항목 수
 * @param issues - 이슈 목록 (심각도 포함)
 * @returns 품질 점수 (0-100)
 */
export function calculateCatalogQualityScore(
  totalItems: number,
  issues: { severity: string }[],
): number {
  if (totalItems <= 0) {
    return issues.length === 0 ? 100 : 0;
  }

  const severityWeights: Record<string, number> = {
    critical: 3,
    high: 2,
    medium: 1,
  };

  const totalWeight = issues.reduce((sum, issue) => {
    return sum + (severityWeights[issue.severity] ?? 0);
  }, 0);

  const score = 100 - (totalWeight / totalItems) * 100;
  return Math.max(0, Math.round(score));
}
