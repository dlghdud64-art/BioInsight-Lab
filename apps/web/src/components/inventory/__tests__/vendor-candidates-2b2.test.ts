import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

/**
 * §inventory-delta-label-kpi P2b-2 (호영님 2026-07-27 핸드오프 §2b) — 공급사 후보(컨텍스트 패널).
 *   canonical PurchaseRecord 집계(useReorderRecommendation, §11.310b) 재사용 → 패널 inline 노출.
 *   read-only 표시 계층(fetch 신규 0·mutation 0) · 미지정 시 재발주 관문 표기 · 지정은 기존
 *   '정보 수정' 실 액션(dead button 0) · loading/empty/list 상태.
 */
const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const read = (rel: string) => readFileSync(join(REPO_ROOT, rel), "utf8");
const PANEL = read("src/components/inventory/inventory-context-panel.tsx");

describe("§P2b-2 — 공급사 후보 섹션", () => {
  it("canonical hook 재사용 — useReorderRecommendation(item.productName)", () => {
    expect(PANEL).toMatch(/from "@\/hooks\/use-reorder-recommendation"/);
    expect(PANEL).toMatch(/useReorderRecommendation\(item\.productName\)/);
  });

  it("후보 컨테이너 testid + 상태(loading/list) — 후보 0건은 블록 미표시(§inventory-brief-delta 7/29 §4-5)", () => {
    expect(PANEL).toMatch(/data-testid="inventory-context-vendor-candidates"/);
    expect(PANEL).toMatch(/data-testid="inventory-context-vendor-candidates-loading"/);
    expect(PANEL).toMatch(/data-testid="inventory-context-vendor-candidates-list"/);
    // 렌더 게이트 — loading 또는 후보 ≥1일 때만. "공급사 후보 없음" 회색 텍스트 제거,
    // 공급사 미지정 신호는 리스크 섹션(공급사 미지정 risk)으로 일원화.
    expect(PANEL).toMatch(/vendorRec\.isLoading \|\| vendorRec\.vendors\.length > 0/);
    expect(PANEL).not.toMatch(/inventory-context-vendor-candidates-empty/);
    expect(PANEL).not.toMatch(/최근 구매 이력이 없어 후보가 없습니다/);
  });

  it("read-only 표시 — vendors.slice map(vendorName·unitPrice·count), mutation 0", () => {
    expect(PANEL).toMatch(/vendorRec\.vendors\.slice\(0, 3\)\.map/);
    expect(PANEL).toMatch(/\{v\.vendorName\}/);
    expect(PANEL).toMatch(/v\.unitPrice\.toLocaleString\(\)/);
    // 후보 행은 li(비인터랙티브) — 후보에 직접 재발주/선택 mutation CTA 부재
    expect(PANEL).not.toMatch(/vendor-candidates-list[\s\S]{0,400}<button/);
  });

  it("미지정 관문 표기(!item.vendor) + 지정은 기존 '정보 수정'(dead button 0)", () => {
    expect(PANEL).toMatch(/!item\.vendor && \(/);
    expect(PANEL).toMatch(/재발주 관문 · 미지정/);
    expect(PANEL).toMatch(/공급사 지정은 ‘정보 수정’에서 진행하세요/);
  });
});
