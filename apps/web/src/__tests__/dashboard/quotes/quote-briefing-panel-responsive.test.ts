/**
 * §11.248e #quote-briefing-panel-responsive — 호영님 P0 견적 관리 #5 Operational Briefing 패널 반응형
 *
 * 호영님 spec:
 *   - 일정 너비 이하(<1200px)에서 패널을 테이블 우측 고정이 아닌 상단/하단 이동
 *     (또는 접힘 토글) → 현재 lg (1024px)+ 우측 패널 노출, 1024-1199px 가용 너비 ↓
 *   - 패널 내부 텍스트 word-break — 어절 단위 줄바꿈 (break-keep)
 *   - "전체 상세 열기 / 닫기" 버튼 터치 영역 44px 이상 (현재 h-7 = 28px)
 *
 * 현재 상태 (Phase 0 audit):
 *   - line 2663: <div className="hidden lg:flex w-[480px] ..."> (right panel)
 *   - line 2551: <div className="lg:hidden fixed inset-0 z-40"> (mobile bottom-sheet)
 *   - line 3098: "Send to supplier" 한글화 누락 (§11.248a 잔재)
 *   - line 3103, 3105: 전체 상세 열기 / 닫기 Button h-7 (28px)
 *
 * canonical truth lock:
 *   - selectedQuote / selectedSignals / selectedOpStatus 시스템 보존
 *   - 480px width 보존 (1200px+ 에서)
 *   - mobile bottom-sheet 시스템 보존 (lg → min-[1200px] 으로 breakpoint 만 swap)
 *   - 모든 secondaryCta / tertiaryCta wiring 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.248e #1 — breakpoint 1024px → 1200px 상향 (Tailwind arbitrary)", () => {
  it("우측 Briefing 패널 hidden min-[1200px]:flex (이전 hidden lg:flex)", () => {
    // <div className="hidden min-[1200px]:flex w-[480px] ..."> 패턴
    expect(page).toMatch(
      /hidden\s+min-\[1200px\]:flex[\s\S]{0,200}w-\[480px\]/,
    );
  });

  it("Mobile bottom-sheet min-[1200px]:hidden (이전 lg:hidden)", () => {
    // <div className="min-[1200px]:hidden fixed inset-0 z-40"> 패턴
    expect(page).toMatch(
      /min-\[1200px\]:hidden\s+fixed\s+inset-0\s+z-40/,
    );
  });

  it("기존 'hidden lg:flex w-[480px]' 패턴 제거", () => {
    // 정확히 'hidden lg:flex w-[480px]' 시퀀스 0
    expect(page).not.toMatch(/hidden\s+lg:flex\s+w-\[480px\]/);
  });

  it("기존 'lg:hidden fixed inset-0' 패턴 제거", () => {
    expect(page).not.toMatch(/^\s*<div className="lg:hidden fixed inset-0/m);
  });
});

describe("§11.248e #2 — 내부 텍스트 word-break (break-keep)", () => {
  it("selectedQuote.title / selectedSignals.summary 영역 break-keep 적용", () => {
    // 패널 안 selectedQuote.title 또는 summary text 에 break-keep 클래스
    expect(page).toMatch(
      /(selectedQuote\.title|selectedSignals\.summary)[\s\S]{0,800}break-keep/,
    );
  });
});

describe("§11.248e #3 — '전체 상세 열기 / 닫기' 44px 터치 영역", () => {
  it("Briefing 패널 안 '전체 상세 열기' Button min-h-[44px] 또는 h-11", () => {
    // line 3103 근처 — Button 안 전체 상세 열기 + min-h-[44px] 또는 h-11
    expect(page).toMatch(
      /(min-h-\[44px\]|h-11)[\s\S]{0,200}전체 상세 열기|전체 상세 열기[\s\S]{0,200}(min-h-\[44px\]|h-11)/,
    );
  });
});

describe("§11.248e #4 — §11.248a 잔재 한글화 (Briefing 패널 안)", () => {
  it("Briefing 패널 Send to supplier 한글화 — 공급사에 전송", () => {
    // line 3098 잔재 — 'Send to supplier 잠김' → '공급사에 전송 잠김' 양방향 매칭
    expect(page).toMatch(/공급사에 전송/);
    // Send to supplier 영문이 page.tsx 에 0 (한글화 sweep 완료)
    expect(page).not.toMatch(/Send to supplier/);
  });
});

describe("§11.248e #5 — invariant 보존", () => {
  it("selectedQuote / selectedSignals / selectedOpStatus 시스템 보존", () => {
    expect(page).toMatch(/selectedQuote && selectedSignals && selectedOpStatus/);
  });

  it("Briefing 패널 width 480px 보존 (1200px+에서)", () => {
    expect(page).toMatch(/w-\[480px\]/);
  });

  // §11.279c — OPERATIONAL BRIEFING → 운영 브리핑 한글 swap (호영님 P2 sprint)
  it("운영 브리핑 헤더 보존 (한글, §11.279c)", () => {
    expect(page).toMatch(/운영 브리핑/);
  });

  it("closeQuoteContextRail mutation 보존", () => {
    expect(page).toMatch(/closeQuoteContextRail/);
  });

  it("§11.248e trace marker comment", () => {
    expect(page).toMatch(/§11\.248e[\s\S]{0,300}(briefing|breakpoint|1200|반응형|word-break|44px)/i);
  });
});
