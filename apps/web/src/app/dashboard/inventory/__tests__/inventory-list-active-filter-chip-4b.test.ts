import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

/**
 * §inventory-delta-label-kpi P4b (호영님 2026-07-27 핸드오프 §3) — 리스트 상단 활성 필터 칩.
 *   4a에서 KPI 카드 클릭→statusFilter 토글을 깔았으나, 리스트로 스크롤하면 어떤 필터가
 *   걸렸는지·되돌리는 법이 리스트 머리에서 안 보임 → 리스트 직상단에 활성 필터 칩(라벨·N건·
 *   ✕ 해제) 노출로 루프 봉합. 신규 데이터 배선 0 — statusFilter 표시 계층 전용(값 소유 무접촉).
 */

const REPO_ROOT = join(__dirname, "..", "..", "..", "..", "..");
const SRC = readFileSync(
  join(REPO_ROOT, "src/app/dashboard/inventory/inventory-content.tsx"),
  "utf8",
);

describe("§P4b — 리스트 상단 활성 필터 칩", () => {
  it("STATUS_FILTER_LABELS 맵 — 상태 Select 라벨 정합(all 제외)", () => {
    expect(SRC).toMatch(/const STATUS_FILTER_LABELS: Record<string, string> = \{/);
    expect(SRC).toMatch(/expiring: "만료 임박"/);
    expect(SRC).toMatch(/low: "부족 \/ 재주문 필요"/);
    // "all" 은 칩 미노출 → 맵에 없음(부재 lock)
    expect(SRC).not.toMatch(/all: "전체 상태"/);
  });

  it("칩 testid + statusFilter !== all 게이팅(0필터 시 미노출)", () => {
    expect(SRC).toMatch(/data-testid="inventory-list-active-filter-chip"/);
    expect(SRC).toMatch(/\{statusFilter !== "all" && \(/);
  });

  it("라벨 = STATUS_FILTER_LABELS[statusFilter] + 카운트 = filteredInventories.length건", () => {
    expect(SRC).toMatch(/STATUS_FILTER_LABELS\[statusFilter\] \?\? statusFilter/);
    expect(SRC).toMatch(/\{filteredInventories\.length\}건/);
  });

  it("✕ 해제 = setStatusFilter(\"all\") 실 배선(dead button 0) + aria-label", () => {
    expect(SRC).toMatch(/onClick=\{\(\) => setStatusFilter\("all"\)\}/);
    expect(SRC).toMatch(/aria-label="상태 필터 해제"/);
  });

  it("4a 필터-활성 파랑 토큰 일관(border-blue-200 bg-blue-50)", () => {
    expect(SRC).toMatch(/inventory-list-active-filter-chip"[\s\S]{0,120}border-blue-200 bg-blue-50/);
  });

  it("배치 = 리스트(InventoryTable) 직상단 — 칩이 표 렌더보다 먼저", () => {
    const chip = SRC.indexOf('data-testid="inventory-list-active-filter-chip"');
    const table = SRC.indexOf("<InventoryTable");
    expect(chip).toBeGreaterThan(-1);
    expect(table).toBeGreaterThan(chip); // 칩 → 표 순서
  });
});
