import { describe, it, expect } from "vitest";
import { mergeGs1WithOcr, isFieldVerified } from "@/lib/ocr/merge-gs1-ocr";
import type { Gs1Parsed } from "@/lib/scan/gs1-parser";
import type { LabelParseResult } from "@/lib/ocr/label-parser";

// §11.382 P2 — GS1↔OCR merge 머신 단위. source-based verified 마킹 핵심.

const gs1 = (o: Partial<Gs1Parsed>): Gs1Parsed => ({
  gtin: null, lotNo: null, expirationDate: null, productionDate: null,
  serial: null, elements: {}, isGs1: true, ...o,
});

const ocr = (o: Partial<LabelParseResult>): LabelParseResult => ({
  catalogNo: null, lotNo: null, expirationDate: null, brand: null, productName: null,
  casNumber: null, quantity: null, rawText: "", confidence: "low", matchedFields: 0, ...o,
});

describe("§11.382 — mergeGs1WithOcr: GS1 결정적 우선 + source 태그", () => {
  it("GS1 lotNo/expiry 있으면 우선 + source gs1 (OCR 무시)", () => {
    const m = mergeGs1WithOcr(
      gs1({ lotNo: "2505056", expirationDate: "2027-05", gtin: "00812345600012" }),
      ocr({ lotNo: "WRONG", expirationDate: "2099-01", productName: "Ambion DEPC Water" }),
    );
    expect(m.lotNo).toBe("2505056");
    expect(m.sources.lotNo).toBe("gs1");
    expect(m.expirationDate).toBe("2027-05");
    expect(m.sources.expirationDate).toBe("gs1");
    expect(m.gtin).toBe("00812345600012");
    expect(m.productName).toBe("Ambion DEPC Water"); // 품명은 OCR(GS1 없음)
  });

  it("GS1 없으면 OCR fallback + source ocr", () => {
    const m = mergeGs1WithOcr(null, ocr({ lotNo: "L123", expirationDate: "2026-12", catalogNo: "AM9906" }));
    expect(m.lotNo).toBe("L123");
    expect(m.sources.lotNo).toBe("ocr");
    expect(m.catalogNo).toBe("AM9906");
    expect(m.sources.catalogNo).toBe("ocr");
    expect(m.gtin).toBeNull();
  });

  it("catalogNo 는 항상 OCR only (GTIN→catalog 매핑 out-of-scope)", () => {
    const m = mergeGs1WithOcr(gs1({ gtin: "00812345600012" }), ocr({ catalogNo: "AM9906" }));
    expect(m.catalogNo).toBe("AM9906");
    expect(m.sources.catalogNo).toBe("ocr");
  });

  it("둘 다 공백이면 null + source null", () => {
    const m = mergeGs1WithOcr(gs1({}), ocr({}));
    expect(m.lotNo).toBeNull();
    expect(m.sources.lotNo).toBeNull();
    expect(m.conflicts.lotNo).toBe(false);
  });
});

describe("§11.382 — conflict: GS1≠OCR → GS1 우선 + conflict(확인필요)", () => {
  it("불일치 시 GS1 값 채택 + conflict true", () => {
    const m = mergeGs1WithOcr(gs1({ lotNo: "2505056" }), ocr({ lotNo: "250505G" }));
    expect(m.lotNo).toBe("2505056"); // GS1 우선
    expect(m.conflicts.lotNo).toBe(true);
  });

  it("일치(공백/대소문자 무시) 시 conflict false", () => {
    const m = mergeGs1WithOcr(gs1({ lotNo: "2505056" }), ocr({ lotNo: " 2505056 " }));
    expect(m.conflicts.lotNo).toBe(false);
  });
});

describe("§11.382 — isFieldVerified: datamatrix=verified, OCR/conflict=확인필요", () => {
  it("source gs1 + 불일치 없음 → verified (§11.380 vision-guess 예외)", () => {
    expect(isFieldVerified("gs1", false)).toBe(true);
  });
  it("source gs1 but conflict → verified 아님(확인필요)", () => {
    expect(isFieldVerified("gs1", true)).toBe(false);
  });
  it("source ocr(vision-guess) → verified 아님", () => {
    expect(isFieldVerified("ocr", false)).toBe(false);
  });
  it("source null → verified 아님", () => {
    expect(isFieldVerified(null, false)).toBe(false);
  });
});
