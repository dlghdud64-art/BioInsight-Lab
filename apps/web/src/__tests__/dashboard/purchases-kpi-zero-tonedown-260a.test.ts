/**
 * §11.260a #purchases-kpi-zero-tonedown — purchases KPI 0건 톤다운
 *
 * §11.259a #5 (견적 KPI 0건 회색 톤다운) 패턴 reuse. purchases KpiCard
 * 컴포넌트에 isZero (value === 0 && !active) 분기 추가. 0건 카드 시각
 * 우선순위 낮춤. caller 4 KpiCard 변경 0 = minimum diff.
 *
 * scope:
 *   (1) KpiCard 컴포넌트 내부 isZero 변수 정의 (value === 0 && !active)
 *   (2) isZero 시 카드 전체 opacity-50 + hover opacity-100 회복
 *   (3) active === true 시 opacity-100 (활성 카드 톤다운 안 함)
 *
 * canonical truth lock:
 *   - KpiCard signature (icon/iconBg/label/value/valueColor/sub/active/onClick) 보존
 *   - 4 caller 변경 0 (검토필요 / 발주가능 / 확정됨 / 만료)
 *   - active 상태 시각 (border-blue-300 + ring-blue-100 + shadow-md) 보존
 *   - text-3xl font-extrabold 값 표시 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../app/dashboard/purchases/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.260a #1 — KpiCard 내부 0건 톤다운 (isZero)", () => {
  it("§11.260a trace marker comment 존재", () => {
    expect(page).toMatch(/§11\.260a/);
  });

  it("KpiCard 안 isZero 변수 정의 (value === 0 && !active)", () => {
    expect(page).toMatch(/const isZero = value === 0 && !active/);
  });

  it("isZero 시 opacity-50 적용 (active 시 opacity-100 복원)", () => {
    expect(page).toMatch(/isZero[\s\S]{0,80}opacity-50/);
  });
});

describe("§11.260a #2 — invariant 보존 (canonical truth)", () => {
  it("KpiCard signature 보존 (icon/iconBg/label/value/valueColor/sub/active/onClick)", () => {
    expect(page).toMatch(
      /function KpiCard\(\{\s*icon,\s*iconBg,\s*label,\s*value,\s*valueColor,\s*sub,\s*active,\s*onClick\s*\}/,
    );
  });

  it("KpiCard props 타입 (value: number / active: boolean) 보존", () => {
    expect(page).toMatch(/value:\s*number;/);
    expect(page).toMatch(/active:\s*boolean;/);
  });

  it("4 KpiCard caller 보존 (검토 필요 / 발주 가능 / 확정됨 / 만료)", () => {
    expect(page).toMatch(/label="발주 전환 대기"/);
    expect(page).toMatch(/label="발주 승인 대기"/);
    expect(page).toMatch(/label="발주 확정"/);
    expect(page).toMatch(/label="공급사 통보 완료"/);
  });

  it("active 시 border-blue-300 + ring-blue-100 + shadow-md 보존", () => {
    expect(page).toMatch(/border-blue-300 ring-1 ring-blue-100 shadow-md/);
  });

  it("text-3xl font-extrabold 값 표시 보존", () => {
    expect(page).toMatch(/text-3xl font-extrabold/);
  });

  it("KPI grid md:grid md:grid-cols-2 lg:grid-cols-4 (데스크탑 한정) — §11.277a 후속", () => {
    // §11.260a 원안 `grid grid-cols-2 lg:grid-cols-4` (모바일 2×2) 는 §11.273b/
    // §11.277a 후속으로 데스크탑 md+ 한정 (`hidden md:grid md:grid-cols-2
    // lg:grid-cols-4` + 모바일 1줄 요약 바) 으로 supersede. invariant update.
    expect(page).toMatch(/md:grid md:grid-cols-2 lg:grid-cols-4/);
  });

  it("4 onClick (setQueueTab toggle) 보존", () => {
    expect(page).toMatch(/setQueueTab\(queueTab === "review_required" \? "all" : "review_required"\)/);
    expect(page).toMatch(/setQueueTab\(queueTab === "ready_for_po" \? "all" : "ready_for_po"\)/);
    expect(page).toMatch(/setQueueTab\(queueTab === "confirmed" \? "all" : "confirmed"\)/);
    expect(page).toMatch(/setQueueTab\("review_required"\)/);
  });
});
