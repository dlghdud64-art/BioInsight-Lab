/**
 * Compare & Decision Workspace — AI Work Panel Contract
 *
 * Track B 설계 문서 #5
 *
 * L5 (AI 작업 패널) 레이어의 입출력 계약.
 * 비교 결과와 문서 맥락을 사람이 빠르게 판단할 수 있게 정리한다.
 *
 * 금지:
 *   - raw diff 없이 AI 요약만 노출
 *   - provenance 없는 단정형 판단
 *   - 액션 연결 없는 요약 카드
 */

import type { DiffResult, DiffSignificance, DiffActionability } from "./03-diff-output-spec";
import type { EntityResolution } from "./02-ontology-draft";
import type { CanonicalFieldKey } from "./01-canonical-schema";

// ══════════════════════════════════════════════════════════════════════════════
// Work Panel View — 패널 전체 출력
// ══════════════════════════════════════════════════════════════════════════════

export interface WorkPanelView {
  panelId: string;
  compareId: string;
  sections: WorkPanelSection[];
  recommendedActions: RecommendedAction[];
  reviewPoints: ReviewPoint[];
  uncertainFields: UncertainField[];
  citations: Citation[];
  generatedAt: Date;
  generatedBy: string;  // AI model version
}

// ══════════════════════════════════════════════════════════════════════════════
// 패널 섹션
// ══════════════════════════════════════════════════════════════════════════════

export interface WorkPanelSection {
  sectionId: string;
  sectionType: PanelSectionType;
  title: string;
  content: string;
  citationIds: string[];
  priority: number;  // 1 = 최상위
}

export type PanelSectionType =
  | "KEY_CHANGES"        // 핵심 변경 요약
  | "IMPACT_ANALYSIS"    // 영향 해석
  | "COMPATIBILITY"      // 호환성 분석
  | "COST_COMPARISON"    // 비용 비교
  | "TIMELINE_IMPACT"    // 일정 영향
  | "SAFETY_NOTES"       // 안전 관련 참고
  | "EXPERT_CONTEXT";    // 전문가 맥락

export const SECTION_TYPE_LABELS: Record<PanelSectionType, string> = {
  KEY_CHANGES: "핵심 변경 사항",
  IMPACT_ANALYSIS: "영향 분석",
  COMPATIBILITY: "호환성 분석",
  COST_COMPARISON: "비용 비교",
  TIMELINE_IMPACT: "일정 영향",
  SAFETY_NOTES: "안전 참고",
  EXPERT_CONTEXT: "전문가 맥락",
};

// ══════════════════════════════════════════════════════════════════════════════
// 추천 액션
// ══════════════════════════════════════════════════════════════════════════════

export interface RecommendedAction {
  actionId: string;
  actionType: RecommendedActionType;
  label: string;
  description: string;
  linkedCtaId?: string | null;      // Track A CTA 연결
  linkedFields: CanonicalFieldKey[];
  significance: DiffSignificance;
  citationIds: string[];
}

export type RecommendedActionType =
  | "APPROVE_SUBSTITUTION"     // 대체 승인
  | "REQUEST_EXPERT_REVIEW"    // 전문가 검토 요청
  | "INQUIRE_VENDOR"           // 공급사 문의
  | "COMPARE_ALTERNATIVES"     // 추가 대안 비교
  | "PROCEED_WITH_ORDER"       // 주문 진행
  | "HOLD_FOR_REVIEW"          // 검토 대기
  | "REJECT_SUBSTITUTION"      // 대체 거부
  | "UPDATE_SPEC";             // 규격 업데이트

export const ACTION_TYPE_LABELS: Record<RecommendedActionType, string> = {
  APPROVE_SUBSTITUTION: "대체 승인",
  REQUEST_EXPERT_REVIEW: "전문가 검토 요청",
  INQUIRE_VENDOR: "공급사 문의",
  COMPARE_ALTERNATIVES: "추가 대안 비교",
  PROCEED_WITH_ORDER: "주문 진행",
  HOLD_FOR_REVIEW: "검토 대기",
  REJECT_SUBSTITUTION: "대체 거부",
  UPDATE_SPEC: "규격 업데이트",
};

// ══════════════════════════════════════════════════════════════════════════════
// 검토 필요 포인트
// ══════════════════════════════════════════════════════════════════════════════

export interface ReviewPoint {
  pointId: string;
  field: CanonicalFieldKey;
  reason: string;
  actionability: DiffActionability;
  suggestedReviewer?: string | null;  // role or specific user
  citationIds: string[];
}

// ══════════════════════════════════════════════════════════════════════════════
// 불확실한 필드
// ══════════════════════════════════════════════════════════════════════════════

export interface UncertainField {
  field: CanonicalFieldKey;
  entityId: string;
  reason: string;          // 왜 불확실한지
  confidenceScore: number; // 0.0–1.0
  suggestedResolution: string;
  citationIds: string[];
}

// ══════════════════════════════════════════════════════════════════════════════
// Source Citation (provenance 표시)
// ══════════════════════════════════════════════════════════════════════════════

export interface Citation {
  citationId: string;
  documentId: string;
  documentTitle: string;
  pageNumber?: number | null;
  sectionName?: string | null;
  excerpt: string;         // 원본 텍스트 발췌 (50자 이내)
  url?: string | null;
}

// ══════════════════════════════════════════════════════════════════════════════
// 패널 생성 입력 계약
// ══════════════════════════════════════════════════════════════════════════════

export interface WorkPanelInput {
  diffResult: DiffResult;
  entityResolutions: EntityResolution[];
  userContext: {
    userId: string;
    role: string;
    department?: string | null;
  };
  preferences?: {
    focusFields?: CanonicalFieldKey[];
    language?: "ko" | "en";
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// 패널 규칙 (금지사항 명시)
// ══════════════════════════════════════════════════════════════════════════════

export const WORK_PANEL_RULES = {
  /** raw diff 데이터 없이 AI 요약만 표시하면 안 됨 */
  MUST_INCLUDE_RAW_DIFF: true,

  /** 모든 판단에 source citation이 있어야 함 */
  MUST_CITE_SOURCES: true,

  /** 추천 액션 없이 요약만 있는 카드는 금지 */
  MUST_LINK_ACTIONS: true,

  /** provenance 없는 단정형 판단 금지 */
  NO_UNSUBSTANTIATED_CLAIMS: true,

  /** 최소 1개 이상의 citation 필수 */
  MIN_CITATIONS_PER_SECTION: 1,

  /** uncertain 필드는 반드시 명시 */
  MUST_FLAG_UNCERTAIN: true,
} as const;
