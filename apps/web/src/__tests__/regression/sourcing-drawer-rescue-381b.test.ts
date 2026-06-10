/**
 * §11.381 Phase B-pre — sourcing-recommendation-drawer 구출 (소싱 이식) sentinel
 *
 * 호영님 결정 (2026-06-10): compare 라우트 retire(Phase B) 전에 drawer 를
 * 소싱 surface 로 이식. /api/sourcing/recommend 유일 UI 소비처 보존.
 *
 * 구현 계약:
 *   - 이동: app/compare/_components/ → app/_workbench/_components/ (구 경로 삭제)
 *   - CTA 재배선: /compare/quote → /app/quote (B2 에서 /compare/quote retire 예정)
 *   - 소싱 wiring: SourcingSpecCompareSection 행별 "대체품/벤더 찾기" 트리거
 *     + drawer same-canvas render (신규 페이지 0)
 *   - compare/page.tsx 는 새 경로 import 로 유지 (B2 전 무손상)
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const NEW_DRAWER = "src/app/_workbench/_components/sourcing-recommendation-drawer.tsx";
const OLD_DRAWER = "src/app/compare/_components/sourcing-recommendation-drawer.tsx";
const SECTION = "src/app/_workbench/_components/sourcing-spec-compare-section.tsx";
const COMPARE_PAGE = "src/app/compare/page.tsx";

describe("§11.381b — drawer 이동 (구 경로 삭제 + 신 경로 본체)", () => {
  it("신 경로 존재 + 구 경로 부재", () => {
    expect(existsSync(join(REPO_ROOT, NEW_DRAWER))).toBe(true);
    expect(existsSync(join(REPO_ROOT, OLD_DRAWER))).toBe(false);
  });

  it("본체 보존: export + Sheet same-canvas + 출처 뱃지 + hasData 분기", () => {
    const src = read(NEW_DRAWER);
    expect(src).toMatch(/export function SourcingRecommendationDrawer/);
    expect(src).toMatch(/<Sheet/);
    expect(src).toMatch(/과거 구매 기록 기반|sourceLabel/);
    expect(src).toMatch(/sourcing-source-badge/);
    expect(src).toMatch(/hasData/);
    expect(src).toMatch(/sourcing-empty-state/);
    expect(src).not.toMatch(/export default function/);
  });

  it("상태 testid 보존: loading / error / vendor-row / substitute-row", () => {
    const src = read(NEW_DRAWER);
    expect(src).toMatch(/sourcing-loading/);
    expect(src).toMatch(/sourcing-error/);
    expect(src).toMatch(/sourcing-vendor-row/);
    expect(src).toMatch(/sourcing-substitute-row/);
  });

  it("CTA 재배선: /app/quote (구 /compare/quote 참조 0)", () => {
    const src = read(NEW_DRAWER);
    expect(src).toMatch(/href="\/app\/quote"/);
    expect(src).not.toMatch(/\/compare\/quote/);
    expect(src).toMatch(/sourcing-empty-quote-cta/);
    expect(src).toMatch(/sourcing-vendor-quote-cta/);
  });

  it("API 경로 보존: /api/sourcing/recommend (canonical truth 무변경)", () => {
    const src = read(NEW_DRAWER);
    expect(src).toMatch(/\/api\/sourcing\/recommend\?productId=/);
  });
});

describe("§11.381b — 소싱 wiring: SourcingSpecCompareSection 트리거", () => {
  it("drawer import + render (same-canvas, 신규 페이지 0)", () => {
    const src = read(SECTION);
    expect(src).toMatch(/import \{ SourcingRecommendationDrawer \} from ["']\.\/sourcing-recommendation-drawer["']/);
    expect(src).toMatch(/<SourcingRecommendationDrawer/);
  });

  it("행별 '대체품/벤더 찾기' 트리거 + state wiring (dead button 0)", () => {
    const src = read(SECTION);
    expect(src).toMatch(/대체품\/벤더 찾기/);
    expect(src).toMatch(/sourcing-find-btn/);
    expect(src).toMatch(/showSourcingDrawer/);
    expect(src).toMatch(/sourcingProductId/);
    expect(src).toMatch(/sourcingProductName/);
    expect(src).toMatch(/setShowSourcingDrawer\(true\)/);
  });

  it("drawer props wiring: productId + productName", () => {
    const src = read(SECTION);
    expect(src).toMatch(/productId=\{sourcingProductId\}/);
    expect(src).toMatch(/productName=\{sourcingProductName\}/);
  });
});

describe("§11.381b — compare/page.tsx 무손상 (B2 전): 새 경로 import 유지", () => {
  it("새 경로 import + 기존 wiring 보존", () => {
    const src = read(COMPARE_PAGE);
    expect(src).toMatch(/from ["']\.\.\/_workbench\/_components\/sourcing-recommendation-drawer["']/);
    expect(src).toMatch(/<SourcingRecommendationDrawer/);
    expect(src).toMatch(/대체품\/벤더 찾기/);
  });
});
