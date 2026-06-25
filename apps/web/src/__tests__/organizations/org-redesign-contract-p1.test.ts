/**
 * §org-management-redesign P1 — 계약(ODropdown · 조직 유형 · 5탭 상수)
 *   (PLAN: docs/plans/PLAN_org-management-redesign.md Phase 1)
 *
 * P2~P5 공유 빌딩블록. ORG_TYPES = back-compat(기존 저장값 유지, 품질관리 포함).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ODROPDOWN = readFileSync(
  resolve(__dirname, "../../components/organizations/odropdown.tsx"),
  "utf8",
);
const CONSTANTS = readFileSync(
  resolve(__dirname, "../../lib/organizations/org-constants.ts"),
  "utf8",
);

describe("§org-management-redesign P1 — ODropdown 컴포넌트", () => {
  it("export + click-outside + 키보드(Esc) 닫힘", () => {
    expect(ODROPDOWN).toMatch(/export function ODropdown/);
    expect(ODROPDOWN).toMatch(/!ref\.current\.contains\(e\.target as Node\)/);
    expect(ODROPDOWN).toMatch(/e\.key === "Escape"/);
  });
  it("선택값 체크 표시 + 토큰 정합(blue-600, amber/orange 0)", () => {
    expect(ODROPDOWN).toMatch(/opt === value/);
    expect(ODROPDOWN).toMatch(/text-blue-600/);
    expect(ODROPDOWN).not.toMatch(/-amber-|-orange-/);
  });
  it("a11y — listbox/option role + aria-expanded", () => {
    expect(ODROPDOWN).toMatch(/role="listbox"/);
    expect(ODROPDOWN).toMatch(/role="option"/);
    expect(ODROPDOWN).toMatch(/aria-expanded=\{open\}/);
  });
});

describe("§org-management-redesign P1 — 조직 유형(back-compat) + 5탭", () => {
  it("ORG_TYPES = 기존 저장값 유지 + 품질관리 포함", () => {
    expect(CONSTANTS).toMatch(/export const ORG_TYPES/);
    expect(CONSTANTS).toMatch(/"QC\/QA 품질관리"/);
    expect(CONSTANTS).toMatch(/"R&D 연구소"/);
  });
  it("ORG_DETAIL_TABS = 시안 5탭(개요/멤버 및 접근/승인 및 초대/활동 및 감사/정책 및 설정)", () => {
    for (const tab of ["개요", "멤버 및 접근", "승인 및 초대", "활동 및 감사", "정책 및 설정"]) {
      expect(CONSTANTS).toMatch(new RegExp(`"${tab}"`));
    }
  });
});
