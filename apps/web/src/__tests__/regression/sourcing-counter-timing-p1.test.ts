/**
 * §sourcing-counter-timing P1 #contract-sentinel — 카운터 표시 단일화 · 담기 타이밍/토스트 완화
 *
 * 정본: docs/plans/PLAN_sourcing-counter-timing.md (P0 Truth Lock 반영).
 *   P0 판정:
 *   - `차단 N` red = 하드 차단(공급사 없음=견적 요청 불가, request-readiness.ts:93-98) → **red 유지·무접촉**
 *     (QA-4 배지 red→yellow 완화 거부 = 정직성 역행). 무가=이미 muted·검토=이미 yellow.
 *   - 3면 카운터: 상태바 1025/1028(data-fly-target)=삭제 · 이전선택맥락 카드(…{…}건)=유지 · 하단 바 배지=단일 소스.
 *   - fly target: 상태바 삭제 → data-fly-target 하단 바 세그먼트 배지 이동.
 *
 * ⚠️ Phase 1 RED — P2(헤더 정리·하단 바 1줄·타이밍·pill) 구현 전 신규 behavior 앵커 실패가 정상.
 * 🔒 self-trip 회피: 상태바 카운터 `비교 후보 {compareIds.length}`(직접 보간) vs
 *    이전선택맥락 카드 `비교 후보 <span…>{compareIds.length}건`(nested+건) 을 정밀 구분.
 * 🔒 false-pass 방지: 신규 값 앵커는 트레이스 마커 §sourcing-counter-timing(현재 부재) 게이트로 RED 확정.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const p = (rel: string) => join(REPO_ROOT, rel);
const readSafe = (rel: string) => (existsSync(p(rel)) ? readFileSync(p(rel), "utf8") : "");

const PAGE = "src/app/_workbench/search/page.tsx";
const ROW = "src/app/_workbench/_components/sourcing-result-row.tsx";

describe("§sourcing-counter-timing P1 계약 — 신규 behavior (구현 후 GREEN)", () => {
  it("(1) 헤더 카운터 부재-lock — 상태바 직접 보간 카운터 제거(카드 nested형은 보존)", () => {
    const src = readSafe(PAGE);
    // 상태바(1025/1028) `비교 후보 {compareIds.length}` / `견적 후보 {quoteItems.length}` 직접형 제거.
    expect(src).not.toMatch(/비교 후보 \{compareIds\.length\}/);
    expect(src).not.toMatch(/견적 후보 \{quoteItems\.length\}/);
  });

  it("(3) 담기 타이밍 신값 pin — 모프 380·fly 820·hold 120·범프 520 (§트레이스 게이트)", () => {
    const src = readSafe(PAGE) + readSafe(ROW);
    expect(src).toMatch(/§sourcing-counter-timing/); // 구현 시 추가되는 트레이스 마커(현재 부재 → RED)
    expect(src).toMatch(/\b380\b/); // 모프
    expect(src).toMatch(/\b820\b/); // 플라잉 arc
    expect(src).toMatch(/\b120\b/); // hold
    expect(src).toMatch(/\b520\b/); // 범프 글로우
  });

  it("(4) 하단 다크 pill 토스트 — #0f172a · 2600 · 문구 정직", () => {
    const src = readSafe(PAGE);
    expect(src).toMatch(/견적 후보에 담았어요 · 가격은 견적 요청 후 확정/); // 신규 pill 문구
    expect(src).toMatch(/2600/); // pill duration
    expect(src).toMatch(/#0f172a/i); // 다크 pill 배경
  });

  it("(6) fly target 이동 — data-fly-target 이 하단 바 세그먼트 <Badge> 에 부여", () => {
    const src = readSafe(PAGE);
    expect(src).toMatch(/<Badge[^>]*data-fly-target="compare"/);
    expect(src).toMatch(/<Badge[^>]*data-fly-target="quote"/);
  });
});

describe("§sourcing-counter-timing P1 가드 — 보존(현재 GREEN 유지)", () => {
  it("(2) 하단 바 세그먼트 보존 — 견적함/비교함 Badge + focus key onClick", () => {
    const src = readSafe(PAGE);
    expect(src).toMatch(/setCompareFocusKey\(\(k\)/);
    expect(src).toMatch(/setQuoteFocusKey\(\(k\)/);
    expect(src).toMatch(/<Badge[^>]*>\{compareIds\.length\}<\/Badge>/);
    expect(src).toMatch(/<Badge[^>]*>\{quoteItems\.length\}<\/Badge>/);
  });

  it("(5) reduced-motion 폴백 경로 보존(이동·범프 생략 분기 기반)", () => {
    const src = readSafe(PAGE);
    expect(src).toMatch(/prefers-reduced-motion/);
  });

  it("(가드) 이전선택맥락 카드 카운터 유지 — self-trip 방지(nested+건형 보존)", () => {
    const src = readSafe(PAGE);
    expect(src).toMatch(/비교 후보 <span[^>]*>\{compareIds\.length\}건/);
    expect(src).toMatch(/견적 후보 <span[^>]*>\{quoteItems\.length\}건/);
  });

  it("(가드) 차단 N red 배지 유지 — P0 판정(하드 차단, red→yellow 완화 거부)", () => {
    const src = readSafe(PAGE);
    // §sourcing-counter-timing 은 표시 위치/타이밍만. `차단 N` red(bg-red-100/text-red-700) 은 하드 차단 → 유지.
    expect(src).toMatch(/bg-red-100 text-red-700[\s\S]{0,120}차단 \{requestReadiness\.summary\.blocked\}/);
  });
});
