/**
 * §auth §3 P2 #auth-silent-refresh — SessionProvider silent refresh (보수적 additive)
 *   (PLAN: docs/plans/PLAN_auth-refocus-token-silent-refresh.md)
 *
 * NextAuth 내장 refetchInterval(활성 세션 주기 갱신=JWT rolling) + refetchOnWindowFocus(명시).
 * 무음(토스트/리다이렉트 0) — 실제 만료 시에만 §2/api-client redirect.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}
const PROVIDER = "src/providers/session-provider.tsx";

describe("§auth §3 P2 — SessionProvider silent refresh", () => {
  const src = read(PROVIDER);
  it("refetchInterval(주기 갱신=rolling) 설정", () => {
    expect(src).toMatch(/refetchInterval=\{/);
  });
  it("refetchOnWindowFocus 명시(§2 정합)", () => {
    expect(src).toMatch(/refetchOnWindowFocus/);
  });
  it("회귀 0 — SessionProvider 래퍼 + children 보존", () => {
    expect(src).toMatch(/from "next-auth\/react"/);
    expect(src).toMatch(/<SessionProvider[\s\S]{0,120}>\s*\{children\}/);
  });
});
