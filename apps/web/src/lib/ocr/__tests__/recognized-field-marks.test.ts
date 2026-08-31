import { describe, it, expect } from "vitest";
import { deriveFieldMarks } from "../recognized-field-marks";

/**
 * §scan-recognition-upgrade P3 — 필드 마크 파생 계약.
 *
 * 잠그는 계약:
 *   1) label-commit-gate **위에** 확장(대체 아님) — Lot·유효기간 규칙은 내부에서
 *      evaluateLabelCommitGate 를 호출해 승계(중복 구현 0).
 *   2) 필드별 마크 verified|needs-confirm|ok|empty. critical 기본 = lot·expiry,
 *      표면별 추가(critical 파라미터) 가능 — 명세서 표면은 quantity·catalogNo.
 *   3) 필드 null/빈값 = "empty" — 빈값 폴백은 차단 사유가 아니다(지어내지 않음).
 *   4) datamatrix verified = 게이트 우회(rule 3 승계).
 */

describe("§scan-recognition-upgrade P3 — deriveFieldMarks", () => {
  it("high + 전부 채움 · 미확인 → critical 은 needs-confirm, 비 critical 은 ok · canCommit false", () => {
    const r = deriveFieldMarks({
      fields: { lot: "SLBX5678A", expiry: "2027-03-15", catalogNo: "G1264-250MG" },
      confidence: "high",
    });
    expect(r.marks.lot).toBe("needs-confirm");
    expect(r.marks.expiry).toBe("needs-confirm");
    expect(r.marks.catalogNo).toBe("ok");
    expect(r.canCommit).toBe(false);
  });

  it("critical 확인 완료 → ok + canCommit true", () => {
    const r = deriveFieldMarks({
      fields: { lot: "SLBX5678A", expiry: "2027-03-15" },
      confidence: "high",
      confirmed: { lot: true, expiry: true },
    });
    expect(r.marks.lot).toBe("ok");
    expect(r.marks.expiry).toBe("ok");
    expect(r.canCommit).toBe(true);
  });

  it("low → 채워진 전 필드 needs-confirm (rule 1 승계) · canCommit false", () => {
    const r = deriveFieldMarks({
      fields: { lot: "L1", expiry: null, catalogNo: "C-1" },
      confidence: "low",
    });
    expect(r.marks.lot).toBe("needs-confirm");
    expect(r.marks.catalogNo).toBe("needs-confirm");
    expect(r.canCommit).toBe(false);
  });

  it("필드 null = empty — 차단 아님(빈값 폴백)", () => {
    const r = deriveFieldMarks({
      fields: { lot: null, expiry: "2026-12-31" },
      confidence: "high",
      confirmed: { expiry: true },
    });
    expect(r.marks.lot).toBe("empty");
    expect(r.canCommit).toBe(true); // lot 부재 = 확인 대상 아님 (gate rule 승계)
  });

  it("datamatrix verified → 마크 verified + 게이트 우회 (rule 3 승계)", () => {
    const r = deriveFieldMarks({
      fields: { lot: "GS1-LOT", expiry: "2027-01-01" },
      confidence: "high",
      verified: { lot: true, expiry: true },
    });
    expect(r.marks.lot).toBe("verified");
    expect(r.marks.expiry).toBe("verified");
    expect(r.canCommit).toBe(true);
  });

  it("표면별 critical 추가(quantity·catalogNo) — 채워졌으면 확인 전 needs-confirm + 차단", () => {
    const r = deriveFieldMarks({
      fields: { lot: "L1", expiry: "2027-01-01", quantity: "10", catalogNo: "C-1" },
      confidence: "high",
      critical: ["lot", "expiry", "quantity", "catalogNo"],
      confirmed: { lot: true, expiry: true },
    });
    expect(r.marks.quantity).toBe("needs-confirm");
    expect(r.marks.catalogNo).toBe("needs-confirm");
    expect(r.canCommit).toBe(false);
    const r2 = deriveFieldMarks({
      fields: { lot: "L1", expiry: "2027-01-01", quantity: "10", catalogNo: "C-1" },
      confidence: "high",
      critical: ["lot", "expiry", "quantity", "catalogNo"],
      confirmed: { lot: true, expiry: true, quantity: true, catalogNo: true },
    });
    expect(r2.canCommit).toBe(true);
  });
});
