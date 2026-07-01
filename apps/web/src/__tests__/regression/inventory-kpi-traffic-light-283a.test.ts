/**
 * §11.283a #inventory-kpi-traffic-light — 재고 KPI 신호등 색상 + 0건 톤다운
 *   (호영님 P0 spec, 2026-05-23).
 *
 * 【SUPERSEDED — §web-mobile-reskin-fidelity 2026-07-01】
 *   재고 모바일 KPI 4-카드(mobile-inventory-view 안 MobileSummaryStrip)는
 *   navy 헤더 3 KPI + 우선처리 배너 + 요약 칩(inventory-content.tsx)으로 이전
 *   (호영님 승인 커밋 ce01fb02 / 2e73063c). MobileSummaryStrip 은 render-unreachable
 *   dead 로 orphan → 제거. 아래는 원 P0 intent(신호등 의미 차별화 · 0건 톤다운 ·
 *   expired-우선)를 새 위치(navy 헤더 / inventory-content)로 재앵커한 보존 계약
 *   (부재-lock + intent-lock). §11.302d-4/-5 신호등 정합과 동일 surface.
 *
 * 원본 P0 spec (보존 intent):
 *   (a) 재주문 = 긴급 red, 만료 = 검토 yellow (신호등 의미 차별화)
 *   (b) 0건 카드 중립 톤다운 (모든 카드 동일 톤 회피)
 *   (c) expired lot 우선 (generic reorder 가 dispose 가림 금지, §11.311)
 *
 * readFileSync + regex (CLAUDE.md sentinel 패턴).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const VIEW = readFileSync(
  resolve(__dirname, "../../components/inventory/mobile-inventory-view.tsx"),
  "utf8",
);
const CONTENT = readFileSync(
  resolve(__dirname, "../../app/dashboard/inventory/inventory-content.tsx"),
  "utf8",
);

describe("§11.283a [SUPERSEDED] 재고 집계 KPI → navy 헤더 이전 (부재-lock)", () => {
  it("mobile-inventory-view 집계 카드(MobileSummaryStrip) 제거 — dead orphan 부재", () => {
    expect(VIEW).not.toMatch(/MobileSummaryStrip/);
    expect(VIEW).not.toMatch(/reorderCount/);
    expect(VIEW).not.toMatch(/text-xl font-bold tracking-tight/);
  });
});

describe("§11.283a 신호등 색상 intent 보존 (navy 헤더 / 요약 칩 재앵커)", () => {
  it("만료 임박 = 검토 yellow 톤 보존", () => {
    expect(CONTENT).toMatch(/만료 임박[\s\S]{0,200}text-yellow-700/);
    expect(CONTENT).toMatch(/만료 임박[\s\S]{0,200}bg-yellow-100/);
  });

  it("재주문 필요 = 긴급 red 톤 보존", () => {
    expect(CONTENT).toMatch(/재주문 필요[\s\S]{0,200}text-red-700/);
    expect(CONTENT).toMatch(/재주문 필요[\s\S]{0,200}bg-red-100/);
  });

  it("안전재고 미달 = 위험 rose 톤 보존 (navy 헤더 alert)", () => {
    expect(CONTENT).toMatch(/안전재고 미달/);
    expect(CONTENT).toMatch(/bg-rose-500\/15/);
  });
});

describe("§11.283a 0건 톤다운 보존 (navy 헤더 alert 게이팅)", () => {
  it("alert KPI 0건 시 중립 톤 (k.alert && k.value > 0 분기)", () => {
    expect(CONTENT).toMatch(
      /k\.alert && k\.value > 0 \? "bg-rose-500\/15" : "bg-white\/\[0\.06\]"/,
    );
  });
});

describe("§11.283a expired-우선 신호등 보존 (§11.311)", () => {
  it("priorityExpiredLot 최상단 → expiring → lowOrOutOfStock 순 (danger 우선)", () => {
    expect(CONTENT).toMatch(
      /priorityExpiredLot \?[\s\S]{0,120}expiringSoonCount > 0 \?[\s\S]{0,120}lowOrOutOfStockCount > 0/,
    );
  });

  it("폐기(dispose) red 톤 우선 신호 보존 — generic reorder 가 dispose 가리지 않음", () => {
    expect(CONTENT).toMatch(/폐기 처리/);
    expect(CONTENT).toMatch(/priorityExpiredLot/);
  });
});
