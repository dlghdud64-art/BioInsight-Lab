/**
 * §amber-token-ratchet — amber/orange **토큰 축** 전역 ratchet
 *
 * 승계: §0-B 파일 계약(product-completeness.tsx 앵커 · amber 8토큰 전수 일치)은
 *       2026-08-16 은퇴. 앵커 파일 importer 0(dead)이었고, 8토큰 계약을 질 수 있는
 *       라이브 표면이 **0건**이었다(라이브 최다 4종). 302c 와 형태가 다르다 —
 *       그때는 승계자가 같은 계약을 졌다. 여기서는 계약 축을 **파일 → 토큰**으로 옮긴다.
 *
 * 왜 필요한가: §11.302d-6a~6d 의 amber-removed sweep 은 **Tailwind class 축만** 쓸었다.
 *       그 sentinel 들의 주석이 명시한다 — "chart palette hex(#f59e0b) 는 Tailwind class 가
 *       아니라 sweep 무관(보존)". 그 결과 클래스 축은 전역 0 이지만 **hex 축은 무방비**다.
 *       이 게이트가 메우는 자리가 정확히 그 hex 축이다.
 *
 * 🛑 이 게이트는 amber 를 **제거하지 않는다.** CLAUDE.md §9 는 muted amber 이전을
 *    "미채택/보류(대공사, 별도 신중 배치)" 로 못박았다. 부채를 지금 갚지 않는다 —
 *    **늘지 않게 막고 보이게 만든다.** 감축은 별도 배치 몫이며, 감축 시 baseline 을
 *    낮추고 커밋하는 것이 이 게이트가 요구하는 절차다.
 *
 * ── 모집단 정의 (다음 배치가 다른 수를 세지 않도록 문자열로 고정) ──
 *   포함  라이브 소스 파일의 amber/orange 출현 전량
 *         · hex   Tailwind amber 50..950 + orange 50..950 전종
 *         · class amber-N / orange-N (utility prefix 유무 무관)
 *   라이브 = App Router 진입점(page/layout/route/…) 이거나 비-테스트 importer ≥ 1
 *         (판정은 **명세 해석**. basename 매칭 금지 — _helpers/import-graph.ts 참조)
 *   제외  🛑 테스트 파일 전량 — sentinel 상수는 검사 **대상**이 아니라 검사 **도구**다.
 *            빼지 않으면 게이트가 자기를 센다(2026-08-16 실측 sentinel 24파일 / 103건).
 *   제외  dead 파일(importer 0 · 라우트 아님) — 렌더 도달 불가. 2026-08-16 실측 6파일 / 24건
 *
 * 측정 시점 2026-08-16 · 라이브 24파일 / 81건
 */
import { describe, it, expect } from "vitest";
import { buildGraph, rel, isTestFile } from "../_helpers/import-graph";

const AMBER_HEX = ["fffbeb","fef3c7","fde68a","fcd34d","fbbf24","f59e0b","d97706","b45309","92400e","78350f","451a03","a16207"];
const ORANGE_HEX = ["fff7ed","ffedd5","fed7aa","fdba74","fb923c","f97316","ea580c","c2410c","9a3412","7c2d12","431407"];
const HEX = new RegExp("#(?:" + [...AMBER_HEX, ...ORANGE_HEX].join("|") + ")\\b", "gi");
const CLS = /\b(?:amber|orange)-(?:50|100|200|300|400|500|600|700|800|900|950)\b/g;

/** 🛑 baseline. 증가 RED · 감소도 RED(갱신 요구). 손으로 고치기 전에 사유를 커밋 메시지에 적을 것 */
const BASELINE_TOTAL = 81;
const BASELINE_PER_FILE: Record<string, number> = {
  "app/_components/final-cta-section.tsx": 7,
  "app/_components/ops-console-preview-section.tsx": 9,
  "app/_workbench/search/page.tsx": 1,
  "app/api/analytics/dashboard/route.ts": 1,
  "app/dashboard/analytics/_components/team-analytics-view.tsx": 1,
  "app/dashboard/analytics/category/page.tsx": 4,
  "app/dashboard/analytics/page.tsx": 3,
  "app/dashboard/safety/page.tsx": 1,
  "app/intro/page.tsx": 4,
  "app/products/[id]/page.tsx": 4,
  "components/analytics/rum-trend-line-chart.tsx": 2,
  "components/budget/budget-register-sheet.tsx": 1,
  "components/dashboard/category-distribution-card.tsx": 1,
  "components/inventory/ReorderReviewSheet.tsx": 10,
  "components/inventory/inventory-context-panel.tsx": 1,
  "components/inventory/inventory-reorder-blocked-sheet.tsx": 9,
  "components/operational-brief/popup.tsx": 1,
  "components/receiving/mobile-receiving-view.tsx": 2,
  "emails/quote-completed.tsx": 3,
  "lib/budget/spending-category-schema.ts": 1,
  "lib/email/templates.ts": 3,
  "lib/email/vendor-request-templates.ts": 7,
  "lib/inventory/flow-insight-engine.ts": 4,
  "lib/inventory/lot-tracking-engine.ts": 1
};

