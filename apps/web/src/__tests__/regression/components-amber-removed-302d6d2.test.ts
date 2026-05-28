/**
 * §11.302d-6d-2 #components-amber-removed — Regression sentinel
 *
 * 호영님 P2 sweep 옵션 A — §11.302d-6 초기 audit 누락분 중 components/*
 * (dashboard widgets 외 ops-hub/ontology/console/ai/governed-action/
 * fast-track/operational-brief/review-queue/quote-draft/protocol 등).
 *
 * Swap: amber(warning)/orange(status: SLA지연/경고/high우선순위/임계초과/
 *   기한초과/추출경고) → yellow. components 의 amber/orange 는 모두 status/
 *   warning (위험 red·장식 sky 대상 0 — orange 12곳 status 확인).
 *   chart palette 는 hex(#f59e0b)라 Tailwind class sweep 무관.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const COMP_DIR = join(REPO_ROOT, "src/components");

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

describe("§11.302d-6d-2 — components/* 전체 amber/orange Tailwind 0", () => {
  it("components 디렉토리 recursive 스캔 amber/orange 0", () => {
    const offenders: string[] = [];
    for (const f of walkTsx(COMP_DIR)) {
      const src = readFileSync(f, "utf8");
      if (/(bg|text|border|border-l|from|to|ring)-(amber|orange)-[0-9]/.test(src)) {
        offenders.push(f.replace(COMP_DIR, "components"));
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("§11.302d-6d-2 — 대표 file yellow swap (status)", () => {
  it("work-queue-inbox SLA 지연/no-move yellow", () => {
    const src = readFileSync(join(COMP_DIR, "dashboard/work-queue-inbox.tsx"), "utf8");
    expect(src).toMatch(/text-yellow-600/);
    expect(src).not.toMatch(/(text|bg|border)-orange-[0-9]/);
  });
  it("console/remediation-table high priority yellow (border-l)", () => {
    const src = readFileSync(join(COMP_DIR, "dashboard/console/remediation-table.tsx"), "utf8");
    expect(src).toMatch(/high:\s*"border-l-yellow-400"/);
  });
  it("protocol/extraction-result-item 추출 경고 yellow", () => {
    const src = readFileSync(join(COMP_DIR, "protocol/extraction-result-item.tsx"), "utf8");
    expect(src).toMatch(/bg-yellow-50 text-yellow-700 border-yellow-200/);
  });
});
