/**
 * §org-management-redesign P6 — list 카드 가짜 활동 정직화 (§11.318, P3 detail 누락분 봉합)
 *   (PLAN: docs/plans/PLAN_org-management-redesign.md Phase 6)
 *
 * ★ live §11.318 위반 봉합: getRecentActivity(날조 텍스트·"N분 전 활동" 가짜 시간) 제거 →
 *   실 org 필드(adminCount/pendingCount) 파생 상태(getOrgStatusLine, 없으면 미표기).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE = readFileSync(
  resolve(__dirname, "../../app/dashboard/organizations/page.tsx"),
  "utf8",
);

describe("§org-management-redesign P6 — 가짜 활동 헬퍼 제거(§11.318)", () => {
  it("getRecentActivity(mock) + MOCK_ACTIVITIES 제거", () => {
    expect(PAGE).not.toMatch(/function getRecentActivity/);
    expect(PAGE).not.toMatch(/MOCK_ACTIVITIES/);
  });
  it("가짜 활동 렌더(activity.time/activity.text) 제거", () => {
    expect(PAGE).not.toMatch(/activity\.time/);
    expect(PAGE).not.toMatch(/activity\.text/);
  });
  it("날조 활동 텍스트 리터럴 제거(렌더 — 주석 제외 안전 문자열)", () => {
    expect(PAGE).not.toMatch(/MSDS 안전 점검 완료/);
    expect(PAGE).not.toMatch(/시약 재고 \$\{/);
  });
});

describe("§org-management-redesign P6 — 실 필드 파생 상태(정직)", () => {
  it("getOrgStatusLine = 실 org 필드(adminCount/pendingCount) 파생", () => {
    expect(PAGE).toMatch(/function getOrgStatusLine/);
    expect(PAGE).toMatch(/org\.adminCount === 0/);
    expect(PAGE).toMatch(/org\.pendingCount > 0/);
  });
  it("상태 라인 = null 가드(없으면 미표기, 가짜 0)", () => {
    expect(PAGE).toMatch(/statusLine && \(/);
    expect(PAGE).toMatch(/\{statusLine\}/);
  });
});
