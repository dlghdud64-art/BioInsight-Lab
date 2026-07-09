/**
 * §11.146 #operational-brief-rail-inventory-reorder (진화: §inventory-redesign P2a 정합, 2026-07-10)
 *
 * /dashboard/inventory 의 InventoryContextPanel (480px sticky rail) 고유 불변식 가드.
 *
 * ⚠️ 구조 진화 이력 — 본 sentinel 은 §11.146 당시의 "4 preset chips + 4 sections(핵심 근거/다음 조치)"
 *    구조를 assert 했으나, 이후 §11.320(chips 제거·상태 배너 통합·핵심 근거→재고 현황·sticky footer 제거),
 *    §11.322(인라인 KPI row), §11.333(섹션 기본 펼침), §inventory-redesign P2a(운영→품목 브리핑 rename)
 *    가 그 구조를 의도적으로 대체함. → 상세 구조 가드는 신 sentinel 에 위임하고, 본 파일은
 *    시간에 걸쳐 유지되는 고유 불변식(rename·no-chatbot·real reorder·safety/risk resolver·same-canvas)만 가드.
 *
 * 상세 구조 sentinel:
 *   - inventory-context-panel-restructure-320.test.ts (상태 배너/섹션 접기/재고 현황/색상)
 *   - layout-width-inventory-brief-333.test.ts (섹션 기본 펼침)
 *   - inventory-briefing-panel-p2.test.ts (품목 브리핑 rename + de-red 배너)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PATH = resolve(
  __dirname,
  "../../../components/inventory/inventory-context-panel.tsx",
);

describe("operational brief rail (inventory) — §11.146 고유 불변식 (진화판)", () => {
  const source = readFileSync(PATH, "utf8");

  it("rail 헤더 UI 텍스트 \"품목 브리핑\" (§inventory-redesign P2a rename — 구 \"운영 브리핑\" UI 제거)", () => {
    expect(source).toMatch(/: "품목 브리핑"\}/);
    expect(source).not.toMatch(/: "운영 브리핑"\}/);
  });

  it("Object label \"선택한 재고\" 존재", () => {
    expect(source).toMatch(/선택한 재고/);
    expect(source).not.toMatch(/SELECTED OBJECT/);
  });

  it("§11.320 상태 배너 통합 보존 (구 4 preset chips 는 §11.320 Phase 2 에서 제거됨)", () => {
    expect(source).toMatch(/data-testid="inventory-context-status-banner"/);
    // 구 preset chip array (상태 요약/보유량) 잔재 0 — 탭 제거 회귀 방지
    expect(source).not.toMatch(/id:\s*"summary",\s*label:\s*"상태 요약"/);
    expect(source).not.toMatch(/id:\s*"facts",\s*label:\s*"보유량"/);
  });

  it("§11.320 현재 섹션 라벨 \"재고 현황\" 보존 (구 \"핵심 근거\" 대체)", () => {
    expect(source).toMatch(/label="재고 현황"/);
  });

  it("§11.142 lock: chatbot input 0 (자유 채팅창 부재)", () => {
    expect(source).not.toMatch(/AI에게 물어보기|Ask AI|<textarea[^>]*ai/i);
  });

  it("회귀 0: 기존 onReorder action wiring 보존 (real action)", () => {
    expect(source).toMatch(/onReorder/);
  });

  it("회귀 0: 안전재고 + risks resolver 보존", () => {
    expect(source).toMatch(/안전재고/);
    expect(source).toMatch(/risks/);
  });

  it("rail w-[480px] desktop sticky — same-canvas 보존 (§11.179 density up)", () => {
    expect(source).toMatch(/w-\[480px\]/);
  });
});
