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
  // §inbox-seed-cutoff (2026-09-22 · 호영님 판정) — inbox (handleAction) 제거.
  //   그 표면은 더 이상 **변경을 하지 않는다**(예전엔 시드 스토어만 바꿨다 · 저장 0). 액션은 상세로 이동만 한다.
  //   변경이 없으면 무효화할 캐시도 없다 → 목록에서 뺀다. 대신 아래에서 "변경 0" 을 단언해
  //   누군가 인박스에 mutation 을 붙이면서 cache-bust 를 빠뜨리면 그 자리에서 드러나게 한다.
  {
    label: "quotes (handleSendSuccess)",
    path: "../../../app/dashboard/quotes/page.tsx",
    moduleKey: "quote_detail",
  },
];

describe("§11.158 cache-bust call-sites · 4 surface (+ 인박스는 변경 0)", () => {
  it("§inbox-seed-cutoff · 운영 작업함은 변경을 하지 않는다 (그래서 cache-bust 대상이 아니다)", () => {
    const inbox = readFileSync(
      resolve(__dirname, "../../../app/dashboard/inbox/page.tsx"),
      "utf8",
    );
    expect(inbox).toMatch(/router\.push\(quickAction\?\.detailRoute \?\? item\.entityRoute\)/);
    expect(inbox).not.toMatch(/useMutation|csrfFetch|\bonExecute\(\)/);
    // mutation 이 다시 생기면 이 단언이 RED → 그때 위 SURFACES 에 인박스를 되돌린다(근거 커밋과 함께).
  });

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
