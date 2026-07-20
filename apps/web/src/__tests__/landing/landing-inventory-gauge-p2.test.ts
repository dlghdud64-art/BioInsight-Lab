/**
 * §랜딩 목업 갱신 P2 → P4 진화 — 재고 목업 안전재고 게이지 (호영님 2026-07-13)
 *
 * P2 원안: `.md` 산문 "0 레드·미달 앰버·정상 그린"을 current÷safety 비율 규칙으로 구현.
 * P4 진화: 목업 원본(단독 실행본) 확보 후 실값과 상충 확인 → **목업을 truth로 채택**.
 *   목업 실값 — 만료임박 85% 앰버 · 재주문필요 22% 레드 · 입고미처리 60% 그린.
 *   즉 게이지 색 = 행 심각도, 폭 = 재고 수준(비율 임계 규칙 아님). N/M 라벨은 목업에 없어 제거.
 * amber = inline hex(마케팅 랜딩 예외, Tailwind amber-* 0).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CTA = readFileSync(
  resolve(__dirname, "../../app/_components/final-cta-section.tsx"),
  "utf8",
);

describe("§랜딩 P4 — 게이지 목업 실값 정합", () => {
  it("만료 임박(Gibco) = 85% 앰버", () => {
    expect(CTA).toMatch(/gaugePct:\s*85,\s*\n\s*gaugeColor:\s*"#F59E0B"/);
  });
  it("재주문 필요(DMEM) = 22% 레드", () => {
    expect(CTA).toMatch(/gaugePct:\s*22,\s*\n\s*gaugeColor:\s*"#EF4444"/);
  });
  it("입고 미처리(PBS) = 60% 그린", () => {
    expect(CTA).toMatch(/gaugePct:\s*60,\s*\n\s*gaugeColor:\s*"#22C55E"/);
  });
  it("게이지 막대가 목업 실값 바인딩(폭·색)", () => {
    expect(CTA).toMatch(/width:\s*`\$\{item\.gaugePct\}%`/);
    expect(CTA).toMatch(/backgroundColor:\s*item\.gaugeColor/);
  });
});

describe("§랜딩 P4 — 폐기분 잔재 0(P2 비율 규칙)", () => {
  it("current/safety 필드 + gaugeColor() 헬퍼 부재", () => {
    expect(CTA).not.toMatch(/^\s*current:\s*\d/m);
    expect(CTA).not.toMatch(/^\s*safety:\s*\d/m);
    expect(CTA).not.toMatch(/function gaugeColor/);
    expect(CTA).not.toMatch(/Math\.min\(item\.current/);
  });
  it("목업에 없는 N/M 라벨 제거", () => {
    expect(CTA).not.toMatch(/\{item\.current\}\/\{item\.safety\}/);
  });
});

describe("§랜딩 P4 — 무회귀(재고 섹션 골격 보존)", () => {
  it("KPI4 보존", () => {
    expect(CTA).toMatch(/오늘 처리 대상/);
    expect(CTA).toMatch(/부족\/품절/);
    expect(CTA).toMatch(/만료 임박/);
    expect(CTA).toMatch(/전체 재고/);
  });
  it("상태 pill 보존", () => {
    expect(CTA).toMatch(/status:\s*"만료 임박"/);
    expect(CTA).toMatch(/status:\s*"재주문 필요"/);
    expect(CTA).toMatch(/status:\s*"입고 미처리"/);
  });
  it("LOT 브리핑 드로어 보존", () => {
    expect(CTA).toMatch(/RAIL_DETAIL/);
    expect(CTA).toMatch(/유효기간/);
    expect(CTA).toMatch(/보관 위치/);
    expect(CTA).toMatch(/재주문 검토/);
    expect(CTA).toMatch(/Lot 수정/);
  });
  it("좌측 3기능카드 + 경고만 앰버(P3) 보존", () => {
    expect(CTA).toMatch(/입고 즉시 재고 반영/);
    expect(CTA).toMatch(/Lot \/ 유효기간 추적/);
    expect(CTA).toMatch(/부족·재주문 판단/);
    expect(CTA).toMatch(/tone:\s*"amber"/);
  });
  it("Tailwind amber/orange 클래스 0(inline hex 예외만)", () => {
    expect(CTA).not.toMatch(/\b(bg|text|border|from|to)-(amber|orange)-\d{2,3}\b/);
  });
});
