/**
 * §11.264g #quote-card-compact-collapse — 견적 카드 2단계 접힘/펼침 (호영님 spec 견적 모바일 #2 P1)
 *
 * 호영님 spec:
 *   "견적 카드 컴팩트화 (2단계 접힘/펼침)" — 모바일 카드 정보 밀도 ~200px 누적.
 *   요약 (collapsed) = 핵심만 / 확장 (expanded) = 부가 정보 (progress + readiness + 공급사 timeline).
 *
 * 호영님 결정: 모바일 한정 (sm 이하). 데스크탑 (md+) 영향 0.
 *
 * Fix (한 batch — state + 토글 + 조건부 wrapper):
 *   (1) QuoteCard 안 per-card local state `const [isExpanded, setIsExpanded] = useState(false)`.
 *   (2) 토글 버튼 모바일 한정 (md:hidden) — readiness strip 위. aria-expanded.
 *   (3) progress bar / readiness strip / 공급사 timeline 의 wrapper className 에
 *       `${isExpanded ? "" : "hidden md:block"}` 분기 — CSS-only mutex.
 *
 * canonical truth lock:
 *   - 1-7 row (체크박스/운영 신호/제목/요청자/summary/메타/CTA) 보존 (요약 영역)
 *   - 8-10 row (progress/readiness/공급사 timeline) content 보존 — wrapper className 만 추가
 *   - data-testid 보존 (quote-request-card, sourcing-* 등)
 *   - 데스크탑 (md+) 변경 0 — 모든 row 항상 표시
 *   - §11.264i KPI 도트 + briefSheetOpen 보존
 *   - §11.264h-2 전체 선택 텍스트 링크 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.264g #1 — isExpanded state + 모바일 토글 버튼", () => {
  it("§11.264g trace marker comment 존재", () => {
    expect(page).toMatch(/§11\.264g/);
  });

  it("QuoteCard 안 isExpanded useState (default false — 모바일 collapsed)", () => {
    expect(page).toMatch(
      /const\s+\[isExpanded,\s+setIsExpanded\]\s*=\s*useState\(\s*false\s*\)/,
    );
  });

  it("토글 버튼 신규 (모바일 한정 md:hidden) — onClick setIsExpanded toggle", () => {
    // data-testid + md:hidden + setIsExpanded prev => !prev (각각 별도 검증)
    expect(page).toMatch(/data-testid="quote-card-expand-toggle"/);
    expect(page).toMatch(/setIsExpanded\(\(prev\) => !prev\)/);
    expect(page).toMatch(
      /quote-card-expand-toggle[\s\S]{0,500}md:hidden|md:hidden[\s\S]{0,500}quote-card-expand-toggle/,
    );
  });

  it("토글 버튼 aria-expanded 정합", () => {
    expect(page).toMatch(
      /aria-expanded=\{isExpanded\}/,
    );
  });

  it("토글 버튼 라벨 '자세히 보기' / '접기' 분기", () => {
    expect(page).toMatch(/isExpanded \? "접기" : "자세히 보기"/);
  });
});

describe("§11.264g #2 — 3 row 조건부 렌더 (progress / readiness / 공급사 timeline)", () => {
  it("Progress bar wrapper 에 isExpanded 분기 (모바일 collapsed 시 hidden, 데스크탑 always)", () => {
    // (quote.status === "SENT" || quote.status === "RESPONDED") && itemCount > 0 && (
    //   <div className={`mt-2.5 flex items-center gap-2 ${isExpanded ? "" : "hidden md:flex"}`} ...
    expect(page).toMatch(
      /aria-label="회신 수집 진행률"[\s\S]{0,500}\$\{isExpanded \? "" : "hidden md:flex"\}|\$\{isExpanded \? "" : "hidden md:flex"\}[\s\S]{0,500}aria-label="회신 수집 진행률"/,
    );
  });

  it("진행 단계 strip wrapper 에 isExpanded 분기 (§quotes-mgmt-enhance §1a)", () => {
    // {/* §quotes-mgmt-enhance §1a — 카드 스텝퍼 경량화 */}
    // <div className={`mt-3 pt-2.5 border-t border-bd/50 ${isExpanded ? "" : "hidden md:block"}`} aria-label="진행 단계">
    expect(page).toMatch(
      /§quotes-mgmt-enhance §1a[\s\S]{0,500}mt-3 pt-2\.5 border-t border-bd\/50\s+\$\{isExpanded \? "" : "hidden md:block"\}/,
    );
  });

  it("공급사 응답 ●●● 타임라인 은퇴 — 진행 단계 점 스텝퍼로 대체 (§quotes-mgmt-enhance §1a)", () => {
    // §1a: 시각 소음(●●●) 제거, aria-label="진행 단계" 점 스텝퍼 + 우측 회신 요약으로 대체.
    expect(page).not.toMatch(/aria-label="공급사 응답 진행"/);
    expect(page).toMatch(/aria-label="진행 단계"/);
  });
});

