/**
 * §11.302d-6b-1 #sourcing-work-window-amber-removed — Regression sentinel
 *
 * 호영님 P2 sweep 옵션 B 그룹 1/3 — sourcing work-window 2 file.
 *
 * Swap 규칙:
 *   - amber (warning/urgent/경고/incomplete) → yellow
 *   - orange (제출 검토 status + 제출 primary CTA) → blue (진행/정보 톤,
 *     위험 아님 → red 의미 왜곡 방지)
 *   - critical(red) / emerald(완료) 분기 보존
 *
 * §11.302 신호등 정합 + dead button/의미 왜곡 방지 원칙.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const ASSEMBLY_PATH = "src/components/sourcing/request-assembly-work-window.tsx";
const SUBMISSION_PATH = "src/components/sourcing/request-submission-work-window.tsx";

describe("§11.302d-6b-1 — request-assembly-work-window amber → yellow", () => {
  it("amber/orange Tailwind class 0", () => {
    const src = read(ASSEMBLY_PATH);
    expect(src).not.toMatch(/(bg|text|border|from|to|ring)-amber-/);
    expect(src).not.toMatch(/(bg|text|border|from|to|ring)-orange-/);
  });

  it("warning/urgent yellow swap (text-yellow-400 / border-yellow-500 / bg-yellow-600)", () => {
    const src = read(ASSEMBLY_PATH);
    expect(src).toMatch(/text-yellow-400/);
    expect(src).toMatch(/border-yellow-500/);
    expect(src).toMatch(/bg-yellow-600/);
  });

  it("urgency critical red 보존 (text-red-300)", () => {
    const src = read(ASSEMBLY_PATH);
    expect(src).toMatch(/urgency === "critical" \? "text-red-300"/);
  });
});

describe("§11.302d-6b-1 — request-submission-work-window amber→yellow + orange→blue", () => {
  it("amber/orange Tailwind class 0", () => {
    const src = read(SUBMISSION_PATH);
    expect(src).not.toMatch(/(bg|text|border|from|to|ring)-amber-/);
    expect(src).not.toMatch(/(bg|text|border|from|to|ring)-orange-/);
  });

  it("warning/경고 yellow swap (text-yellow-400 / border-yellow-500)", () => {
    const src = read(SUBMISSION_PATH);
    expect(src).toMatch(/text-yellow-400/);
    expect(src).toMatch(/border-yellow-500/);
  });

  it("제출 검토 status orange → blue (진행/정보 톤)", () => {
    const src = read(SUBMISSION_PATH);
    expect(src).toMatch(/bg-blue-600\/15 border-blue-500\/25/);
    expect(src).toMatch(/<Send className="h-5 w-5 text-blue-400" \/>/);
  });

  it("제출 primary CTA orange → blue (submitting blue-700 / 활성 blue-600)", () => {
    const src = read(SUBMISSION_PATH);
    expect(src).toMatch(/bg-blue-700 text-blue-200 cursor-wait/);
    expect(src).toMatch(/bg-blue-600 hover:bg-blue-500 text-white/);
  });

  it("isSubmitted emerald 완료 보존", () => {
    const src = read(SUBMISSION_PATH);
    expect(src).toMatch(/isSubmitted \? "bg-emerald-600\/15 border-emerald-500\/25"/);
    expect(src).toMatch(/<Check className="h-5 w-5 text-emerald-400" \/>/);
  });

  it("urgency critical red 보존", () => {
    const src = read(SUBMISSION_PATH);
    expect(src).toMatch(/urgency === "critical" \? "text-red-300"/);
  });
});

describe("§11.302d-6b-1 — 회귀 0 (wiring 보존)", () => {
  it("submission executeSubmission wiring 보존", () => {
    const src = read(SUBMISSION_PATH);
    expect(src).toMatch(/onClick=\{executeSubmission\}/);
  });

  it("submission canSubmit disabled 분기 보존", () => {
    const src = read(SUBMISSION_PATH);
    expect(src).toMatch(/!validation\?\.canSubmit/);
    expect(src).toMatch(/cursor-not-allowed/);
  });

  it("assembly incompleteLines wiring 보존", () => {
    const src = read(ASSEMBLY_PATH);
    expect(src).toMatch(/incompleteLines/);
  });
});
