/**
 * #settings-billing-hero (호영님 2026-07-11) — 설정 셸 전역 재디자인 + 청구 히어로.
 *
 * 시안(설정 사용자·워크스페이스 고도화.html) 델타 중 실 React 미반영분:
 *  #1 플랜 히어로: 단색 네이비 → 네이비→블루 그라데이션(118deg) + 우상단 블루 글로우.
 *  #3 전역 배경: 흰/중앙 → 회색 캔버스 #e9edf4.
 *  #4 서브내비 좌측: 중앙 mx-auto 래퍼 제거 → 좌측정렬. 가드: max-w 상한으로 초광폭 가독폭 유지.
 *
 * (#2 모달구조·B1 폼토글·B2 안내문구·#5/#6 정직성은 이미 React 반영 확인 — 조치 없음.)
 * 스코프: 설정 셸 전역(청구뿐 아니라 프로필·알림·엔터프라이즈 전 탭 동일 셸).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const WEB = join(__dirname, "..", "..", "..");
const read = (rel: string): string => readFileSync(join(WEB, rel), "utf8");
const PAGE = "src/app/dashboard/settings/page.tsx";

describe("#settings-billing-hero — 전역 셸(#3/#4)", () => {
  it("#3 회색 캔버스 = bg-canvas 단일 토큰(§dashboard-surface-unify 정합, 하드코드 아님)", () => {
    const src = read(PAGE);
    // 호영님 2026-07-11 결정: 하드코드 #e9edf4 대신 bg-canvas 토큰(=#E9EEF4) 재사용 — 단일 소스 유지.
    expect(src).toContain("min-h-screen bg-canvas");
    expect(src).not.toContain("bg-[#e9edf4]");
  });
  it("#4 메인 래퍼 중앙 mx-auto 제거(좌측정렬) + 가독폭 상한", () => {
    const src = read(PAGE);
    expect(src).not.toContain('max-w-7xl mx-auto px-4 sm:px-6 py-6'); // 구 중앙래퍼 제거
    expect(src).toContain('max-w-[1600px] px-4 sm:px-6 py-6'); // 좌측 + 상한(가드1)
  });
});

describe("#settings-billing-hero — 플랜 히어로 그라데이션(#1)", () => {
  it("네이비→블루 118deg 그라데이션", () => {
    expect(read(PAGE)).toContain("linear-gradient(118deg,#0e1830_0%,#1b3568_52%,#2a5fb0_100%)");
  });
  it("우상단 블루 글로우(radial)", () => {
    expect(read(PAGE)).toContain("radial-gradient(120%_120%_at_88%_8%,rgba(59,130,246,0.40)_0%,rgba(59,130,246,0)_52%)");
  });
  it("히어로 단색 bg-slate-900 카드 제거(그라데이션 대체)", () => {
    expect(read(PAGE)).not.toContain('border-0 bg-slate-900 text-white overflow-hidden relative');
  });
});

describe("#settings-billing-hero — 이미 반영분 회귀 가드(모달·정직성)", () => {
  it("B1: 결제 모달 조건부 렌더 보존(hidden-attr 동시노출 버그 없음)", () => {
    expect(read(PAGE)).toContain('paymentMethod === "card" ?');
  });
  it("정직성: 카드 등록 fake save 없음(PG handoff 안내 유지)", () => {
    const src = read(PAGE);
    expect(src).toContain("PG 보안 결제");
    expect(src).toContain("break-keep"); // B2 안내 word-break 유지
  });
  it("실데이터: /api/billing 배선 보존(DEMO 하드코딩 아님)", () => {
    expect(read(PAGE)).toContain('"/api/billing"');
  });
});
