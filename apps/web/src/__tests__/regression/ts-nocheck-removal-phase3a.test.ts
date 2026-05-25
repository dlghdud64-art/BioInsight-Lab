/**
 * §11.305-phase3a #ts-nocheck-removal — production code @ts-nocheck 제거.
 *   release-prep P1 Phase 3a (호영님 P1, hidden type error 노출 + 정합 처리).
 *
 * Scope (1 file):
 *   - apps/web/src/app/_workbench/compare/page.tsx
 *
 * @ts-nocheck 제거 후 노출된 hidden type error 7건 + cascade 2건 = 총 8건
 *   simple swap 으로 정합:
 *
 *   1~4. AnalyticsEvent enum 4 literal 누락 (lib/analytics.ts 정합):
 *     - "compare_export_csv" (line 383)
 *     - "compare_decision_option_committed" (line 609)
 *     - "compare_review_enter" (line 1354)
 *     - "compare_review_handoff" (line 1596)
 *
 *   5. DecisionOptionSet element type — null → undefined (line 470):
 *     - priceKRW / leadTimeDays / specMatchScore 가 number | undefined 기대
 *
 *   6. CompareDecisionContext required field 누락 (line 468):
 *     - compareMode + selectedDecisionItemId 추가
 *
 *   7. moveProduct typo bug (line 878, 🚨 hidden runtime bug):
 *     - `moveProduct(index, products.length - 1)` (number) → `moveProduct(index, "down")`
 *     - signature: (index, direction: "up" | "down") — line 875 "up" 정합
 *     - UI 의도: "한 칸 아래" — 기존 코드는 "마지막으로 jump" semantic
 *
 *   8. setSelectedProductId 미정의 bug (line 1228, 🚨 hidden runtime bug):
 *     - `setSelectedProductId(null)` → `setActiveCompareItemId(null)`
 *     - setSelectedProductId 정의 0 (JS ReferenceError 가능)
 *     - line 1146 패턴 정합 (rail close)
 *
 *   9. AnalyticsEventProperties.note string?: 정합 (line 1601):
 *     - `note: !!reviewNote` (boolean) → `note: reviewNote || undefined`
 *
 * Production effect:
 *   - moveProduct "down" 버튼이 실제로 한 칸 아래 이동 (이전: 마지막으로 jump)
 *   - rail 안 "비교 제외" 클릭 시 rail close 동작 (이전: ReferenceError no-op)
 *   - 4 trackEvent 호출이 type-safe (이전: any)
 *
 * Baseline:
 *   - tsc baseline: 100 error → fix 후 동일 100 (다른 file 영향 0)
 *   - compare/page.tsx: 7 error → 0 error
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(__dirname, "../../../../..");

const COMPARE_PAGE_SRC = readFileSync(
  resolve(REPO_ROOT, "apps/web/src/app/_workbench/compare/page.tsx"),
  "utf8",
);
const ANALYTICS_SRC = readFileSync(
  resolve(REPO_ROOT, "apps/web/src/lib/analytics.ts"),
  "utf8",
);

describe("§11.305-phase3a — production code @ts-nocheck 제거 + hidden bug fix", () => {
  it("§11.305-phase3a trace marker (self-referential)", () => {
    const selfSrc = readFileSync(__filename, "utf8");
    expect(selfSrc).toMatch(/§11\.305-phase3a/);
  });

  describe("compare/page.tsx @ts-nocheck 제거", () => {
    it("@ts-nocheck 지시문 0 (file 첫 부분)", () => {
      // 첫 5줄에 @ts-nocheck 부재 (history comment 는 본문 deep 에서 허용)
      const firstFiveLines = COMPARE_PAGE_SRC.split("\n").slice(0, 5).join("\n");
      expect(firstFiveLines).not.toMatch(/^\/\/\s*@ts-nocheck/m);
    });

    it("§11.305-phase3a trace 주석 존재", () => {
      expect(COMPARE_PAGE_SRC).toMatch(/§11\.305-phase3a/);
    });
  });

  describe("AnalyticsEvent enum 4 literal 추가 (lib/analytics.ts)", () => {
    it('"compare_export_csv" literal 추가', () => {
      expect(ANALYTICS_SRC).toMatch(/\|\s*"compare_export_csv"/);
    });

    it('"compare_decision_option_committed" literal 추가', () => {
      expect(ANALYTICS_SRC).toMatch(/\|\s*"compare_decision_option_committed"/);
    });

    it('"compare_review_enter" literal 추가', () => {
      expect(ANALYTICS_SRC).toMatch(/\|\s*"compare_review_enter"/);
    });

    it('"compare_review_handoff" literal 추가', () => {
      expect(ANALYTICS_SRC).toMatch(/\|\s*"compare_review_handoff"/);
    });

    it("§11.305-phase3a trace 주석 존재 (analytics.ts)", () => {
      expect(ANALYTICS_SRC).toMatch(/§11\.305-phase3a/);
    });
  });

  describe("DecisionOptionSet + CompareDecisionContext 정합", () => {
    it("priceKRW / leadTimeDays / specMatchScore null → undefined swap", () => {
      // null literal 사용 0 — undefined 사용
      expect(COMPARE_PAGE_SRC).toMatch(
        /priceKRW:\s*p\.vendors\?\.\[0\]\?\.priceInKRW\s*\?\?\s*undefined/,
      );
      expect(COMPARE_PAGE_SRC).toMatch(
        /leadTimeDays:\s*getAverageLeadTime\(p\)\s*\|\|\s*undefined/,
      );
      expect(COMPARE_PAGE_SRC).toMatch(/specMatchScore:\s*undefined/);
    });

    it("compareMode + selectedDecisionItemId required field 추가", () => {
      expect(COMPARE_PAGE_SRC).toMatch(/compareMode:\s*""/);
      // selectedDecisionItemId pass-through 보존
      expect(COMPARE_PAGE_SRC).toMatch(
        /buildCompareDecisionOptionSet\([\s\S]*?selectedDecisionItemId[\s\S]*?\}\)/,
      );
    });
  });

  describe("🚨 Hidden runtime bug fix 2건", () => {
    it('Line 878 typo bug — moveProduct(index, "down") swap', () => {
      // 기존 patterned: moveProduct(index, products.length - 1) 부재
      expect(COMPARE_PAGE_SRC).not.toMatch(
        /moveProduct\(index,\s*products\.length\s*-\s*1\)/,
      );
      // 새 패턴: moveProduct(index, "down") 존재
      expect(COMPARE_PAGE_SRC).toMatch(/moveProduct\(index,\s*"down"\)/);
      // line 875 "up" 패턴 보존
      expect(COMPARE_PAGE_SRC).toMatch(/moveProduct\(index,\s*"up"\)/);
    });

    it("Line 1228 setSelectedProductId 미정의 bug — setActiveCompareItemId swap", () => {
      // 기존 setSelectedProductId 호출 0
      expect(COMPARE_PAGE_SRC).not.toMatch(/setSelectedProductId\(/);
      // 새 패턴 — 비교 제외 onClick 안에서 setActiveCompareItemId(null) 호출
      expect(COMPARE_PAGE_SRC).toMatch(
        /toggleCompare\(selectedProduct\.id\)[\s\S]*?setActiveCompareItemId\(null\)/,
      );
    });
  });

  describe("AnalyticsEventProperties.note 정합", () => {
    it('"compare_review_handoff" note string?: 정합 (boolean → string)', () => {
      // 기존 boolean 패턴 부재
      expect(COMPARE_PAGE_SRC).not.toMatch(
        /trackEvent\("compare_review_handoff"[\s\S]*?note:\s*!!reviewNote/,
      );
      // 새 패턴 — string or undefined
      expect(COMPARE_PAGE_SRC).toMatch(
        /trackEvent\("compare_review_handoff"[\s\S]*?note:\s*reviewNote\s*\|\|\s*undefined/,
      );
    });
  });

  describe("Canonical truth 보존 (회귀 0)", () => {
    it("trackEvent / toggleCompare / addProductToQuote 호출 보존", () => {
      expect(COMPARE_PAGE_SRC).toMatch(/trackEvent\("compare_/);
      expect(COMPARE_PAGE_SRC).toMatch(/toggleCompare\(/);
      expect(COMPARE_PAGE_SRC).toMatch(/addProductToQuote\(/);
    });

    it("compareSessionId / activeCompareItemId / selectedDecisionItemId state 보존", () => {
      expect(COMPARE_PAGE_SRC).toMatch(/compareSessionId/);
      expect(COMPARE_PAGE_SRC).toMatch(/activeCompareItemId/);
      expect(COMPARE_PAGE_SRC).toMatch(/selectedDecisionItemId/);
    });

    it("moveProduct signature 보존 (index, direction)", () => {
      expect(COMPARE_PAGE_SRC).toMatch(
        /moveProduct\s*=\s*\(index:\s*number,\s*direction:\s*"up"\s*\|\s*"down"\)/,
      );
    });
  });
});
