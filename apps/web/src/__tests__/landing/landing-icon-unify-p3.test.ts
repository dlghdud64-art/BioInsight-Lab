/**
 * §랜딩 목업 갱신 P3 — 아이콘 통일 (호영님 2026-07-13)
 *
 * §3 핵심(이모지 전면 제거 → 라인 SVG 통일)은 이미 충족: 랜딩 3파일에 데코 이모지 0,
 *   전부 lucide-react 라인 아이콘(→ 화살표는 타이포). 아이콘 셋·스타일도 표와 거의 정합.
 * 유일 실델타 = §3 "경고만 앰버" — 기능 3카드 중 부족·재주문(AlertTriangle)만 앰버 사각.
 * amber = inline hex(마케팅 랜딩 예외, Tailwind amber-* 0).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CTA = readFileSync(
  resolve(__dirname, "../../app/_components/final-cta-section.tsx"),
  "utf8",
);
const HERO = readFileSync(
  resolve(__dirname, "../../app/_components/bioinsight-hero-section.tsx"),
  "utf8",
);
const OPS = readFileSync(
  resolve(__dirname, "../../app/_components/ops-console-preview-section.tsx"),
  "utf8",
);

describe("§랜딩 P3 — 경고 카드 앰버(§3 '경고만 앰버')", () => {
  it("부족·재주문 카드 tone: amber", () => {
    expect(CTA).toMatch(/부족·재주문 판단[\s\S]{0,120}tone:\s*"amber"/);
  });
  it("tone amber → 사각 앰버(#FFFBEB) + 아이콘 앰버(#D97706), 그 외 파랑", () => {
    expect(CTA).toMatch(/pt\.tone === "amber" \? "#FFFBEB" : LT\.blueSoft/);
    expect(CTA).toMatch(/pt\.tone === "amber" \? "#D97706" : LT\.blueText/);
  });
  it("box·clock 카드는 파랑 유지(tone: blue)", () => {
    expect(CTA).toMatch(/입고 즉시 재고 반영[\s\S]{0,120}tone:\s*"blue"/);
    expect(CTA).toMatch(/Lot \/ 유효기간 추적[\s\S]{0,120}tone:\s*"blue"/);
  });
});

describe("§랜딩 P3 — 이모지 0 · 라인 SVG 통일(이미 충족 guard)", () => {
  const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u;
  it("데코 이모지 0 (3파일)", () => {
    expect(CTA).not.toMatch(EMOJI);
    expect(HERO).not.toMatch(EMOJI);
    expect(OPS).not.toMatch(EMOJI);
  });
  it("lucide-react 라인 아이콘 사용 유지", () => {
    expect(CTA).toMatch(/from "lucide-react"/);
    expect(OPS).toMatch(/from "lucide-react"/);
  });
  it("Tailwind amber/orange 클래스 0(inline hex 예외만)", () => {
    expect(CTA).not.toMatch(/\b(bg|text|border|from|to)-(amber|orange)-\d{2,3}\b/);
  });
});