describe("§11.264g #3 — invariant 보존 (canonical truth)", () => {
  it("QuoteCard data-testid 보존", () => {
    expect(page).toMatch(/data-testid="quote-request-card"/);
  });

  it("displayTitle + 첫 품목명 우선 로직 보존 (§11.217 Phase 1)", () => {
    expect(page).toMatch(/const firstItem = quote\.items\[0\]/);
    // multi-line: firstItemName \n ? moreCount > 0
    expect(page).toMatch(/firstItemName[\s\S]{0,30}\?\s*moreCount > 0/);
  });

  it("운영 신호 row (상태 뱃지 + blocker + 긴급) 보존", () => {
    expect(page).toMatch(/opStatus\.label/);
    expect(page).toMatch(/signals\.blocker && \(/);
    expect(page).toMatch(/delayed && \(/);
  });

  it("CTA Button 보존 (signals.ctaLabel + ArrowRight + §11.264e onSelect ctaLabel)", () => {
    expect(page).toMatch(/\{signals\.ctaLabel\}/);
    expect(page).toMatch(/onSelect\?\.\(signals\.ctaLabel\)/);
  });

  it("Progress bar content 보존 (SENT/RESPONDED + itemCount > 0)", () => {
    expect(page).toMatch(
      /\(quote\.status === "SENT" \|\| quote\.status === "RESPONDED"\) && itemCount > 0/,
    );
    expect(page).toMatch(/role="progressbar"/);
  });

  it("Readiness strip content 보존 (READINESS_LABELS + signals.readinessStage)", () => {
    expect(page).toMatch(/READINESS_LABELS\.map\(/);
    expect(page).toMatch(/signals\.readinessStage/);
  });

  it("§quotes-mgmt-enhance §1a — 공급사 응답 ●●● mini timeline 은퇴(회귀 가드)", () => {
    // §11.227 #10c 타임라인(공급사 응답 stage 점 + waiting 파생)은 §1a 카드 스텝퍼로 대체·제거.
    //   시각 소음 재도입 방지: 은퇴한 타임라인 고유 파생/라벨 부재 확인. 진행 단계 스텝퍼로 대체(sibling it).
    expect(page).not.toMatch(/quote\.status === "SENT" && responseCount === 0/);
    expect(page).not.toMatch(/aria-label="공급사 응답 진행"/);
  });

  it("§11.264h-2 전체 선택 텍스트 링크 보존", () => {
    expect(page).toMatch(
      /selectablePending\.map\(q => q\.id\)[\s\S]{0,1500}underline-offset-2 hover:underline/,
    );
  });

  it("§11.264i briefSheetOpen + ✦ 운영 브리핑 + KPI 도트 보존", () => {
    expect(page).toMatch(
      /const\s+\[briefSheetOpen,\s+setBriefSheetOpen\]\s*=\s*useState/,
    );
    expect(page).toMatch(/aria-label="운영 브리핑 열기"/);
    // §quote-flat KPI-dedup(170222b3) — quote-kpi-scroll-dots 는 KPI 모바일 바와 함께 제거됨.
    //   '보존' 핀 → '제거 유지' 부재-lock 전환(272c/§11.374 부재-lock family 정합). briefSheetOpen·운영 브리핑은 보존.
    expect(page).not.toMatch(/data-testid="quote-kpi-scroll-dots"/);
  });

  it("§11.264j 공급사별 회신 현황 보존", () => {
    expect(page).toMatch(/공급사별 회신 현황/);
    expect(page).toMatch(/data-testid="quote-vendor-response-status"/);
  });

  it("§11.264e autoScrollToVendorSection state 보존", () => {
    expect(page).toMatch(
      /const\s+\[autoScrollToVendorSection,\s+setAutoScrollToVendorSection\]\s*=\s*useState/,
    );
  });
});
