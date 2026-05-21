/**
 * §11.274c #section-landmark-aria-label-korean — 5 spot section landmark
 *   aria-label 한국어 정합 lock (Phase B audit 의 P2 backlog).
 *
 * Phase B cross-surface smoke 발견:
 *   - approval workbenches (2 spot) + sourcing surfaces (3 spot) 의 section
 *     landmark aria-label 이 영문 잔존 → SR 사용자 영문 청취 → §11.142
 *     한국어 정합 lock 위반.
 *
 * Fix (minimum diff, 4 file 5 spot byte-level swap):
 *   1. quote-chain-workbenches.tsx:126 — "Quote Approval Workbench"
 *      → "견적 결재 워크벤치"
 *   2. dispatch-prep-workbench.tsx:167 — "Dispatch Preparation Workbench"
 *      → "발송 준비 워크벤치"
 *   3. _workbench/search/page.tsx:684 — "Sourcing Result Triage Mobile"
 *      → "소싱 결과 분류 (모바일)"
 *   4. _workbench/search/page.tsx:1235 — "Sourcing Result Triage"
 *      → "소싱 결과 분류"
 *   5. search/page.tsx:154 — "Sourcing Result Triage"
 *      → "소싱 결과 분류"
 *
 * 매핑 정합 (§11.142 한국어 lock):
 *   - "Quote Approval" → "견적 결재" (workspace 결재 lineage)
 *   - "Dispatch Preparation" → "발송 준비" (§11.272b/§11.274/§11.275 정합)
 *   - "Sourcing Result Triage" → "소싱 결과 분류" (한국어 검색 surface 정합)
 *   - "(Mobile)" suffix → "(모바일)" 한국어 일관
 *
 * 제외 (관용 영문 — sweep 제외):
 *   - footer "GitHub" 브랜드명
 *   - nav "Breadcrumb" HTML semantic role-like
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const QUOTE_CHAIN = readFileSync(
  resolve(__dirname, "../../components/approval/quote-chain-workbenches.tsx"),
  "utf8",
);
const DISPATCH_PREP = readFileSync(
  resolve(__dirname, "../../components/approval/dispatch-prep-workbench.tsx"),
  "utf8",
);
const WORKBENCH_SEARCH = readFileSync(
  resolve(__dirname, "../../app/_workbench/search/page.tsx"),
  "utf8",
);
const SEARCH = readFileSync(
  resolve(__dirname, "../../app/search/page.tsx"),
  "utf8",
);

describe("§11.274c #1 — 영문 잔존 0 (5 spot sweep)", () => {
  it("§11.274c trace marker 존재 (4 file 중 1+ 에서)", () => {
    const combined = QUOTE_CHAIN + DISPATCH_PREP + WORKBENCH_SEARCH + SEARCH;
    expect(combined).toMatch(/§11\.274c/);
  });

  it("quote-chain-workbenches.tsx 영문 \"Quote Approval Workbench\" 0", () => {
    expect(QUOTE_CHAIN).not.toMatch(/aria-label="Quote Approval Workbench"/);
  });

  it("dispatch-prep-workbench.tsx 영문 \"Dispatch Preparation Workbench\" 0", () => {
    expect(DISPATCH_PREP).not.toMatch(
      /aria-label="Dispatch Preparation Workbench"/,
    );
  });

  it("_workbench/search/page.tsx 영문 \"Sourcing Result Triage Mobile\" 0", () => {
    expect(WORKBENCH_SEARCH).not.toMatch(
      /aria-label="Sourcing Result Triage Mobile"/,
    );
  });

  it("_workbench/search/page.tsx + search/page.tsx 영문 \"Sourcing Result Triage\" 0", () => {
    expect(WORKBENCH_SEARCH).not.toMatch(/aria-label="Sourcing Result Triage"/);
    expect(SEARCH).not.toMatch(/aria-label="Sourcing Result Triage"/);
  });
});

describe("§11.274c #2 — 한글 aria-label 매칭 (5 spot)", () => {
  it("quote-chain-workbenches.tsx 한글 \"견적 결재 워크벤치\" 매칭", () => {
    expect(QUOTE_CHAIN).toMatch(/aria-label="견적 결재 워크벤치"/);
  });

  it("dispatch-prep-workbench.tsx 한글 \"발송 준비 워크벤치\" 매칭", () => {
    expect(DISPATCH_PREP).toMatch(/aria-label="발송 준비 워크벤치"/);
  });

  it("_workbench/search/page.tsx 한글 \"소싱 결과 분류 (모바일)\" 매칭", () => {
    expect(WORKBENCH_SEARCH).toMatch(
      /aria-label="소싱 결과 분류 \(모바일\)"/,
    );
  });

  it("_workbench/search/page.tsx 한글 \"소싱 결과 분류\" 매칭 (desktop spot)", () => {
    expect(WORKBENCH_SEARCH).toMatch(/aria-label="소싱 결과 분류"/);
  });

  it("search/page.tsx 한글 \"소싱 결과 분류\" 매칭", () => {
    expect(SEARCH).toMatch(/aria-label="소싱 결과 분류"/);
  });
});

describe("§11.274c #3 — invariant 보존 (canonical truth)", () => {
  // workbenches 는 <div role="main" aria-label=...> 패턴 (section 아님)
  it("quote-chain-workbenches.tsx role='main' landmark + aria-label 보존", () => {
    expect(QUOTE_CHAIN).toMatch(
      /role="main"[\s\S]{0,300}aria-label="견적 결재 워크벤치"/
    );
  });

  it("dispatch-prep-workbench.tsx role='main' landmark + aria-label 보존", () => {
    expect(DISPATCH_PREP).toMatch(
      /role="main"[\s\S]{0,300}aria-label="발송 준비 워크벤치"/
    );
  });

  it("_workbench/search/page.tsx 모바일 + 데스크탑 2 landmark 보존", () => {
    // line 684: section aria-label="소싱 결과 분류 (모바일)"
    expect(WORKBENCH_SEARCH).toMatch(/aria-label="소싱 결과 분류 \(모바일\)"/);
    // line 1235: section aria-label="소싱 결과 분류"
    expect(WORKBENCH_SEARCH).toMatch(/aria-label="소싱 결과 분류"/);
  });

  it("search/page.tsx section landmark + aria-label 보존", () => {
    // section 과 aria-label 사이에 data-testid + className + comment 있음 → window 400
    expect(SEARCH).toMatch(/<section[\s\S]{0,400}aria-label="소싱 결과 분류"/);
  });
});
