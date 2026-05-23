/**
 * §11.283e #lot-strip-badge-light-mode — mobile-inventory-view lot_issue
 *   strip 검토/임박 배지 light mode 신호등 정합 hot fix (호영님 P0+ production
 *   smoke 결과 후속).
 *
 * 호영님 P0+ production smoke 결과 (Chrome MCP):
 *   labaxis.co.kr/dashboard/inventory HTML 검사 — "검토" 배지가
 *   bg-yellow-500 text-slate-900 (진한 노랑 + 어두운 텍스트) 로 렌더링.
 *   §11.283d STATUS_CONFIG hot fix 는 normal/low/expiring/danger (4 spot)
 *   만 swap 했고 line 327-336 lot_issue shortLabel 분기 (§11.273c 에서 land)
 *   는 cover 못함.
 *
 * Root Cause:
 *   mobile-inventory-view.tsx line 330, 332 에서 검토 + 임박 shortLabel 분기
 *   가 bg-yellow-500 text-slate-900 사용 — 호영님 spec light mode 신호등
 *   (bg-XXX-100 text-XXX-700) 와 mismatch.
 *
 * Fix (minimum-diff, mobile-inventory-view.tsx line 330+332 만 swap):
 *   - 검토 (line 330): bg-yellow-500 text-slate-900 → bg-yellow-100 text-yellow-700
 *   - 임박 (line 332): bg-yellow-500 text-slate-900 → bg-yellow-100 text-yellow-700
 *
 * 보존 (다른 shortLabel 분기 유지):
 *   - 긴급/폐기: bg-red-600 text-white (§11.283d 정합)
 *   - 재주문: bg-blue-500 text-white (다른 category)
 *   - 위치: bg-violet-500 text-white (다른 category)
 *   - none fallback: bg-slate-200 text-slate-700 (보존)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const VIEW = readFileSync(
  resolve(__dirname, "../../components/inventory/mobile-inventory-view.tsx"),
  "utf8",
);

describe("§11.283e — lot_issue strip 검토/임박 light mode 신호등 정합", () => {
  it("§11.283e trace marker 존재", () => {
    expect(VIEW).toMatch(/§11\.283e/);
  });

  it("검토 shortLabel — bg-yellow-100 text-yellow-700 (light mode 신호등)", () => {
    expect(VIEW).toMatch(/shortLabel === "검토"\s*\?\s*"bg-yellow-100 text-yellow-700"/);
  });

  it("임박 shortLabel — bg-yellow-100 text-yellow-700 (light mode 신호등)", () => {
    expect(VIEW).toMatch(/shortLabel === "임박"\s*\?\s*"bg-yellow-100 text-yellow-700"/);
  });

  it("기존 dark tone (bg-yellow-500 text-slate-900) lot_issue 분기 잔존 부재", () => {
    // shortLabel === "검토" / "임박" 분기에 bg-yellow-500 잔존 없어야 함
    expect(VIEW).not.toMatch(/shortLabel === "(검토|임박)"\s*\?\s*"bg-yellow-500 text-slate-900"/);
  });

  it("긴급/폐기 shortLabel — bg-red-600 text-white 보존 (§11.283d 정합)", () => {
    expect(VIEW).toMatch(/shortLabel === "긴급"\s*\?\s*"bg-red-600 text-white"/);
    expect(VIEW).toMatch(/shortLabel === "폐기"\s*\?\s*"bg-red-600 text-white"/);
  });

  it("재주문/위치 shortLabel — 다른 category 색상 보존 (canonical truth)", () => {
    expect(VIEW).toMatch(/shortLabel === "재주문"\s*\?\s*"bg-blue-500 text-white"/);
    expect(VIEW).toMatch(/shortLabel === "위치"\s*\?\s*"bg-violet-500 text-white"/);
  });
});
