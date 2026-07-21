/**
 * §quotes-mobile-refine P1 #screen-3a — 견적 관리 모바일 화면 개편
 *
 * 정본: docs/plans/PLAN_quotes-mobile-refine.md + 호영님 지시문(2026-07-21) §1 견적 관리 화면(3a).
 *
 * 호영님 확정(2026-07-21):
 *   - "독려/독촉" 금지는 **이번 트랙 3 surface 한정** (데스크탑 배치 시트·ops-console lib 무접촉).
 *   - 색상 표기 규약(07-20): 지시문 앰버 계열 = warm warning = **yellow 토큰**.
 *
 * 3a 계약:
 *   ① 배너 — 품목명 1줄 + 액션 문장 1줄 분리. 대시(—) 연결 금지. "회신 독려" 금지.
 *     메타 한 줄: RFQ · 마감 D-N · 공급사 N곳 (stage section 중복 표기 제거).
 *     CTA 는 stage 별 유지(P0 판정 #6 — top 이 s1 이면 리마인더 부적합).
 *   ② 날짜 칩 — "N월 N주" 폐지 → 오늘 날짜만 `7.21 (화)` 형식.
 *   ③ 리스트 카드 — 좌측 세로 색 띠 제거(상태는 상단 pill 만). 빈 `⏱ —` 금지 →
 *     공급사 미정 = yellow 칩 + CTA `공급사 추가` / 준비 건 = 정보 + CTA 유지.
 *   ④ RFQ 코드 font-mono 금지 → Pretendard 세미볼드 + 자간 .03em.
 *   ⑤ #b45821/#fdf3ec hex(muted amber — CLAUDE.md §9 보류분의 sentinel 우회 반입) → yellow 토큰 정합.
 *
 * ⚠️ P0-G3: mobile-quotes-view 는 이전까지 참조 테스트 0건(무보호) — 본 파일이 첫 보호막.
 * ⚠️ Phase 1 RED sentinel — 구현 전 실패가 정상.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const read = (rel: string) => readFileSync(join(REPO_ROOT, rel), "utf8");
const VIEW = read("src/components/quotes/mobile-quotes-view.tsx");
const PRC = read("src/components/quotes/priority-recommendation-card.tsx");

/* ── ① 배너 ───────────────────────────────────────────────── */
describe("§quotes-mobile-refine P1 — 배너 카피 구조", () => {
  it("'회신 독려' 표현 0 (mobile view + 데스크탑 카드 라벨)", () => {
    expect(VIEW).not.toMatch(/독려|독촉/);
    expect(PRC).not.toMatch(/독려|독촉/);
  });

  it("품목 1줄 + 액션 문장 1줄 분리 — 대시 연결 문장 폐지", () => {
    expect(VIEW).not.toMatch(/— \$\{next\[top\.stage\]\}/);
    expect(VIEW).toMatch(/ACTION_LINE/);
  });

  it("액션 문장 존재 (s2 = 회신 확인 톤, 압박 어휘 0)", () => {
    expect(VIEW).toMatch(/공급사 회신을 확인할 차례예요/);
  });

  it("메타 한 줄 — stage section 중복 표기 제거", () => {
    // (구) meta 에 STAGE_META[top.stage].section 노출 → 배너/pill 과 중복. 제거.
    expect(VIEW).not.toMatch(/\{STAGE_META\[top\.stage\]\.section\}/);
    expect(VIEW).toMatch(/공급사 \{top\.totalCount\}곳/);
  });

  it("배너 CTA stage 별 유지 + '나중에' 보존 (P0 판정 #6)", () => {
    expect(VIEW).toMatch(/top\.stage === "s1" \? "견적 요청 발송"/);
    expect(VIEW).toMatch(/나중에/);
  });
});

