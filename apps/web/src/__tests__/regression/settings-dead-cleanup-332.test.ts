/**
 * §11.332 (회귀) — 설정 dead 항목 정리 sentinel
 *
 * 방안 A: 미구현(mock/저장0) 섹션 메뉴 제거 + Cost Center 표시-only 블록 조건부.
 *   - 온톨로지 엔진(AI)·시스템 연동: NAV 메뉴 항목 제거(진입로 0). activeSection 블록은 잔존.
 *   - Cost Center/입고 위치: 값 있을 때만 렌더, "운영 정책 미설정" dead 신호 제거.
 *   - 회귀 0: 작동 메뉴(operator/security/notifications/billing) 보존.
 *   문자열 매칭은 toContain 사용(esbuild ts-loader 모호성 회피).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}
const PAGE = "src/app/dashboard/settings/page.tsx";

describe("§11.332 — dead 섹션 메뉴 제거", () => {
  it("온톨로지 메뉴 항목 def 제거", () => {
    const src = read(PAGE);
    expect(src).not.toMatch(/id:\s*"ontology",\s*label:/);
  });
  it("시스템 연동 메뉴 항목 def 제거", () => {
    const src = read(PAGE);
    expect(src).not.toMatch(/id:\s*"integrations",\s*label:/);
  });
  it("activeSection 블록은 잔존(코드 보존, 진입로 0 — rollback 가능)", () => {
    const src = read(PAGE);
    expect(src).toContain('activeSection === "ontology"');
    expect(src).toContain('activeSection === "integrations"');
  });
});

describe("§11.332 — Cost Center 조건부 (dead 신호 제거)", () => {
  it("값 있을 때만 '기본 업무 환경' 블록 렌더", () => {
    const src = read(PAGE);
    expect(src).toContain("(userData?.costCenter || userData?.defaultLocation) &&");
  });
  it("각 행도 값 있을 때만(미설정 else 분기 제거)", () => {
    const src = read(PAGE);
    expect(src).toContain("{userData?.costCenter && (");
    expect(src).toContain("{userData?.defaultLocation && (");
  });
});

describe("§11.332 — 회귀 0 (작동 메뉴/섹션 보존)", () => {
  it("작동 메뉴 항목 보존 (operator/security/notifications/billing)", () => {
    const src = read(PAGE);
    expect(src).toMatch(/id:\s*"operator"/);
    expect(src).toMatch(/id:\s*"security"/);
    expect(src).toMatch(/id:\s*"notifications"/);
    expect(src).toMatch(/id:\s*"billing"/);
  });
});
