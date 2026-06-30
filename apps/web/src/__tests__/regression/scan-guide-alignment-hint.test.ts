/**
 * §scan-guide-alignment-hint (호영님 2026-06-30) — Vivino식 비차단 정합 시각 큐.
 *
 * §11.375 보존: verdict(overall)·자동촬영 게이트는 blur+lighting만. alignment는 게이팅 아님.
 * quality.alignment.ok → ScanGuideFrame `aligned` → 비차단 emerald glow(advisory). 과대주장 카피 0.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(resolve(SRC, rel), "utf8");

describe("§scan-guide-alignment-hint — ScanGuideFrame 비차단 glow", () => {
  const FRAME = read("components/inventory/ScanGuideFrame.tsx");

  it("aligned prop + advisory glow(비차단)", () => {
    expect(FRAME).toMatch(/aligned\?:\s*boolean/);
    expect(FRAME).toMatch(/aligned && \(/);
    expect(FRAME).toMatch(/data-scan-aligned="true"/);
    expect(FRAME).toMatch(/pointer-events-none[\s\S]{0,80}ring-emerald-400/);
  });
});

describe("§scan-guide-alignment-hint — Modal 전달", () => {
  const MODAL = read("components/inventory/LabelScannerModal.tsx");

  it("quality.alignment.ok → aligned 전달", () => {
    expect(MODAL).toMatch(/aligned=\{!!quality\?\.alignment\?\.ok\}/);
  });
});

describe("§scan-guide-alignment-hint — §11.375 verdict 보존 가드", () => {
  const CQ = read("lib/ocr/capture-quality.ts");

  it("overall(failCount)은 blur+lighting만 — alignment 미반영", () => {
    expect(CQ).toMatch(/const failCount = \(blurOk \? 0 : 1\) \+ \(lightingOk \? 0 : 1\);/);
    // alignment 가 failCount/overall 계산에 들어가지 않음(§11.375)
    expect(CQ).not.toMatch(/failCount[\s\S]{0,60}align/i);
  });
});
