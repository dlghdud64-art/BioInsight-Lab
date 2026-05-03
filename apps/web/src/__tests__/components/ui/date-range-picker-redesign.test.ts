/**
 * §11.210 #date-range-picker-redesign — RED test
 *
 * 호영님 시안 7항목 source-level 검증 (Purchase Report 달력 모달 재디자인):
 *   ① Dual-Month Navigation (Calendar numberOfMonths={2})
 *   ② Preset Sidebar (오늘 / 지난 7일 / 지난 30일 / 이번 달 / 지난 3개월)
 *   ③ JetBrains Mono Typography (font-mono className 정합)
 *   ④ Continuous range highlighting + hover preview (modifier styling)
 *   ⑤ Slate 900 + Blue 600 + Slate 50 palette
 *   ⑥ motion/framer-motion spring + backdrop
 *   ⑦ Start/End footer indicator
 *
 * canonical truth: components/ui/date-range-picker.tsx (강화 — props
 * 시그니처 변경 0). 신규 파일 신설 0.
 *
 * lock §11.142 호환: same-canvas, dead button 0, page-per-feature 0.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const PICKER = "src/components/ui/date-range-picker.tsx";
const LAYOUT = "src/app/layout.tsx";
const TAILWIND = "tailwind.config.ts";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.210 date-range-picker — 시안 7항목 정합", () => {
  describe("Phase 1 — 인프라 (JetBrains Mono)", () => {
    it("layout.tsx 가 next/font 의 JetBrains_Mono 를 import + variable", () => {
      const src = read(LAYOUT);
      expect(src).toMatch(/from\s+["']next\/font\/google["']/);
      expect(src).toMatch(/JetBrains_Mono/);
      expect(src).toMatch(/variable:\s*["']--font-jetbrains-mono["']/);
    });

    it("layout.tsx html className 에 jetbrainsMono.variable 적용", () => {
      const src = read(LAYOUT);
      expect(src).toMatch(/jetbrainsMono\.variable/);
    });

    it("tailwind.config.ts fontFamily.mono 가 JetBrains Mono var 우선", () => {
      const src = read(TAILWIND);
      expect(src).toMatch(/mono:\s*\[\s*["']var\(--font-jetbrains-mono\)["']/);
    });
  });

  describe("Phase 2 — DateRangePicker 강화", () => {
    it("①  Calendar numberOfMonths={2} (dual-month navigation)", () => {
      const src = read(PICKER);
      expect(src).toMatch(/numberOfMonths\s*=\s*\{?\s*2/);
    });

    it("②  preset sidebar 5 항목 (오늘 / 지난 7일 / 지난 30일 / 이번 달 / 지난 3개월)", () => {
      const src = read(PICKER);
      expect(src).toMatch(/오늘/);
      expect(src).toMatch(/지난\s*7일|7일/);
      expect(src).toMatch(/지난\s*30일|30일/);
      expect(src).toMatch(/이번\s*달/);
      expect(src).toMatch(/지난\s*3개월|3개월/);
    });

    it("③  date display 에 font-mono className 적용 (JetBrains Mono)", () => {
      const src = read(PICKER);
      // trigger button 또는 footer indicator 에 font-mono 부여
      expect(src).toMatch(/font-mono/);
    });

    it("④  selected range modifier 스타일 (continuous highlight)", () => {
      const src = read(PICKER);
      // react-day-picker 의 modifiersClassNames 또는 classNames prop
      // (range_start / range_middle / range_end 또는 selected 사용)
      expect(src).toMatch(/range_start|range_middle|range_end|day_range|selected/);
    });

    it("⑤  Blue 600 active state + Slate 900 text (palette swap)", () => {
      const src = read(PICKER);
      // Blue 600 active: bg-blue-600 또는 text-blue-600
      expect(src).toMatch(/blue-600/);
      // Slate 900 또는 slate-50 (배경 또는 텍스트)
      expect(src).toMatch(/slate-900|slate-50/);
    });

    it("⑥  motion/framer-motion 적용 (spring entry animation)", () => {
      const src = read(PICKER);
      expect(src).toMatch(/from\s+["']framer-motion["']|from\s+["']motion\/react["']/);
    });

    it("⑦  Start/End footer indicator (시작일 / 종료일 라벨)", () => {
      const src = read(PICKER);
      // footer 안에 시작일 / 종료일 라벨 + 날짜 또는 "—" placeholder
      expect(src).toMatch(/시작일|시작\s*날짜|Start\s*Date/);
      expect(src).toMatch(/종료일|종료\s*날짜|End\s*Date/);
    });

    it("§11.210 hot fix 코멘트 명시 (drift 차단)", () => {
      const src = read(PICKER);
      expect(src).toMatch(/§11\.210/);
    });
  });

  describe("canonical truth 보호", () => {
    it("DateRangePickerProps 시그니처 유지 (startDate / endDate / onDateChange)", () => {
      const src = read(PICKER);
      expect(src).toMatch(/startDate\??:\s*string/);
      expect(src).toMatch(/endDate\??:\s*string/);
      expect(src).toMatch(/onDateChange:\s*\(/);
    });
  });
});
