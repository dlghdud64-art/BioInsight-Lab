import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * §inventory-delta-label-kpi Phase 2a (호영님 2026-07-27 핸드오프 §1.2·§2.3)
 *   레일 표시버그·액션 단일화 로컬 수정:
 *   - D-day는 만료 ≤90일에만 노출, 그 외 먼 미래는 날짜만(D-1425 오노출 방지).
 *   - 상단 재주문 버튼 제거(AI 섹션 재발주안 검토 CTA와 중복) — danger는 상단 정보 수정만.
 */

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}
const PANEL = "src/components/inventory/inventory-context-panel.tsx";

describe("§inventory-brief-delta(2026-07-29) §2 — 최단 유효기간 D-day 배지 게이트", () => {
  it("KPI 라벨 '최단 유효기간' + 값=날짜, D-day는 배지(≤30 레드 / ≤90 앰버 / 그 외 없음)", () => {
    const src = read(PANEL);
    expect(src).toMatch(/data-testid="inventory-context-kpi-shortest-expiry"/);
    expect(src).toMatch(/최단 유효기간/);
    expect(src).toMatch(/kpiExpiryDays <= 30[\s\S]{0,120}bg-red-50 text-red-700/);
    expect(src).toMatch(/kpiExpiryDays <= 90[\s\S]{0,120}bg-yellow-50 text-yellow-700/);
    // 값 자체는 항상 날짜(먼 미래에 D-N/'임박' 오노출 방지).
    expect(src).toMatch(/kpiExpiryDays === null \? "-" : format\(new Date\(item\.expiryDate!\), "yyyy\.MM\.dd"\)/);
  });

  it("구 패턴 제거 — '만료 임박' KPI testid 및 양수 전부 D-N 금지", () => {
    const src = read(PANEL);
    expect(src).not.toMatch(/data-testid="inventory-context-kpi-expiring-soon"/);
    expect(src).not.toMatch(/expiryDays < 0 \? "만료됨" : `D-\$\{expiryDays\}`/);
  });
});

describe("§inventory-brief-delta(2026-07-29) §1 — 재발주 CTA = 상태 액션 카드 단일화", () => {
  it("primary-actions 행에 재주문 라벨 버튼 부재 — CTA는 상태 카드 내부 단일", () => {
    const src = read(PANEL);
    expect(src).toMatch(/data-testid="inventory-context-status-card-cta"/);
    const actionsBlock = src.slice(
      src.indexOf('data-testid="inventory-context-primary-actions"'),
      src.indexOf('data-testid="inventory-context-primary-actions"') + 900,
    );
    expect(actionsBlock).not.toMatch(/>\s*재주문\s*<\/Button>/);
  });

  it("회귀 0 — 재발주안 검토 CTA + 정보 수정 보존, CTA 실 핸들러(dead button 0)", () => {
    const src = read(PANEL);
    expect(src).toMatch(/재발주안 검토/);
    expect(src).toMatch(/정보 수정/);
    // 카드 CTA 실 핸들러(onReorder) → 재발주안 검토.
    expect(src).toMatch(/onReorder\(item\);[\s\S]{0,200}재발주안 검토/);
  });
});
