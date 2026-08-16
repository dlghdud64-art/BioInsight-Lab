// @vitest-environment node
//
// 🛑 이 파일만 node 환경이다. 프로젝트 기본값은 jsdom(vitest.config.ts:19).
//    아래 "잠그지 못하는 것" describe 가 `typeof document === "undefined"` 로
//    **입력원이 소스 문자열 하나임을 런타임 사실로 잠그기** 때문이다.
//    jsdom 에서는 document 가 항상 존재해 그 단언이 영구 RED 가 된다.
//    (2026-08-16 실측: 격리 러너 26/26 GREEN ↔ 프로젝트 러너 25/26 —
//     환경 기본값 차이였다. 게이트는 **프로젝트 러너 기준**이 정본이다.)
/**
 * §analytics-tabs — 지출 분석 탭 개선 COMP 적합성 게이트 (**축 C 배선**)
 *
 * 🛑 이 파일이 잠그는 것은 **제품 소스**다. 시안이 아니다.
 *    actual = `apps/web/src/app/dashboard/analytics/page.tsx` 의 **authored 문자열**.
 *
 *   ┌ 축 A — fixture 자기 무결성 ─────────────────────── analytics-tabs-comp-conformance.test.ts
 *   ├ 축 B — fixture ↔ 시안 실렌더 ──────────────────── 같은 파일 (74134b1a)
 *   └ 축 C — fixture ↔ **제품 소스** ─────────────────── 이 파일 (2026-08-16 배선)
 *
 * 🛑 **anchor 를 검사 기준으로 쓰지 않는다.** (CLAUDE.md §Sentinel — fixture 필드 지위)
 *    `anchor` · `현행` · `_주의` 는 **구현 전 위치 서술**이다. 구현이 끝나면 stale 이
 *    정상이고, 그걸 갱신하면 fixture 가 구현을 따라가 **영구 GREEN** 이 된다.
 *    검사 기준은 `expect` · `expect_text` · `expect_NOT` 뿐이다.
 *    (구 anchor 문자열은 **역계약 재료**로만 쓴다 — R1 · S10 이 실제로 그렇게 쓴다.)
 *
 * 🛑 **명세값과 Tailwind 유틸은 문자열이 다르다.** fixture `expect` 를 그대로 grep 하면
 *    20슬롯 중 8건이 **조용히 통과**한다(검사 0 인 채 GREEN 에 포함). 그 8건이
 *    `SPEC_TO_TW` 다. 매핑 없는 슬롯은 skip 이 아니라 **실패**로 떨어뜨린다 —
 *    커버리지 구멍이 GREEN 으로 위장되는 것이 이 트랙이 S14 에서 겪은 형태다.
 *
 * 🛑 **border-width 는 authored 로만 검사한다.** 렌더 computed 는 2.5px 를 2px 로
 *    스냅한다(fixture `_측정층`). 축 C 는 소스 문자열이라 이 문제가 원천 소멸한다 —
 *    그게 이 축이 그 슬롯을 잠글 수 있는 유일한 자리다.
 *
 * 잠그는 것    : 20슬롯의 authored 토큰·구조·역계약이 page.tsx 에 실재한다
 * 잠그지 못하는 것:
 *   - **렌더 박스**. `after:h-11` 이 있다고 히트 영역이 44px 인 보장은 없다(leading 간섭)
 *   - **정렬**. `-mb-px` 가 있다고 밑줄이 컨테이너 보더를 덮는 보장은 없다
 *   → 위 2건은 실브라우저 실측 몫이다. 이 파일 GREEN 을 '화면 정합' 으로 읽지 말 것.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * 게이트 자기검증 — 변이 9종 전부 RED 확인 · 오탐 0
 *   (2026-08-16 · 격리 /tmp vitest 3.1.1 · 호영님 node_modules 미오염 · 바이트 복원 일치)
 *
 *   무변이 baseline                                  → 🟢 GREEN 26/26
 *   ① gap-[22px] → gap-[20px]                        → 🔴 RED  S2
 *   ② 선택 분기 font-bold → font-semibold             → 🔴 RED  S3
 *   ③ border-b-[2.5px] → border-b-2                  → 🔴 RED  S3
 *   ④ disabled:bg-[#e2e8f0] 삭제                      → 🔴 RED  S8
 *   ⑤ 사유 <p> 에 title= 주입                          → 🔴 RED  S9
 *   ⑥ tabs 에서 team 원소 삭제                         → 🔴 RED  S13
 *   ⑦ role="tab" → data-role="tab"                   → 🔴 RED  S15
 *   ⑧ after:h-11 → after:h-10                        → 🔴 RED  S17
 *   ⑨ CHECKS 에서 슬롯 1건 제거                        → 🔴 RED  커버리지 앵커
 *   원복 후                                           → 🟢 GREEN · 오탐 0
 *
 * 🔴 1차 프로브에서 **단언 결함 3건** 검출 — 구현 결함이 아니라 이 파일의 결함이었다.
 *    ②·⑤·⑦ 이 GREEN 으로 통과했고, 수정 후 재실증해 9/9 로 올렸다.
 *      ② 배지 span 의 `font-bold` 가 대신 매칭 → 선택 분기를 **한 덩어리 정규식**으로 묶어 해소
 *      ⑤ 창을 버튼에만 열어 사유 노드의 title 회귀를 놓침 → `W_REASON` 검사 추가
 *      ⑦ `data-role="tab"` 이 `role="tab"` 을 문자열로 포함 → `(?<![\w-])` 경계 추가
 *    ⚠️ ⑦은 §Sentinel 3원칙 ① 이 이미 예고한 형태다(`disabled=` ⊂ `aria-disabled=`).
 *       조항이 있는데도 1차에서 걸렸다 — 조항은 사후 회고가 아니라 **작성 시 체크리스트**다.
 *    ⚠️ ②는 3원칙에 없던 4번째 형태다: **같은 값을 쓰는 다른 요소가 대신 매칭**한다.
 *       토큰 단위로 세지 말고 분기 단위로 묶어야 잡힌다.
 * ─────────────────────────────────────────────────────────────────────────
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import fixture from "../fixtures/analytics-tabs-comp.json";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const p = (rel: string) => join(REPO_ROOT, rel);
const PAGE = "src/app/dashboard/analytics/page.tsx";
const SRC = readFileSync(p(PAGE), "utf8");

type SpecSlot = { id: string; md: string; anchor: string };
const FIX = fixture as unknown as {
  구현_대상: string;
  sections: Record<string, { spec_slots: SpecSlot[] }>;
  spec_slots_공통: SpecSlot[];
  _앵커: { _토큰_앵커: { spec_slots_수: Record<string, number> } };
};

const allSlots = (): SpecSlot[] => [
  ...Object.values(FIX.sections).flatMap((s) => s.spec_slots),
  ...FIX.spec_slots_공통,
];

/* ── 창(window) — §Sentinel 3원칙 ② 여는 태그부터 연다 ──────────────────
 * 속성부터 열면 여는 태그 앞부분이 창 밖으로 나가고, 그 자리에 회귀가 들어와도
 * 안 잡힌다. 실제로 이 트랙에서 한 번 그 형태로 통과했다.
 */
