/**
 * §landing-second-section-polish — 랜딩 둘째 섹션(final-cta-section) 고칠점 패치
 *   (호영님 spec — "둘째섹션 고칠점 패치": 룩앤필 유지, 지적된 부분만 정밀 수정)
 *
 * 3 항목 + 히어로 spacer:
 *   ① lot → Lot (제목 대소문자 — 가장 눈에 띔)
 *   ②A 둘째 섹션 상단 패딩 축소 (py-20 md:py-28 → pt-12 md:pt-16 pb-20 md:pb-28)
 *   ②B 히어로 하단 spacer 축소 (h-14 md:h-20 → h-8 md:h-12) — 타이트 조인
 *   ③A KPI 라벨 톤 한 단계 진하게 (text4 → text3, 7px → 8px)
 *   ③B 행 부제 톤 한 단계 진하게 (text3 → text2, 10px → 11px, font-medium)
 *
 * 룩앤필 보존 lock:
 *   - 색 토큰(C.text2/text3) 자체 불변 — 적용처만 한 단계 진한 쪽으로 이동
 *   - INVENTORY_ITEMS / RAIL_DETAIL / 본문 "Lot 번호" 대문자 표기 불변
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CTA_PATH = resolve(__dirname, "../../app/_components/final-cta-section.tsx");
const HERO_PATH = resolve(__dirname, "../../app/_components/bioinsight-hero-section.tsx");
const cta = readFileSync(CTA_PATH, "utf8");
const hero = readFileSync(HERO_PATH, "utf8");

describe("§landing-second-section-polish — 4 항목 적용", () => {
  it("① 제목 lot → Lot (대문자)", () => {
    expect(cta).toMatch(/재고와 Lot 상태를 한눈에 관리합니다/);
    expect(cta).not.toMatch(/재고와 lot 상태/); // 소문자 제목 제거
  });

  it("②A 둘째 섹션 상단 패딩 축소(빈 공간 해소)", () => {
    expect(cta).toMatch(/className="relative pt-12 md:pt-16 pb-20 md:pb-28"/);
    expect(cta).not.toMatch(/className="relative py-20 md:py-28"/); // 과다 상단 여백 제거
  });

  it("②B 히어로 하단 spacer 축소(타이트 조인)", () => {
    expect(hero).toMatch(/<div className="h-8 md:h-12" \/>/);
    expect(hero).not.toMatch(/<div className="h-14 md:h-20" \/>/);
  });

  it("③A KPI 라벨 톤 진하게(text4 → text3, 8px)", () => {
    expect(cta).toMatch(/text-\[8px\] md:text-\[9px\] uppercase tracking-wider font-semibold mb-0\.5" style=\{\{ color: C\.text3 \}\}/);
  });

  it("③B 행 부제 톤 진하게(text3 → text2, 11px, font-medium)", () => {
    expect(cta).toMatch(/text-\[9px\] md:text-\[11px\] mt-0\.5 font-medium" style=\{\{ color: C\.text2 \}\}/);
  });
});

describe("§landing-second-section-polish — 룩앤필 보존(회귀 0)", () => {
  it("색 토큰 자체 불변(C.text2 #334155 / C.text3 #64748B)", () => {
    expect(cta).toMatch(/text2: "#334155"/);
    expect(cta).toMatch(/text3: "#64748B"/);
  });

  it("INVENTORY_ITEMS 3행 + RAIL_DETAIL lot 값 보존(목업 데이터 불변)", () => {
    expect(cta).toMatch(/Gibco FBS \(500mL\)/);
    expect(cta).toMatch(/DMEM Medium \(500mL\)/);
    expect(cta).toMatch(/PBS Solution \(1L\)/);
    expect(cta).toMatch(/lot: "LOT-2026-0387"/);
  });

  it("본문/목업 Lot 대문자 표기 보존(이미 정합)", () => {
    expect(cta).toMatch(/Lot 번호와 유효기간을/);
    expect(cta).toMatch(/Lot 정보 미입력/);
    expect(cta).toMatch(/Lot 수정/);
  });

  it("섹션 타이틀/설명 + Inventory Operations eyebrow 보존", () => {
    expect(cta).toMatch(/Inventory Operations/);
    expect(cta).toMatch(/만료 폐기, 부족 재발주, 점검 기록까지/);
  });
});
