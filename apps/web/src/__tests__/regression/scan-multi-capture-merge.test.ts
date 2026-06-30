/**
 * §scan-multi-capture-merge (호영님 2026-06-30) — 다장 캡처 병합 유닛 + UI sentinel.
 *
 * fill-empty: 빈 필드만 채움, 채워진/dirty 값 보존, catalogNo 누적 보완. 단일샷=교체(회귀 0).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { mergeFormData } from "@/lib/inventory/scan-form-merge";
import type { SmartReceiveFormData } from "@/components/inventory/LabelScannerModal";

const SRC = resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(resolve(SRC, rel), "utf8");

function form(p: Partial<SmartReceiveFormData> = {}): SmartReceiveFormData {
  return {
    productName: "", catalogNumber: "", lotNumber: "", expirationDate: "",
    packSize: "", packUnit: "", receivedQuantity: "1", receivedUnit: "통",
    brand: "", casNumber: "", ...p,
  };
}

describe("§scan-multi-capture-merge — mergeFormData(fill-empty)", () => {
  it("빈 catalogNo 를 새 스캔이 채움", () => {
    const prev = form({ productName: "BCP", brand: "Sigma", catalogNumber: "" });
    const incoming = form({ productName: "BCP", brand: "Sigma", catalogNumber: "B9673" });
    const r = mergeFormData(prev, incoming);
    expect(r.catalogNumber).toBe("B9673");
    expect(r.productName).toBe("BCP");
  });

  it("이미 채워진 값(이전 스캔/사용자 수정)은 보존 — 새 값으로 안 덮음", () => {
    const prev = form({ productName: "사용자수정명", catalogNumber: "KEEP-1" });
    const incoming = form({ productName: "OCR명", catalogNumber: "OTHER-2", lotNumber: "L9" });
    const r = mergeFormData(prev, incoming);
    expect(r.productName).toBe("사용자수정명"); // 보존
    expect(r.catalogNumber).toBe("KEEP-1");     // 보존
    expect(r.lotNumber).toBe("L9");             // 빈칸만 채움
  });

  it("received* 기본값 보존(사용자 입력 보호)", () => {
    const prev = form({ receivedQuantity: "5", receivedUnit: "박스" });
    const incoming = form({ receivedQuantity: "1", receivedUnit: "통", lotNumber: "L1" });
    const r = mergeFormData(prev, incoming);
    expect(r.receivedQuantity).toBe("5");
    expect(r.receivedUnit).toBe("박스");
  });

  it("빈 prev → incoming 그대로(단일샷 동치)", () => {
    const incoming = form({ productName: "BCP", catalogNumber: "B9673", brand: "Sigma" });
    expect(mergeFormData(form(), incoming)).toEqual(incoming);
  });
});

describe("§scan-multi-capture-merge — UI wiring(LabelScannerModal)", () => {
  const MODAL = read("components/inventory/LabelScannerModal.tsx");

  it("runScan merge 분기 + mergeFormData 사용", () => {
    expect(MODAL).toMatch(/import \{ mergeFormData \} from "@\/lib\/inventory\/scan-form-merge"/);
    expect(MODAL).toMatch(/merge \? mergeFormData\(prev, incoming\) : incoming/);
  });

  it("mergeNextRef + scanCount 누적", () => {
    expect(MODAL).toMatch(/mergeNextRef/);
    expect(MODAL).toMatch(/const \[scanCount, setScanCount\]/);
  });

  it("'다른 각도 재촬영' = catalogNo 빈칸일 때만(dead button 0) + 병합 경로", () => {
    expect(MODAL).toMatch(/!scanResult\.matchedProduct && !formData\.catalogNumber\.trim\(\)/);
    expect(MODAL).toMatch(/mergeNextRef\.current = true;\s*setStep\("upload"\)/);
    expect(MODAL).toMatch(/다른 각도 재촬영/);
  });

  it("'다시 스캔'(리셋) 보존", () => {
    expect(MODAL).toMatch(/onClick=\{resetState\}/);
    expect(MODAL).toMatch(/다시 스캔/);
  });
});
