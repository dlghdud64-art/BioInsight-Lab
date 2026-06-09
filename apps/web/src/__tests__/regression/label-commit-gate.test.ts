/**
 * Phase 1 (RED) — 라벨 저신뢰 commit 게이트 계약 테스트
 * PLAN_label-lowconfidence-gate / 호영님 5규칙.
 *
 * ⚠️ Phase 1 시점: helper 는 스캐폴드(항상 canCommit=true)라 본 테스트는 의도적으로 FAIL(RED).
 *    Phase 2에서 규칙 구현 후 GREEN.
 *    sandbox vitest = rollup-native 불일치로 "실행 불가" → 클로드코드 실제 실행 PASS 확정.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  evaluateLabelCommitGate,
  type LabelCommitGateInput,
} from "@/lib/ocr/label-commit-gate";

function base(over: Partial<LabelCommitGateInput> = {}): LabelCommitGateInput {
  return {
    confidence: "high",
    present: { lot: false, expiry: false },
    criticalConfirmed: { lot: false, expiry: false },
    verified: { lot: false, expiry: false },
    reviewed: false,
    ...over,
  };
}

describe("evaluateLabelCommitGate — rule 2 critical 필드 명시 확인", () => {
  it("Lot 존재 + 미verified + 미확인 → lot-unconfirmed 차단(신뢰도 high여도)", () => {
    const r = evaluateLabelCommitGate(
      base({ confidence: "high", present: { lot: true, expiry: false } }),
    );
    expect(r.blockers).toContain("lot-unconfirmed");
    expect(r.canCommit).toBe(false);
  });

  it("유효기간 존재 + 미verified + 미확인 → expiry-unconfirmed 차단", () => {
    const r = evaluateLabelCommitGate(
      base({ present: { lot: false, expiry: true } }),
    );
    expect(r.blockers).toContain("expiry-unconfirmed");
    expect(r.canCommit).toBe(false);
  });

  it("Lot 명시 확인(criticalConfirmed) → lot 차단 해제", () => {
    const r = evaluateLabelCommitGate(
      base({
        present: { lot: true, expiry: false },
        criticalConfirmed: { lot: true, expiry: false },
      }),
    );
    expect(r.blockers).not.toContain("lot-unconfirmed");
  });

  it("critical 필드 부재 → 해당 차단 없음", () => {
    const r = evaluateLabelCommitGate(base({ present: { lot: false, expiry: false } }));
    expect(r.blockers).not.toContain("lot-unconfirmed");
    expect(r.blockers).not.toContain("expiry-unconfirmed");
  });
});

describe("evaluateLabelCommitGate — rule 3 datamatrix verified 우회", () => {
  it("verified Lot/EXP → 차단 없음 + 마크 verified", () => {
    const r = evaluateLabelCommitGate(
      base({
        present: { lot: true, expiry: true },
        verified: { lot: true, expiry: true },
      }),
    );
    expect(r.blockers).not.toContain("lot-unconfirmed");
    expect(r.blockers).not.toContain("expiry-unconfirmed");
    expect(r.fieldMarks.lot).toBe("verified");
    expect(r.fieldMarks.expiry).toBe("verified");
  });
});

describe("evaluateLabelCommitGate — rule 1 저신뢰 검수(blank 금지·마크)", () => {
  it("저신뢰 + 미검수 → low-confidence-unreviewed 차단", () => {
    const r = evaluateLabelCommitGate(base({ confidence: "low", reviewed: false }));
    expect(r.blockers).toContain("low-confidence-unreviewed");
    expect(r.canCommit).toBe(false);
  });

  it("저신뢰 + 검수완료 + critical 확인 → commit 허용", () => {
    const r = evaluateLabelCommitGate(
      base({
        confidence: "low",
        reviewed: true,
        present: { lot: true, expiry: true },
        criticalConfirmed: { lot: true, expiry: true },
      }),
    );
    expect(r.blockers).toHaveLength(0);
    expect(r.canCommit).toBe(true);
  });

  it("미verified·미확인 critical 필드 마크 = needs-confirm", () => {
    const r = evaluateLabelCommitGate(
      base({ present: { lot: true, expiry: false } }),
    );
    expect(r.fieldMarks.lot).toBe("needs-confirm");
  });
});

describe("evaluateLabelCommitGate — 정상 경로", () => {
  it("high + critical 부재 → canCommit true, 마크 ok", () => {
    const r = evaluateLabelCommitGate(base());
    expect(r.canCommit).toBe(true);
    expect(r.fieldMarks.lot).toBe("ok");
    expect(r.fieldMarks.expiry).toBe("ok");
  });
});

// 회귀 0 — web/mobile 2벌 mirror drift 방지(동일 규칙 구조 유지)
describe("mirror drift 가드 — mobile lib/scan/label-commit-gate", () => {
  const mobileSrc = readFileSync(
    resolve(__dirname, "../../../../mobile/lib/scan/label-commit-gate.ts"),
    "utf8",
  );
  it("3 blocker 리터럴 동일 유지", () => {
    expect(mobileSrc).toMatch(/"lot-unconfirmed"/);
    expect(mobileSrc).toMatch(/"expiry-unconfirmed"/);
    expect(mobileSrc).toMatch(/"low-confidence-unreviewed"/);
  });
  it("export 시그니처 + 핵심 규칙 헬퍼 유지", () => {
    expect(mobileSrc).toMatch(/export function evaluateLabelCommitGate/);
    expect(mobileSrc).toMatch(/function criticalFieldOk/);
    expect(mobileSrc).toMatch(/confidence === "low" && !reviewed/);
  });
});
