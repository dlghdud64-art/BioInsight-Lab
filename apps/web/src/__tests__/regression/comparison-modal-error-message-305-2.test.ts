/**
 * §11.305-2 #comparison-modal-error-message — Regression sentinel
 *
 * 호영님 §11.305 §7 완료기준 잔여:
 *   AI 비교 분석(comparison-modal) 에러 표시가 실제 error(서버 원인) +
 *   하드코딩 "네트워크 상태를 확인해 주세요" 를 항상 병기 → misleading
 *   (분석 실패/권한 등인데 네트워크 문제로 오해).
 *   fix: 네트워크 단정 제거, error(실제 원인) + 일반 재시도 안내.
 *
 * 보존: error state 표시 / 다시 시도 버튼 / fetchAnalysis wiring.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const PATH = "src/app/_workbench/_components/comparison-modal.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.305-2 — 에러 메시지 misleading 제거", () => {
  it("'네트워크 상태를 확인해 주세요' 하드코딩 0 (misleading 제거)", () => {
    const src = read(PATH);
    expect(src).not.toMatch(/네트워크 상태를 확인해 주세요/);
  });

  it("실제 error(서버 원인) 표시 보존 ({error})", () => {
    const src = read(PATH);
    expect(src).toMatch(/text-red-600">\{error\}<\/p>/);
  });

  it("일반 재시도 안내로 교체 (네트워크 단정 없음)", () => {
    const src = read(PATH);
    expect(src).toMatch(/문제가 계속되면 잠시 후 다시 시도해 주세요/);
  });
});

describe("§11.305-2 — 회귀 0 (에러 UI + 재시도 wiring 보존)", () => {
  it("error && !loading 분기 보존", () => {
    const src = read(PATH);
    expect(src).toMatch(/\{error && !loading &&/);
  });

  it("다시 시도 버튼 + fetchAnalysis 보존", () => {
    const src = read(PATH);
    expect(src).toMatch(/onClick=\{fetchAnalysis\}/);
    expect(src).toMatch(/다시 시도/);
  });

  it("compare-analysis 호출 + setError(실제 원인) 보존", () => {
    const src = read(PATH);
    expect(src).toMatch(/\/api\/ai\/compare-analysis/);
    expect(src).toMatch(/setError\(e instanceof Error \? e\.message/);
  });
});
