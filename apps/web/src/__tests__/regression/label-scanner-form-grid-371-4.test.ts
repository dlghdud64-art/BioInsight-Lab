/**
 * §11.371-4 (RED→GREEN) — 입고 review 폼 모바일 1열화
 *
 * 증상(호영님 스크린샷 이미지1/5794): review 폼의 "유효기간 | 규격" 2열 그리드가
 *   375px 폭에서 충돌 → 규격 셀의 packSize 입력칸이 "C"만 보일 만큼 짜부 +
 *   type=date 유효기간 위젯 잘림. 인접 행(카탈로그/Lot, 제조사/CAS)도 동일
 *   grid-cols-2 라 같은 짜부 위험.
 *
 * Fix: review 폼 3개 grid 행을 grid-cols-1 sm:grid-cols-2 로 → 모바일 세로 스택
 *   (입력칸 full-width), 데스크탑(sm≥640px) 2열 유지(회귀 0).
 *
 * 시각 회귀는 단위테스트 한계 → sentinel(readFileSync+regex)로 반응형 클래스
 *   존재 + 데스크탑 2열 보존 + 필드 wiring 회귀 0 만 검증. 최종 진위는 ops 실검증.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}

const MODAL = "src/components/inventory/LabelScannerModal.tsx";

describe("§11.371-4 — review 폼 모바일 1열화", () => {
  it("review 폼 3행 모두 grid-cols-1 sm:grid-cols-2 (모바일 1열/데스크탑 2열)", () => {
    const src = read(MODAL);
    const matches = src.match(/grid grid-cols-1 sm:grid-cols-2 gap-3/g) ?? [];
    expect(matches.length).toBe(3);
  });

  it("모바일 짜부 유발하던 grid-cols-2 단독(반응형 미적용)이 폼에서 제거됨", () => {
    const src = read(MODAL);
    // "grid grid-cols-2 gap-3" 단독(앞에 grid-cols-1 sm: 없는) 패턴 0
    expect(src).not.toMatch(/className="grid grid-cols-2 gap-3"/);
  });
});

describe("§11.371-4b — 유효기간 모바일 비대 차단 (#10 type=text 진화)", () => {
  it("유효기간 type=text(native picker 비대 원천 차단) + h-9 통일 유지", () => {
    const src = read(MODAL);
    // §10 — type=date(auto-today 버그 + native picker 비대) → type=text 전환. picker 자체가 없어
    //   appearance-none 불필요(비대 원천 0). 목표(모바일 비대 차단 + h-9 통일) 더 철저히 달성.
    expect(src).toMatch(/className="mt-1 h-9 text-sm"/);
    // EXP 입력에 type=date 잔존 0(auto-today 차단 §10)
    expect(src).not.toMatch(/expirationDate[\s\S]{0,200}type="date"/);
  });
});

describe("§11.371-4 — 회귀 0 (필드·wiring·데스크탑 보존)", () => {
  it("유효기간/규격/Lot/CAS 필드 + updateField wiring 보존", () => {
    const src = read(MODAL);
    expect(src).toMatch(/updateField\("expirationDate", e\.target\.value\)/);
    expect(src).toMatch(/updateField\("packSize", e\.target\.value\)/);
    expect(src).toMatch(/updateField\("lotNumber", e\.target\.value\)/);
    expect(src).toMatch(/updateField\("casNumber", e\.target\.value\)/);
  });

  it("규격 nested packSize+packUnit flex 구조 보존", () => {
    const src = read(MODAL);
    expect(src).toMatch(/규격 \(통 1개의 함량\)/);
    expect(src).toMatch(/<div className="flex gap-2 mt-1">/);
  });

  it("데스크탑 2열은 sm: 분기로 유지(grid-cols-1 만 단독 아님)", () => {
    const src = read(MODAL);
    expect(src).not.toMatch(/className="grid grid-cols-1 gap-3"/);
  });
});
