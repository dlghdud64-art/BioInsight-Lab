/**
 * §org-management-redesign P5 — 반응형 감사 + end-to-end smoke (최종 종결)
 *   (PLAN: docs/plans/PLAN_org-management-redesign.md Phase 5)
 *
 * P1~P4a 정합 land smoke + 신규 표면 반응형 불변(375px 잘림 0). 코드 변경 0(목록 요약 바 flex-wrap 1줄 제외).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const LIST = readFileSync(resolve(__dirname, "../../app/dashboard/organizations/page.tsx"), "utf8");
const DETAIL = readFileSync(resolve(__dirname, "../../app/dashboard/organizations/[id]/page.tsx"), "utf8");
const ODROPDOWN = readFileSync(resolve(__dirname, "../../components/organizations/odropdown.tsx"), "utf8");

describe("§org-management-redesign P5 — end-to-end smoke(P1~P4a)", () => {
  it("P1 — ODropdown 컴포넌트", () => {
    expect(ODROPDOWN).toMatch(/export function ODropdown/);
  });
  it("P2 — 목록 ODropdown 소비 + 요약 바 + 단일 CTA", () => {
    expect(LIST).toMatch(/<ODropdown/);
    expect(LIST).toMatch(/개 조직 · 멤버/);
    expect(LIST).not.toMatch(/새로운 조직이 필요한가요/);
  });
  it("P3 — 상세 요약 바 + 활동 honesty(가짜 0)", () => {
    expect(DETAIL).toMatch(/멤버 <b className="text-slate-900">\{totalMembers\}<\/b>/);
    expect(DETAIL).toMatch(/활동 내역이 아직 없습니다/);
    expect(DETAIL).not.toMatch(/actor: "이매니저"/);
  });
  it("P4a — 삭제 type-to-confirm(dead button 봉합)", () => {
    expect(DETAIL).toMatch(/data-testid="org-delete-confirm"/);
    expect(DETAIL).toMatch(/deleteOrgMutation = useMutation/);
  });
});

describe("§org-management-redesign P5 — 신규 표면 반응형(375px 잘림 0)", () => {
  it("목록 요약 바 = flex-wrap(좁은 화면 줄바꿈)", () => {
    expect(LIST).toMatch(/flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl/);
  });
  it("상세 요약 바 = flex-wrap", () => {
    expect(DETAIL).toMatch(/flex flex-wrap items-center gap-x-5 gap-y-2/);
  });
  it("삭제 모달 = sm:max-w(모바일 w-full 축소)", () => {
    expect(DETAIL).toMatch(/sm:max-w-\[440px\]/);
  });
  it("ODropdown = w-full(컨테이너 맞춤)", () => {
    expect(ODROPDOWN).toMatch(/w-full items-center gap-2 rounded-lg border/);
  });
});
