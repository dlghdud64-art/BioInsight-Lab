/**
 * §11.161 #operational-brief-hook-call-sites
 *
 * Source-level guard — 5 surface 가 `useOperationalBriefNarrative` hook 을
 * § 1. 상황 요약 section 에 통합. fallback path (selectedSignals.summary /
 * item.summary / situationOneLiner 등) 보존.
 *
 * §11.142 lock 정합:
 *   - facts 는 resolver canonical (status / blocker / nextAction).
 *   - narrative 만 hook 통해 LLM 또는 deterministic 압축 (env 분기).
 *   - hook fail 시 자동 fallback (caller error 0).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SURFACES = [
  {
    label: "purchases",
    path: "../../../app/dashboard/purchases/page.tsx",
    moduleKey: "purchase_conversion",
    fallbackMatch: /selectedItem\.requestTitle|selectedItem\.blockerReason/,
  },
  {
    label: "quotes",
    path: "../../../app/dashboard/quotes/page.tsx",
    moduleKey: "quote_detail",
    fallbackMatch: /selectedSignals\.summary/,
  },
  // §11.191 — inbox surface deprecated (hidden redirect → /dashboard).
  // hook call site 자연 drop, narrative cache 는 dashboard 메인이 흡수.
  {
    label: "inventory",
    path: "../../../components/inventory/inventory-context-panel.tsx",
    moduleKey: "inventory",
    fallbackMatch: /currentQuantity|safetyStock/,
  },
  {
    label: "work-queue",
    path: "../../../components/dashboard/console/queue-detail-panel.tsx",
    moduleKey: "work_queue",
    fallbackMatch: /situationOneLiner/,
  },
];

describe("§11.161 hook call-sites — 5 surface", () => {
  for (const s of SURFACES) {
    describe(s.label, () => {
      const source = readFileSync(resolve(__dirname, s.path), "utf8");

      it("useOperationalBriefNarrative import 존재", () => {
        expect(source).toMatch(/useOperationalBriefNarrative/);
      });

      it(`module: "${s.moduleKey}" key 사용`, () => {
        const re = new RegExp(`module:\\s*["']${s.moduleKey}["']`);
        expect(source).toMatch(re);
      });

      it("facts 객체 (status / blocker / nextAction) payload 사용", () => {
        // hook 호출에 facts: { ... } 패턴 존재
        expect(source).toMatch(/facts:\s*\{/);
      });

      it("narrative 변수 사용 (hook 결과 표시)", () => {
        expect(source).toMatch(/narrative/);
      });

      it("fallback path 보존 — 기존 표시 fallback", () => {
        expect(source).toMatch(s.fallbackMatch);
      });
    });
  }

  it("hook 자체 export 보존 (use-operational-brief.ts)", () => {
    const hookSrc = readFileSync(
      resolve(__dirname, "../../../lib/hooks/use-operational-brief.ts"),
      "utf8",
    );
    expect(hookSrc).toMatch(/export function useOperationalBriefNarrative/);
  });
});
