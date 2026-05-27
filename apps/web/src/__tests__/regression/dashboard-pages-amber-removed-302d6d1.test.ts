/**
 * §11.302d-6d-1 #dashboard-pages-amber-removed — Regression sentinel
 *
 * 호영님 P2 sweep 옵션 A (위험 red / status yellow / 장식 비-orange) —
 * §11.302d-6 초기 audit 누락분 중 dashboard/* sub-pages + _components.
 *
 * Swap 규칙 (file별 의미 분류):
 *   - amber (warning) → yellow 일괄
 *   - orange 위험 → red: budget(초과 critical) / safety(인화성 GHS 위험물) /
 *     stock-risk(만료 위험)
 *   - orange status → yellow: activity-logs / purchase-orders(HIGH/대체품)
 *   - orange 장식(avatar 팔레트) → sky: organizations (§11.302 신호등 무관)
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const DASH_DIR = join(REPO_ROOT, "src/app/dashboard");

function walkTsx(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walkTsx(full));
    else if (entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

describe("§11.302d-6d-1 — dashboard/* 전체 amber/orange Tailwind 0", () => {
  it("dashboard 디렉토리 recursive 스캔 amber/orange 0", () => {
    const offenders: string[] = [];
    for (const f of walkTsx(DASH_DIR)) {
      const src = readFileSync(f, "utf8");
      if (/(bg|text|border|border-l|from|to|ring)-(amber|orange)-[0-9]/.test(src)) {
        offenders.push(f.replace(DASH_DIR, "dashboard"));
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("§11.302d-6d-1 — 위험 orange → red 격상 (옵션 A)", () => {
  it("safety 인화성(GHS 위험물) red", () => {
    const src = readFileSync(join(DASH_DIR, "safety/page.tsx"), "utf8");
    expect(src).toMatch(/flammable:\s*\{\s*label:\s*"인화성 물질",\s*bg:\s*"bg-red-50",\s*color:\s*"text-red-500"/);
  });
  it("stock-risk 만료 위험 red", () => {
    const src = readFileSync(join(DASH_DIR, "stock-risk/page.tsx"), "utf8");
    expect(src).toMatch(/expiry_risk:\s*\{\s*label:\s*"만료 위험"[\s\S]{0,80}bg-red-900\/40/);
  });
  it("budget critical(초과) red", () => {
    const src = readFileSync(join(DASH_DIR, "budget/page.tsx"), "utf8");
    expect(src).toMatch(/critical:\s*\{[\s\S]{0,80}color:\s*"text-red-600"/);
  });
});

describe("§11.302d-6d-1 — status yellow + 장식 sky", () => {
  it("purchase-orders HIGH priority yellow (위험 아닌 긴급)", () => {
    const src = readFileSync(join(DASH_DIR, "purchase-orders/page.tsx"), "utf8");
    expect(src).toMatch(/HIGH:\s*\{\s*bg:\s*"bg-yellow-50"/);
  });
  it("activity-logs PRODUCT_FAVORITED yellow", () => {
    const src = readFileSync(join(DASH_DIR, "activity-logs/page.tsx"), "utf8");
    expect(src).toMatch(/PRODUCT_FAVORITED:\s*"bg-yellow-100 text-yellow-700 border-yellow-200"/);
  });
  it("organizations AVATAR_COLORS 장식 sky (orange 제거, 신호등 무관)", () => {
    const src = readFileSync(join(DASH_DIR, "organizations/page.tsx"), "utf8");
    expect(src).toMatch(/AVATAR_COLORS/);
    expect(src).toMatch(/bg-sky-500/);
    expect(src).not.toMatch(/bg-orange-500/);
  });
});
