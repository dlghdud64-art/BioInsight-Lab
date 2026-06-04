import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const FILE = "src/app/dashboard/page.tsx";

describe("§11.362-1/2 — 위험-우선 severity rank (가장 먼저 처리)", () => {
  it("severityRank 필드가 후보에 부여된다", () => {
    const src = read(FILE);
    const ranks = src.match(/severityRank:\s*\d+/g) ?? [];
    // 만료/SLA/재고/입고/승인 5종 후보.
    expect(ranks.length).toBe(5);
  });

  it("위험 신호(만료·SLA)가 우선순위 후보에 편입된다", () => {
    const src = read(FILE);
    expect(src).toMatch(/id:\s*"expiring"/);
    expect(src).toMatch(/id:\s*"sla"/);
    expect(src).toMatch(/count:\s*stats\.expiringCount/);
    expect(src).toMatch(/count:\s*riskOrBlockerCount/);
  });

  it("primary 는 count>0 후보 중 severityRank 최상위로 정렬 선정", () => {
    const src = read(FILE);
    // find(count>0) 단독(구) 제거 → filter + sort(severityRank) 로 전환.
    expect(src).toMatch(
      /\.filter\(\(action\) => action\.count > 0\)\s*\.sort\(\(a, b\) => a\.severityRank - b\.severityRank\)\[0\]/
    );
  });

  it("rank 순서: 만료(1) < SLA(2) < 재고(3) < 입고(4) < 승인(5)", () => {
    const src = read(FILE);
    const idxExpiring = src.indexOf('id: "expiring"');
    const idxSla = src.indexOf('id: "sla"');
    const idxInventory = src.indexOf('id: "inventory"');
    const idxReceiving = src.indexOf('id: "receiving"');
    const idxApproval = src.indexOf('id: "approval"');
    // 배열 선언 순서가 severity rank 순 (가독성/순서 정합).
    expect(idxExpiring).toBeLessThan(idxSla);
    expect(idxSla).toBeLessThan(idxInventory);
    expect(idxInventory).toBeLessThan(idxReceiving);
    expect(idxReceiving).toBeLessThan(idxApproval);
  });

  describe("회귀 0 — 보존 항목", () => {
    it("secondary 도 severity 정렬 후 2개로 제한", () => {
      const src = read(FILE);
      expect(src).toMatch(
        /secondaryPriorityActions = \[\.\.\.dashboardPriorityActions\][\s\S]*?\.sort\(\(a, b\) => a\.severityRank - b\.severityRank\)\s*\.slice\(0, 2\)/
      );
    });

    it("nextPriorityAction / inactiveReason / priorityStageBadges 유지", () => {
      const src = read(FILE);
      expect(src).toMatch(/const nextPriorityAction = secondaryPriorityActions\[0\]/);
      expect(src).toMatch(/const inactiveReason =/);
      expect(src).toMatch(/const priorityStageBadges = \[/);
    });

    it("primary CTA href / label 렌더 유지", () => {
      const src = read(FILE);
      expect(src).toMatch(/href=\{primaryPriorityAction\.href\}/);
      expect(src).toMatch(/\{primaryPriorityAction\.label\} \{primaryPriorityAction\.count\}건/);
    });
  });
});
