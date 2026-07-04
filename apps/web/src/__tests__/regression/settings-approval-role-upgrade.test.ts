/**
 * §설정-고도화 §2.1~2.3 (호영님 2026-07-04) — 승인 규정 명칭·ApprovalTierRow 배지/구간/막대·역할 템플릿.
 * 안전판: RBAC role enum·ROLE_LABELS 캐논 맵 무변경(표시 한정), 가짜 member count 위조 0, amber(#b45821) 토큰.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const PAGE = readFileSync(join(__dirname, "..", "..", "app/dashboard/settings/page.tsx"), "utf8");

describe("§설정-고도화 §2.1~2.3", () => {
  it("§2.1 '금액별 승인 규정' 명칭·부제(결재선 라우팅 폐기)", () => {
    expect(PAGE).toMatch(/title="금액별 승인 규정"/);
    expect(PAGE).toMatch(/구매 금액에 따라 승인자가 자동으로 정해집니다/);
    // 옛 명칭이 SectionCard title 로 잔존하면 안 됨(설명 주석의 언급은 허용).
    expect(PAGE).not.toMatch(/title="결재선 라우팅 규칙"/);
  });
  it("§2.2 ApprovalTierRow 색 배지 + 구간 칩(optional) + 막대(optional), 저장 로직 불변", () => {
    expect(PAGE).toMatch(/color: "emerald" \| "blue" \| "amber"/);
    expect(PAGE).toMatch(/rangeLabel\?:/);
    expect(PAGE).toMatch(/barPct\?:/);
    expect(PAGE).toMatch(/onChange=\{setApprovalTier1\}/);
    expect(PAGE).toMatch(/#b45821/); // muted amber(CLAUDE §9)
  });
  it("§2.3 가짜 count·mock 4역할 제거 → 3역할 표준 템플릿 + CTA 실배선", () => {
    expect(PAGE).not.toMatch(/\{r\.count\}명/);
    expect(PAGE).not.toMatch(/count: 1, color: "text-red-600"/);
    expect(PAGE).toMatch(/관리자 필수/);
    expect(PAGE).toMatch(/멤버 및 역할 관리/);
    expect(PAGE).toMatch(/router\.push\("\/dashboard\/organizations"\)/);
  });
  it("안전판 — ROLE_LABELS 캐논 맵 보존(RBAC role enum 무변경)", () => {
    expect(PAGE).toMatch(/const ROLE_LABELS: Record<string, string>/);
  });
});
