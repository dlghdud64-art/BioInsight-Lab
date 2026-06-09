/**
 * 라벨 저신뢰 commit 게이트 — mobile mirror
 * (web 원본: apps/web/src/lib/ocr/label-commit-gate.ts — 동일 로직 유지)
 *
 * PLAN_label-lowconfidence-gate / 호영님 5규칙:
 *   1. 저신뢰 → 채움 + "확인 필요" 마크(blank 금지), 검수 전 commit 차단.
 *   2. critical 필드(Lot·유효기간) = 신뢰도 무관 명시 확인 후 commit. 자동 수용 금지.
 *   3. datamatrix 등 결정적 디코드 = verified → 게이트 우회.
 *
 * ⚠️ web/mobile 2벌 mirror — 로직/시그니처 drift 금지(동일 테스트 매트릭스 유지).
 */

export type LabelConfidence = "high" | "medium" | "low";
export type LabelFieldMark = "verified" | "needs-confirm" | "ok";
export type LabelCommitBlocker =
  | "lot-unconfirmed"
  | "expiry-unconfirmed"
  | "low-confidence-unreviewed";

export interface LabelCommitGateInput {
  confidence: LabelConfidence;
  present: { lot: boolean; expiry: boolean };
  criticalConfirmed: { lot: boolean; expiry: boolean };
  verified: { lot: boolean; expiry: boolean };
  reviewed: boolean;
}

export interface LabelCommitGateResult {
  canCommit: boolean;
  blockers: LabelCommitBlocker[];
  fieldMarks: { lot: LabelFieldMark; expiry: LabelFieldMark };
}

function criticalFieldOk(present: boolean, verified: boolean, confirmed: boolean): boolean {
  if (!present) return true;
  return verified || confirmed;
}

function fieldMark(
  present: boolean,
  verified: boolean,
  confirmed: boolean,
  lowUnreviewed: boolean,
): LabelFieldMark {
  if (verified) return "verified";
  if (present && !confirmed) return "needs-confirm";
  if (lowUnreviewed) return "needs-confirm";
  return "ok";
}

export function evaluateLabelCommitGate(
  input: LabelCommitGateInput,
): LabelCommitGateResult {
  const { confidence, present, criticalConfirmed, verified, reviewed } = input;
  const blockers: LabelCommitBlocker[] = [];

  if (!criticalFieldOk(present.lot, verified.lot, criticalConfirmed.lot)) {
    blockers.push("lot-unconfirmed");
  }
  if (!criticalFieldOk(present.expiry, verified.expiry, criticalConfirmed.expiry)) {
    blockers.push("expiry-unconfirmed");
  }

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
