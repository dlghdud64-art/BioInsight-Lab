// §scan-gs1 P2 — GS1 datamatrix ↔ Gemini OCR source-based merge (순수). 호영님 P-track 2026-06-12
//   GS1 = canonical fast-path(checksum 결정적), Gemini = fallback(공백 보강, 대체 아님).
//   결정적 필드(lotNo·expirationDate): GS1 있으면 우선 + source "gs1". 공백만 OCR.
//   gtin = GS1 only(표시). catalogNo = OCR only(GTIN→catalog 매핑은 out-of-scope roadmap).
//   마킹(호영님 콜=verified): source "gs1" + 불일치 없음 → verified(§11.380 vision-guess 예외).
//     불일치(gs1≠ocr) → gs1 값 우선 + conflict=true → verified 아님(확인필요).
//   ⚠️ 순수 함수만. parseGs1 은 서버 single impl(클라 복제 금지) — 본 머신은 parse 결과만 받음.

import type { Gs1Parsed } from "@/lib/scan/gs1-parser";
import type { LabelParseResult } from "@/lib/ocr/label-parser";

export type FieldSource = "gs1" | "ocr" | null;

export interface MergedLabelResult {
  productName: string | null;
  catalogNo: string | null;
  lotNo: string | null;
  expirationDate: string | null;
  brand: string | null;
  casNumber: string | null;
  quantity: string | null;
  gtin: string | null;
  sources: { lotNo: FieldSource; expirationDate: FieldSource; catalogNo: FieldSource };
  conflicts: { lotNo: boolean; expirationDate: boolean };
}

const norm = (v: string | null | undefined): string =>
  (v ?? "").toLowerCase().replace(/\s+/g, "").trim();

function isPresent(v: string | null | undefined): v is string {
  return v != null && v !== "";
}

function pickDeterministic(
  gs1Val: string | null,
  ocrVal: string | null,
): { value: string | null; source: FieldSource; conflict: boolean } {
  if (isPresent(gs1Val)) {
    const conflict = isPresent(ocrVal) && norm(ocrVal) !== norm(gs1Val);
    return { value: gs1Val, source: "gs1", conflict };
  }
  if (isPresent(ocrVal)) return { value: ocrVal, source: "ocr", conflict: false };
  return { value: null, source: null, conflict: false };
}

export function mergeGs1WithOcr(gs1: Gs1Parsed | null, ocr: LabelParseResult): MergedLabelResult {
  const lot = pickDeterministic(gs1?.lotNo ?? null, ocr.lotNo);
  const exp = pickDeterministic(gs1?.expirationDate ?? null, ocr.expirationDate);
  const catalogNo = ocr.catalogNo ?? null;

  return {
    productName: ocr.productName ?? null,
    catalogNo,
    lotNo: lot.value,
    expirationDate: exp.value,
    brand: ocr.brand ?? null,
    casNumber: ocr.casNumber ?? null,
    quantity: ocr.quantity ?? null,
    gtin: gs1?.gtin ?? null,
    sources: {
      lotNo: lot.source,
      expirationDate: exp.source,
      catalogNo: isPresent(catalogNo) ? "ocr" : null,
    },
    conflicts: { lotNo: lot.conflict, expirationDate: exp.conflict },
  };
}

export function isFieldVerified(source: FieldSource, conflict: boolean): boolean {
  return source === "gs1" && !conflict;
}
