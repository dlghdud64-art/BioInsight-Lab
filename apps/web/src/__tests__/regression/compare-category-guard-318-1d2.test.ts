/**
 * §11.318 1d-2 (RED) — 혼합 카테고리 가드 warn→block (B안)
 *
 * 결정(호영님 2026-05-30): B안 — 혼합/blocked 카테고리 시 comparison-modal 의 AI 분석
 *   (/api/ai/compare-analysis) 자동 호출 차단(§1 엉뚱 비교 환각 방지) + 경고 + "그래도 분석"
 *   수동 우회(과차단 회피). direct 는 기존대로 자동. CompareReviewWorkWindow 경고 강화.
 *
 * 회귀: validateCompareCategoryIntegrity 엔진 자체는 불변(기존 동작 보존).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}

const MODAL = "src/app/_workbench/_components/comparison-modal.tsx";
const ENGINE = "src/lib/ai/compare-review-engine.ts";

describe("§11.318 1d-2 — comparison-modal 가드 연결", () => {
  it("validateCompareCategoryIntegrity import", () => {
    const src = read(MODAL);
    expect(src).toMatch(/validateCompareCategoryIntegrity/);
    expect(src).toMatch(/from ["']@\/lib\/ai\/compare-review-engine["']/);
  });

  it("카테고리 가드 결과 산출(compareMode)", () => {
    const src = read(MODAL);
    expect(src).toMatch(/compareMode/);
  });

  it("blocked/mixed 시 자동 fetchAnalysis 차단(direct 만 자동)", () => {
    const src = read(MODAL);
    // useEffect 자동 호출이 가드 통과(direct) 조건에 묶임
    expect(src).toMatch(/compareMode === ["']direct["']/);
  });

  it("'그래도 분석' 수동 우회 + 경고 노출(과차단 회피)", () => {
    const src = read(MODAL);
    expect(src).toMatch(/그래도 분석|그대로 분석|강제 분석/);
    expect(src).toMatch(/용도가 다른|카테고리|비교 결과가 부정확/);
  });
});

describe("§11.318 1d-2 — 엔진 회귀 0", () => {
  it("validateCompareCategoryIntegrity 시그니처/compareMode 보존", () => {
    const src = read(ENGINE);
    expect(src).toMatch(/export function validateCompareCategoryIntegrity/);
    expect(src).toMatch(/compareMode:\s*CompareMode/);
    expect(src).toMatch(/"direct"|"mixed_warning"|"blocked"/);
  });
});
