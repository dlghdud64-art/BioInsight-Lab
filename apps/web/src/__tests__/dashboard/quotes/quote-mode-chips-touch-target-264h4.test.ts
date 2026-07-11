/**
 * §11.264h-4 #quote-mode-chips-touch-target — 빠른 필터 chip 44x44 touch target
 *   (호영님 모바일 spec a11y 일관성, §11.264h-3 cross-cutting concern follow-up)
 *
 * §quotes-quick-filter-4a P2 — 구 MODE_CHIPS(setModeChip 단일선택 mode chip 4종:
 *   우선 처리 / 차단 있음 / 오늘 처리 / 전환 가능)가 QUICK_CHIP_META 5칩 다중선택(Set)
 *   빠른 필터(deadline/stalled/priority/send/reply, toggleQuickStatus, 신호등 QUICK_CHIP_CLS,
 *   비활성 0건 숨김 `if (!active && count === 0) return null`)으로 교체됨. touch-target /
 *   시각(text-[11px]/min-h-[44px]/rounded-full/whitespace-nowrap) 단언을 신 chip 으로 재앵커.
 *   genuinely-removed(MODE_CHIPS.map / setModeChip / chip.tone 삼항 / cursor-not-allowed 0건)
 *   단언은 부재-lock 으로 은퇴. 초기화 button 은 resetQuick 로 재앵커.
 *
 * 신 chip className (QUICK_CHIP_META.map, page.tsx L~2557):
 *   inline-flex items-center gap-1 text-[11px] min-h-[44px] px-2.5 rounded-full
 *   border font-medium transition-all whitespace-nowrap shrink-0
 *   - min-h-[44px] = 세로 44px 보장 (WCAG 2.1 SC 2.5.5 Target Size)
 *   - text-[11px] 시각 사이즈 보존 (44px line-height 안 가운데 정렬)
 *   - rounded-full / whitespace-nowrap 보존
 *
 * canonical truth lock (신 빠른 필터):
 *   - toggleQuickStatus(meta.key) onClick (다중 AND Set 토글)
 *   - aria-pressed={active} (신호등 chip pressed 상태)
 *   - 활성/비활성 시각 = QUICK_CHIP_CLS[meta.tone] (danger red / warn yellow / info blue)
 *   - 비활성 0건 숨김: if (!active && count === 0) return null (구 cursor-not-allowed 대체)
 *   - count 표시 (text-[9px]) 보존
 *   - flex-nowrap + overflow-x-auto (§11.259c row container) 보존
 *   - §11.220 전체 선택 텍스트 링크 (§11.264h-3 min-h-[44px]) 보존
 *   - 초기화 button → resetQuick ({quickActive && ...}) 재앵커
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.264h-4 #1 — 빠른 필터 chip 44x44 touch target", () => {
  it("§quotes-quick-filter-4a trace marker comment 존재 (§11.264h-4 계보 계승)", () => {
    // §quotes-quick-filter-4a P2 supersession — 구 §11.264h-4 mode-chip 마커는 제거됨.
    //   touch-target 관심사는 live 빠른 필터(§quotes-quick-filter-4a)로 이전 → 마커 재앵커.
    expect(page).toMatch(/§quotes-quick-filter-4a/);
  });

  it("chip className 에 min-h-[44px] (QUICK_CHIP_META.map 안)", () => {
    expect(page).toMatch(
      /QUICK_CHIP_META\.map[\s\S]{0,1500}className=\{`inline-flex items-center gap-1 text-\[11px\] min-h-\[44px\] px-2\.5 rounded-full/,
    );
  });

  it("text-[11px] 시각 사이즈 보존 (44px height 안에 가운데 정렬)", () => {
    // text-[11px] 가 min-h-[44px] 앞에 와야 함 (className 순서 정합)
    expect(page).toMatch(
      /QUICK_CHIP_META\.map[\s\S]{0,1500}text-\[11px\] min-h-\[44px\]/,
    );
  });

  it("rounded-full 보존 (44px height + rounded-full = 22px radius 자연)", () => {
    expect(page).toMatch(
      /QUICK_CHIP_META\.map[\s\S]{0,1500}min-h-\[44px\] px-2\.5 rounded-full/,
    );
  });
});

describe("§11.264h-4 #2 — invariant 보존 (canonical truth)", () => {
  it("§11.264h whitespace-nowrap 보존 (QUICK_CHIP_META.map 안)", () => {
    expect(page).toMatch(
      /QUICK_CHIP_META\.map[\s\S]{0,1500}whitespace-nowrap/,
    );
  });

  it("toggleQuickStatus onClick 토글 보존 (구 setModeChip 대체)", () => {
    // §quotes-quick-filter-4a P2 supersession — 구 setModeChip(isActive ? null : chip.key)
    //   단일선택 토글 → toggleQuickStatus(meta.key) 다중 AND Set 토글.
    expect(page).not.toMatch(/setModeChip\(isActive \? null : chip\.key\)/);
    expect(page).toMatch(/onClick=\{\(\) => toggleQuickStatus\(meta\.key\)\}/);
    expect(page).toMatch(/aria-pressed=\{active\}/);
  });

  it("활성 시각 (신호등 QUICK_CHIP_CLS danger red) 보존", () => {
    // §quotes-quick-filter-4a P2 supersession — 구 `chip.tone === "danger" ? "..."` 삼항 →
    //   QUICK_CHIP_CLS[meta.tone] 객체 룩업. danger active 톤(red) 재앵커.
    expect(page).not.toMatch(/chip\.tone === "danger" \?/);
    expect(page).toMatch(/danger:\s*\{\s*active:\s*"bg-red-50 text-red-700 border-red-300"/);
  });

  it("비활성 시각 (danger 옅은 tone) + 비활성 0건 숨김 보존", () => {
    expect(page).toMatch(/idle:\s*"bg-white text-red-600 border-red-200/);
    // §quotes-quick-filter-4a P2 supersession — 구 0건 cursor-not-allowed(disabled) →
    //   비활성 0건 chip 은 렌더 자체를 숨김(해제 데드락 방지: 활성 0건은 항상 노출).
    expect(page).not.toMatch(/chipCount === 0[\s\S]{0,140}cursor-not-allowed/);
    expect(page).toMatch(/if \(!active && count === 0\) return null/);
  });

  it("count 표시 (text-[9px]) 보존", () => {
    // §quotes-quick-filter-4a P2 — 구 chipCount(text-[9px]) span → count(text-[9px]) span 재앵커.
    expect(page).toMatch(/text-\[9px\][\s\S]{0,80}\{count\}<\/span>/);
  });

  it("§11.259c flex-nowrap + overflow-x-auto row container 보존", () => {
    expect(page).toMatch(/flex items-center gap-1\.5 flex-nowrap overflow-x-auto/);
  });

  it("§11.264h-3 전체 선택 텍스트 링크 min-h-[44px] 보존 (siblings touch target)", () => {
    expect(page).toMatch(
      /selectablePending\.map\(q => q\.id\)[\s\S]{0,1500}min-h-\[44px\]/,
    );
  });

  it("§11.262a fade overlay 보존", () => {
    expect(page).toMatch(/§11\.262a/);
    expect(page).toMatch(/bg-gradient-to-r from-white to-transparent pointer-events-none sm:hidden/);
  });

  it("초기화 button 보존 (resetQuick 재앵커, {quickActive && ...})", () => {
    // §quotes-quick-filter-4a P2 supersession — 구 setModeChip(null) 초기화 → resetQuick.
    expect(page).not.toMatch(/setModeChip\(null\)/);
    expect(page).toMatch(/quickActive && \([\s\S]{0,240}onClick=\{resetQuick\}[\s\S]{0,120}초기화/);
  });
});
