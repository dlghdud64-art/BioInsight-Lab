/**
 * §랜딩 목업 갱신 P2 — 재고 목업 안전재고 게이지 (호영님 2026-07-13)
 *
 * §2 재고 섹션 요소 중 KPI4·상태pill·LOT 드로어·3기능카드는 이미 충족.
 * 유일 갭 = 안전재고 게이지 막대(현재÷안전, 0 레드·미달 앰버·정상 그린) 추가.
 * amber 예외 승인(마케팅 랜딩, inline hex only, Tailwind amber-* 0).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CTA = readFileSync(
  resolve(__dirname, "../../app/_components/final-cta-section.tsx"),
  "utf8",
);

describe("§랜딩 P2 — 안전재고 게이지", () => {
  it("게이지 색 헬퍼 + 3색 토큰(0 레드·미달 앰버·정상 그린)", () => {
    expect(CTA).toMatch(/function gaugeColor/);
    expect(CTA).toMatch(/#EF4444/); // zero red
    expect(CTA).toMatch(/#F59E0B/); // low amber
    expect(CTA).toMatch(/#22C55E/); // ok green
  });

  it("색 분기 로직 — current===0 레드 · current<safety 앰버 · else 그린", () => {
    expect(CTA).toMatch(/if\s*\(current === 0\)\s*return GAUGE\.zero/);
    expect(CTA).toMatch(/if\s*\(current < safety\)\s*return GAUGE\.low/);
    expect(CTA).toMatch(/return GAUGE\.ok/);
  });

  it("게이지 막대 width = min(current/safety,1)*100%", () => {
    expect(CTA).toMatch(/Math\.min\(item\.current \/ item\.safety, 1\) \* 100/);
    expect(CTA).toMatch(/backgroundColor: gaugeColor\(item\.current, item\.safety\)/);
  });

  it("INVENTORY_ITEMS 3건에 current/safety(green/amber/red 3색 시연)", () => {
    // inv-001 정상(2/2), inv-002 미달(1/3), inv-003 0 레드(0/2)
    expect(CTA).toMatch(/current:\s*2,\s*\n\s*safety:\s*2/);
    expect(CTA).toMatch(/current:\s*1,\s*\n\s*safety:\s*3/);
    expect(CTA).toMatch(/current:\s*0,\s*\n\s*safety:\s*2/);
  });
});

describe("§랜딩 P2 — 무회귀(재고 섹션 골격 보존)", () => {
  it("KPI4(오늘 처리·부족/품절·만료 임박·전체 재고) 보존", () => {
    expect(CTA).toMatch(/오늘 처리 대상/);
    expect(CTA).toMatch(/부족\/품절/);
    expect(CTA).toMatch(/만료 임박/);
    expect(CTA).toMatch(/전체 재고/);
  });

  it("상태 pill(만료 임박·재주문 필요·입고 미처리) 보존", () => {
    expect(CTA).toMatch(/status:\s*"만료 임박"/);
    expect(CTA).toMatch(/status:\s*"재주문 필요"/);
    expect(CTA).toMatch(/status:\s*"입고 미처리"/);
  });

  it("LOT 브리핑 드로어(Lot·유효기간·보관 위치·잔량·최근 입고 + 재주문 검토/입고 반영/Lot 수정) 보존", () => {
    expect(CTA).toMatch(/RAIL_DETAIL/);
    expect(CTA).toMatch(/유효기간/);
    expect(CTA).toMatch(/보관 위치/);
    expect(CTA).toMatch(/재주문 검토/);
    expect(CTA).toMatch(/Lot 수정/);
  });

  it("좌측 3기능카드(입고 즉시 반영·Lot 추적·부족 재주문) 보존", () => {
    expect(CTA).toMatch(/입고 즉시 재고 반영/);
    expect(CTA).toMatch(/Lot \/ 유효기간 추적/);
    expect(CTA).toMatch(/부족·재주문 판단/);
  });

  it("Tailwind amber/orange 클래스 0(inline hex 예외만)", () => {
    expect(CTA).not.toMatch(/\b(bg|text|border|from|to)-(amber|orange)-\d{2,3}\b/);
  });
});
