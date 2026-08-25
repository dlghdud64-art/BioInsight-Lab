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
  it("요약 3축(조직 수·멤버·초대 대기) — 데이터 보존", () => {
    /* 승계 (§org-management-web P5 2026-08-24 · 표현 완화 · 결정 무손상):
     * 이 단언이 잠그는 것은 **3축이 화면에 남아 있다** 이지 그 배치가 아니다.
     * P5 가 별도 요약 바를 검색 행으로 흡수하며 두 가지가 바뀌었다 —
     *   ① 줄바꿈이 생겨 `개 조직 · 멤버` 가 같은 줄이 아니게 됐다 (포맷)
     *   ② `초대 대기 {totalPending}` 에 <b> 강조 + 대기 시 yellow 경고색이 **더해졌다** (개선)
     * 둘 다 값도 축도 안 바꿨다. 배치는 아래 smoke-p5 가 따로 잠근다. */
    expect(PAGE).toMatch(/개 조직 ·[\s\S]{0,40}?멤버/);
    /* 창 100자 — 실측 71자(강조 태그 + 조건부 색) 근처로 잡는다. §닿았음 단언 */
    expect(PAGE).toMatch(/초대 대기 [\s\S]{0,100}?\{totalPending\}/);
    /* 창을 넓힌 만큼 개선분 자체를 핀해 되돌림을 잡는다 — 대기 시 yellow 경고색 */
    expect(PAGE).toMatch(/totalPending > 0 \? "text-yellow-600"/);
    expect(PAGE).toMatch(/\{organizations\.length\}/);
    /* 역방향 잠금 — 3축 중 하나라도 빠지면 RED (totalMembers 축은 위 정규식 밖이라 명시) */
    expect(PAGE).toMatch(/\{totalMembers\}/);
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
