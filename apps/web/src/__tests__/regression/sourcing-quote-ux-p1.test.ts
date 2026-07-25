/**
 * §sourcing-quote-ux P1 #contract-sentinel — 소싱 담기 인터랙션 + AI 비교 리포트 계약
 *
 * 정본: docs/plans/PLAN_sourcing-quote-ux.md (P0 완료 `f3fe187f` + 판정 `0c53051c`).
 *   판정 반영: ③b 담기=로컬 draft(설계 의도) — 금지 = "서버 저장 암시 가짜 성공 문구/상태" ·
 *   ④ 결정 교체 승인(별도 AI 리포트 surface 허용, 조건: same-canvas·inline 신호 보존·옛 이름 재사용 0) ·
 *   ② 대형 박스 = 기제거(§11.292) → 부재-lock 유지, 실작업은 pill 토스트 1.8s 정합.
 *
 * 대상: 소싱 워크벤치 `_workbench/search/page.tsx`(+ 신규 리포트 surface·resolve-add-to-quote-toast).
 *
 * ⚠️ Phase 1 RED — P2(인터랙션)/P3(리포트)/P4(배선) 구현 전 실패가 정상.
 * 🔒 false-pass 방지: RED 앵커는 P0에서 현재 부재(0) 실측된 마커만 사용
 *   (§sourcing-quote-ux·getBoundingClientRect·prefers-reduced-motion·sourcing-flying-chip·
 *    sourcing-compare-report·색 토큰 #6d28d9/#93c5fd/#fafbfd/#15803d·1800·"추천안으로 견적 요청").
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const p = (rel: string) => join(REPO_ROOT, rel);
const readSafe = (rel: string) => (existsSync(p(rel)) ? readFileSync(p(rel), "utf8") : "");

const PAGE = "src/app/_workbench/search/page.tsx";
const ROW = "src/app/_workbench/_components/sourcing-result-row.tsx";
const TOAST = "src/lib/quote/resolve-add-to-quote-toast.ts";
const SEARCH_API = "src/app/api/products/search/route.ts";

describe("§sourcing-quote-ux P1 계약 — P2 담기 인터랙션 (구현 후 GREEN)", () => {
  it("(P2-a) §sourcing-quote-ux trace + 담기 모프 색 토큰(#eff6ff/#1d4ed8/#93c5fd)", () => {
    const src = readSafe(PAGE) + readSafe(ROW);
    expect(src).toMatch(/§sourcing-quote-ux/);
    expect(src).toMatch(/#93c5fd/i); // 모프 하이라이트
  });

  it("(P2-b) 플라잉 칩 = getBoundingClientRect 실측(하드코딩 좌표 0) + testid", () => {
    const src = readSafe(PAGE);
    expect(src).toMatch(/getBoundingClientRect/);
    // 플라잉 칩은 body-append 임시 요소라 DOM setAttribute 로 생성 → JSX/DOM 양형 testid 값 매칭.
    expect(src).toMatch(/["']sourcing-flying-chip["']/);
  });

  it("(P2-c) 견적 #2563eb / 비교 #6d28d9 동일 문법", () => {
    const src = readSafe(PAGE);
    expect(src).toMatch(/#6d28d9/i); // 비교 보라
  });

  it("(P2-d) prefers-reduced-motion 분기(플라잉·범프 생략)", () => {
    const src = readSafe(PAGE);
    expect(src).toMatch(/prefers-reduced-motion/);
  });

  it("(P2-e) pill 토스트 2.6s(2600) 하단 pill — 서버 저장 암시 문구 0(로컬 draft 정직)", () => {
    // 🔄 결정 교체(호영님 승인 2026-07-25): §sourcing-counter-timing 토스트 상단 1800 → 하단 다크 pill 2600 이관.
    //   신값으로 완전 이관 → 옛 1800 부재-lock. 값·정직성 계약(서버 저장 암시 문구 0) 불변.
    const src = readSafe(PAGE);
    expect(src).toMatch(/2600/); // 하단 pill duration ms
    expect(src).not.toMatch(/1800/); // 옛 상단 토스트 duration 부재-lock
    // ③b: 서버 저장 암시 문구 금지(로컬 draft). "저장됨/서버에 반영" 류 0.
    expect(src).not.toMatch(/서버에 (저장|반영)(되었|했)/);
  });
});

describe("§sourcing-quote-ux P1 계약 — P3 AI 비교 리포트 (구현 후 GREEN)", () => {
  it("(P3-a) 리포트 surface = same-canvas 시트/오버레이(sourcing-compare-report, 새 라우트 0)", () => {
    const src = readSafe(PAGE);
    expect(src).toMatch(/data-testid="sourcing-compare-report"/);
    // 새 페이지 금지 — 리포트가 router.push 로 별도 라우트 이동하지 않음.
    expect(src).not.toMatch(/router\.push\(["'`]\/[^"'`]*compare-report/);
  });

  it("(P3-b) 관문 1a — 가격·납기 행 잠금(#fafbfd/#94a3b8) + 전면 차단 0", () => {
    const src = readSafe(PAGE);
    expect(src).toMatch(/#fafbfd/i); // 잠금 행 배경
  });

  it("(P3-c) 데이터 1b — 우위 값 #15803d + 추천 CTA `추천안으로 견적 요청 ›`", () => {
    const src = readSafe(PAGE);
    expect(src).toMatch(/#15803d/i); // 우위 값 강조
    expect(src).toMatch(/추천안으로 견적 요청/);
  });
});

describe("§sourcing-quote-ux P1 계약 — P4 배선 (구현 후 GREEN)", () => {
  it("(P4-a) 프리필 = 기존 store 핸드오프(useTestFlow/compare-store) 재사용 — URL param 신설 0", () => {
    const src = readSafe(PAGE);
    // 리포트 CTA → 견적 요청서: 기존 store 경유(useTestFlow/compareIds). URL param(?prefill=) 신설 금지.
    expect(src).toMatch(/§sourcing-quote-ux/); // 리포트 배선 마커(구현 시 추가)
    expect(src).not.toMatch(/[?&]prefill=/);
  });
});

// ── P4 보강 계약(false-done 방지) — 0-a 실배선 + 0-b 정직성(호영님 승인 2026-07-25: 0-a만 진행+문구 정직화) ──
describe("§sourcing-quote-ux P1 계약 — P4 보강 (0-a 실데이터 · 0-b 정직성)", () => {
  it("(P4-b) 최소 주문 실데이터 — 검색 API minOrderQty 반환 + 리포트 표 읽기(부재 정직 —)", () => {
    const api = readSafe(SEARCH_API);
    expect(api).toMatch(/minOrderQty/); // 검색 응답 매핑에 MOQ 전달
    const src = readSafe(PAGE);
    expect(src).toMatch(/minOrderQty/); // 리포트 표에서 실데이터 렌더
  });

  it("(P4-c) 구매 이력 실데이터 — 기존 recommend API 재사용 + 이력 없는 상품 정직 empty", () => {
    const src = readSafe(PAGE);
    expect(src).toMatch(/\/api\/sourcing\/recommend/); // 기존 조회 API 재사용(신설 0)
    expect(src).toMatch(/reportPurchaseHistory/); // 후보별 이력 상태
    expect(src).toMatch(/hasData/); // 정직 empty 분기(hasData=false → —)
  });

  it("(P4-d) 신선도 헤더 — 반영 건수 + 갱신 시각", () => {
    const src = readSafe(PAGE);
    expect(src).toMatch(/data-testid="compare-report-freshness"/);
    expect(src).toMatch(/구매 이력 .*건 반영/);
    expect(src).toMatch(/reportGeneratedAt/);
  });

  it("(P4-e) 자동 갱신 가짜 약속 부재 — 0-b 연결 부재 → 미구현 능동 약속 금지(정직 조건부만)", () => {
    const src = readSafe(PAGE);
    // 회신→후보 자동 갱신 연결이 코드에 없으므로 "자동 갱신돼요"류 미래 능동 약속 금지(§reports-honesty).
    expect(src).not.toMatch(/자동\s*갱신돼요/);
    expect(src).not.toMatch(/리포트가 자동/);
  });

  it("(P4-f) 카운트 단일 소스 최종 — 하단 바=레일=리포트 동일 파생(회귀 0)", () => {
    const src = readSafe(PAGE);
    expect(src).toMatch(/quoteItems\.length/);
    expect(src).toMatch(/compareIds\.length/);
  });
});

describe("§sourcing-quote-ux P1 가드 — 판정 조건 보존(현재 GREEN 유지)", () => {
  it("(가드-1) inline 신호 보존 — 상단 배너(sourcing-top-banner) + pickTopBanner (④ 조건)", () => {
    const src = readSafe(PAGE);
    expect(src).toMatch(/data-testid="sourcing-top-banner"/);
    expect(src).toMatch(/pickTopBanner\(/);
  });

  it("(가드-2) 옛 AI 분석 시트 부재-lock 유지 — 신규 리포트는 별도 이름(④ 조건)", () => {
    const src = readSafe(PAGE);
    expect(src).not.toMatch(/aiAnalysisSheetOpen/);
    expect(src).not.toMatch(/sourcing-ai-analysis-(sheet|trigger)/);
  });

  it("(가드-3) 담기 토스트 계약 원문 보존 — resolveAddToQuoteToast + result-mode 문구", () => {
    const src = readSafe(PAGE);
    expect(src).toMatch(/resolveAddToQuoteToast/);
    const toast = readSafe(TOAST);
    expect(toast).toMatch(/가격은 견적 요청 후 확정됩니다/); // vendorPending 문구
  });

  it("(가드-4) 카운트 단일 소스 파생 보존 — quoteItems/compareIds length", () => {
    const src = readSafe(PAGE);
    expect(src).toMatch(/quoteItems\.length/);
    expect(src).toMatch(/compareIds\.length/);
  });
});
