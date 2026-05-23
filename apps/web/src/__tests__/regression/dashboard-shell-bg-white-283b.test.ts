/**
 * §11.283b #dashboard-shell-bg-white-unified — 호영님 P0 spec: "배경색이 너무
 *   회색톤이여서 흰색톤으로 통일". application-wide dashboard surface 흰색 통일.
 *
 * Truth Reconciliation (Phase 0 audit):
 *   - 기존 dashboard-shell.tsx line 58: `<div className="flex h-screen overflow-hidden bg-[#F8FAFC]">`
 *   - `bg-[#F8FAFC]` = slate-50 톤 (옅은 회색)
 *   - bg-pn (var(--app-panel-3) = #FFFFFF) 은 이미 흰색
 *   - bg-el (var(--surface-elevated) = #F1F5F9) 은 active state 회색 (별도)
 *   - 호영님이 본 회색톤 = page-level #F8FAFC (모든 dashboard surface 적용)
 *
 * Fix (minimum diff, 1 file 1 className swap + 4 line trace comment):
 *   `bg-[#F8FAFC]` → `bg-white`. application-wide dashboard surface (대시보드 /
 *   견적 / 구매 / 재고 / 설정 등) 흰색 통일.
 *
 * canonical truth 보존:
 *   - flex h-screen overflow-hidden wrapper 구조 보존
 *   - DashboardSidebar / DashboardHeader 자식 element 변경 0
 *   - operational brief rail / popup provider 변경 0
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SHELL = readFileSync(
  resolve(__dirname, "../../app/dashboard/_components/dashboard-shell.tsx"),
  "utf8",
);

describe("§11.283b — dashboard-shell 배경 흰색 통일", () => {
  it("§11.283b trace marker 존재", () => {
    expect(SHELL).toMatch(/§11\.283b/);
  });

  it("dashboard-shell wrapper 에 bg-white 명시 (배경 흰색)", () => {
    expect(SHELL).toMatch(/flex h-screen overflow-hidden bg-white/);
  });

  it("기존 bg-[#F8FAFC] (slate-50 톤) wrapper 잔존 부재", () => {
    expect(SHELL).not.toMatch(/flex h-screen overflow-hidden bg-\[#F8FAFC\]/);
  });

  it("invariant: flex h-screen overflow-hidden 구조 보존", () => {
    expect(SHELL).toMatch(/flex h-screen overflow-hidden/);
  });

  it("invariant: DashboardSidebar / DashboardHeader 자식 보존", () => {
    expect(SHELL).toMatch(/<DashboardSidebar/);
    expect(SHELL).toMatch(/<DashboardHeader/);
  });
});
