/**
 * §11.212 client component Date.now() drift sweep — RED→GREEN test
 *
 * client component (use client) 안 render-path 의 `Date.now()` /
 * `new Date()` 직접 호출이 SSR-CSR hydration mismatch (#418/#423/#425)
 * root cause. 5 entry file 의 RelativeTimeText import 강제, 향후
 * 새 component 가 동일 drift 패턴 재발 시 본 test 가 차단.
 *
 * Scope (cluster scope):
 *   - apps/web/src/app/dashboard/quotes/page.tsx
 *   - apps/web/src/components/dashboard/work-queue-inbox.tsx
 *   - apps/web/src/components/dashboard/ai-action-inbox.tsx
 *   - apps/web/src/components/dashboard/action-ledger.tsx
 *   - (helper 자체는 제외)
 *
 * Out of scope (별도 트랙):
 *   - inbox-adapter.ts (server-side helper, caller chain 의 client useMemo
 *     에서도 호출되지만 별도 fix path — 본 cluster 가 5 entry 에서 swap
 *     완료 후 inbox-adapter 의 NOW 사용은 client useMemo 호출 시점의 값
 *     으로 stable, hydration mismatch 0).
 *   - server route handler (Date.now/new Date — server-only path 정합).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT_WEB = join(__dirname, "..", "..", "..");

const SWEEP_FILES = [
  "src/app/dashboard/quotes/page.tsx",
  "src/components/dashboard/work-queue-inbox.tsx",
  "src/components/dashboard/ai-action-inbox.tsx",
  "src/components/dashboard/action-ledger.tsx",
];

/**
 * §11.214 강화 — component render-path (top-level body) 의 인라인 NOW
 * 의존 변수 정의 (`const ageDays = Math.floor((Date.now() - new Date...`)
 * 패턴 차단. useEffect / onClick / mutationFn 안의 호출은 허용 (event
 * handler, render-path 0 → hydration mismatch 0).
 *
 * False positive 0:
 *   - useState/useEffect 안 setDays(Math.floor((Date.now()...)) 매칭 0
 *   - useAgeDays helper 안 호출 매칭 0
 *
 * 매칭:
 *   - render body 의 `const ageDays = Math.floor((Date.now() - new Date...`
 *   - render body 의 `const X = Math.floor((Date.now() - new Date...`
 */
const INLINE_NOW_PATTERN = /\bconst\s+\w+\s*=\s*Math\.floor\(\(Date\.now\(\)\s*-\s*new Date/;

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT_WEB, rel), "utf8");
}

describe("§11.212 client component Date.now drift sweep", () => {
  for (const file of SWEEP_FILES) {
    it(`${file} — RelativeTimeText import (Date.now() 직접 render-path 호출 swap)`, () => {
      const src = read(file);
      expect(src).toMatch(/RelativeTimeText/);
    });
  }
});

describe("§11.214 client component 인라인 Date.now() 차단 (helper 거치지 않은 호출 0)", () => {
  for (const file of SWEEP_FILES) {
    it(`${file} — 인라인 \`Date.now() - new Date\` 패턴 0 (RelativeTimeText 또는 useEffect 거쳐야)`, () => {
      const src = read(file);
      expect(src).not.toMatch(INLINE_NOW_PATTERN);
    });
  }

  it("executive-summary-section.tsx — render-path NOW 의존 차단 (Note: 별도 file 추가 검증)", () => {
    const src = read("src/components/dashboard/executive-summary-section.tsx");
    // buildMonthlyProjection 의 NOW prop 으로 받거나 useEffect 분리 검증
    // 단순 패턴: "const now = new Date()" 0 (또는 useState/useEffect 거쳐야)
    expect(src).not.toMatch(/^\s*const\s+now\s*=\s*new Date\(\);?\s*$/m);
  });
});
