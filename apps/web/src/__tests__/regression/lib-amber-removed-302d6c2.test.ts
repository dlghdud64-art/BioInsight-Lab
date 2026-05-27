/**
 * §11.302d-6c-2 #lib-amber-removed — Regression sentinel
 *
 * 호영님 P2 sweep 옵션 A — lib 23 file amber/orange → yellow
 * (design-tokens warning / safety high 는 의미별 개별).
 *
 * Swap 규칙:
 *   - design-tokens.ts severity.warning + TEXT.warning: amber → yellow (주의)
 *   - safety-visualization high("위험"): orange → red 격상 (호영님 옵션 A,
 *     critical 과 위험계열 통일, border 진하기로 미세 구분)
 *   - 나머지 lib (우선순위/중요/만료/진행 status): amber/orange → yellow
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const LIB_DIR = join(REPO_ROOT, "src/lib");

function walkTs(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walkTs(full));
    else if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) out.push(full);
  }
  return out;
}

describe("§11.302d-6c-2 — lib 디렉토리 amber/orange Tailwind 0", () => {
  it("lib 전체 .ts 스캔 — amber/orange class 0", () => {
    const offenders: string[] = [];
    for (const f of walkTs(LIB_DIR)) {
      const src = readFileSync(f, "utf8");
      if (/(bg|text|border|border-l|from|to|ring)-(amber|orange)-[0-9]/.test(src)) {
        offenders.push(f.replace(LIB_DIR, "lib"));
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("§11.302d-6c-2 — design-tokens warning yellow swap", () => {
  it("severity.warning border-l-yellow-500", () => {
    const src = readFileSync(join(REPO_ROOT, "src/lib/design-tokens.ts"), "utf8");
    expect(src).toMatch(/warning:\s*"border-l-yellow-500"/);
  });
  it("TEXT.warning text-yellow-400", () => {
    const src = readFileSync(join(REPO_ROOT, "src/lib/design-tokens.ts"), "utf8");
    expect(src).toMatch(/warning:\s*"text-yellow-400"/);
  });
  it("critical(red) / success(emerald) / info(blue) 보존", () => {
    const src = readFileSync(join(REPO_ROOT, "src/lib/design-tokens.ts"), "utf8");
    expect(src).toMatch(/critical:\s*"border-l-red-500"/);
    expect(src).toMatch(/success:\s*"border-l-emerald-500"/);
  });
});

describe("§11.302d-6c-2 — safety-visualization high red 격상 (호영님 옵션 A)", () => {
  const SAFETY = join(REPO_ROOT, "src/lib/utils/safety-visualization.ts");

  it("high block red (text-red-700 / bg-red-50 / border-red-200) + label 위험 보존", () => {
    const src = readFileSync(SAFETY, "utf8");
    expect(src).toMatch(/color:\s*"text-red-700",\s*\n\s*bgColor:\s*"bg-red-50",\s*\n\s*borderColor:\s*"border-red-200",\s*\n\s*label:\s*"위험"/);
  });

  it("ternary high → red (critical border-red-300 / high border-red-200 미세 구분)", () => {
    const src = readFileSync(SAFETY, "utf8");
    expect(src).toMatch(/adjustedLevel === "high" \? "border-red-200"/);
    expect(src).toMatch(/adjustedLevel === "critical" \? "border-red-300"/);
  });

  it("amber/orange 0 (전체 file)", () => {
    const src = readFileSync(SAFETY, "utf8");
    expect(src).not.toMatch(/(bg|text|border)-(amber|orange)-[0-9]/);
  });
});