function openTag(marker: string, tag = "<div"): number {
  const i = SRC.indexOf(marker);
  if (i < 0) throw new Error(`창 마커 없음: ${marker}`);
  const s = SRC.lastIndexOf(tag, i);
  if (s < 0) throw new Error(`여는 태그 없음: ${tag} before ${marker}`);
  return s;
}
function windowBetween(startMarker: string, endMarker: string, tag = "<div"): string {
  const s = openTag(startMarker, tag);
  const e = SRC.indexOf(endMarker, s);
  if (e < 0) throw new Error(`창 종료 마커 없음: ${endMarker}`);
  return SRC.slice(s, e);
}

/** 탭 행 — role="tablist" 여는 태그 ~ 액션 행 주석 */
const W_TABROW = windowBetween('role="tablist"', "액션 행");
/** 데스크톱 헤더 우측 액션 슬롯 — 여는 태그 ~ tablist 시작 */
const W_HEADER_RIGHT = windowBetween('hidden sm:flex sm:flex-col', 'role="tablist"');
/** 모바일 액션 행 — 여는 태그 ~ reason 렌더 직후 */
const W_ACTION_ROW = windowBetween('sm:hidden space-y-1', 'aiReportReason("mobile")');
/** AI 리포트 예시 버튼 — <button 여는 태그부터 */
const W_BTN_EXAMPLE = windowBetween("setReportModalOpen(true)", "</button>", "<button");
/** AI 리포트 생성 버튼 — <button 여는 태그부터 (헬퍼 안의 것. anomaly 탭·재시도 버튼과 구분) */
const W_BTN_GENERATE = windowBetween(
  "disabled={aiLoading || dataInsufficient}",
  "</button>",
  "<button",
);
/** tabs 배열 리터럴 */
const W_TABS_ARRAY = windowBetween("const tabs:", "];", "const tabs:");
/** 사유 인라인 1줄 */
const W_REASON = windowBetween("완료된 발주 1건 이상 필요", "</p>", "<p");

