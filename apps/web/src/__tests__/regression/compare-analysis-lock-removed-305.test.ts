/**
 * §11.305 #compare-analysis-lock-removed — Regression sentinel
 *
 * 호영님 P0 spec (옵션 A, 2026-05-27):
 *   AI 비교 분석 lock 영구 잔존 버그 해소.
 *
 * root cause:
 *   /api/ai/compare-analysis/route.ts 가 enforceAction() 으로 mutation lock
 *   을 획득한 뒤 complete()/fail() 미호출 → lock 영구 잔존.
 *   + targetEntityId 'compare-analysis' 하드코딩 (전체 사용자 공유).
 *   + read 액션에 mutation lock 부적합.
 *
 * fix: enforceAction 완전 제거, auth() 인증만 유지.
 *
 * 보안 유지:
 *   - auth() → 미인증 401 (변경 0)
 *   - products 입력 검증 보존
 *   - Gemini / local fallback 분석 로직 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const PATH = "src/app/api/ai/compare-analysis/route.ts";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.305 — enforceAction lock 완전 제거", () => {
  it("파일 존재 + POST handler", () => {
    expect(existsSync(join(REPO_ROOT, PATH))).toBe(true);
    const src = read(PATH);
    expect(src).toMatch(/export\s+async\s+function\s+POST\s*\(/);
  });

  it("enforceAction import 0 (실제 import문)", () => {
    const src = read(PATH);
    expect(src).not.toMatch(/import\s*\{[^}]*enforceAction[^}]*\}\s*from/);
  });

  it("InlineEnforcementHandle import 0", () => {
    const src = read(PATH);
    expect(src).not.toMatch(/import\s*\{[^}]*InlineEnforcementHandle[^}]*\}\s*from/);
  });

  it("enforceAction() 호출 0", () => {
    const src = read(PATH);
    expect(src).not.toMatch(/enforceAction\s*\(/);
  });

  it("enforcement.allowed / .deny() / .complete() / .fail() 0", () => {
    const src = read(PATH);
    expect(src).not.toMatch(/enforcement\.allowed/);
    expect(src).not.toMatch(/enforcement\.deny\s*\(/);
    expect(src).not.toMatch(/enforcement\.complete\s*\(/);
    expect(src).not.toMatch(/enforcement\.fail\s*\(/);
  });

  it("targetEntityId 'compare-analysis' 하드코딩 0 (lock concurrencyKey 공유 제거)", () => {
    const src = read(PATH);
    expect(src).not.toMatch(/targetEntityId:\s*['"]compare-analysis['"]/);
  });

  it("let enforcement 선언 0", () => {
    const src = read(PATH);
    expect(src).not.toMatch(/let\s+enforcement/);
  });
});

describe("§11.305 — auth() 인증 보존 (보안 회귀 0)", () => {
  it("auth() 호출 보존", () => {
    const src = read(PATH);
    expect(src).toMatch(/await\s+auth\(\)/);
  });

  it("미인증 401 분기 보존", () => {
    const src = read(PATH);
    expect(src).toMatch(/session\?\.user\?\.id/);
    expect(src).toMatch(/인증이 필요합니다[\s\S]{0,40}401/);
  });
});

describe("§11.305 — 분석 로직 보존 (회귀 0)", () => {
  it("products 입력 검증 보존 (1개 이상)", () => {
    const src = read(PATH);
    expect(src).toMatch(/products\.length\s*<\s*1/);
    expect(src).toMatch(/분석할 제품이 필요합니다/);
  });

  it("최대 5개 cap 보존", () => {
    const src = read(PATH);
    expect(src).toMatch(/products\.slice\(0,\s*5\)/);
  });

  it("Gemini 호출 + local fallback 보존", () => {
    const src = read(PATH);
    expect(src).toMatch(/GEMINI_API_KEY/);
    expect(src).toMatch(/buildLocalAnalysis/);
  });

  it("성공 응답 shape 보존 (success/data)", () => {
    const src = read(PATH);
    expect(src).toMatch(/success:\s*true,\s*data:/);
  });

  it("catch 에러 핸들링 보존 (500)", () => {
    const src = read(PATH);
    expect(src).toMatch(/AI 분석 중 오류가 발생했습니다/);
  });
});
