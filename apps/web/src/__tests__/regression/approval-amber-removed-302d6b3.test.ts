/**
 * §11.302d-6b-3 #approval-amber-removed — Regression sentinel
 *
 * 호영님 P2 sweep 옵션 B 그룹 3/3 — approval 35 file (~233 occ).
 * sed 일괄 amber/orange → yellow.
 *
 * Swap 규칙:
 *   - amber → yellow (warning/pending/검토 status, 전부 주의 톤)
 *   - orange → yellow (expedite 긴급 / attention_required — 긴급 attention)
 *   - 예외: rc0-midpoint DWELL at_risk → red 격상 (위험)
 *   - risk_increasing(red) / stable(green) / critical(red) 보존
 *
 * §11.302d-6b 종결 batch (sourcing + quotes + approval 전체 정합).
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const APPROVAL_DIR = join(REPO_ROOT, "src/components/approval");

function read(abs: string): string {
  return readFileSync(abs, "utf8");
}

const tsxFiles = readdirSync(APPROVAL_DIR).filter((f) => f.endsWith(".tsx"));

describe("§11.302d-6b-3 — approval 디렉토리 전체 amber/orange Tailwind class 0", () => {
  it(`${tsxFiles.length} tsx file 스캔 — amber/orange class 0`, () => {
    const offenders: string[] = [];
    for (const f of tsxFiles) {
      const src = read(join(APPROVAL_DIR, f));
      if (/(bg|text|border|border-l|from|to|ring)-(amber|orange)-[0-9]/.test(src)) {
        offenders.push(f);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("approval 디렉토리에 tsx file 30+ 존재 (스캔 범위 확인)", () => {
    expect(tsxFiles.length).toBeGreaterThanOrEqual(30);
  });
});

describe("§11.302d-6b-3 — rc0-midpoint at_risk red 격상 + 위험 신호 보존", () => {
  const RC0 = join(APPROVAL_DIR, "rc0-midpoint-review-workbench.tsx");

  it("DWELL_COLOR at_risk = text-red-400 (위험 격상)", () => {
    const src = read(RC0);
    expect(src).toMatch(/at_risk:\s*"text-red-400"/);
  });

  it("DWELL_COLOR watch = text-yellow-400 (주의 보존, at_risk 와 구분)", () => {
    const src = read(RC0);
    expect(src).toMatch(/watch:\s*"text-yellow-400"/);
  });

  it("VERDICT risk_increasing red 보존", () => {
    const src = read(RC0);
    expect(src).toMatch(/risk_increasing:\s*"text-red-400"/);
    expect(src).toMatch(/risk_increasing:\s*"bg-red-900\/30 border-red-700\/40"/);
  });

  it("VERDICT attention_required yellow (주의 — orange 였던 것)", () => {
    const src = read(RC0);
    expect(src).toMatch(/attention_required:\s*"text-yellow-400"/);
  });

  it("VERDICT stable green 보존", () => {
    const src = read(RC0);
    expect(src).toMatch(/stable:\s*"text-green-400"/);
  });
});

describe("§11.302d-6b-3 — 대표 file yellow swap 정합", () => {
  it("reorder-decision-governance expedite 긴급 yellow (orange → yellow)", () => {
    const src = read(join(APPROVAL_DIR, "reorder-decision-governance-workbench.tsx"));
    expect(src).toMatch(/border-yellow-500\/20 bg-yellow-500\/10/);
    expect(src).toMatch(/text-yellow-300/);
  });

  it("procurement-dashboard-workbench yellow swap", () => {
    const src = read(join(APPROVAL_DIR, "procurement-dashboard-workbench.tsx"));
    expect(src).toMatch(/(bg|text|border)-yellow-[0-9]/);
  });

  it("dispatch-prep-workbench yellow swap", () => {
    const src = read(join(APPROVAL_DIR, "dispatch-prep-workbench.tsx"));
    expect(src).toMatch(/(bg|text|border)-yellow-[0-9]/);
  });
});
