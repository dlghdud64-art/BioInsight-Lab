/**
 * §quote-table-sian-realign — quoteDisplayRef 단위 테스트
 * canonical quoteNumber 우선 / 없으면 RFQ-YYMM-끝4 파생 / cuid 원본 미노출.
 */
import { describe, it, expect } from "vitest";
import { quoteDisplayRef } from "@/lib/quote-management/quote-display-ref";

describe("quoteDisplayRef", () => {
  it("quoteNumber 있으면 그대로 사용(canonical 우선)", () => {
    expect(quoteDisplayRef({ quoteNumber: "Q-20260619-A1B2C3", createdAt: "2026-06-19", id: "cmqnj71gb000dheu49grk70dk" })).toBe("Q-20260619-A1B2C3");
  });
  it("quoteNumber 없으면 RFQ-<YYMM>-<id 끝4 대문자> 파생", () => {
    expect(quoteDisplayRef({ quoteNumber: null, createdAt: "2026-06-19T00:00:00Z", id: "cmqnj71gb000dheu49grk70dk" })).toBe("RFQ-2606-70DK");
  });
  it("cuid 원본 전체를 노출하지 않음", () => {
    const ref = quoteDisplayRef({ quoteNumber: null, createdAt: "2026-06-19", id: "cmqnj71gb000dheu49grk70dk" });
    expect(ref).not.toContain("cmqnj71gb000dheu49grk70dk");
    expect(ref.startsWith("RFQ-")).toBe(true);
  });
  it("createdAt 누락/이상치도 안전(현재월 fallback)", () => {
    const ref = quoteDisplayRef({ id: "abcd1234" });
    expect(ref).toMatch(/^RFQ-\d{4}-1234$/);
  });
});
