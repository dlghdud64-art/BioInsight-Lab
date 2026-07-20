/**
 * §랜딩 목업 갱신 E — 미세 색 토큰 목업 정합 (호영님 2026-07-13)
 *
 * 목업 원본(7/19 개정) 색 토큰과의 잔여 차이 4건 정합:
 *   1) 히어로 KPI 값색 → #93C5FD  2) 재고 KPI 4색 → #DC2626/#B45309/#DC2626/#2563EB
 *      (만료 임박의 오렌지 hex #F97316 제거 — 신호등 정합 부수효과)
 *   3) 탭 활성 텍스트 → #1E3A8A  4) LOT 드로어 보조버튼 → 다크(#CBD5E1/#2F3D57/#1A2438)
 * skip: body bg #f1f5fb — 목업은 grid 1장 배경, 구현은 흰 카드+dock 구조라 1:1 대응 없음(PLAN 기록).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const HERO = readFileSync(
  resolve(__dirname, "../../app/_components/bioinsight-hero-section.tsx"),
  "utf8",
);
const OPS = readFileSync(
  resolve(__dirname, "../../app/_components/ops-console-preview-section.tsx"),
  "utf8",
);
const CTA = readFileSync(
  resolve(__dirname, "../../app/_components/final-cta-section.tsx"),
  "utf8",
);

describe("§랜딩 E — 목업 색 토큰 정합", () => {
  it("1) 히어로 KPI 값색 = #93C5FD", () => {
    expect(HERO).toMatch(/label: "회신 대기", value: "12건", color: "#93C5FD"/);
  });

  it("2) 재고 KPI 4색 = 목업 토큰(오렌지 hex 제거)", () => {
    expect(CTA).toMatch(/label: "오늘 처리 대상", value: "3", color: "#DC2626"/);
    expect(CTA).toMatch(/label: "부족\/품절", value: "2", color: "#B45309"/);
    expect(CTA).toMatch(/label: "만료 임박", value: "1", color: "#DC2626"/);
    expect(CTA).toMatch(/label: "전체 재고", value: "47", color: "#2563EB"/);
    expect(CTA).not.toMatch(/#F97316/i);
  });

  it("3) 탭 활성 텍스트 = #1E3A8A", () => {
    expect(OPS).toMatch(/color: i === 0 \? "#1E3A8A" : "#94a3b8"/);
  });

  it("4) 드로어 보조버튼 = 다크 토큰(#CBD5E1/#2F3D57/#1A2438) 2개", () => {
    const hits = CTA.match(/color: "#CBD5E1", border: "1px solid #2F3D57", backgroundColor: "#1A2438"/g) ?? [];
    expect(hits).toHaveLength(2);
  });
});

describe("§랜딩 E — 무회귀", () => {
  it("second-section-polish lock 보존 — C 토큰 정의 불변", () => {
    expect(CTA).toMatch(/text2: "#334155"/);
    expect(CTA).toMatch(/text3: "#64748B"/);
  });

  it("KPI 배열에 빈 객체 원소 0(JS 배열 내 JSX 주석 금지 — §11.303 유사)", () => {
    expect(CTA).not.toMatch(/\[\s*\{\/\*/);
    expect(CTA).not.toMatch(/,\s*\{\}\s*,/);
  });

  it("드로어 1차 CTA(재주문 검토)·보조버튼 라벨 보존", () => {
    expect(CTA).toMatch(/재주문 검토/);
    expect(CTA).toMatch(/입고 반영/);
    expect(CTA).toMatch(/Lot 수정/);
  });

  it("Tailwind amber/orange 클래스 0(inline hex 예외만)", () => {
    for (const src of [HERO, OPS, CTA]) {
      expect(src).not.toMatch(/\b(bg|text|border|from|to)-(amber|orange)-\d{2,3}\b/);
    }
  });
});