/* ── SPEC_TO_TW — 명세값 ↔ Tailwind 유틸 ───────────────────────────────
 * 🛑 이 표가 없으면 아래 8건은 grep 이 실패한다. 실패가 아니라 **검사 0** 으로
 *    끝나고 GREEN 에 포함된다. 표를 지우면 커버리지가 조용히 줄어든다.
 */
const SPEC_TO_TW: Record<string, string> = {
  // 직접 매칭(arbitrary value — 명세값이 소스에 그대로 있다)
  "gap: 22px": "gap-[22px]",
  "font-size: 13.5px": "text-[13.5px]",
  "border-bottom: 2.5px solid #2563eb": "border-b-[2.5px]",
  "color: #0f172a": "text-[#0f172a]",
  "color: #64748b": "text-[#64748b]",
  "color: #94a3b8": "text-[#94a3b8]",
  "height: 42px": "h-[42px]",
  "font-size: 11px": "text-[11px]",
  "font-size: 9.5px": "text-[9.5px]",
  // 🔴 매핑 필요 — 명세값 문자열이 소스에 없다
  "font-weight: 700": "font-bold",
  "font-weight: 500": "font-medium",
  "margin-bottom: -1px": "-mb-px",
  "gap: 8px": "gap-2",
  "grid-template-columns: 1fr 1fr": "grid-cols-2",
  "background: #ffffff": "bg-white",
  "border-bottom: 1px solid #e2e8f0": "border-b border-[#e2e8f0]",
  "hit-area: 44px": "after:h-11",
  "border-radius: 99px": "rounded-full",
};
const tw = (spec: string): string => {
  const v = SPEC_TO_TW[spec];
  if (!v) throw new Error(`SPEC_TO_TW 매핑 없음: "${spec}" — 매핑을 추가할 것(skip 금지)`);
  return v;
};

/* ── 슬롯별 검사 ────────────────────────────────────────────────────────
 * 🛑 키는 fixture spec_slots 의 id 와 **양방향 일치**해야 한다.
 *    누락 = RED (아래 커버리지 앵커). 검사 없는 슬롯을 GREEN 으로 흘리지 않는다.
 */
