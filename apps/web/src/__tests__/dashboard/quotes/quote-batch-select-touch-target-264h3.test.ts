/**
 * §11.264h-3 #quote-batch-select-touch-target — 전체 선택 텍스트 링크 44x44 touch target
 *
 * 호영님 모바일 spec touch target 44x44 보장 (Apple HIG / Material 표준).
 *
 * §11.264h-2 결과: chip 톤 → 텍스트 링크 (px-1 py-1 text-[11px]) → 클릭 영역 ~17x17
 *   호영님 모바일 spec (44x44) 미달.
 *
 * Fix (minimum diff, Tailwind class swap):
 *   기존: inline-flex items-center gap-1 text-[11px] px-1 py-1
 *   신규: inline-flex items-center gap-1 text-[11px] min-h-[44px] px-2 py-1
 *   - min-h-[44px] = 세로 44px 보장
 *   - px-2 = 가로 padding 확장 (시각 미미한 변화)
 *   - items-center = text 가운데 정렬 (44px line-height 안)
 *
 * canonical truth lock:
 *   - §11.264h-2 텍스트 링크 시각 (underline-offset-2 hover:underline text-violet-700) 보존
 *   - whitespace-nowrap (§11.264h) 보존
 *   - ml-auto (우측 정렬) 보존
 *   - aria-label / onClick / visible 라벨 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.264h-3 #1 — 44x44 touch target", () => {
  it("§11.264h-3 trace marker comment 존재", () => {
    expect(page).toMatch(/§11\.264h-3/);
  });

  it("전체 선택 CTA className 에 min-h-[44px] 추가", () => {
    expect(page).toMatch(
      /selectablePending\.map\(q => q\.id\)[\s\S]{0,1500}min-h-\[44px\]/,
    );
  });

  it("px-1 → px-2 확장 (touch 영역 가로 확보)", () => {
    expect(page).toMatch(
      /selectablePending\.map\(q => q\.id\)[\s\S]{0,1500}px-2 py-1/,
    );
  });
});

describe("§11.264h-3 #2 — invariant 보존 (canonical truth)", () => {
  it("§11.264h-2 텍스트 링크 시각 보존 (underline-offset + hover:underline)", () => {
    expect(page).toMatch(
      /selectablePending\.map\(q => q\.id\)[\s\S]{0,1500}underline-offset-2 hover:underline/,
    );
  });

  it("text-violet-700 + hover:text-violet-900 보존", () => {
    expect(page).toMatch(
      /selectablePending\.map\(q => q\.id\)[\s\S]{0,1500}text-violet-700 hover:text-violet-900/,
    );
  });

  it("ml-auto (우측 정렬) 보존", () => {
    expect(page).toMatch(
      /selectablePending\.map\(q => q\.id\)[\s\S]{0,1500}className="ml-auto/,
    );
  });

  it("§11.264h whitespace-nowrap 보존", () => {
    expect(page).toMatch(
      /selectablePending\.map\(q => q\.id\)[\s\S]{0,1500}whitespace-nowrap/,
    );
  });

  it("aria-label 라벨 보존 (전체 선택 해제 / 발송 대기 견적 전체 선택)", () => {
    expect(page).toMatch(
      /aria-label=\{allSelected \? "전체 선택 해제" : "발송 대기 견적 전체 선택"\}/,
    );
  });

  it("visible 라벨 보존 (전체 해제 / 전체 선택 (N건))", () => {
    expect(page).toMatch(
      /\{allSelected \? "전체 해제" : `전체 선택 \(\$\{selectablePending\.length\}건\)`\}/,
    );
  });

  it("§11.220 selectablePending guard + allSelected onClick 보존", () => {
    expect(page).toMatch(
      /const\s+selectablePending\s*=\s*filteredQuotes\.filter\(q => deriveRailState\(q\) === "request_not_sent"\)/,
    );
    expect(page).toMatch(/if \(allSelected\) \{\s*clearSelection\(\);/);
  });
});
