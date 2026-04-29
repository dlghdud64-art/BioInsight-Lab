/**
 * §11.146 #operational-brief-rail-inventory-reorder
 *
 * /dashboard/inventory 의 InventoryContextPanel (420px) 가
 * §11.142 운영 브리핑 패턴 정합:
 * "운영 브리핑" + "선택한 재고" + 4 chips + 4 sections + Primary CTA(reorder).
 *
 * 기존 풍부한 rail 컨텐츠 (기본 정보, 운영 리스크, 연결 흐름, action footer) 모두 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PATH = resolve(
  __dirname,
  "../../../components/inventory/inventory-context-panel.tsx",
);

describe("operational brief rail (inventory) — §11.146 regression guard", () => {
  const source = readFileSync(PATH, "utf8");

  it("rail title \"운영 브리핑\" 존재", () => {
    expect(source).toMatch(/운영 브리핑/);
  });

  it("Object label \"선택한 재고\" 존재", () => {
    expect(source).toMatch(/선택한 재고/);
    expect(source).not.toMatch(/SELECTED OBJECT/);
  });

  it("4 preset chips: 상태 요약 / 보유량 / 리스크 / 재발주", () => {
    expect(source).toMatch(/상태 요약/);
    expect(source).toMatch(/보유량/);
    expect(source).toMatch(/리스크/);
    expect(source).toMatch(/재발주/);
  });

  it("4 canonical section: 상황 요약 / 핵심 근거 / 리스크 / 다음 조치", () => {
    expect(source).toMatch(/상황 요약/);
    expect(source).toMatch(/핵심 근거/);
    expect(source).toMatch(/리스크/);
    expect(source).toMatch(/다음 조치/);
  });

  it("§11.142 lock: chatbot input 0 (자유 채팅창 부재)", () => {
    expect(source).not.toMatch(/AI에게 물어보기|Ask AI|<textarea[^>]*ai/i);
  });

  it("회귀 0: 기존 onReorder action wiring 보존", () => {
    expect(source).toMatch(/onReorder/);
  });

  it("회귀 0: 운영 리스크 + 안전재고 + risks resolver 보존", () => {
    expect(source).toMatch(/안전재고/);
    expect(source).toMatch(/risks/);
  });

  it("rail w-[420px] desktop sticky — same-canvas 보존", () => {
    expect(source).toMatch(/w-\[420px\]/);
  });
});
