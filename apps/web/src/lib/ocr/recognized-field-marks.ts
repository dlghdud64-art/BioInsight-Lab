/**
 * §scan-recognition-upgrade P3 — 필드 마크 파생 (label-commit-gate **위에** 확장).
 *
 * Lot·유효기간 규칙(호영님 5규칙)은 여기서 재구현하지 않는다 —
 * evaluateLabelCommitGate 를 내부 호출해 그대로 승계하고(중복 구현 0),
 * 이 모듈이 더하는 것은
 *   1) 임의 필드 집합에 대한 마크(verified|needs-confirm|ok|empty)
 *   2) 표면별 critical 확장(명세서 표면 = quantity·catalogNo 추가)
 * 뿐이다. null/빈값 = "empty" — 빈값 폴백은 차단 사유가 아니다(지어내지 않음).
 */

import {
  evaluateLabelCommitGate,
  type LabelConfidence,
} from "./label-commit-gate";

export type RecognizedFieldMark = "verified" | "needs-confirm" | "ok" | "empty";

export interface DeriveFieldMarksInput {
  /** 필드 key → 값 (null/공백 = empty) */
  fields: Record<string, string | null | undefined>;
  confidence: LabelConfidence;
  /** 명시 확인 대상 필드 — 기본 ["lot", "expiry"] (게이트 rule 2 승계) */
  critical?: string[];
  /** 사용자가 명시 확인/보정한 필드 */
  confirmed?: Record<string, boolean>;
  /** datamatrix 등 결정적 디코드 필드 — 게이트 우회(rule 3 승계) */
  verified?: Record<string, boolean>;
}

export interface DeriveFieldMarksResult {
  marks: Record<string, RecognizedFieldMark>;
  canCommit: boolean;
  /** gate blockers 승계 + 확장 critical 미확인은 `critical-unconfirmed:<key>` */
  blockers: string[];
}

const DEFAULT_CRITICAL = ["lot", "expiry"];

export function deriveFieldMarks(input: DeriveFieldMarksInput): DeriveFieldMarksResult {
  const critical = input.critical ?? DEFAULT_CRITICAL;
  const confirmed = input.confirmed ?? {};
  const verified = input.verified ?? {};
  const present = (key: string) => {
    const v = input.fields[key];
    return typeof v === "string" && v.trim() !== "";
  };

  // Lot·유효기간 = 원 게이트 그대로(재구현 0). reviewed = 어떤 필드든 명시 확인이 있었는가.
  const gate = evaluateLabelCommitGate({
    confidence: input.confidence,
    present: { lot: present("lot"), expiry: present("expiry") },
    criticalConfirmed: { lot: !!confirmed.lot, expiry: !!confirmed.expiry },
    verified: { lot: !!verified.lot, expiry: !!verified.expiry },
    reviewed: Object.values(input.confirmed ?? {}).some(Boolean),
  });

  const lowUnreviewed = gate.blockers.includes("low-confidence-unreviewed");
  const marks: Record<string, RecognizedFieldMark> = {};
  const blockers: string[] = [...gate.blockers];

  for (const key of Object.keys(input.fields)) {
    if (!present(key)) {
      marks[key] = "empty"; // 빈값 폴백 — 확인 대상 아님(차단 0)
      continue;
    }
    if (verified[key]) {
      marks[key] = "verified"; // rule 3
      continue;
    }
    if (critical.includes(key) && !confirmed[key]) {
      marks[key] = "needs-confirm"; // rule 2 확장
      // lot/expiry 는 gate blockers 가 이미 담당 — 확장 critical 만 추가.
      if (key !== "lot" && key !== "expiry") blockers.push(`critical-unconfirmed:${key}`);
      continue;
    }
    marks[key] = lowUnreviewed && !confirmed[key] ? "needs-confirm" : "ok"; // rule 1
  }

  return { marks, canCommit: blockers.length === 0, blockers };
}
