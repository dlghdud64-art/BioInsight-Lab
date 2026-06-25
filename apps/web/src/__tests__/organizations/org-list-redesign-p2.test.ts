/**
 * §org-management-redesign P2 — 목록 리디자인 + ODropdown 소비
 *   (PLAN: docs/plans/PLAN_org-management-redesign.md Phase 2)
 *
 * 우측 군더더기(포트폴리오 요약 패널·중복 생성 CTA) 제거 → 상단 요약 바. native select → ODropdown(wiring 보존).
 * 회귀 0: 단일 CTA(상단 조직 생성)·바로 처리할 항목(실 actionable)·생성 mutation wiring 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE = readFileSync(
  resolve(__dirname, "../../app/dashboard/organizations/page.tsx"),
  "utf8",
);

describe("§org-management-redesign P2 — ODropdown 소비(native select 통일)", () => {
  it("ODropdown import + 렌더 + organizationType wiring 보존(dead button 0)", () => {
    expect(PAGE).toMatch(/import \{ ODropdown \} from "@\/components\/organizations\/odropdown"/);
    expect(PAGE).toMatch(/<ODropdown/);
    expect(PAGE).toMatch(/onChange=\{\(v\) => setFormData\(\{ \.\.\.formData, organizationType: v \}\)\}/);
    expect(PAGE).toMatch(/options=\{ORG_TYPES\}/);
  });
  it("조직 유형 입력 = ODropdown(native select element 미사용 — 렌더 형태)", () => {
    // 주석 내 'native <select>' 언급은 제외, 실제 element( <select 속성 ) 부재만 검증.
    expect(PAGE).not.toMatch(/<select\s+id="org-type"/);
    expect(PAGE).not.toMatch(/<option value=/);
  });
});

describe("§org-management-redesign P2 — 우측 군더더기 제거 + 요약 바", () => {
  it("포트폴리오 요약 패널 + SidebarStatRow 제거(렌더 형태 — 주석 제외)", () => {
    expect(PAGE).not.toMatch(/포트폴리오 요약<\/span>/);
    expect(PAGE).not.toMatch(/function SidebarStatRow/);
    expect(PAGE).not.toMatch(/<SidebarStatRow/);
  });
  it("중복 조직 생성 CTA(rail) 제거", () => {
    expect(PAGE).not.toMatch(/새로운 조직이 필요한가요/);
  });
  it("상단 요약 바(조직 수·멤버·초대 대기) — 데이터 보존", () => {
    expect(PAGE).toMatch(/개 조직 · 멤버/);
    expect(PAGE).toMatch(/초대 대기 \{totalPending\}/);
    expect(PAGE).toMatch(/\{organizations\.length\}/);
  });
});

describe("§org-management-redesign P2 — 회귀 0(단일 CTA·actionable·생성 wiring)", () => {
  it("단일 CTA — 상단 조직 생성 버튼 보존", () => {
    expect(PAGE).toMatch(/조직 생성/);
    expect(PAGE).toMatch(/onClick=\{\(\) => setIsOpen\(true\)\}/);
  });
  it("바로 처리할 항목(실 actionable) 보존", () => {
    expect(PAGE).toMatch(/바로 처리할 항목/);
    expect(PAGE).toMatch(/orgsWithWarnings/);
  });
  it("조직 생성 mutation(POST /api/organizations) wiring 보존", () => {
    expect(PAGE).toMatch(/csrfFetch\("\/api\/organizations"/);
    expect(PAGE).toMatch(/organizationType: formData\.organizationType/);
  });
});
