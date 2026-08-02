/**
 * §receiving-wide-viewport — receiving 랜딩 폭 제약 sentinel.
 *
 * 배경: 랜딩 루트에 max-width 가 없어 2560px 뷰포트에서 콘텐츠가 2241px 로 늘어나
 *   6열 검수 표의 한 행을 눈으로 따라갈 수 없었다(T2 6열 표 도입 시점부터의 회귀).
 *   원인은 표가 아니라 페이지 컨테이너다.
 *
 * 잠그는 의도: 랜딩이 폭 제약 래퍼를 사용할 것 · 루트 흰 캔버스를 유지할 것 ·
 *   모바일 분기를 보존할 것. 래퍼 컴포넌트를 교체할 일이 생기면 삭제가 아니라
 *   supersede 로 승계한다(§receiving-inspection-followup 선례).
 *
 * Phase 1 기대치: 첫 항목 RED(미적용) · 나머지 2건 GREEN(현행 만족).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string): string => readFileSync(join(APP_WEB_ROOT, rel), "utf8");

const PAGE = "src/app/dashboard/receiving/page.tsx";
const SHELL = "src/components/layout/page-header.tsx";

describe("§receiving-wide-viewport — 폭 제약 (Phase 2 전 RED)", () => {
  it("랜딩이 폭 제약 래퍼를 사용한다", () => {
    const src = read(PAGE);
    expect(src).toMatch(/PageShell/);
    expect(src).toMatch(/from "@\/components\/layout\/page-header"/);
  });
});

describe("§receiving-wide-viewport — 기존 보장 (현행 GREEN)", () => {
  it("루트 흰 캔버스 유지 — bg-canvas-unify 와 충돌 없음", () => {
    expect(read(PAGE)).toMatch(/<div className="min-h-screen bg-white/);
  });

  it("모바일 분기 보존", () => {
    expect(read(PAGE)).toMatch(/MobileReceivingView/);
  });

  it("래퍼가 실제로 폭을 제약한다(overview = 7xl)", () => {
    const shell = read(SHELL);
    expect(shell).toMatch(/mx-auto/);
    expect(shell).toMatch(/max-w-7xl/);
  });
});
