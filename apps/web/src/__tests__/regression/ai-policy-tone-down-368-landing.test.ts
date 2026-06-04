import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const L = "src/app/_components";

describe("§11.368 §0 Phase 4 — 제품/랜딩 AI 톤", () => {
  it("beta-banner: ✨ Sparkles(JSX/import) 0 → Info", () => {
    const src = read(`${L}/beta-banner-section.tsx`);
    expect(src).not.toMatch(/<Sparkles/);
    expect(src).not.toMatch(/import \{ Sparkles \}/);
    expect(src).toMatch(/<Info className=/);
  });

  describe("ai-section — freeze 정렬 보존(보존 원칙, 과변경 0)", () => {
    it("operator review 모범 보존 (AI 준비 → 사용자 승인 → 시스템 실행)", () => {
      const src = read(`${L}/ai-section.tsx`);
      expect(src).toMatch(/승인하면 시스템이 실행/);
    });

    it("forbidden claim(완전 자동/대신 결정/자동 발송/자동 확정) 0", () => {
      const src = read(`${L}/ai-section.tsx`);
      expect(src).not.toMatch(/완전 자동|대신 결정|자동 발송|자동 확정/);
    });

    it("'비교 판단'→'비교 분석'(compare-analysis 일관)", () => {
      const src = read(`${L}/ai-section.tsx`);
      expect(src).toMatch(/비교 분석 요약/);
      expect(src).not.toMatch(/비교 판단 요약/);
    });

    it("ai-section ✨ Sparkles 0", () => {
      const src = read(`${L}/ai-section.tsx`);
      expect(src).not.toMatch(/<Sparkles/);
    });
  });
});
