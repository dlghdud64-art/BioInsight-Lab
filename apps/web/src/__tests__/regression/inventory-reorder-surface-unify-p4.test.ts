/**
 * §inventory-reorder-surface-unify P4 — AiAssistant 분석 래퍼 inventory 트리거 retire (orphan 0)
 *   (PLAN: docs/plans/PLAN_inventory-reorder-surface-unify.md)
 *
 * retire: <InventoryAiAssistantPanel> 렌더 + ?ai_panel deep-link + useInventoryAiPanel import + aiPanel state.
 * 보존: ReorderReviewSheet(§11.310) + InventoryReorderReviewSheet(승격 래퍼) + AiAssistant 컴포넌트 파일(rollback).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}
const CONTENT = "src/app/dashboard/inventory/inventory-content.tsx";
const AI_PANEL = "src/components/ai/inventory-ai-assistant-panel.tsx";
const WRAPPER = "src/components/inventory/inventory-reorder-review-sheet.tsx";

describe("§inventory-reorder-surface-unify P4 — AiAssistant 트리거 retire (orphan 0)", () => {
  const src = read(CONTENT);
  it("useInventoryAiPanel import 제거", () => {
    expect(src).not.toMatch(/useInventoryAiPanel/);
  });
  it("aiPanel state/참조 0 (aiPanel. 호출 없음)", () => {
    expect(src).not.toMatch(/aiPanel\./);
    expect(src).not.toMatch(/const aiPanel =/);
  });
  it("<InventoryAiAssistantPanel> 렌더 제거", () => {
    expect(src).not.toMatch(/<InventoryAiAssistantPanel/);
  });
  it("?ai_panel deep-link(aiPanelParam) 제거", () => {
    expect(src).not.toMatch(/aiPanelParam/);
    expect(src).not.toMatch(/searchParams\.get\("ai_panel"\)/);
  });
});

describe("§inventory-reorder-surface-unify P4 — 보존(retire ≠ 삭제)", () => {
  it("InventoryReorderReviewSheet(승격 래퍼) 렌더 보존 = 재발주 검토 대체 표면", () => {
    expect(read(CONTENT)).toMatch(/<InventoryReorderReviewSheet/);
  });
  it("AiAssistant 컴포넌트 파일 보존(rollback) — export 유지", () => {
    expect(read(AI_PANEL)).toMatch(/export function InventoryAiAssistantPanel/);
  });
  it("ReorderReviewSheet 승격 래퍼 파일 보존", () => {
    expect(read(WRAPPER)).toMatch(/ReorderReviewSheet/);
  });
  it("소싱 진입점 보존 — onSearchVendors /app/search?q= (§11.381c, AiAssistant onViewVendors 대체)", () => {
    const src = read(CONTENT);
    expect(src).toMatch(/onSearchVendors=\{/);
    expect(src).toMatch(/\/app\/search\?q=/);
  });
});
