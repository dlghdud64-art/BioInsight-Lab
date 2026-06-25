/**
 * §org-management-redesign P3 — 상세 요약 바 + 활동 mock honesty(§11.318)
 *   (PLAN: docs/plans/PLAN_org-management-redesign.md Phase 3)
 *
 * ★ 핵심 게이트: 가짜 활동 데이터 제거(canonical 부재 → 정직 빈 상태, fake 0).
 * KPI 6박스 → 요약 한 줄 바(실 5지표). 5탭 라벨 시안 정합 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE = readFileSync(
  resolve(__dirname, "../../app/dashboard/organizations/[id]/page.tsx"),
  "utf8",
);

describe("§org-management-redesign P3 — 활동 mock honesty(§11.318)", () => {
  it("가짜 활동 데이터(하드코딩 actor/action) 제거", () => {
    expect(PAGE).not.toMatch(/actor: "이매니저"/);
    expect(PAGE).not.toMatch(/DMEM 시약을 5병 입고/);
    expect(PAGE).not.toMatch(/박신입님이 조직 초대를 수락/);
  });
  it("organizationLogs = 빈 배열(정직)", () => {
    expect(PAGE).toMatch(/const organizationLogs:[\s\S]{0,120}=\s*\[\]/);
  });
  it("활동 없음 정직 표기(empty state)", () => {
    expect(PAGE).toMatch(/활동 내역이 아직 없습니다/);
  });
});

describe("§org-management-redesign P3 — KPI 6박스 → 요약 한 줄 바", () => {
  it("요약 바(실 5지표: 멤버·활성·초대 대기·승인·플랜)", () => {
    expect(PAGE).toMatch(/멤버 <b className="text-slate-900">\{totalMembers\}<\/b>/);
    expect(PAGE).toMatch(/활성 <b/);
    expect(PAGE).toMatch(/초대 대기 <b/);
    expect(PAGE).toMatch(/승인 권한 <b/);
    expect(PAGE).toMatch(/\{planLabel\}/);
  });
  it("가짜 '최근 7일 활동' KPI(organizationLogs.length 카운트 박스) 제거 — 렌더 형태(주석 제외)", () => {
    expect(PAGE).not.toMatch(/최근 7일 활동<\/span>/);
    expect(PAGE).not.toMatch(/\{organizationLogs\.length\}<span/);
  });
});

describe("§org-management-redesign P3 — 회귀 0(5탭·멤버 wiring)", () => {
  it("5탭 라벨 시안 정합 보존", () => {
    for (const label of ["멤버 및 접근", "승인 및 초대", "활동 및 감사", "정책 및 설정"]) {
      expect(PAGE).toMatch(new RegExp(label));
    }
  });
  it("멤버 목록 canonical fetch 보존", () => {
    expect(PAGE).toMatch(/\/api\/organizations\/\$\{params\.id\}\/members/);
  });
});
