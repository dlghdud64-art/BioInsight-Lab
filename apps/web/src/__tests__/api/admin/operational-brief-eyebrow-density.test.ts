/**
 * §11.179 #operational-brief-density-up-other-surfaces (Phase 1)
 *
 * 5 surface ContextPanel header eyebrow + 너비 통일 검증.
 *   - "OPERATIONAL BRIEFING" eyebrow + tracking-[0.12em]
 *   - 너비 ≥ 480 (sheet 은 sm:w-[560px])
 *
 * 4-cell MetricCell grid + LAST UPDATED + amber alert 등 surface-별 facts
 * 매핑이 필요한 패턴은 §11.180 별도 batch.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.179 shared BriefSurfaceHeader 컴포넌트", () => {
  const PATH = "src/components/operational-brief/surface-header.tsx";

  it("파일 존재 + named export", () => {
    expect(existsSync(join(REPO_ROOT, PATH))).toBe(true);
    const src = read(PATH);
    expect(src).toMatch(/export\s+function\s+BriefSurfaceHeader/);
  });

  // §11.279c — OPERATIONAL BRIEFING → 운영 브리핑 한글 swap, tracking 제거
  it("운영 브리핑 eyebrow (한글, §11.279c)", () => {
    const src = read(PATH);
    expect(src).toMatch(/운영 브리핑/);
  });

  it("LAST UPDATED + formatRelativeKr import", () => {
    const src = read(PATH);
    expect(src).toMatch(/LAST UPDATED/);
    expect(src).toMatch(/formatRelativeKr/);
  });

  it("text-2xl work object title", () => {
    const src = read(PATH);
    expect(src).toMatch(/text-2xl[\s\S]*?font-bold/);
  });
});

describe("§11.179 5 surface eyebrow 일괄 swap", () => {
  const SURFACES: { name: string; path: string }[] = [
    { name: "purchases", path: "src/app/dashboard/purchases/page.tsx" },
    { name: "quotes", path: "src/app/dashboard/quotes/page.tsx" },
    { name: "inventory-context-panel", path: "src/components/inventory/inventory-context-panel.tsx" },
    { name: "queue-detail-panel", path: "src/components/dashboard/console/queue-detail-panel.tsx" },
    { name: "operational-detail-shell", path: "src/app/dashboard/_components/operational-detail-shell.tsx" },
  ];

  for (const { name, path } of SURFACES) {
    // §11.279c — OPERATIONAL BRIEFING → 운영 브리핑 한글 swap, tracking 제거
    it(`${name} — 운영 브리핑 eyebrow (한글, §11.279c)`, () => {
      const src = read(path);
      expect(src).toMatch(/운영 브리핑/);
    });
  }
});

describe("§11.179 5 surface 너비 확장 (≥ 480)", () => {
  it("purchases — w-[480px]", () => {
    const src = read("src/app/dashboard/purchases/page.tsx");
    expect(src).toMatch(/w-\[480px\]/);
  });
  it("quotes — w-[480px]", () => {
    const src = read("src/app/dashboard/quotes/page.tsx");
    expect(src).toMatch(/w-\[480px\]/);
  });
  it("inventory-context-panel — w-[480px]", () => {
    const src = read("src/components/inventory/inventory-context-panel.tsx");
    expect(src).toMatch(/w-\[480px\]/);
  });
  it("queue-detail-panel — w-[480px] sm:w-[560px]", () => {
    const src = read("src/components/dashboard/console/queue-detail-panel.tsx");
    expect(src).toMatch(/w-\[480px\][\s\S]*?sm:w-\[560px\]/);
  });
});
