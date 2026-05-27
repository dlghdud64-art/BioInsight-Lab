/**
 * §11.302d-6c-1 #workbench-amber-removed — Regression sentinel
 *
 * 호영님 P2 sweep 옵션 A — _workbench 51 file (/app/* 실사용) sed 일괄
 * amber/orange → yellow (~343 occ).
 *
 * Swap 규칙:
 *   - amber/orange (확인 필요/보류/정리 필요/진행/검역 Quarantine) → yellow
 *     (전부 주의 톤, 명확한 위험=red 대상 0)
 *   - emerald(완료/ready) / red(제외/위험) / blue(quote stage) 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const WORKBENCH_DIR = join(REPO_ROOT, "src/app/_workbench");

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

const tsxFiles = walkTsx(WORKBENCH_DIR);

describe("§11.302d-6c-1 — _workbench 디렉토리 전체 amber/orange Tailwind 0", () => {
  it(`${tsxFiles.length} tsx file 스캔 — amber/orange class 0`, () => {
    const offenders: string[] = [];
    for (const f of tsxFiles) {
      const src = readFileSync(f, "utf8");
      if (/(bg|text|border|border-l|from|to|ring)-(amber|orange)-[0-9]/.test(src)) {
        offenders.push(f.replace(WORKBENCH_DIR, "_workbench"));
      }
    }
    expect(offenders).toEqual([]);
  });

  it("_workbench tsx file 40+ 존재 (스캔 범위 확인)", () => {
    expect(tsxFiles.length).toBeGreaterThanOrEqual(40);
  });
});

describe("§11.302d-6c-1 — 대표 file yellow swap + 다른 톤 보존", () => {
  it("quote-normalization-workbench yellow swap (정리 필요)", () => {
    const src = readFileSync(
      join(WORKBENCH_DIR, "_components/quote-normalization-workbench.tsx"),
      "utf8",
    );
    expect(src).toMatch(/(bg|text|border)-yellow-[0-9]/);
    expect(src).not.toMatch(/(bg|text|border)-(amber|orange)-[0-9]/);
  });

  it("send-confirmation-workbench emerald(완료) 보존 + yellow swap", () => {
    const src = readFileSync(
      join(WORKBENCH_DIR, "_components/send-confirmation-workbench.tsx"),
      "utf8",
    );
    expect(src).toMatch(/isExecuted \? "bg-emerald-600\/15/);
    expect(src).toMatch(/bg-yellow-600/);
  });

  it("comparison-modal 제외(red) 보존 (status '제외' = red)", () => {
    const src = readFileSync(
      join(WORKBENCH_DIR, "_components/comparison-modal.tsx"),
      "utf8",
    );
    expect(src).toMatch(/제외[\s\S]{0,120}text-red-600/);
    // 보류 = yellow (이전 amber)
    expect(src).toMatch(/보류[\s\S]{0,120}text-yellow-600/);
  });
});
