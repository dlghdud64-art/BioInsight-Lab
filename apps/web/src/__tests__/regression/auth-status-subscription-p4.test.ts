/**
 * §auth §4 P4 #auth-status-subscription — 상태 구독 가드(이벤트 비종속)
 *   (버그: 로그아웃 후 활성 탭 재탭 → middleware(navigation)·focus·401 전부 미발화 →
 *    dashboard unauthenticated 분기 부재로 스켈레톤 영구 체류. §auth-empty-state-fix 동일 결함.)
 *
 * 수정: AuthFocusGuard 에 status==="unauthenticated" 전이 시 선제 redirect effect 추가.
 *   focus/navigation 이벤트를 기다리지 않고 상태 전이만으로 발화 → 재탭·크로스탭 로그아웃 일관.
 *
 * 안전(=§2 재사용): wasAuthedRef(공개 방문자 무동작) + isProtectedPath(보호경로 한정) +
 *   signin-path guard(redirect loop 0). 목적지 signin?callbackUrl = §1/§2 와 idempotent.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string): string => readFileSync(join(REPO_ROOT, rel), "utf8");
const GUARD = read("src/components/auth/auth-focus-guard.tsx");

describe("§auth §4 P4 — status 구독 redirect effect", () => {
  it("status==='unauthenticated' 전이 시 발화 (이벤트 비종속)", () => {
    expect(GUARD).toMatch(/if \(status !== "unauthenticated"\) return/);
    // deps [status] — 상태 전이 구독 effect
    expect(GUARD).toMatch(/\}, \[status\]\);/);
  });
  it("signin?callbackUrl 로 하드 redirect (잔존 쿼리/스켈레톤 완전 리셋)", () => {
    expect(GUARD).toMatch(/window\.location\.href = `\/auth\/signin\?callbackUrl=\$\{callbackUrl\}`/);
    expect(GUARD).toMatch(/encodeURIComponent\(\s*window\.location\.pathname \+ window\.location\.search/);
  });
});

describe("§auth §4 P4 — 안전장치(operator 집중 4점)", () => {
  it("① redirect loop 0 — signin-path guard (이미 signin 이면 무동작)", () => {
    expect(GUARD).toMatch(/path\.startsWith\("\/auth\/signin"\)\) return/);
  });
  it("② 공개 경로 무동작 — wasAuthedRef 게이트(로그인 적 있던 세션만)", () => {
    // status effect 안에서 wasAuthedRef.current false 면 early return
    expect(GUARD).toMatch(/if \(status !== "unauthenticated"\) return;\s*\n\s*if \(!wasAuthedRef\.current\) return/);
  });
  it("② 보호 경로 한정 — isProtectedPath 외 무동작", () => {
    expect(GUARD).toMatch(/if \(!isProtectedPath\(path\)/);
  });
  it("③ stale closure 0 — ref + 모듈 순수 함수만 참조(deps [status])", () => {
    // wasAuthedRef(ref) / isProtectedPath(모듈 스코프 함수) — 클로저 신선도 무관
    expect(GUARD).toMatch(/const wasAuthedRef = useRef\(false\)/);
    expect(GUARD).toMatch(/function isProtectedPath\(path: string\): boolean/);
  });
});

describe("§auth §4 P4 — 회귀 0(§2 focus-guard 보존, additive)", () => {
  it("§2 focus/visibilitychange getSession 경로 보존", () => {
    expect(GUARD).toMatch(/addEventListener\("visibilitychange"/);
    expect(GUARD).toMatch(/addEventListener\("focus"/);
    expect(GUARD).toMatch(/const session = await getSession\(\)/);
  });
  it("§2 wasAuthed 설정(authenticated 전이) 보존", () => {
    expect(GUARD).toMatch(/if \(status === "authenticated"\) wasAuthedRef\.current = true/);
  });
  it("PROTECTED_PREFIXES canonical 보존", () => {
    expect(GUARD).toMatch(/"\/dashboard"/);
    expect(GUARD).toMatch(/"\/app"/);
  });
});
