/**
 * #operational-brief-context-aware-category — Phase 1 RED (caller wiring)
 *
 * popup.tsx 가 deriveActiveCategoryFromPath helper 를 사용하여 isOpen 변경
 * 시 pathname 자동 매핑 → setSelectedCategory + viewMode 전환 수행.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const POPUP_PATH = resolve(__dirname, "../../../components/operational-brief/popup.tsx");
const popup = readFileSync(POPUP_PATH, "utf8");

describe("#operational-brief-context-aware-category — popup.tsx wiring", () => {
  it("deriveActiveCategoryFromPath import", () => {
    expect(popup).toMatch(/deriveActiveCategoryFromPath/);
  });

  it("usePathname 사용 (Next.js navigation)", () => {
    expect(popup).toMatch(/usePathname|next\/navigation/);
  });

  it("isOpen + pathname 변경 시 자동 setSelectedCategory + setViewMode 호출", () => {
    // useEffect dep 에 isOpen + pathname 둘 다 + 안에서 setSelectedCategory + setViewMode 호출.
    expect(popup).toMatch(/setSelectedCategory|setViewMode/);
    expect(popup).toMatch(/deriveActiveCategoryFromPath\s*\(/);
  });

  it("cluster trace marker", () => {
    expect(popup).toMatch(/#operational-brief-context-aware-category|컨텍스트 인식|context-aware/);
  });
});
