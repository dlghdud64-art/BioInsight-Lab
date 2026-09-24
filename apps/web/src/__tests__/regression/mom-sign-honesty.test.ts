/**
 * §mom-sign-honesty (2026-09-24 · 호영님 P1) · **증감은 글자에 있어야 한다. 아이콘에만 두지 않는다.**
 *
 * ── 왜 ──
 * 모바일 대시보드 예산 카드가 `전월 대비 {Math.abs(mom)}%` 로 찍었다. 부호를 지우고 방향을
 * **아이콘과 색에만** 뒀다. 동료 세션 prod 실측(2026-09-23 · 390px iframe · 이번 달 ₩0 · 초록 하향 아이콘):
 * 문구는 「전월 대비 100.0%」 였고, 숫자만 읽으면 **「100% 증가」 로 읽힌다.**
 * 아이콘을 못 보는 경우(스크린리더 · 색각 · 작은 화면 · 캡처 텍스트)엔 방향이 통째로 사라진다.
 *
 * ── 이 파일이 지키는 명제 ──
 *   ① 증감 문구에 방향이 **글자로** 있다 (감소/증가) — 절댓값 단독 표기 0
 *   ② 색·아이콘은 **보조**로 남는다 (중복은 해가 없다 · 기존 §dashboard-mobile-refine 핀 보존)
 *
 * ── 형제 슬롯 실측 (2026-09-24 · 같은 형태 sweep) ──
 *   spend-trend-card.tsx      — 이미 부호를 붙인다(`momChange > 0 ? "+" : ""`). 무변경.
 *   analytics-dashboard.tsx   — 문장에 방향이 있다(「… 줄었습니다」 · 「… 증가했습니다」). 모호하지 않다. 무변경.
 *   executive-dashboard.tsx:181 — **같은 결함**(절댓값 + 아이콘 방향). 그러나 렌더 도달 0
 *     (`ExecutiveDashboard` 를 렌더하는 곳이 없다). 이 파일은 그 자리를 단언하지 않는다 —
 *     되살아나면 그때 같은 규칙을 적용한다(별건 큐).
 *
 * ── 자기 한계 ──
 *   1. 방향 표기 규칙을 **전역**으로 강제하지 않는다(증감을 쓰는 모든 화면 축은 더 넓다).
 *      이 파일은 모바일 대시보드 예산 카드 한 자리만 본다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const SRC = join(__dirname, "..", "..");
const MOBILE = "components/dashboard/mobile-dashboard-view.tsx";
const code = (rel: string) => stripComments(readFileSync(join(SRC, rel), "utf8"));

/** 증감 블록 — hasMom 분기의 여는 태그부터 닫는 div 까지(창은 요소 블록으로) */
function momBlock(): string {
  const src = code(MOBILE);
  const at = src.indexOf("{hasMom && (");
  const end = src.indexOf("</div>", src.indexOf("전월 대비", at));
  return at < 0 || end < 0 ? "" : src.slice(at, end);
}

describe("§mom-sign-honesty · 증감 방향은 글자에 있다", () => {
  it("① 방향이 글자로 있다 · 절댓값 단독 표기 0", () => {
    const block = momBlock();
    expect(block.length).toBeGreaterThan(0);
    expect(block).toMatch(/전월 대비 \{Math\.abs\(mom\)\.toFixed\(1\)\}% \{momDown \? "감소" : "증가"\}/);
    // 옛 형태(절댓값 뒤에 바로 닫히는 문구)가 돌아오면 RED
    expect(block).not.toMatch(/전월 대비 \{Math\.abs\(mom\)\.toFixed\(1\)\}%\s*$/m);
  });

  it("② 색·아이콘은 보조로 남는다 (기존 핀 보존)", () => {
    const block = momBlock();
    expect(block).toMatch(/momDown \? "text-emerald-600" : "text-rose-600"/);
    expect(block).toMatch(/<TrendingDown\b/);
    expect(block).toMatch(/<TrendingUp\b/);
    // 방향을 담은 아이콘은 보조다 — 보조 표시에 방향 정보를 **독점**시키지 않았다는 뜻으로
    // ①과 짝을 이룬다(둘 다 있어야 계약이 성립한다).
  });
});