function census() {
  const g = buildGraph();
  const per: Record<string, number> = {};
  let total = 0;
  for (const f of g.files) {
    if (isTestFile(f) || !g.isLive(f)) continue;
    const s = g.read(f);
    const n = (s.match(HEX) || []).length + (s.match(CLS) || []).length;
    if (n) { per[rel(f)] = n; total += n; }
  }
  return { per, total };
}

describe("§amber-token-ratchet — 총계 잠금", () => {
  it(`amber/orange 총계 = baseline ${BASELINE_TOTAL}`, () => {
    const { total } = census();
    if (total > BASELINE_TOTAL)
      throw new Error(
        `amber 토큰이 늘었다: ${total} > baseline ${BASELINE_TOTAL} (+${total - BASELINE_TOTAL}). ` +
          "신규 amber 는 §11.302 신호등 위반이다 — yellow(주의) / red(위험) / emerald(정상) 중 하나를 쓸 것.",
      );
    if (total < BASELINE_TOTAL)
      throw new Error(
        `감축분이 있다: ${total} < baseline ${BASELINE_TOTAL} (-${BASELINE_TOTAL - total}). ` +
          `BASELINE_TOTAL 을 ${total} 로 낮추고 BASELINE_PER_FILE 을 갱신해 커밋할 것 — ratchet 은 되감기지 않는다.`,
      );
    expect(total).toBe(BASELINE_TOTAL);
  });
});

describe("§amber-token-ratchet — 파일별 분포 잠금", () => {
  it("총계가 같아도 파일이 옮겨간 경우를 잡는다", () => {
    const { per } = census();
    const cur = Object.keys(per).sort();
    const base = Object.keys(BASELINE_PER_FILE).sort();
    expect({ 신규유입: cur.filter((k) => !(k in BASELINE_PER_FILE)) }).toEqual({ 신규유입: [] });
    expect({ 소멸: base.filter((k) => !(k in per)) }).toEqual({ 소멸: [] });
    for (const k of base) expect({ [k]: per[k] }).toEqual({ [k]: BASELINE_PER_FILE[k] });
  });

  it("파일별 합 = 총계 (자기 정합)", () => {
    const { per, total } = census();
    expect(Object.values(per).reduce((a, b) => a + b, 0)).toBe(total);
    expect(Object.values(BASELINE_PER_FILE).reduce((a, b) => a + b, 0)).toBe(BASELINE_TOTAL);
  });
});

describe("§amber-token-ratchet — 모집단 경계", () => {
  it("🛑 게이트가 자기를 세지 않는다 (sentinel 상수 제외)", () => {
    const { per } = census();
    expect(Object.keys(per).filter((k) => /__tests__|\.test\./.test(k))).toEqual([]);
  });

  it("dead 파일은 모집단 밖 — 은퇴한 §0-B 앵커가 총계에 안 들어간다", () => {
    const { per } = census();
    expect(per["components/products/product-completeness.tsx"]).toBeUndefined();
  });

  it("라이브 판정이 명세 해석이다 — basename 오음 2건이 라이브로 잡힌다", () => {
    const { per } = census();
    // basename 역참조는 이 둘을 dead 로 오판했다. 둘 다 inventory-content.tsx 가 import 한다
    expect(per["components/inventory/inventory-reorder-blocked-sheet.tsx"]).toBeGreaterThan(0);
    expect(per["components/inventory/inventory-context-panel.tsx"]).toBeGreaterThan(0);
  });
});
