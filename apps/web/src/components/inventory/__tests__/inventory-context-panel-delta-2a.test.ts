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

describe("§inventory-delta-label-kpi P2a — D-day ≤90일 게이트", () => {
  it("재고 현황 만료 임박: expiryDays ≤90 만 D-N, 초과는 날짜(yyyy.MM.dd)", () => {
    const src = read(PANEL);
    expect(src).toMatch(/expiryDays <= 90/);
    // 90 초과 분기에서 raw D-day 대신 포맷 날짜.
    expect(src).toMatch(/expiryDays <= 90\s*\?\s*`D-\$\{expiryDays\}`\s*:\s*format\(new Date\(item\.expiryDate!\), "yyyy\.MM\.dd"\)/);
  });

  it("구 버그(양수 전부 D-N) 제거 — expiryDays < 0 직후 무조건 D-N 금지", () => {
    const src = read(PANEL);
    expect(src).not.toMatch(/expiryDays < 0 \? "만료됨" : `D-\$\{expiryDays\}`/);
  });
});

describe("§inventory-delta-label-kpi P2a — 상단 재주문 버튼 제거(중복)", () => {
  it("danger tone 상단 재주문 버튼 제거(null) — AI CTA 단일화", () => {
    const src = read(PANEL);
    expect(src).toMatch(/tone === "danger" \? null : tone === "warn" \?/);
    // 상단 primary-actions 에 재주문 라벨 버튼 부재(구 danger 버튼).
    const actionsBlock = src.slice(
      src.indexOf('data-testid="inventory-context-primary-actions"'),
      src.indexOf('data-testid="inventory-context-primary-actions"') + 900,
    );
    expect(actionsBlock).not.toMatch(/>\s*재주문\s*<\/Button>/);
  });

  it("회귀 0 — AI 섹션 재발주안 검토 CTA + 정보 수정 보존", () => {
    const src = read(PANEL);
    expect(src).toMatch(/재발주안 검토/);
    expect(src).toMatch(/정보 수정/);
    // AI 재발주 CTA 실 핸들러 보존(dead button 0).
    expect(src).toMatch(/onClick=\{\(\) => onReorder\?\.\(item\)\}[\s\S]{0,120}재발주안 검토/);
  });
});
