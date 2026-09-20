/**
 * §dashboard-kpi-won-glyph (호영님 2026-07-02) — 재무 KPI(₩ 금액) 글리프 겹침 수정.
 *
 * 문제: StatLine 값 <p> 의 tracking-tighter(−0.05em)로 ₩ 글리프가 첫 숫자와 겹쳐
 *       "₩0" 이 취소선처럼 보임(실기기 라이브 대시보드).
 * 수정: 값 <p> tracking-normal 로 전환 → ₩·숫자 분리.
 * 회귀 0: won() 단일 진실(₩ + toLocaleString) 보존, tabular-nums·whitespace-nowrap·
 *         font-black·0건 slate-500 톤 보존.
 *
 * ── 층위 재조준 (§main-dashboard-p0-honesty · 2026-09-18) ─────────────────
 * 이 파일의 일부 단언이 **통짜 className 문자열**과 **호출식 리터럴**을 핀하고 있었다.
 * CLAUDE.md 「sentinel 은 명제를 단언한다 · 이름·문자열·바이트는 명제가 아니다」에 따라
 * 같은 명제를 토큰/블록 층위로 옮긴다. **명제는 그대로다 — 약화가 아니라 재조준이다.**
 * 판별: 구현이 계약을 어겼는가(→구현 수정) vs 검사가 구현을 못 따라갔나(→검사 수정).
 *       실측 결과 후자였다. 구현은 tracking-normal·won() 단일 진실을 계속 지킨다.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const SRC = readFileSync(
  join(REPO_ROOT, "src/components/dashboard/stat-line.tsx"),
  "utf8",
);

// §main-dashboard-p0-honesty P1-6 — 로컬 복사본을 공용 블록 창으로 교체(동작 동일).
import { blockEnclosing } from "../_helpers/block-window";

/** 값 <p> 의 className 표현식 전체 — 클래스 순서·길이에 좌우되지 않는 창. */
const valueClassBlock = (src: string) =>
  blockEnclosing(src, "font-black tracking-normal", "className={`");

describe("§dashboard-kpi-won-glyph — ₩ 글리프 겹침 수정", () => {
  it("값 <p> 는 tracking-normal (tracking-tighter 제거)", () => {
    // 명제: ₩ 글리프가 첫 숫자와 겹치지 않는다 = 값 <p> 에 음수 자간이 없다.
    expect(SRC).toMatch(/font-black tracking-normal/);
    expect(valueClassBlock(SRC)).not.toMatch(/tracking-tighter/);
  });
});

describe("§dashboard-kpi-won-glyph — 회귀 0", () => {
  it("won() 단일 진실 — 로컬 금액 포맷 0", () => {
    // 명제: 금액 문자열은 won() 만 만든다(₩ + toLocaleString 단일 진실).
    //   호출식 리터럴 `{won(it.value)}` 이 아니라 **포맷 경로가 하나뿐인가** 를 본다 —
    //   won 을 포맷터로 주입하는 형태도 같은 명제를 지킨다.
    expect(SRC).toMatch(/\bwon\b/);
    expect(SRC).not.toMatch(/toLocaleString/);
    expect(SRC).not.toMatch(/Intl\.NumberFormat/);
    expect(SRC).not.toMatch(/wonCompact/);
  });
  it("0건 slate-500 / active slate-900 톤 보존", () => {
    expect(SRC).toMatch(/active \? "text-slate-900" : "text-slate-500"/);
  });
  it("값 <p> 가 tabular-nums · whitespace-nowrap · leading-none 을 모두 갖는다", () => {
    // 토큰 3종의 **존재**가 명제(숫자 정렬·줄바꿈 억제). 나열 순서는 명제가 아니다.
    const block = valueClassBlock(SRC);
    expect(block).toMatch(/tabular-nums/);
    expect(block).toMatch(/whitespace-nowrap/);
    expect(block).toMatch(/leading-none/);
  });
});
