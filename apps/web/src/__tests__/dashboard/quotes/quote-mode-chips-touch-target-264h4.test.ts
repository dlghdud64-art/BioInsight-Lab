/**
 * §11.264h-4 #quote-mode-chips-touch-target — mode chips 44x44 touch target
 *   (호영님 모바일 spec a11y 일관성, §11.264h-3 cross-cutting concern follow-up)
 *
 * §11.264h-3 가 §11.220 전체 선택 텍스트 링크에 min-h-[44px] 추가 → 44x44 touch
 * target 정합. 동일 row 안 mode chips (우선 처리 / 차단 있음 / 오늘 처리 /
 * 전환 가능) 4종은 `px-2.5 py-1 text-[11px]` 로 세로 ~24px → 44x44 미달.
 * Apple HIG / Material / WCAG 2.1 SC 2.5.5 Target Size 표준 미달.
 *
 * Fix (minimum diff, Tailwind class addition):
 *   기존: inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full
 *         border font-medium transition-all whitespace-nowrap
 *   신규: inline-flex items-center gap-1 text-[11px] min-h-[44px] px-2.5 py-1
 *         rounded-full border font-medium transition-all whitespace-nowrap
 *   - min-h-[44px] = 세로 44px 보장
 *   - items-center = text 가운데 정렬 (44px line-height 안)
 *   - text-[11px] 보존 (시각 사이즈 유지)
 *   - rounded-full 보존 → 44px 높이 rounded-full 시 양 끝 22px radius (자연스러움)
 *
 * canonical truth lock:
 *   - setModeChip onClick (toggle isActive ? null : chip.key) 보존
 *   - active 시각 (bg-blue-600/10 text-blue-600 border-blue-600/30) 보존
 *   - 비활성 시각 (text-slate-500 border-bd/50 hover:border-bd hover:text-slate-900) 보존
 *   - chipCount 표시 (text-[9px]) 보존
 *   - text-[11px] 시각 사이즈 보존
 *   - whitespace-nowrap (§11.264h) 보존
 *   - flex-nowrap + overflow-x-auto (§11.259c row container) 보존
 *   - §11.220 전체 선택 텍스트 링크 (§11.264h-3 min-h-[44px]) 보존
 *
 * Out-of-scope backlog:
 *   - 초기화 button 자체 44x44 (현재 text link, min-h-[44px] 미적용) — 별도 cluster
 *   - mode chips chipCount span (text-[9px]) — 부모 button 안 정렬 변경 없음
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.264h-4 #1 — mode chip 44x44 touch target", () => {
  it("§11.264h-4 trace marker comment 존재", () => {
    expect(page).toMatch(/§11\.264h-4/);
  });

  it("mode chip className 에 min-h-[44px] 추가 (MODE_CHIPS.map 안)", () => {
    expect(page).toMatch(
      /MODE_CHIPS(?:\.filter\([\s\S]*?\))?\.map[\s\S]{0,1500}className=\{`inline-flex items-center gap-1 text-\[11px\] min-h-\[44px\] px-2\.5 py-1 rounded-full/,
    );
  });

  it("text-[11px] 시각 사이즈 보존 (44px height 안에 가운데 정렬)", () => {
    // text-[11px] 가 min-h-[44px] 앞에 와야 함 (className 순서 정합)
    expect(page).toMatch(
      /MODE_CHIPS(?:\.filter\([\s\S]*?\))?\.map[\s\S]{0,1500}text-\[11px\] min-h-\[44px\]/,
    );
  });

  it("rounded-full 보존 (44px height + rounded-full = 22px radius 자연)", () => {
    expect(page).toMatch(
      /MODE_CHIPS(?:\.filter\([\s\S]*?\))?\.map[\s\S]{0,1500}min-h-\[44px\] px-2\.5 py-1 rounded-full/,
    );
  });
});

describe("§11.264h-4 #2 — invariant 보존 (canonical truth)", () => {
  it("§11.264h whitespace-nowrap 보존", () => {
    expect(page).toMatch(
      /MODE_CHIPS(?:\.filter\([\s\S]*?\))?\.map[\s\S]{0,1500}whitespace-nowrap/,
    );
  });

  it("setModeChip onClick toggle 보존", () => {
    expect(page).toMatch(/setModeChip\(isActive \? null : chip\.key\)/);
  });

  it("active 시각 (§quote-screen-sian P6.2 §08 tone — 위험 빨강/주의 앰버) 보존", () => {
    expect(page).toMatch(/chip\.tone === "danger" \? "bg-red-50 text-red-700 border-red-300"/);
  });

  it("비활성 시각 (§08 옅은 tone) + 0건 비활성 보존", () => {
    expect(page).toMatch(/chip\.tone === "danger" \? "bg-white text-red-600 border-red-200/);
    expect(page).toMatch(/chipCount === 0[\s\S]{0,140}cursor-not-allowed/);
  });

  it("chipCount 표시 (text-[9px]) 보존", () => {
    expect(page).toMatch(/chipCount > 0 &&[\s\S]{0,80}text-\[9px\]/);
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

  it("초기화 button 보존 (out-of-scope backlog — 별도 cluster)", () => {
    expect(page).toMatch(/setModeChip\(null\)[\s\S]{0,200}초기화/);
  });
});
