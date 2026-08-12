/**
 * §product-detail PD-flat (시안 정합) — 콘텐츠 영역 플랫 전환 가드
 *
 * 호영님 2026-06-20 결정: /products/:id 콘텐츠를 시안(추출 ImprovedPage) 플랫 스타일로 정합.
 *   범위 = `.q-embed` 콘텐츠 스코프 한정, 전역 셸 불변. 글래스모피즘(blur orb·rounded-3xl·
 *   bg-pn/80 backdrop)은 콘텐츠에서 제거, 시안 토큰(흰 카드·hairline·radius 18px·accent #2f6be0).
 *
 * 단계: P2 히어로(이 파일 현행). P3 제품사양/안전, P4 우측레일/대체품은 land 시 본 파일에 추가.
 * detail-contrast(text-slate-900 대비)·dead-button(견적함만)·canonical(getDisplaySpecs)은 불변.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DETAIL = readFileSync(
  join(__dirname, "..", "..", "app/products/[id]/page.tsx"),
  "utf8",
);

describe("§PD-flat — 콘텐츠 플랫 스코프(.q-embed)", () => {
  it("콘텐츠 컨테이너에 .q-embed 스코프 클래스(전역 셸 무영향)", () => {
    expect(DETAIL).toMatch(/max-w-7xl mx-auto q-embed/);
  });
});

describe("§PD-flat P2 — 히어로 플랫", () => {
  it("히어로 카드 = 플랫 흰 카드(글래스/blur orb 폐기)", () => {
    expect(DETAIL).toMatch(/bg-white shadow-sm rounded-\[18px\] p-6 md:p-7 border border-gray-200/);
  });
  it("히어로 blur orb 데코 제거(시안 플랫)", () => {
    // 폐기된 히어로 orb 특정 가드(브리틀 regex 회피)
    expect(DETAIL).not.toContain("w-64 h-64 bg-blue-50/30 rounded-full blur-3xl");
  });
  it("히어로 썸네일 96px + accent 그라데이션(시안 정합)", () => {
    expect(DETAIL).toMatch(/w-20 h-20 md:w-24 md:h-24 rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-slate-50/);
  });
  /* 🔁 은퇴→승계 (§product-detail-sourcing-v21 §2, 호영님 승인 2026-08-09)
   *    키 팩트 행(세로 구분선 포함)은 내부 용어 메타(출처·내부 등급) 삭제 + 위험도 단일화로 행 자체가 폐기됐다.
   *    §PD-flat 이 지키려던 것은 "플랫 대비" 이며 그 부분은 아래 회귀 it 이 계속 잠근다. */
  it("키 팩트 행 폐기 — 내부 용어 메타 0", () => {
    expect(DETAIL).not.toMatch(/label: "출처"/);
    expect(DETAIL).not.toMatch(/label: "안전 위험도"/);
  });
  it("회귀 0 — text-slate-900 대비 + 미등록 1줄 승계", () => {
    expect(DETAIL).toMatch(/font-bold text-slate-900 leading-tight/);
    expect(DETAIL).toMatch(/<PendingInfoRow[\s\S]{0,200}?product=\{product\}/);
  });
});

describe("§PD-flat — dead button 0(시안 요소 라우트 분기)", () => {
  it("비교 트레이/비교하기 미도입(/compare 부재 → 견적함만)", () => {
    expect(DETAIL).not.toMatch(/비교표 열기/);
    expect(DETAIL).not.toMatch(/비교하기/);
  });
});

describe("§PD-flat P3 — 제품사양/안전 카드 플랫", () => {
  it("좌측 콘텐츠 카드 글래스 잔재 0(spec body bg-pn/rounded-b-3xl 부재)", () => {
    // 우측 레일/대체품은 P4 전환 예정 → 전역 rounded-3xl 단언은 P4에서 추가.
    expect(DETAIL).not.toMatch(/bg-pn\/50 rounded-b-3xl/);
    expect(DETAIL).not.toMatch(/bg-pg\/30 rounded-t-3xl/);
  });
  it("제품사양/안전/사용용도 = 시안 플랫 카드(radius18·hairline)", () => {
    expect(DETAIL).toMatch(/mb-6 md:mb-8 rounded-\[18px\] border border-gray-200 bg-white shadow-sm overflow-hidden/);
    expect(DETAIL).toMatch(/rounded-\[18px\] border border-gray-200 bg-white shadow-sm p-6 md:p-8/);
  });
  /* 🔁 은퇴 (§v21 §2) — "N개 항목 확인" 배지는 폐기된 제품 사양(PD-J) 카드의 부속. 카드 소멸과 함께 계약 소멸. */
  it("제품 사양 카드 부속 배지 폐기(중복 카드 부활 차단)", () => {
    expect(DETAIL).not.toMatch(/개 항목 확인/);
  });
  it("PD-N 래퍼 indigo blur orb 제거", () => {
    expect(DETAIL).not.toContain("w-48 h-48 bg-indigo-50/20 rounded-full blur-3xl");
  });
  it("회귀 0 — §125 상세스펙 그리드/empty 보존(제품 사양 카드만 은퇴)", () => {
    expect(DETAIL).toMatch(/상세 스펙 \(Specifications\)/);
    expect(DETAIL).toMatch(/등록된 상세 스펙이 없습니다/);
  });
});

