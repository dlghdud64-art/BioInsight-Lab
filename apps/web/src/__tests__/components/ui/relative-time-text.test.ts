/**
 * §11.212 RelativeTimeText helper — RED→GREEN test
 *
 * client component 안 `Date.now()` / `new Date()` 직접 호출이 SSR-CSR
 * hydration mismatch (#418/#423/#425) 의 root cause. 본 helper 는
 * useEffect + useState 패턴으로 client-only mount 후 시간 표시 set,
 * `suppressHydrationWarning` 으로 SSR fallback 과 CSR 실제 값 사이
 * mismatch warn 차단.
 *
 * Lock:
 *   - "use client" 명시
 *   - useEffect + useState 패턴 (mount 후 set)
 *   - suppressHydrationWarning 명시
 *   - iso prop (string) + optional fallback prop
 *   - render: <span> with text
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT_WEB = join(__dirname, "..", "..", "..", "..");
const HELPER = "src/components/ui/relative-time-text.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT_WEB, rel), "utf8");
}

describe("§11.212 RelativeTimeText helper signature", () => {
  it("\"use client\" directive 명시", () => {
    const src = read(HELPER);
    // multiline source — JSDoc 주석 뒤에 directive 위치 가능
    expect(src).toMatch(/["']use client["']/);
  });

  it("RelativeTimeText export", () => {
    const src = read(HELPER);
    expect(src).toMatch(/export\s+(?:function|const)\s+RelativeTimeText/);
  });

  it("useEffect + useState import + 사용 (client-only mount 패턴)", () => {
    const src = read(HELPER);
    expect(src).toMatch(/useEffect/);
    expect(src).toMatch(/useState/);
  });

  it("suppressHydrationWarning 명시 (SSR fallback ≠ CSR 실제 값 mismatch 차단)", () => {
    const src = read(HELPER);
    expect(src).toMatch(/suppressHydrationWarning/);
  });

  it("iso prop accept", () => {
    const src = read(HELPER);
    expect(src).toMatch(/iso\s*[?]?\s*:\s*string|iso\s*\}/);
  });
});
