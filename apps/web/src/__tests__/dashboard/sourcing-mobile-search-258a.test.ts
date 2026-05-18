/**
 * §11.258a — 소싱 모바일 검색 UX 고도화 (우선순위 1+2+3+4+5 batch).
 *
 * 호영님 spec:
 *   1. 줌인 fix — input font-size ≥ 16px (모바일 text-base, 데스크탑 text-sm 보존)
 *   2. X 클리어 button — localQuery > 0 시 노출 + 44px touch
 *   3. 헤더 2행 분리 (방안 A) — 모바일 (<md) 검색 form 2행으로 이동.
 *      1행: LabAxis + 소싱 + 스캔 + 햄버거 / 2행: 검색바 풀너비
 *   4. 최근 검색어 dropdown — input focus + 빈 query 시 localStorage
 *      ("bioinsight-recent-searches") top 5 노출 + 개별 삭제 ✕ + 전체 삭제
 *   5. 카드 배지 잘림 — sourcing-result-row.tsx 의 chip wrapper 에서
 *      overflow-hidden 제거 + flex-wrap 추가 (3개 이상 시 줄바꿈 허용)
 *
 * 자동완성 (6) + 필터칩+정렬 (7) 은 별도 백로그 (server 의존 / 큰 scope).
 *
 * canonical truth lock:
 *   - §11.254 LabAxis + 소싱 Link 분리 보존.
 *   - §11.254b 햄버거 메뉴 5 entry 보존.
 *   - AI 라벨 스캔 button + LabelScannerModal 보존.
 *   - 검색 form submit + setLocalQuery + setSearchQuery + runSearch flow 보존.
 *   - localStorage bioinsight-recent-searches 저장 로직 (page.tsx:2001-2003) 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const PAGE_PATH = resolve(__dirname, "../../app/_workbench/search/page.tsx");
const ROW_PATH = resolve(__dirname, "../../app/_workbench/_components/sourcing-result-row.tsx");
const pageCode = safeRead(PAGE_PATH);
const rowCode = safeRead(ROW_PATH);

describe("§11.258a #1 — 검색창 모바일 줌인 차단 (font-size 16px+)", () => {
  it("§11.258a trace marker", () => {
    expect(pageCode).toMatch(/§11\.258a|11\.258a/);
  });

  it("Input font-size 모바일 16px+ (text-base or text-[16px] 분기)", () => {
    // text-base (16px default) 또는 text-[16px] 또는 text-base md:text-sm/sm:text-sm 분기.
    expect(pageCode).toMatch(/sourcing-search-input[\s\S]{0,500}(text-base|text-\[16px\])/);
  });
});

describe("§11.258a #2 — X 클리어 button", () => {
  it("X 클리어 button aria-label '검색어 지우기' 또는 '지우기'", () => {
    expect(pageCode).toMatch(/aria-label=["'](검색어\s*지우기|지우기|초기화)["']/);
  });

  it("X 클리어 button onClick → setLocalQuery + setSearchQuery 빈 값", () => {
    // 빈 string 으로 setLocalQuery + setSearchQuery 동시 호출 패턴.
    expect(pageCode).toMatch(/setLocalQuery\(["']{2}\)[\s\S]{0,200}setSearchQuery\(["']{2}\)|setSearchQuery\(["']{2}\)[\s\S]{0,200}setLocalQuery\(["']{2}\)/);
  });

  it("X 클리어 button 터치 영역 min-h-[44px] 또는 h-9+ (Apple HIG)", () => {
    // §11.258a 인근에 44px / h-9 / h-10 / h-11 / w-9+ 같이.
    expect(pageCode).toMatch(/§11\.258a[\s\S]{0,3000}(min-h-\[44px\]|min-w-\[44px\]|h-9|h-10|h-11)/);
  });
});

describe("§11.258a #3 — 모바일 헤더 2행 분리 (방안 A)", () => {
  it("모바일 한정 검색 form (md:hidden + flex 또는 sm:hidden)", () => {
    // 모바일 전용 form/검색바 wrapper — md:hidden 분기.
    expect(pageCode).toMatch(/(md:hidden|sm:hidden)[\s\S]{0,2000}(form|sourcing-search-input)/);
  });

  it("데스크탑 한정 검색 form (hidden md:flex 또는 hidden sm:flex)", () => {
    // 데스크탑 한정 form — hidden md:* 분기.
    expect(pageCode).toMatch(/hidden\s+(md:flex|sm:flex|md:block|sm:block)[\s\S]{0,2000}(form|sourcing-search-input)/);
  });
});

describe("§11.258a #4 — 최근 검색어 dropdown", () => {
  it("recent searches state hook 추가 (useState<string[]> 또는 비슷한 패턴)", () => {
    expect(pageCode).toMatch(/(recentSearches|RecentSearches|recent_searches)/);
  });

  it("최근 검색어 라벨 '최근 검색어' 또는 '최근'", () => {
    expect(pageCode).toMatch(/최근\s*검색어|최근\s*검색/);
  });

  it("전체 삭제 button '전체 삭제' 또는 '모두 지우기'", () => {
    expect(pageCode).toMatch(/전체\s*삭제|모두\s*지우기|전체\s*지우기/);
  });

  it("localStorage 키 'bioinsight-recent-searches' 보존 (저장 로직)", () => {
    expect(pageCode).toMatch(/bioinsight-recent-searches/);
  });
});

describe("§11.258a #5 — 검색 결과 카드 배지 줄바꿈 (flex-wrap)", () => {
  it("§11.258a trace marker (sourcing-result-row.tsx)", () => {
    expect(rowCode).toMatch(/§11\.258a|11\.258a/);
  });

  it("opSignals wrapper 에 flex-wrap 추가 (3개 이상 줄바꿈 허용)", () => {
    expect(rowCode).toMatch(/opSignals[\s\S]{0,500}flex-wrap|flex-wrap[\s\S]{0,500}opSignals/);
  });

  it("opSignals wrapper 의 overflow-hidden 제거 (chip 잘림 해소)", () => {
    // chip wrapper line 인근에 overflow-hidden 이 없어야.
    expect(rowCode).not.toMatch(/opSignals[\s\S]{0,300}overflow-hidden/);
  });
});

describe("§11.258a — invariant 보존", () => {
  it("§11.254 LabAxis Link href='/' 보존", () => {
    expect(pageCode).toMatch(/href=["']\/["'][\s\S]{0,300}LabAxis/);
  });

  it("§11.254 소싱 Link href='/app/search' 보존", () => {
    expect(pageCode).toMatch(/href=["']\/app\/search["']/);
  });

  it("§11.254b 햄버거 DropdownMenu 5 entry 보존 (대시보드 / 견적 / 구매 / 재고 / 설정)", () => {
    expect(pageCode).toMatch(/대시보드/);
    expect(pageCode).toMatch(/견적\s*관리/);
    expect(pageCode).toMatch(/구매\s*운영/);
    expect(pageCode).toMatch(/재고\s*관리/);
    expect(pageCode).toMatch(/href=["']\/dashboard\/settings["']/);
  });

  it("AI 라벨 스캔 button (Camera) + LabelScannerModal 보존", () => {
    expect(pageCode).toMatch(/Camera/);
    expect(pageCode).toMatch(/AI\s*라벨\s*스캔/);
    expect(pageCode).toMatch(/LabelScannerModal/);
  });

  it("data-testid='sourcing-search-input' 보존 (검색 form 시그니처)", () => {
    expect(pageCode).toMatch(/data-testid=["']sourcing-search-input["']/);
  });

  it("opSignals chip color 매핑 (green/blue/amber/neutral) 보존", () => {
    expect(rowCode).toMatch(/CHIP_STYLES/);
    expect(rowCode).toMatch(/text-(green|blue|amber)-/);
  });
});
