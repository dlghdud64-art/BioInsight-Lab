/**
 * §11.176 #operational-brief-floating-entry-multi-surface
 *
 * shared parts 추출 (MetricCell + formatRelativeKr) + 4 surface 의 floating
 * entry mount 검증.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.176 shared brief parts 추출", () => {
  it("MetricCell 컴포넌트 파일 존재", () => {
    expect(existsSync(join(REPO_ROOT, "src/components/operational-brief/metric-cell.tsx"))).toBe(true);
  });

  it("MetricCell text-3xl 수치 + tone 별 액센트", () => {
    const src = read("src/components/operational-brief/metric-cell.tsx");
    expect(src).toMatch(/text-3xl/);
    expect(src).toMatch(/border-l-emerald-500/);
    expect(src).toMatch(/border-l-amber-500/);
    expect(src).toMatch(/border-l-red-500/);
    expect(src).toMatch(/border-l-slate-300/);
    expect(src).toMatch(/export\s+function\s+MetricCell/);
  });

  it("formatRelativeKr util 파일 존재 + 한국어 케이스", () => {
    const path = "src/components/operational-brief/relative-time.ts";
    expect(existsSync(join(REPO_ROOT, path))).toBe(true);
    const src = read(path);
    expect(src).toMatch(/방금 전/);
    expect(src).toMatch(/분 전/);
    expect(src).toMatch(/시간 전/);
    expect(src).toMatch(/일 전/);
    expect(src).toMatch(/export\s+function\s+formatRelativeKr/);
  });

  // §11.191 — inbox surface deprecated (hidden redirect → /dashboard).
  // Shared MetricCell migration 검증은 inbox redirect-only swap 으로 자연 drop.
});

describe("§11.176 floating entry mount (§11.191 inbox drop 후 3 surface)", () => {
  const SURFACES: { name: string; path: string }[] = [
    { name: "dashboard", path: "src/app/dashboard/page.tsx" },
    { name: "purchases", path: "src/app/dashboard/purchases/page.tsx" },
    { name: "quotes", path: "src/app/dashboard/quotes/page.tsx" },
  ];

  for (const { name, path } of SURFACES) {
    it(`${name} surface 가 OperationalBriefFloatingEntry import + 사용`, () => {
      const src = read(path);
      expect(src).toMatch(/OperationalBriefFloatingEntry/);
      expect(src).toMatch(/from\s+["']@\/components\/operational-brief\/floating-entry["']/);
    });
  }
});

describe("§11.176 surface 별 hydrate handler (§11.181 popup default 로 marshall 됨)", () => {
  it("§11.181 — purchases FAB 에 onClick prop 없음 (popup context 사용)", () => {
    const src = read("src/app/dashboard/purchases/page.tsx");
    const m = src.match(/<OperationalBriefFloatingEntry[\s\S]*?\/>/);
    expect(m).not.toBeNull();
    expect(m![0]).not.toMatch(/\bonClick\s*=/);
  });

  it("§11.181 — quotes FAB 에 onClick prop 없음 (popup context 사용)", () => {
    const src = read("src/app/dashboard/quotes/page.tsx");
    const m = src.match(/<OperationalBriefFloatingEntry[\s\S]*?\/>/);
    expect(m).not.toBeNull();
    expect(m![0]).not.toMatch(/\bonClick\s*=/);
  });
});
