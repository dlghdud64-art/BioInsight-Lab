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

  // §dashboard-shifan-adopt P1 진화 — 단일 "primary" 선정(레거시 배너)은 ActionInbox
  //   ("오늘 처리해야 할 일")로 대체. ActionInbox가 dashboardPriorityActions(severity 순
  //   배열)의 count>0 항목 전부를 배열 순(=severity 순)으로 surface → 위험-우선 awareness 보존.
  it("우선처리는 ActionInbox가 dashboardPriorityActions(severity 순)를 surface", () => {
    const src = read(FILE);
    expect(src).toMatch(/actionInboxItems:\s*ActionInboxItem\[\]\s*=\s*dashboardPriorityActions\.map/);
    expect(src).toMatch(/<ActionInbox items=\{actionInboxItems\}/);
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

  describe("§dashboard-shifan-adopt P1 진화 — 레거시 배너 retire, ActionInbox 대체", () => {
    it("레거시 primary 선정/배너 cluster 제거(primaryPriorityAction/priorityStageBadges/nextPriorityAction 0)", () => {
      const src = read(FILE);
      expect(src).not.toMatch(/primaryPriorityAction/);
      expect(src).not.toMatch(/priorityStageBadges/);
      expect(src).not.toMatch(/nextPriorityAction/);
    });

    it("severity 순서 awareness 보존 — 배열 순(만료<SLA<재고<입고<승인)이 ActionInbox map 표시 순", () => {
      const src = read(FILE);
      // it4가 배열 선언 순서(severity 순) 검증 — ActionInbox는 .map 순서(=배열 순) 유지.
      expect(src).toMatch(/dashboardPriorityActions\.map/);
    });
  });
});