const CHECKS: Record<string, () => void> = {
  /* 1a — 회귀 금지 */
  "R1-현행-한행-5개-회귀금지": () => {
    expect(W_TABROW).not.toMatch(/overflow-x-auto/);
    expect(W_TABROW).not.toMatch(/scrollbar-hide/);
    expect(W_TABROW).not.toMatch(/AI 리포트/);
    expect(W_TABROW).not.toMatch(/ml-auto/);
  },

  /* 1b — 모바일 */
  "S1-tab-style-underline-mobile": () => {
    expect(W_TABROW).not.toMatch(/rounded-lg/);
    expect(W_TABROW).not.toMatch(/bg-blue-600/);
    expect(W_TABROW).not.toMatch(/bg-pn border border-bd/);
    expect(W_TABROW).toContain(tw("border-bottom: 2.5px solid #2563eb"));
  },
  "S2-tab-row-container": () => {
    expect(W_TABROW).toContain(tw("gap: 22px"));
    expect(W_TABROW).toContain(tw("border-bottom: 1px solid #e2e8f0"));
    expect(W_TABROW).not.toMatch(/overflow-x-auto|snap-x/);
  },
  "S3-tab-selected-token": () => {
    expect(W_TABROW).toContain(tw("font-size: 13.5px"));
    // 🛑 선택 분기를 **한 덩어리**로 묶는다. 토큰을 따로 세면 배지의 font-bold 가
    //    대신 매칭돼 선택 분기가 깨져도 통과한다(프로브 ② 실측).
    expect(W_TABROW).toMatch(
      new RegExp(
        `border-b-\\[2\\.5px\\] border-\\[#2563eb\\] ${tw("font-weight: 700")} ` +
          `text-\\[#0f172a\\]`,
      ),
    );
    expect(W_TABROW).toContain(tw("color: #0f172a"));
    expect(W_TABROW).toContain(tw("margin-bottom: -1px"));
    // 🛑 authored 검사. 렌더 computed(2px)로 검사하면 영구 RED — fixture _측정층
    expect(W_TABROW).toMatch(/border-b-\[2\.5px\]/);
    expect(W_TABROW).not.toMatch(/border-b-2(?![.\d])/);
  },
  "S4-tab-unselected-token": () => {
    expect(W_TABROW).toContain(tw("font-weight: 500"));
    expect(W_TABROW).toContain(tw("color: #64748b"));
  },
  "S5-tab-nodata-token": () => {
    expect(W_TABROW).toContain(tw("color: #94a3b8"));
    // 🛑 토큰 단위로는 부족하다 — 같은 창의 **A1 배지**가 `text-[#94a3b8]` 를 쓰므로
    //    noData 분기를 통째로 지워도 배지가 대신 매칭해 GREEN 이 뜬다(2026-08-16 프로브 실측).
    //    §Sentinel 3원칙 ④(같은 값을 쓰는 다른 요소가 대신 매칭) — **분기 단위로 묶는다.**
    //    ②(font-bold ⊂ 배지)와 같은 형태이며, 그 수정이 S5 에는 안 적용돼 있었다.
    expect(W_TABROW).toMatch(
      /noData[\s\S]{0,40}?\?\s*"font-medium text-\[#94a3b8\] hover:text-\[#64748b\]"/,
    );
    expect(W_TABROW).toMatch(/anomaly/);
    // 클릭 허용 — 탭 button 에 실 disabled 0 (aria-disabled 는 별개, §3원칙 ① 경계)
    expect(W_TABROW).not.toMatch(/(?<!aria-)disabled=/);
    // 탭 내부 빈 상태 안내는 소스 전역에 실재
    expect(SRC).toMatch(/이상 지출 감지가 활성화되지 않았습니다/);
    // 활성 조건이 빈 상태 문구와 같은 derive 를 쓴다(canonical 단일 출처)
    expect(SRC).toMatch(/const anomalyActive = recent90dCount >= 10/);
  },
  "S6-action-row-split": () => {
    expect(W_ACTION_ROW).toContain(tw("grid-template-columns: 1fr 1fr"));
    expect(W_ACTION_ROW).toContain(tw("gap: 8px"));
    expect(W_BTN_EXAMPLE).toContain(tw("height: 42px"));
    expect(W_BTN_GENERATE).toContain(tw("height: 42px"));
    // 액션 행은 탭 행 밖이다
    expect(W_TABROW).not.toMatch(/grid-cols-2/);
  },
  "S7-btn-example-token": () => {
    expect(W_BTN_EXAMPLE).toContain(tw("background: #ffffff"));
    expect(W_BTN_EXAMPLE).toContain("border-[#e2e8f0]");
    expect(W_BTN_EXAMPLE).toContain("text-[#475569]");
  },
  "S8-btn-generate-disabled-token": () => {
    expect(W_BTN_GENERATE).toContain("disabled:bg-[#e2e8f0]");
    expect(W_BTN_GENERATE).toContain("disabled:text-[#94a3b8]");
    // 구 처리(흐리게)는 명시 토큰이 아니다 — 치환 대상이었다
    expect(W_BTN_GENERATE).not.toMatch(/disabled:opacity-60/);
  },
  "S9-disabled-reason-inline": () => {
    expect(W_REASON).toContain("AI 리포트 생성 · 완료된 발주 1건 이상 필요");
    expect(W_REASON).toContain(tw("font-size: 11px"));
    expect(W_REASON).toContain(tw("color: #94a3b8"));
    expect(W_REASON).toContain("text-right");
    // 툴팁 의존 0 — 사유는 화면 문구다. 버튼과 **사유 노드 양쪽**을 잡는다
    // (프로브 ⑤ 실측 — 창을 버튼에만 열면 사유 노드의 title 회귀를 놓친다)
    expect(W_BTN_GENERATE).not.toMatch(/\btitle=/);
    expect(W_REASON).not.toMatch(/\btitle=/);
    expect(SRC).not.toMatch(/리포트 생성에 최소 1건의 완료된 발주 데이터가 필요합니다/);
    // em dash 금지(화면 노출 문구)
    expect(W_REASON).not.toMatch(/—/);
  },
  "S10-fade-hint-removed": () => {
    expect(SRC).not.toMatch(/bg-gradient-to-l from-canvas/);
    expect(W_TABROW).not.toMatch(/overflow-x-auto/);
  },
  "A1-누적시-배지-모바일": () => {
    expect(W_TABROW).toContain("누적 시");
    expect(W_TABROW).toContain(tw("font-size: 9.5px"));
    expect(W_TABROW).toContain("bg-[#f1f5f9]");
    expect(W_TABROW).toContain("py-[1.5px]");
    expect(W_TABROW).toContain(tw("border-radius: 99px"));
  },

  /* 1c — 데스크톱 */
  "S11-actions-to-header-right": () => {
    expect(W_HEADER_RIGHT).toMatch(/aiReportActions\("desktop"\)/);
    expect(W_HEADER_RIGHT).toMatch(/sm:items-end/);
  },
  "S12-tab-row-view-switch-only": () => {
    // 탭 행의 <button 은 tabs.map 산출물 1개소뿐이다
    expect((W_TABROW.match(/<button/g) ?? []).length).toBe(1);
    expect(W_TABROW).toMatch(/tabs\.map\(/);
    expect(W_TABROW).not.toMatch(/AI 리포트/);
  },
  "S13-team-tab-added": () => {
    expect(W_TABS_ARRAY).toMatch(/\{\s*id:\s*"team",\s*label:\s*"팀별 보기"/);
    // dead branch 해소 — 렌더는 이미 있었다
    expect(SRC).toMatch(/activeTab === "team" && <TeamAnalyticsView \/>/);
    // 모바일 4탭은 390px 가로 초과 → 데스크톱 전용 노출
    expect(W_TABS_ARRAY).toMatch(/desktopOnly:\s*true/);
    expect(W_TABROW).toMatch(/hidden sm:inline-flex/);
  },
  "S14-tab-style-underline-desktop": () => {
    // 단일 탭 컴포넌트. 데스크톱 전용 칩형 분기가 없어야 한다
    expect(W_TABROW).not.toMatch(/sm:rounded|sm:bg-blue-600|sm:bg-\[#2563eb\]/);
    expect(W_TABROW).not.toMatch(/rounded-lg/);
    // 1b 와 같은 밑줄 토큰을 그대로 쓴다
    expect(W_TABROW).toContain(tw("border-bottom: 2.5px solid #2563eb"));
  },
  "A1-누적시-배지-데스크톱": () => {
    // 배지는 단일 렌더다 — 모바일/데스크톱 분기 복제 0
    expect((W_TABROW.match(/누적 시/g) ?? []).length).toBe(1);
    expect(W_TABROW).toContain(tw("font-size: 9.5px"));
  },

  /* 공통 */
  "S15-tab-role-aria": () => {
    // 🛑 접두사 경계 필수 — `data-role="tab"` 이 `role="tab"` 을 문자열로 포함한다
    //    (프로브 ⑦ 실측. §Sentinel 3원칙 ① `disabled=` ⊂ `aria-disabled=` 와 동형)
    expect(W_TABROW).toMatch(/(?<![\w-])role="tablist"/);
    expect(W_TABROW).toMatch(/(?<![\w-])role="tab"/);
    expect(W_TABROW).toMatch(/aria-selected=\{selected\}/);
  },
  "S16-btn-aria-disabled-describedby": () => {
    expect(W_BTN_GENERATE).toMatch(/aria-disabled=/);
    expect(W_BTN_GENERATE).toMatch(/aria-describedby=/);
    // 실 disabled 도 함께 살아 있어야 한다 (§3원칙 ① — aria- 가 대신 매칭되지 않게)
    expect(W_BTN_GENERATE).toMatch(/(?<!aria-)disabled=\{aiLoading \|\| dataInsufficient\}/);
    // describedby 가 가리키는 id 가 실재한다
    expect(W_REASON).toMatch(/id=\{`ai-report-reason-\$\{variant\}`\}/);
  },
  "S17-hit-area-44": () => {
    expect(W_TABROW).toContain(tw("hit-area: 44px"));
    expect(W_BTN_EXAMPLE).toContain(tw("hit-area: 44px"));
    expect(W_BTN_GENERATE).toContain(tw("hit-area: 44px"));
    expect(W_TABROW).toMatch(/touch-manipulation/);
    // 시각 42px 과 터치 44px 을 분리해서 md 내부 충돌을 만족시킨다
    expect(W_BTN_GENERATE).toContain(tw("height: 42px"));
    expect(W_BTN_GENERATE).toMatch(/after:content-\[''\]/);
  },
};

/* ═══════════════════════════════════════════════════════════════════════ */

describe("§analytics-tabs 축 C — 입력 앵커", () => {
  it("구현 대상 파일이 실재하고 fixture 가 같은 파일을 가리킨다", () => {
    expect(existsSync(p(PAGE))).toBe(true);
    expect(FIX.구현_대상).toBe("apps/web/src/app/dashboard/analytics/page.tsx");
    expect(SRC.length).toBeGreaterThan(1000);
  });

  it("🛑 anchor 는 이미 stale 하다 — 검사 기준으로 쓸 수 없음이 실증된다", () => {
    // anchor 는 **구현 전 위치 서술**이다. 구현이 끝났으므로 가리키던 문자열이
    // 소스에 없는 것이 정상 종료 상태다. 아래 3건이 그 실증이다.
    //
    // 🛑 이 it 이 RED 로 바뀌는 유일한 경로는 **누군가 anchor 를 구현에 맞춰
    //    갱신했을 때**다. 그 순간 fixture 는 정본에서 기록으로 강등되고
    //    축 C 는 영구 GREEN 이 된다. 갱신 금지의 기계적 잠금이 이 it 이다.
    const staleByDesign = [
      "flex items-center gap-1.5 overflow-x-auto", // S2 anchor — 구 탭 행 컨테이너
      "title={dataInsufficient ?", // S9 anchor — 구 툴팁
      "disabled:opacity-60", // S8 _주의 — 구 흐리게 처리
    ];
    for (const s of staleByDesign) expect(SRC).not.toContain(s);
    // 그리고 그 구 문자열들은 fixture 에 **보존**돼 있어야 한다(역계약 재료)
    const fixtureText = JSON.stringify(fixture);
    expect(fixtureText).toContain("overflow-x-auto");
    expect(fixtureText).toContain("disabled:opacity-60");
  });
});

describe("§analytics-tabs 축 C — 커버리지 앵커 (매핑 없는 슬롯은 실패)", () => {
  it("슬롯 20건 — 분포 1a 1 · 1b 11 · 1c 5 · 공통 3", () => {
    const n = FIX._앵커._토큰_앵커.spec_slots_수;
    expect(FIX.sections["1a"].spec_slots.length).toBe(n["1a"]);
    expect(FIX.sections["1b"].spec_slots.length).toBe(n["1b"]);
    expect(FIX.sections["1c"].spec_slots.length).toBe(n["1c"]);
    expect(FIX.spec_slots_공통.length).toBe(n["공통"]);
    expect(allSlots().length).toBe(n["합"]);
    expect(allSlots().length).toBe(20);
  });

  it("🛑 CHECKS ↔ fixture 슬롯 id 양방향 일치 — 검사 없는 슬롯 0 · 유령 검사 0", () => {
    const fixtureIds = allSlots().map((s) => s.id).sort();
    const checkIds = Object.keys(CHECKS).sort();
    // 검사가 빠진 슬롯 = 커버리지 구멍. skip 이 아니라 RED 로 떨어뜨린다
    expect(checkIds).toEqual(fixtureIds);
  });

  it("SPEC_TO_TW — 매핑 표가 살아 있다(18건). 지우면 검사가 조용히 준다", () => {
    expect(Object.keys(SPEC_TO_TW).length).toBe(18);
    // 매핑 없는 명세값을 요구하면 skip 이 아니라 throw
    expect(() => tw("존재하지-않는-명세값")).toThrow(/SPEC_TO_TW 매핑 없음/);
  });
});

describe("§analytics-tabs 축 C — 20슬롯 대조 (fixture expect ↔ page.tsx authored)", () => {
  for (const slot of allSlots()) {
    it(`${slot.id} — ${slot.md.slice(0, 60)}`, () => {
      const run = CHECKS[slot.id];
      if (!run) expect.fail(`슬롯 검사 미등록: ${slot.id} — CHECKS 에 추가할 것(skip 금지)`);
      run();
    });
  }
});

describe("§analytics-tabs 축 C — 잠그지 못하는 것 (등급 한계 명시)", () => {
  it("🛑 렌더 박스·정렬은 이 축이 잠그지 않는다 — actual 은 소스 문자열뿐이다", () => {
    // after:h-11 이 있다고 히트 영역이 44px 인 보장이 없고(leading 간섭),
    // -mb-px 가 있다고 밑줄이 컨테이너 보더를 덮는 보장이 없다.
    // 이 단언은 '없음' 을 잠근다 — 이 파일의 입력원이 소스 1개임을 고정한다.
    // 실측 배선 시 **별도 파일**로 낼 것. 여기에 섞으면 축이 뒤섞인다.
    //
    // 🛑 자기 파일을 읽어 문자열을 grep 하지 않는다. 검사식 자체가 그 문자열을
    //    포함해 **자기가 자기를 잡는다** (75fcbdac '가드가 자기를 잡았다' 와 동형).
    //    런타임 사실로 잠근다.
    expect(typeof (globalThis as unknown as { document?: unknown }).document).toBe("undefined");
    expect(typeof (globalThis as unknown as { window?: unknown }).window).toBe("undefined");
    // 입력원은 page.tsx 소스 문자열 하나다 — 렌더 스냅샷은 축 B 몫이다
    expect(typeof SRC).toBe("string");
    expect(SRC).toContain("export default function AnalyticsPage");
  });
});
