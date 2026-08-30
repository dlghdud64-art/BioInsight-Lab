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

/** 부정 단언은 주석 제거본에 건다 — 은퇴 사유를 적은 주석의 인용이 걸리면 안 된다. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

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
  it("ORG_DETAIL_TABS = 4탭(개요/멤버 및 접근/승인 및 초대/정책 및 설정) — 활동 및 감사 은퇴", () => {
    /* 🛑 재조준 — 결정 교체 (§org-management-web v2-3 · 호영님 리뷰 2026-08-30).
     * 옛 결정: 시안 5탭. 실측: "활동 및 감사" 는 사이드바 전역 통합 로그
     * (/dashboard/audit)와 중복인 빈 껍데기였다 — org-scoped 엔드포인트 부재로
     * organizationLogs 가 항상 [] 라 탭이 늘 빈 상태만 그렸다.
     * 대체: 개요 최근 활동 요약 + 전체 활동 로그 딥링크(/dashboard/audit?org= 조직 필터). */
    for (const tab of ["개요", "멤버 및 접근", "승인 및 초대", "정책 및 설정"]) {
      expect(CONSTANTS).toMatch(new RegExp(`"${tab}"`));
    }
    /* 역방향 잠금 — 5탭으로 되돌아오면 RED (주석 제거본 — 은퇴 사유 주석의 인용 제외) */
    expect(stripComments(CONSTANTS)).not.toMatch(/"활동 및 감사"/);
  });
});
