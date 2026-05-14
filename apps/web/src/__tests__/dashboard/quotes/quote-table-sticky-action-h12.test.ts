/**
 * §11.242c #quote-table-sticky-action-h12 — 호영님 P0 가독성 백로그 close
 *
 * 호영님 §11.242 백로그 잔여 2 항목 (정식 런칭 전 가독성 강화):
 *   #9  tbody tr 행 높이 h-12 통일 — px-3/4 + py-2/3 혼재 → 일관 행 간격
 *   #10 마지막 액션 column sticky right-0 — 가로 스크롤 시 항상 보임
 *
 * canonical truth lock:
 *   - §11.226 ~ §11.243 cluster invariant 모두 보존
 *   - visibleColumns / DEFAULT_COLUMN_PREFS / actions 분기 변경 0
 *   - first column sticky left-0 (§11.242 #10 a) 정합 (대칭)
 *
 * Minimal-Diff:
 *   - thead actions th: className 에 sticky right-0 bg-gray-100 z-20 추가
 *   - tbody actions td: className 에 sticky right-0 + zebra bg 분기 추가
 *   - tbody tr: className 에 h-12 추가
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.242c #1 — 액션 column sticky right-0", () => {
  it("thead actions th — sticky right-0 + bg-gray-100 + z-20", () => {
    // visibleColumns.map() 안 actions 분기 className 에 sticky right-0 명시
    expect(page).toMatch(/key === "actions"[\s\S]{0,800}sticky\s+right-0/);
  });

  it("tbody actions td — sticky right-0 + zebra bg 분기 (rowIndex % 2)", () => {
    // key === "actions" 분기 (tbody) 안 sticky right-0 + bg 분기 (zebra)
    expect(page).toMatch(/if \(key === "actions"\)[\s\S]{0,600}sticky\s+right-0/);
  });
});

describe("§11.242c #2 — tr 행 높이 h-12 통일", () => {
  it("tbody tr className IIFE return 안 h-12 sentinel", () => {
    // tr className IIFE 의 return template literal 안 `h-12 ${bgClass}` 패턴.
    //   §11.242 cluster IIFE 의 return 결과 첫 token 으로 h-12 부착.
    expect(page).toMatch(/return\s*`h-12\s+\$\{bgClass\}/);
  });
});

describe("§11.242c #3 — invariant 보존", () => {
  it("§11.242 #10 첫 column sticky left-0 보존 (대칭 lock)", () => {
    expect(page).toMatch(/sticky left-0[\s\S]{0,200}z-20/);
  });

  it("§11.226 #2 actions min-w-[120px] 보존", () => {
    expect(page).toMatch(/key === "actions" \? "min-w-\[120px\]"/);
  });

  it("§11.230b DEFAULT_COLUMN_PREFS actions 보존", () => {
    expect(page).toMatch(/actions: 120/);
    expect(page).toMatch(/order:\s*\[[\s\S]{0,200}"actions"\s*\]/);
  });

  it("§11.243 trace marker 보존 (§11.242c 추가)", () => {
    expect(page).toMatch(/§11\.242c[\s\S]{0,300}(sticky|h-12|행 높이|액션)/i);
  });
});
