/**
 * §mobile-residual-5 — 모바일 잔여 정리 5건 (호영님 핸드오프 2026-09-07)
 *
 * 시각 truth: 모바일 잔여 정리 (단독).html 1a~1e.
 *   1a 재고 ⋮ → scrim + 바텀 시트   1b 기간 행 `MM-DD ~ MM-DD · N일`
 *   1c 프리셋 `직접` 탭 + 기간 시트  1d AI 리포트 모달 flex 3단(푸터 항상 화면 안)
 *   1e 멤버 초대 역할 = 포털 0 · 인라인 listbox
 *
 * ⚠️ Phase 1 RED sentinel — 구현 전 실패가 정상.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  formatPeriodRow,
  periodDayCount,
  validateCustomRange,
  toIsoDate,
} from "@/lib/reports/period-label";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const p = (rel: string) => join(REPO_ROOT, rel);
const read = (rel: string) => readFileSync(p(rel), "utf8");

const SHEET = "src/components/ui/mobile-sheet.tsx";
const RANGE_SHEET = "src/components/ui/mobile-date-range-sheet.tsx";
const INLINE_SELECT = "src/components/ui/inline-select.tsx";
const INVENTORY = "src/app/dashboard/inventory/inventory-content.tsx";
const MOBILE_REPORT = "src/app/dashboard/reports/mobile-report-view.tsx";
const REPORT_PAGE = "src/app/dashboard/reports/page.tsx";
const ANALYTICS = "src/app/dashboard/analytics/page.tsx";
const ORG = "src/app/dashboard/organizations/[id]/page.tsx";

describe("공통 — 모바일 바텀 시트 셸 (핸들 40×4 · radius 20 · scrim 탭 닫기)", () => {
  it("mobile-sheet 존재 + scrim rgba(15,23,42,.45) + 핸들 + 스와이프 닫기", () => {
    expect(existsSync(p(SHEET))).toBe(true);
    const src = read(SHEET);
    expect(src).toMatch(/export function MobileSheet/);
    expect(src).toMatch(/export function MobileActionSheet/);
    expect(src).toMatch(/rgba\(15,23,42,(0)?\.45\)/);
    expect(src).toMatch(/rounded-t-\[20px\]/);
    expect(src).toMatch(/h-1 w-10/); // 핸들 40×4
    expect(src).toMatch(/onTouchStart/); // 핸들 스와이프
    expect(src).toMatch(/role="dialog"/);
    expect(src).not.toMatch(/@radix-ui|SheetPrimitive/); // 포털 0 — plain div
  });
});

describe("1a — 재고 ⋮ 더보기 = 바텀 시트 (모바일 드롭다운 0)", () => {
  it("모바일 utility ActionMenu 제거 → MobileActionSheet 4항목 + 활성 ⋮ 스타일", () => {
    const src = read(INVENTORY);
    expect(src).not.toMatch(/menuId="inv-content-utility-mobile"/);
    expect(src).toMatch(/MobileActionSheet/);
    expect(src).toMatch(/title="재고 작업"/);
    expect(src).toMatch(/발주 완료 건을 재고로 가져오기/);
    expect(src).toMatch(/엑셀·CSV 일괄 등록/);
    expect(src).toMatch(/Lot 조회 · 입출고 처리/);
    expect(src).toMatch(/Lot QR 라벨 출력/);
    // 열림 중 ⋮ = 블루 보더 + #eff6ff
    expect(src).toMatch(/border-blue-600 bg-\[#eff6ff\]/);
    // 데스크톱 utility 메뉴 보존
    expect(src).toMatch(/menuId="inv-content-utility-desktop"/);
  });
});

describe("1b — 기간 행 표기 `MM-DD ~ MM-DD · N일` (순수 함수)", () => {
  it("formatPeriodRow — 05-31 ~ 08-31 · 92일 (프리셋 일수와 동일 diff 규칙)", () => {
    expect(formatPeriodRow("2026-05-31", "2026-08-31")).toBe("05-31 ~ 08-31 · 92일");
    expect(formatPeriodRow("2026-08-24", "2026-08-31")).toBe("08-24 ~ 08-31 · 7일");
  });
  it("periodDayCount — end − start (일)", () => {
    expect(periodDayCount("2026-06-01", "2026-07-15")).toBe(44);
    expect(periodDayCount("2026-01-01", "2026-01-01")).toBe(0);
  });
  it("빈 기간 = API 기본(최근 1개월) 표기 · em dash 0", () => {
    expect(formatPeriodRow("", "")).toBe("최근 1개월");
    expect(formatPeriodRow("2026-05-31", "2026-08-31")).not.toMatch(/—/);
  });
  it("toIsoDate — 로컬 날짜 YYYY-MM-DD (UTC 시프트 0)", () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
  it("mobile-report-view — 기간 행은 formatPeriodRow · 한국어 월/일 표기 0", () => {
    const src = read(MOBILE_REPORT);
    expect(src).toMatch(/formatPeriodRow\(startDate, endDate\)/);
    expect(src).not.toMatch(/\$\{m\}월 \$\{d\}일/);
  });
});

describe("1c — `직접` 탭 + 기간 바텀 시트 (검증: 종료>시작 · 최대 1년)", () => {
  it("validateCustomRange — 정상/역순/1년 초과/미입력", () => {
    expect(validateCustomRange("2026-06-01", "2026-07-15")).toEqual({ ok: true });
    expect(validateCustomRange("2026-07-15", "2026-06-01").ok).toBe(false);
    expect(validateCustomRange("2026-06-01", "2026-06-01").ok).toBe(false);
    expect(validateCustomRange("2025-06-01", "2026-06-02").ok).toBe(false);
    expect(validateCustomRange("2025-06-01", "2026-06-01")).toEqual({ ok: true });
    expect(validateCustomRange("", "2026-06-01").ok).toBe(false);
    const r = validateCustomRange("2026-07-15", "2026-06-01");
    expect(r.ok === false && r.reason.length > 0).toBe(true);
  });
  it("기간 시트 — 시작/종료 2필드 + 미니 캘린더 + 적용 disabled 사유", () => {
    expect(existsSync(p(RANGE_SHEET))).toBe(true);
    const src = read(RANGE_SHEET);
    expect(src).toMatch(/export function MobileDateRangeSheet/);
    expect(src).toMatch(/기간 직접 설정/);
    expect(src).toMatch(/시작일/);
    expect(src).toMatch(/종료일/);
    expect(src).toMatch(/validateCustomRange/);
    expect(src).toMatch(/disabled=\{!valid\.ok/);
    expect(src).toMatch(/bg-\[#eff6ff\]/); // 범위 밴드
    expect(src).toMatch(/formatPeriodRow\(/); // 실시간 결과 표기
  });
  it("mobile-report-view — 세그먼트 5칸(직접 포함) · role=tab 0 · 필터에 날짜 필드 0", () => {
    const src = read(MOBILE_REPORT);
    expect(src).toMatch(/grid-cols-5/);
    expect(src).toMatch(/직접/);
    expect(src).toMatch(/MobileDateRangeSheet/);
    expect(src).toMatch(/onCustomRange/);
    expect(src).not.toMatch(/role="tab"/);
    expect(src).not.toMatch(/type="date"/);
  });
  it("page.tsx — onCustomRange 주입 → activePreset 'custom' (canonical 날짜 상태는 page 소유)", () => {
    const page = read(REPORT_PAGE);
    expect(page).toMatch(/onCustomRange=\{/);
    expect(page).toMatch(/setActivePreset\("custom"\)/);
  });
});

describe("1d — AI 지출 리포트 모달 flex 3단 (헤더 고정 · 본문 스크롤 · 푸터 항상 화면 안)", () => {
  it("모달 = 뷰포트 고정 높이 flex-col · 본문만 overflow-y-auto · 탭바(z-50) 위", () => {
    const src = read(ANALYTICS);
    const start = src.indexOf('data-testid="ai-report-modal"');
    const block = src.slice(start, start + 2600);
    expect(block).toMatch(/flex flex-col/);
    expect(block).toMatch(/100dvh/);
    expect(block).toMatch(/flex-1 min-h-0 overflow-y-auto/);
    // 시트 전체 스크롤 금지(푸터가 스크롤 영역 밖으로 밀리던 원인)
    expect(block).not.toMatch(/max-h-\[92vh\] sm:max-h-\[88vh\] overflow-y-auto/);
    const outer = src.slice(start - 400, start);
    expect(outer).toMatch(/z-\[60\]/);
    // 푸터 safe-area
    const footer = src.indexOf("예시 데이터 기준 · 실제 리포트는 발주 누적 시 생성");
    expect(src.slice(footer - 400, footer)).toMatch(/safe-area-bottom/);
  });
});

describe("1e — 멤버 초대 역할 = 인라인 listbox (포털 0)", () => {
  it("inline-select 존재 — listbox/option/aria-expanded + 키보드", () => {
    expect(existsSync(p(INLINE_SELECT))).toBe(true);
    const src = read(INLINE_SELECT);
    expect(src).toMatch(/export function InlineSelect/);
    expect(src).toMatch(/role="listbox"/);
    expect(src).toMatch(/role="option"/);
    expect(src).toMatch(/aria-expanded=\{open\}/);
    expect(src).toMatch(/"ArrowDown"/);
    expect(src).toMatch(/"ArrowUp"/);
    expect(src).toMatch(/"Enter"/);
    expect(src).toMatch(/"Escape"/);
    expect(src).toMatch(/bg-\[#eff6ff\]/); // 선택 행
    expect(src).not.toMatch(/@radix-ui|Portal|position: "fixed"/);
  });
  it("초대 모달 — Select 포털 제거 → InlineSelect 4역할(색 점 + 설명)", () => {
    const src = read(ORG);
    const start = src.indexOf("<Dialog open={inviteModalOpen}");
    const block = src.slice(start, src.indexOf("초대 링크 만들기", start));
    expect(block).toMatch(/InlineSelect/);
    expect(block).not.toMatch(/<SelectContent/);
    expect(block).toMatch(/INVITE_ROLE_OPTIONS/);
    expect(src).toMatch(/조직 설정·멤버 관리/); // ADMIN 설명
    expect(src).toMatch(/요청 승인·반려/);
    // 역할 색 점 — 승인자 퍼플 · 관리자 앰버 (전역 드롭다운 토큰)
    expect(src).toMatch(/APPROVER: "bg-\[#7c3aed\]"/);
    expect(src).toMatch(/ADMIN: "bg-\[#b45309\]"/);
  });
});
