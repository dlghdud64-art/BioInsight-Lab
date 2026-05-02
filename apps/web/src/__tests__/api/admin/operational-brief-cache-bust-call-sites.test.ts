/**
 * §11.158 #operational-brief-cache-bust-call-sites
 *
 * Source-level guard — 5 surface 의 핵심 mutation onSuccess 가 §11.156 helper
 * `invalidateBriefNarrative()` 를 호출하는지 검증.
 *
 * cache stale window 차단 — 운영자 mutation 즉시 narrative 재생성.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SURFACES = [
  {
    label: "purchases (bulkPo + rationale + selectReply)",
    path: "../../../app/dashboard/purchases/page.tsx",
    moduleKey: "purchase_conversion",
  },
  {
    label: "work-queue console (executeOps)",
    path: "../../../components/dashboard/work-queue-console.tsx",
    moduleKey: "work_queue",
  },
  {
    label: "inventory (onReorder)",
    path: "../../../app/dashboard/inventory/inventory-content.tsx",
    moduleKey: "inventory",
  },
  // §11.191 — inbox surface deprecated (hidden redirect → /dashboard).
  // cache-bust call site 자연 drop (mutation 발생 surface 가 redirect-only).
  {
    label: "quotes (handleSendSuccess)",
    path: "../../../app/dashboard/quotes/page.tsx",
    moduleKey: "quote_detail",
  },
];

describe("§11.158 cache-bust call-sites — 5 surface", () => {
  for (const s of SURFACES) {
    describe(s.label, () => {
      const source = readFileSync(resolve(__dirname, s.path), "utf8");

      it("invalidateBriefNarrative import 존재", () => {
        expect(source).toMatch(/invalidateBriefNarrative/);
      });

      it(`module: "${s.moduleKey}" key 사용`, () => {
        const re = new RegExp(`module:\\s*["']${s.moduleKey}["']`);
        expect(source).toMatch(re);
      });

      it("sourceUpdatedAt: new Date() 패턴 (mutation timestamp)", () => {
        // sourceUpdatedAt: new Date() 또는 sourceUpdatedAt: new Date(...) 가 cache-bust context
        expect(source).toMatch(/sourceUpdatedAt:\s*new Date\(/);
      });
    });
  }

  it("§11.156 helper 자체는 보존 (use-operational-brief.ts export)", () => {
    const hookSrc = readFileSync(
      resolve(__dirname, "../../../lib/hooks/use-operational-brief.ts"),
      "utf8",
    );
    expect(hookSrc).toMatch(/export async function invalidateBriefNarrative/);
  });
});
