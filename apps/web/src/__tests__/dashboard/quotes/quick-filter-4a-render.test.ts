/**
 * §quotes-quick-filter-4a — 빠른 필터 렌더 회귀 sentinel (P2)
 *
 * 보호: 5칩 신호등 · 내담당/마감기간 · popover 제거 일원화 · 신호등 색(amber/orange 금지)
 *       · a11y(aria-pressed/radiogroup) · canonical 파생 배선 · dead-symbol 부재.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");
const LIB_PATH = resolve(__dirname, "../../../lib/quote-management/quick-filter.ts");
const lib = readFileSync(LIB_PATH, "utf8");

describe("§quotes-quick-filter-4a P2 — 상태칩 5종(신호등)", () => {
  it("QUICK_CHIP_META 5칩 존재", () => {
    for (const k of ["deadline", "stalled", "priority", "send", "reply"]) {
      expect(page).toMatch(new RegExp(`key:\\s*"${k}"`));
    }
  });
  it("budget/arrival 칩 미도입", () => {
    expect(page).not.toMatch(/key:\s*"budget"/);
    expect(page).not.toMatch(/key:\s*"arrival"/);
  });
  it("신호등 색만(위험 red · 주의 yellow · 정보 blue) — amber/orange 금지", () => {
    // QUICK_CHIP_CLS 블록 추출
    const m = page.match(/const QUICK_CHIP_CLS = \{[\s\S]*?\} as const;/);
    expect(m).not.toBeNull();
    const cls = m![0];
    expect(cls).toMatch(/red-/);
    expect(cls).toMatch(/yellow-/);
    expect(cls).toMatch(/blue-/);
    expect(cls).not.toMatch(/amber-/);
    expect(cls).not.toMatch(/orange-/);
  });
});

describe("§quotes-quick-filter-4a P2 — 대상/기간 + a11y", () => {
  it("내 담당 토글 aria-pressed", () => {
    expect(page).toMatch(/aria-pressed=\{quickMine\}/);
    expect(page).toMatch(/내 담당/);
  });
  it("마감 기간 radiogroup + 3옵션", () => {
    expect(page).toMatch(/role="radiogroup"/);
    expect(page).toMatch(/role="radio"/);
    expect(page).toMatch(/"전체"/);
    expect(page).toMatch(/"이번 주"/);
    expect(page).toMatch(/"3일 이내"/);
  });
  it("상태 칩 aria-pressed 토글", () => {
    expect(page).toMatch(/aria-pressed=\{active\}/);
    expect(page).toMatch(/onClick=\{\(\) => toggleQuickStatus\(meta\.key\)\}/);
  });
});

describe("§quotes-quick-filter-4a P2 — 정직성 & canonical 배선", () => {
  it("정직 배지 chipCount + 비활성 0건 숨김", () => {
    expect(page).toMatch(/qfChipCount\(quickChipPool, qfState, meta\.key, qfCtx\)/);
    expect(page).toMatch(/if \(!active && count === 0\) return null/);
  });
  it("canonical 파생 predicate 배선(deriveQuote/period/mine/STATUS_PREDICATES)", () => {
    expect(page).toMatch(/deriveQuote\(qf, now\)/);
    expect(page).toMatch(/periodMatch\(quickPeriod, d\)/);
    expect(page).toMatch(/mineMatch\(qf, currentUserId\)/);
    expect(page).toMatch(/STATUS_PREDICATES\[k\]\(qf, d\)/);
  });
  it("초기화는 검색·정렬 유지(resetQuick)", () => {
    expect(page).toMatch(/const resetQuick = \(\) => \{ setQuickStatus\(new Set\(\)\); setQuickMine\(false\); setQuickPeriod\("all"\); \};/);
  });
});

describe("§quotes-quick-filter-4a P2 — popover 일원화(제거) 회귀", () => {
  it("제거된 popover 심볼 라이브 코드 부재", () => {
    // 주석 제외 라이브 참조 0 — set/use 심볼로 검증
    expect(page).not.toMatch(/setPriorityFilter/);
    expect(page).not.toMatch(/setReplyFilter/);
    expect(page).not.toMatch(/setArrivalFilter/);
    expect(page).not.toMatch(/setFilterOpen/);
    expect(page).not.toMatch(/filterActiveCount/);
    expect(page).not.toMatch(/setModeChip/);
  });
});

describe("§quotes-quick-filter-4a P2 — lib 정직성 보존", () => {
  it("chipShow = 활성 항상 노출(데드락 방지)", () => {
    expect(lib).toMatch(/if \(state\.status\.has\(id\)\) return true;/);
  });
  it("저장 0 — computePriority 파생", () => {
    expect(lib).toMatch(/computePriority/);
  });
});
