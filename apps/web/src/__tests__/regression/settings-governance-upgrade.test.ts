/**
 * §설정-고도화 §1.3~1.7 (호영님 2026-07-04) — 설정 서브탭 거버넌스/워크스페이스/세션/활동로그.
 * §1.3 SectionCard governance 칩(편집가능/관리자잠금) · §1.5 워크스페이스 연결 실배선 CTA ·
 * §1.7 활동로그 프리뷰 + orphaned import/query 제거(build 회귀 방지).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const PAGE = readFileSync(join(__dirname, "..", "..", "app/dashboard/settings/page.tsx"), "utf8");

describe("§설정-고도화 §1.3~1.7", () => {
  it("§1.3 SectionCard governance prop(폴백) + 편집가능/관리자잠금 칩", () => {
    expect(PAGE).toMatch(/governance\?:\s*"editable" \| "locked"/);
    expect((PAGE.match(/governance="editable"/g) || []).length).toBeGreaterThanOrEqual(2);
    expect((PAGE.match(/governance="locked"/g) || []).length).toBeGreaterThanOrEqual(2);
  });
  it("§1.5 워크스페이스 연결 CTA 실배선(→/dashboard/organizations, dead-button 아님)", () => {
    expect(PAGE).toMatch(/워크스페이스 연결/);
    expect(PAGE).toMatch(/router\.push\("\/dashboard\/organizations"\)/);
  });
  it("§1.7 orphaned import/query 제거(build 회귀 방지)", () => {
    expect(PAGE).not.toMatch(/import[^\n]*AUDIT_EVENT_LABELS/);
    expect(PAGE).not.toMatch(/import[^\n]*AUDIT_TONE_DOT_CLASSES/);
    expect(PAGE).not.toMatch(/const\s+\{?\s*recentActivityData/);
  });
});
