/**
 * 라벨 저신뢰 commit 게이트 — 통합 계약 (PLAN_label-lowconfidence-gate, 호영님 5규칙)
 *
 * 3 surface(웹 입고 모달·웹 라벨검색 모달·모바일 scan) 공통 commit 게이트.
 * 원칙:
 *   1. 저신뢰 → 필드 채움 + "확인 필요" 마크(blank 금지). 검수 전 commit 차단.
 *   2. critical 필드(Lot·유효기간) = 신뢰도 무관 명시 확인 후에만 commit. 자동 수용 금지.
 *   3. datamatrix 등 결정적 디코드 = verified → 게이트 우회(해당 필드 확인 면제).
 *
 * Phase 2 — 규칙 본체 구현. mobile mirror = apps/mobile/lib/scan/label-commit-gate.ts (동일 로직).
 */

export type LabelConfidence = "high" | "medium" | "low";

/** critical 필드 마크: 결정적 verified / 확인 필요 / 정상 */
export type LabelFieldMark = "verified" | "needs-confirm" | "ok";

export type LabelCommitBlocker =
  | "lot-unconfirmed"
  | "expiry-unconfirmed"
  | "low-confidence-unreviewed";

export interface LabelCommitGateInput {
  /** OCR 추출 신뢰도 */
  confidence: LabelConfidence;
  /** 필드 초안 값 보유(존재) 여부 */
  present: { lot: boolean; expiry: boolean };
  /** 사용자가 명시 확인/보정한 critical 필드 */
  criticalConfirmed: { lot: boolean; expiry: boolean };
  /** datamatrix 등 결정적 디코드로 verified 처리된 필드 */
  verified: { lot: boolean; expiry: boolean };
  /** 기존 §11.378 저신뢰 검수 신호(제품명 보정 등) */
  reviewed: boolean;
}

export interface LabelCommitGateResult {
  canCommit: boolean;
  blockers: LabelCommitBlocker[];
  fieldMarks: { lot: LabelFieldMark; expiry: LabelFieldMark };
}

/**
 * critical 필드(lot/expiry) commit 가능 여부.
 * rule 2: 존재하면 신뢰도 무관 명시 확인 필요. rule 3: verified면 면제.
 */
function criticalFieldOk(present: boolean, verified: boolean, confirmed: boolean): boolean {
  if (!present) return true; // 부재 → 확인 대상 아님
  return verified || confirmed; // verified(결정적) 또는 명시 확인
}

/** critical 필드 표시 마크. */
function fieldMark(
  present: boolean,
  verified: boolean,
  confirmed: boolean,
  lowUnreviewed: boolean,
): LabelFieldMark {
  if (verified) return "verified"; // rule 3
  if (present && !confirmed) return "needs-confirm"; // rule 2 — 미확인 critical
  if (lowUnreviewed) return "needs-confirm"; // rule 1 — 저신뢰 미검수
  return "ok";
}

export function evaluateLabelCommitGate(
  input: LabelCommitGateInput,
): LabelCommitGateResult {
  const { confidence, present, criticalConfirmed, verified, reviewed } = input;
  const blockers: LabelCommitBlocker[] = [];

  // rule 2 — critical 필드 명시 확인(verified 우회 = rule 3)
  if (!criticalFieldOk(present.lot, verified.lot, criticalConfirmed.lot)) {
    blockers.push("lot-unconfirmed");
  }
  if (!criticalFieldOk(present.expiry, verified.expiry, criticalConfirmed.expiry)) {
    blockers.push("expiry-unconfirmed");
  }

  // rule 1 — 저신뢰 + 미검수 차단(blank 대신 채움+검수 강제, §11.378 신호 유지)
  const lowUnreviewed = confidence === "low" && !reviewed;
  if (lowUnreviewed) blockers.push("low-confidence-unreviewed");

  return {
    canCommit: blockers.length === 0,
    blockers,
    fieldMarks: {
      lot: fieldMark(present.lot, verified.lot, criticalConfirmed.lot, lowUnreviewed),
      expiry: fieldMark(present.expiry, verified.expiry, criticalConfirmed.expiry, lowUnreviewed),
    },
  };
}
