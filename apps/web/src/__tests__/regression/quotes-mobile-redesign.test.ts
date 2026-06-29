/**
 * §quotes-mobile-redesign — 견적 관리 모바일 리디자인 sentinel
 *
 * 호영님 P1 (2026-06-23):
 *   1. 퍼널 가로 1행 컴팩트 칩 + "발주 전환"(s5) ENABLE_PURCHASING 게이트 + 전 단계 0건 collapse.
 *   2. 모바일 카드 단일 고정 — 뷰 토글·컬럼 설정 데스크톱 전용(hidden md). effectiveViewMode.
 *   3. 필터 칩 0건 disabled 사유 노출(회색 침묵 금지). wiring은 기존 정상(setModeChip→filteredQuotes).
 *
 * 검증 2축: (A) 게이트/구조 강제, (B) 회귀 0(발주 stage 소스·MODE_CHIPS wiring 보존).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const FUNNEL = "src/components/quotes/quote-funnel.tsx";
const PAGE = "src/app/dashboard/quotes/page.tsx";

describe("§quotes-mobile-redesign — 퍼널 (A)", () => {
  it("발주 전환(s5) ENABLE_PURCHASING 게이트", () => {
    const src = read(FUNNEL);
    expect(src).toMatch(/getFlag\("ENABLE_PURCHASING"\)/);
    expect(src).toMatch(/s\.key !== "s5"/);
  });
  it("전 단계 0건 collapse — '진행 중 견적 없음' 단일 라인", () => {
    const src = read(FUNNEL);
    expect(src).toMatch(/allZero/);
    expect(src).toMatch(/진행 중 견적 없음/);
  });
  it("모바일 압축 1행 유지 / 데스크탑 리치 (§quote-funnel-sian-restore — 2행 wrap·basis 폐지 보존)", () => {
    // §quote-funnel-sian-restore — 반응형: 모바일(<md) 압축 1행 칩 보존, 데스크탑(md+) 시안 리치(chevron 복원).
    const src = read(FUNNEL);
    expect(src).toMatch(/flex md:hidden items-stretch gap-2/); // 모바일 압축 분기 보존
    expect(src).toMatch(/hidden md:flex items-stretch/); // 데스크탑 리치 분기
    expect(src).not.toMatch(/flex-wrap md:flex-nowrap/);
    expect(src).not.toMatch(/basis-\[30%\]/);
  });
});

describe("§quotes-mobile-redesign — 모바일 카드 고정 (A)", () => {
  it("isMobile matchMedia + effectiveViewMode", () => {
    const src = read(PAGE);
    expect(src).toMatch(/matchMedia\("\(max-width: 767px\)"\)/);
    expect(src).toMatch(/effectiveViewMode/);
  });
  it("뷰 토글·컬럼 설정 데스크톱 전용 (hidden md:flex)", () => {
    const src = read(PAGE);
    expect(src).toMatch(/hidden md:flex items-center justify-end/);
    expect(src).toMatch(/effectiveViewMode === "table"/);
  });
});

describe("§quotes-mobile-redesign — 필터 칩 사유 (A)", () => {
  it("0건 disabled 사유 노출 (회색 침묵 금지)", () => {
    const src = read(PAGE);
    expect(src).toMatch(/해당 0건/);
  });
});

describe("§quotes-mobile-redesign — 회귀 0 (B)", () => {
  it("발주 전환 stage 정의 보존(되살리기용)", () => {
    const src = read(FUNNEL);
    expect(src).toMatch(/label: "발주 전환"/);
    expect(src).toMatch(/key: "s5"/);
  });
  it("MODE_CHIPS / setModeChip wiring 보존", () => {
    const src = read(PAGE);
    expect(src).toMatch(/MODE_CHIPS/);
    expect(src).toMatch(/setModeChip\(isActive \? null : chip\.key\)/);
  });
  it("카드 본문 예상금액(canonical 회신가) 노출 보존", () => {
    const src = read(PAGE);
    expect(src).toMatch(/회신 \$\{responseCount\}건 \(가격 미기재\)|건 수신/);
  });
});

describe("§quotes-filter-popover — 다축 필터 popover + 빠른 필터(호영님 시안)", () => {
  it("필터 facet state(우선순위/회신상태/견적상태)", () => {
    const src = read(PAGE);
    expect(src).toMatch(/priorityFilter/);
    expect(src).toMatch(/replyFilter/);
    expect(src).toMatch(/arrivalFilter/);
  });
  it("canonical 와이어링(computePriority.level / responses / vendorRequests) — 가짜 0", () => {
    const src = read(PAGE);
    expect(src).toMatch(/priorityFilter\.includes\(computePriority\(c\)\.level\)/);
    expect(src).toMatch(/q\.vendorRequests\?\.length/);
    expect(src).toMatch(/q\.responses\?\.length/);
  });
  it("필터 popover 3 facet 그룹 라벨", () => {
    const src = read(PAGE);
    expect(src).toContain("우선순위");
    expect(src).toContain("회신 상태");
    expect(src).toContain("견적 상태");
  });
  it("초기화/적용 + 빠른 필터 라벨", () => {
    const src = read(PAGE);
    expect(src).toContain("초기화");
    expect(src).toContain("적용");
    expect(src).toContain("빠른 필터");
  });
  it("상태 Select 제거(필터 popover로 대체) — <Select 미사용", () => {
    expect(read(PAGE)).not.toMatch(/<Select\b/);
  });
});
