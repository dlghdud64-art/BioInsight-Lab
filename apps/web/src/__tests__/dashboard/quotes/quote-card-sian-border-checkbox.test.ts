/**
 * §quote-card-sian(호영님 라이브 대조) — 견적 카드 시안 정합.
 *   ① 카드 바깥 테두리 강화(평면 borderless → border-slate-200 + shadow-sm).
 *   ② 선택 체크박스: 네이티브(옛 디자인) → 커스텀 토글(peer-checked, onChange 핸들러 보존).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(__dirname, "../../../app/dashboard/quotes/page.tsx"),
  "utf8",
);

describe("§quote-card-sian — 카드 테두리 + 커스텀 체크박스", () => {
  it("카드 바깥 테두리 강화 + shadow-sm (시안 정합)", () => {
    expect(src).toContain("rounded-xl border shadow-sm");
    expect(src).toContain("border-slate-200 hover:border-slate-300");
  });

  it("선택 체크박스 커스텀 + onChange 핸들러 보존(wiring 0 변경)", () => {
    expect(src).toContain("peer-checked:bg-violet-600");
    expect(src).toContain("onChange={onToggleSelect}");
    // 구 네이티브 체크박스 className 제거 확인
    expect(src).not.toMatch(/h-4 w-4 rounded border-slate-300 text-violet-600 focus-visible/);
  });
});