describe("§PD-flat P4 — 우측 레일 + 대체품 플랫", () => {
  it("콘텐츠 글래스 잔재 0 — rounded-3xl 전무(전 phase 완료)", () => {
    expect(DETAIL).not.toMatch(/rounded-3xl/);
  });
  it("레일 견적 카드 = 플랫 흰 카드(글래스 폐기)", () => {
    expect(DETAIL).toMatch(/bg-white shadow-sm rounded-\[18px\] p-6 md:p-8 border border-gray-200 relative overflow-hidden/);
  });
  it("주 CTA gradient 폐기 → 시안 accent #2f6be0 플랫(데스크탑·모바일)", () => {
    expect(DETAIL).not.toMatch(/from-blue-600 to-indigo-600/);
    expect(DETAIL).toMatch(/w-full py-3\.5 bg-\[#2f6be0\] hover:bg-\[#2456bd\] text-white rounded-xl/);
  });
  /**
   * 승계 (§sourcing-quote-flow v1.1 §4, 호영님 2026-08-12) — 섹션 간 여백이 `mt-6`(24px)
   * → `mt-5`(20px) 로 바뀌었다. **플랫 계약 자체(bg-white / shadow-sm / rounded-[18px] /
   * 얇은 border)는 불변**이고, 여백만 v1.1 이 소유한다.
   */
  it("대체품 섹션 카드 플랫 + 섹션 간 20px(§v1.1 §4)", () => {
    expect(DETAIL).toMatch(/bg-white shadow-sm rounded-\[18px\] p-6 md:p-8 border border-gray-200 mt-5/);
    expect(DETAIL).not.toMatch(/rounded-\[18px\] p-6 md:p-8 border border-gray-200 mt-6/);
  });
  /** §v1.1 §4 — 대체품 카드 간 12px. 값 변경 시 여기서 먼저 깨진다. */
  it("대체품 카드 간 12px(gap-3)", () => {
    expect(DETAIL).toMatch(/grid grid-cols-1 md:grid-cols-3 gap-3/);
  });
});

describe("§PD-flat P4 — dead button 0(시안 요소 실동선 배선)", () => {
  /* 🔁 은퇴→승계 (§product-detail-sourcing-v21 §7, 호영님 승인 2026-08-09 · 시안 우선)
   *    레일 1행 압축으로 stock-mini 후신(재고 조회)과 영업 문의 푸터 링크가 함께 삭제됐다.
   *    §PD-flat P4 의 계약은 "시안 요소가 dead button 이 아닐 것" — 요소를 없애면 계약은 자동 충족된다.
   *    따라서 **부활 차단**(버튼만 있고 이동 없는 형태로 되돌아오지 않을 것)으로 승계한다. */
  it("레일 보조 요소 0 — dead button 부활 차단", () => {
    // ⚠️ 본 파일의 DETAIL 은 주석 미제거본이라 `재고 조회` 문자열 부정 단언을 걸 수 없다
    //    (은퇴 사유를 적은 주석까지 매칭 → 계약이 문서를 깎는다. §refinement 서두 경고 참조).
    //    렌더 0 잠금은 주석 제거본을 쓰는 §v21 §7 "레일 보조 버튼·링크 0" 이 담당한다.
    expect(DETAIL).not.toMatch(/<button[^>]*>\s*영업 (담당자 연결|문의)/);
    expect(DETAIL).not.toMatch(/<Link href="\/dashboard\/inventory">[\s\S]{0,120}?재고 조회/);
  });
  /** 🔁 승계 (§sourcing-quote-flow v1.1 ⑥) — 이전처가 toast → 담김 캡션으로 바뀌었다. */
  it("회귀 0 — 신뢰 문구는 담김 캡션으로 이전 + 가격 대비(slate-900) 보존", () => {
    expect(DETAIL).toMatch(/견적 요청은 무료입니다/);
    expect(DETAIL).toMatch(/text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight/);
  });
});

describe("§PD-flat P5 — Cat.No 위치 · 공급가 카드 · 사양 밀도 · accent(시안 정밀)", () => {
  it("Cat.No = 제품명 바로 아래 + 복사 버튼(시안 pd-catno)", () => {
    expect(DETAIL).toMatch(/Cat\.No 를 제품명 바로 아래로/);
    expect(DETAIL).toMatch(/text-\[13px\] font-mono font-semibold text-slate-900">\{product\.catalogNumber\}/);
    expect(DETAIL).toMatch(/aria-label="카탈로그 번호 복사"/);
  });
  it("공급가 카드 = qc-state(아이콘) + qc-meta(Cat.No/납기/최소주문), '가격 정보' 제목 폐기", () => {
    expect(DETAIL).not.toMatch(/<CardTitle className="text-base font-semibold text-slate-900 mb-2">가격 정보/);
    expect(DETAIL).toMatch(/bg-\[#2f6be0\] text-white flex items-center justify-center flex-shrink-0/);
    // 🔁 §v21 §7 — qc-meta(Cat.No/납기/최소주문) 행은 레일 1행 압축으로 전량 삭제. 상태 라벨만 남는다.
    expect(DETAIL).toMatch(/견적가 안내 품목/);
  });
  it("제품 사양/상세스펙 = 시안 hairline 정의그리드(gap-px+bg-line, 셀 흰배경)", () => {
    // §PD-flat: 박스 폐기 → 시안 spec-grid(gap-px + bg-line + 셀 흰배경 + border/rounded/overflow-hidden).
    expect(DETAIL).toMatch(/grid grid-cols-1 sm:grid-cols-2 gap-px bg-gray-100 rounded-lg overflow-hidden border border-gray-100/);
    expect(DETAIL).toMatch(/flex flex-col gap-0\.5 px-4 py-3 bg-white/);
  });
  it("accent = 시안 #2f6be0(arbitrary hex)", () => {
    expect(DETAIL).toMatch(/bg-\[#2f6be0\]/);
  });
});