/* ── ② 날짜 칩 ────────────────────────────────────────────── */
describe("§quotes-mobile-refine P1 — 날짜 칩", () => {
  it("'N월 N주' 주차 표기 폐지", () => {
    expect(VIEW).not.toMatch(/월 \$\{Math\.ceil/);
    expect(VIEW).not.toMatch(/periodLabel/);
  });

  it("오늘 날짜만 — `M.D (요일)` 형식", () => {
    expect(VIEW).toMatch(/todayLabel/);
    expect(VIEW).toMatch(/\["일", "월", "화", "수", "목", "금", "토"\]/);
  });
});

/* ── ③ 리스트 카드 ────────────────────────────────────────── */
describe("§quotes-mobile-refine P1 — 리스트 카드", () => {
  it("좌측 세로 색 띠 제거 (상태는 상단 pill 만)", () => {
    expect(VIEW).not.toMatch(/w-1 shrink-0/);
    expect(VIEW).not.toMatch(/rail:/);
  });

  it("빈 `⏱ —` 금지 — dd null 시 시계열 미노출", () => {
    // (구) ddText(null)="—" 를 Clock 아이콘과 함께 노출. (신) dd 없으면 행 자체 미렌더.
    expect(VIEW).not.toMatch(/if \(dd == null\) return "—"/);
    expect(VIEW).toMatch(/vm\.dd != null &&[\s\S]{0,200}<Clock/);
  });

  it("공급사 미정 = yellow 칩 (plain text 폐지)", () => {
    expect(VIEW).toMatch(/공급사 미정[\s\S]{0,60}/);
    expect(VIEW).toMatch(/bg-yellow-50 text-yellow-700[\s\S]{0,120}공급사 미정|공급사 미정[\s\S]{0,120}bg-yellow-50 text-yellow-700/);
  });

  it("공급사 미정 건 CTA = '공급사 추가' (발송 오라벨 0)", () => {
    expect(VIEW).toMatch(/공급사 추가/);
  });
});

/* ── ④ RFQ 폰트 ───────────────────────────────────────────── */
describe("§quotes-mobile-refine P1 — RFQ 코드 폰트", () => {
  it("font-mono 0 (본문 폰트 단일)", () => {
    expect(VIEW).not.toMatch(/font-mono/);
  });

  it("세미볼드 + 자간 .03em 대체", () => {
    expect(VIEW).toMatch(/tracking-\[\.03em\]/);
  });
});

/* ── ⑤ muted amber hex 정합 ───────────────────────────────── */
describe("§quotes-mobile-refine P1 — #b45821 hex → yellow 토큰 (CLAUDE.md §9 규율 복구)", () => {
  it("#b45821 / #fdf3ec hex 0", () => {
    expect(VIEW).not.toMatch(/#b45821|#fdf3ec/i);
  });

  it("s4 pill·mid 우선순위 = yellow 토큰", () => {
    expect(VIEW).toMatch(/s4:[\s\S]{0,220}bg-yellow-50 text-yellow-700/);
    expect(VIEW).toMatch(/mid:\s*\{[\s\S]{0,120}bg-yellow-50 text-yellow-700/);
  });

  it("amber/orange Tailwind class 0 (§11.302)", () => {
    expect(VIEW).not.toMatch(/(bg|text|border|border-l|from|to|ring)-(amber|orange)-\d/);
  });
});

/* ── 회귀 0 (§quote-mobile-v2 canonical·wiring 전수) ───────── */
describe("§quotes-mobile-refine P1 — 회귀 0", () => {
  it("canonical 파생 3종 보존 (toQuoteCase·computePriority·quoteDisplayRef)", () => {
    expect(VIEW).toMatch(/from "@\/lib\/quote-management\/derive"/);
    expect(VIEW).toMatch(/from "@\/lib\/quote-management\/from-quote"/);
    expect(VIEW).toMatch(/from "@\/lib\/quote-management\/quote-display-ref"/);
    expect(VIEW).toMatch(/computePriority\(c\)/);
  });

  it("액션 wiring 보존 (onSelect·onAction — dead button 0)", () => {
    expect(VIEW).toMatch(/onClick=\{\(\) => onSelect\(vm\.id\)\}/);
    expect(VIEW).toMatch(/onClick=\{\(\) => onAction\(vm\.id\)\}/);
    expect(VIEW).toMatch(/onClick=\{\(\) => onAction\(top\.id\)\}/);
  });

  it("필터 칩·카운트·aria-pressed 보존", () => {
    expect(VIEW).toMatch(/aria-pressed=\{on\}/);
    expect(VIEW).toMatch(/\{counts\[c\.k\]\}/);
  });

  it("단계 섹션 그룹핑 보존 (발송 대기 → 회신 추적 → 비교 검토 → 승인·입고)", () => {
    expect(VIEW).toMatch(/push\("발송 대기"/);
    expect(VIEW).toMatch(/push\("회신 추적"/);
    expect(VIEW).toMatch(/push\("비교 검토"/);
  });

  it("KPI 3종 파생 보존 (진행·회신 대기·마감 임박)", () => {
    expect(VIEW).toMatch(/active: vms\.length/);
    expect(VIEW).toMatch(/dueSoon: vms\.filter/);
  });

  it("빈 상태 정직 + 필터 초기화 보존", () => {
    expect(VIEW).toMatch(/견적이 없습니다/);
    expect(VIEW).toMatch(/필터 초기화/);
  });

  it("터치 타겟 보존 (배너 CTA h-11 · 필터 min-h-[40px])", () => {
    expect(VIEW).toMatch(/h-11 px-4/);
    expect(VIEW).toMatch(/min-h-\[40px\]/);
  });

  it("데스크탑 카드(PRC) 구조 무접촉 — 라벨 1건 외 변경 0", () => {
    expect(PRC).toMatch(/우선 추천/);
    expect(PRC).toMatch(/NEXT_STEP/);
    expect(PRC).toMatch(/회신 확인/);
  });
});
