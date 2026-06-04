/**
 * §11.364 D-1 + D-2 — 운영 바로가기 액션존↔네비존 분리 + 데코 컬러 제거
 *
 * D-1: 운영 바로가기 = 순수 네비게이션. 진입 Link + 읽기전용 건수 배지만.
 *      처리/실행 버튼·in-card expand·mutation 0. 발송 진입 동선 보존.
 * D-2: 좌측 컬러바 삭제, 아이콘 박스 무채색. 색은 상태값(§11.302)에만 —
 *      건수 배지 노랑(검토 대기), 0건 무표기.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PATH = resolve(
  __dirname,
  "../../components/dashboard/operator-quick-actions.tsx",
);
const src = readFileSync(PATH, "utf8");

describe("§11.364 D-1 — 순수 네비 (처리버튼/expand/mutation 0)", () => {
  it("4 카드 모두 Link 렌더 (특수 분기 0)", () => {
    // quotes 카드 특수 분기 제거 → 단일 ACTIONS.map Link 경로.
    expect(src).not.toMatch(/if \(action\.countKey === "quotes"\)/);
    expect(src).toMatch(/ACTIONS\.map/);
  });

  it("in-card expand / toggle / button 처리 CTA 부재", () => {
    expect(src).not.toMatch(/useState/);
    expect(src).not.toMatch(/isQuoteDispatchExpanded/);
    expect(src).not.toMatch(/<button/);
  });

  it("발송 진입 동선 보존 — 견적 발송 카드 워크벤치 href", () => {
    expect(src).toMatch(/href:\s*"\/dashboard\/quotes\?labaxisPilot=quote-dispatch"/);
    expect(src).toMatch(/label:\s*"견적 발송"/);
  });

  it("canonical truth — count display-only (mutation 0)", () => {
    expect(src).toMatch(/count display-only/);
  });
});

describe("§11.364 D-2 — 데코 컬러 제거 (색은 상태값에만)", () => {
  it("좌측 컬러바(border-l-*) 제거", () => {
    expect(src).not.toMatch(/border-l-2/);
    expect(src).not.toMatch(/border-l-(blue|emerald|yellow|purple|red)-500/);
  });

  it("TONE_MAP 데코 팔레트 제거", () => {
    expect(src).not.toMatch(/TONE_MAP/);
    expect(src).not.toMatch(/accent:\s*"border-l/);
  });

  it("아이콘 박스 무채색 (slate)", () => {
    expect(src).toMatch(/w-8 h-8 rounded-lg bg-slate-100/);
    expect(src).toMatch(/text-slate-600/);
  });

  it("건수 배지 = §11.302 노랑(검토 대기) 상태색", () => {
    expect(src).toMatch(/bg-yellow-100 text-yellow-700/);
  });

  it("amber/orange 데코 0 (§11.302)", () => {
    expect(src).not.toMatch(/(bg|text|border|from|to)-(amber|orange)-[0-9]/);
  });
});
