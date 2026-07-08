/**
 * §receiving-funnel-focus (호영님 2026-07-08, 입고 퍼널 현재집중 규칙.md)
 *
 * 라이브에서 `입고 대기 0 · 검수 대기 0 · 문서·판단 2 · 재고 반영 1` 인데 "현재 집중"이
 * 0건짜리 검수 대기(하드코딩 active:true)에 붙던 버그.
 * 규칙: 파이프라인 순서(waiting→review→blocked→posted)에서 건수>0 인 **가장 앞선**
 *   단계에만 집중. 0건 단계엔 절대 없음(흐리게). 전부 0이면 -1(집중 없음).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  RECEIVING_FUNNEL_ORDER,
  resolveReceivingFocusIndex,
} from "../receiving-list-view-model";

const f = (waiting: number, review: number, blocked: number, posted: number) => ({
  waiting,
  review,
  blocked,
  posted,
});

describe("§receiving-funnel-focus — 현재 집중 배치 규칙(.md 시나리오)", () => {
  it("파이프라인 순서 waiting→review→blocked→posted", () => {
    expect([...RECEIVING_FUNNEL_ORDER]).toEqual(["waiting", "review", "blocked", "posted"]);
  });

  it("0·0·2·1 (내 화면) → 집중 = 문서·판단(idx 2)", () => {
    expect(resolveReceivingFocusIndex(f(0, 0, 2, 1))).toBe(2);
  });
  it("2·3·1·4 → 집중 = 입고 대기(idx 0)", () => {
    expect(resolveReceivingFocusIndex(f(2, 3, 1, 4))).toBe(0);
  });
  it("5·0·0·0 → 집중 = 입고 대기(idx 0)", () => {
    expect(resolveReceivingFocusIndex(f(5, 0, 0, 0))).toBe(0);
  });
  it("0·0·0·0 → 집중 없음(-1)", () => {
    expect(resolveReceivingFocusIndex(f(0, 0, 0, 0))).toBe(-1);
  });
  it("앞 단계 0 건너뜀 — 0·0·0·3 → 재고 반영(idx 3)", () => {
    expect(resolveReceivingFocusIndex(f(0, 0, 0, 3))).toBe(3);
  });
});

describe("§receiving-funnel-focus — desktop-list 배선(하드코딩 집중 제거)", () => {
  const CMP = readFileSync(
    join(__dirname, "..", "..", "..", "components", "receiving", "receiving-desktop-list.tsx"),
    "utf8",
  );

  it("resolveReceivingFocusIndex(funnel) 소비 — 건수 기반 집중", () => {
    expect(CMP).toMatch(/resolveReceivingFocusIndex\(funnel\)/);
  });
  it("하드코딩 active:true 회귀 0", () => {
    expect(CMP).not.toMatch(/active:\s*true/);
  });
  it("0건 단계 흐리게(opacity-40)", () => {
    expect(CMP).toMatch(/opacity-40/);
  });
  it("문서·판단 집중 시 rose 톤(ring-rose-200)", () => {
    expect(CMP).toMatch(/ring-rose-200/);
  });
});
