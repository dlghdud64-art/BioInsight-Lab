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

// §web-mobile-reskin 재앵커 — lot_issue 별도 shortLabel 색상 ternary 는 카드 재설계로
//   제거되고 만료 임박 색상은 STATUS_CONFIG.expiring 단일 소스(§11.302 muted amber)로 통합.
//   본 sentinel 은 (1) §11.283e 추적 marker 존재 (2) 만료 임박 amber 정합
//   (3) 쨍한 yellow(bg-yellow-500 text-slate-900) 재유입 방지 로 재정의.
describe("§11.283e — 만료 임박 색상 STATUS_CONFIG 통합 (§11.302 amber)", () => {
  it("§11.283e trace marker 존재", () => {
    expect(VIEW).toMatch(/§11\.283e/);
  });

  it("STATUS_CONFIG.expiring — muted amber (#b45821) 정합", () => {
    expect(VIEW).toMatch(/expiring:[\s\S]{0,300}bg-\[#fdf3ec\] text-\[#b45821\] border-\[#f3d4bf\]/);
  });

  it("쨍한 yellow(bg-yellow-500 text-slate-900) 재유입 방지 (§11.302)", () => {
    expect(VIEW).not.toMatch(/bg-yellow-500 text-slate-900/);
  });

  it("위험(danger) — bg-red-600 text-white 보존 (신호등 대비)", () => {
    expect(VIEW).toMatch(/badgeCls:\s*"bg-red-600 text-white border-red-700"/);
  });
});
