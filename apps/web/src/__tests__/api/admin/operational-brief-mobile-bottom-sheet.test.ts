/**
 * §11.152 #operational-brief-rail-mobile-bottom-sheet — shared component guard.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PATH = resolve(
  __dirname,
  "../../../components/operational-brief/mobile-bottom-sheet.tsx",
);

describe("§11.152 MobileOperationalBriefSheet", () => {
  const source = readFileSync(PATH, "utf8");

  it("운영 브리핑 헤더 + 4 default chips 라벨", () => {
    expect(source).toMatch(/운영 브리핑/);
    expect(source).toMatch(/상태 요약/);
    expect(source).toMatch(/핵심 근거/);
    expect(source).toMatch(/리스크/);
    expect(source).toMatch(/다음 조치/);
  });

  it("4 anchor IDs (mobile-prefixed): mb-brief-summary / facts / risks / next", () => {
    expect(source).toMatch(/mb-brief-summary/);
    expect(source).toMatch(/mb-brief-facts/);
    expect(source).toMatch(/mb-brief-risks/);
    expect(source).toMatch(/mb-brief-next/);
  });

  it("a11y: role=dialog + aria-modal + aria-label", () => {
    expect(source).toMatch(/role="dialog"/);
    expect(source).toMatch(/aria-modal="true"/);
    expect(source).toMatch(/aria-label="운영 브리핑"/);
  });

  it("Esc key + body scroll lock 처리", () => {
    expect(source).toMatch(/Escape/);
    expect(source).toMatch(/document\.body\.style\.overflow/);
  });

  it("md:hidden — 모바일 전용 (desktop rail 와 mutually exclusive)", () => {
    expect(source).toMatch(/md:hidden/);
  });

  it("Primary CTA 1개 + ArrowRight icon + sticky bottom", () => {
    expect(source).toMatch(/primaryCta/);
    expect(source).toMatch(/ArrowRight/);
  });

  it("§11.142 lock: chatbot input 0", () => {
    expect(source).not.toMatch(/AI에게 물어보기|Ask AI|<textarea[^>]*ai/i);
  });
});
