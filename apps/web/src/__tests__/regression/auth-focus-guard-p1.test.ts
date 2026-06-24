/**
 * §auth §2 P1 #auth-focus-guard — 재포커스 세션 유효성 선제 게이트 (보수적 additive)
 *   (PLAN: docs/plans/PLAN_auth-refocus-token-silent-refresh.md)
 *
 * 탭 복귀 시 getSession()으로 선제 검증 → 만료 시 기존 signin redirect 재사용.
 * 안전: wasAuthed 게이트·보호 경로 한정·signin guard·debounce·canonical(getSession)만.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}
const GUARD = "src/components/auth/auth-focus-guard.tsx";
const LAYOUT = "src/app/layout.tsx";

describe("§auth §2 P1 — AuthFocusGuard 선제 게이트", () => {
  const src = read(GUARD);
  it("visibilitychange + focus 리스너", () => {
    expect(src).toMatch(/addEventListener\("visibilitychange"/);
    expect(src).toMatch(/addEventListener\("focus"/);
  });
  it("canonical 유효성 = getSession() (자체 만료 계산 0)", () => {
    expect(src).toMatch(/getSession/);
    expect(src).toMatch(/const session = await getSession\(\)/);
    expect(src).toMatch(/if \(session\) return/); // 유효 → 무동작
  });
  it("만료 시 기존 signin redirect 재사용(callbackUrl)", () => {
    expect(src).toMatch(/\/auth\/signin\?callbackUrl=/);
  });
});

describe("§auth §2 P1 — 안전장치 (loop/storm/가짜 만료 0)", () => {
  const src = read(GUARD);
  it("wasAuthed 게이트(공개 방문자 무동작)", () => {
    expect(src).toMatch(/wasAuthedRef/);
    expect(src).toMatch(/if \(!wasAuthedRef\.current\) return/);
  });
  it("보호 경로 한정 + signin-path guard", () => {
    expect(src).toMatch(/isProtectedPath/);
    expect(src).toMatch(/\/auth\/signin/);
    expect(src).toMatch(/PROTECTED_PREFIXES/);
  });
  it("debounce(중복/storm 차단)", () => {
    expect(src).toMatch(/setTimeout\(/);
    expect(src).toMatch(/clearTimeout\(timer\)/);
  });
  it("visible 일 때만 동작", () => {
    expect(src).toMatch(/document\.visibilityState !== "visible"/);
  });
  it("리스너 cleanup(removeEventListener)", () => {
    expect(src).toMatch(/removeEventListener\("visibilitychange"/);
    expect(src).toMatch(/removeEventListener\("focus"/);
  });
});

describe("§auth §2 P1 — 전역 마운트", () => {
  it("layout AuthSessionProvider 하위에 AuthFocusGuard 마운트", () => {
    const src = read(LAYOUT);
    expect(src).toMatch(/import \{ AuthFocusGuard \}/);
    expect(src).toMatch(/<AuthFocusGuard \/>/);
  });
});
