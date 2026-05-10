/**
 * #operational-brief-cta-shorten-d1 + #operational-brief-last-updated-label-d2
 *
 * 호영님 production 검증 후 5 axis redesign 의 Batch 1 (D1 + D2).
 *
 * D1 — CTA 잘림: popup primary CTA "비교표 검토 후 공급사 선..." 말줄임. 호영님
 *      spec: "이 패널에서 가장 중요한 액션이거든요. 텍스트가 잘리면 안 돼요."
 *      shortenCtaLabel 의 pattern `/비교\s*검토.*공급사\s*선정/` 가 "비교표"
 *      (표 포함) 매칭 실패 → "비교표" 추가 매핑.
 *
 * D2 — LAST UPDATED 라벨: 영문 "Last Updated" 가 모호 ("AI 분석이 5분 전인지
 *      데이터가 5분 전인지"). 호영님 spec: "마지막 분석: 5분 전" 명확화.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const POPUP_PATH = resolve(__dirname, "../../../components/operational-brief/popup.tsx");
const popup = readFileSync(POPUP_PATH, "utf8");

describe("#operational-brief-cta-shorten-d1 — 비교표 검토 매핑 source guard", () => {
  it("CTA_SHORT_LABEL 안 '비교표' 매칭 pattern 추가 (호영님 D1 마찰)", () => {
    // 기존 pattern `/비교\s*검토.*공급사\s*선정/` 가 '비교표' (with 표) 매칭 실패.
    // fix: pattern 에 `비교(?:표)?\s*검토` 또는 별도 pattern '비교표' 명시.
    expect(popup).toMatch(/비교\(\?:표\)\?\s*\\?s\*검토|비교표\s*검토/);
  });

  it("기존 '비교 검토.*공급사 선정' 패턴 의미 보존 (backward compat)", () => {
    expect(popup).toMatch(/공급사\s*선정/);
  });

  it("CTA_MAX_LENGTH 14 보존 (기존 truncate 패턴)", () => {
    expect(popup).toMatch(/CTA_MAX_LENGTH\s*=\s*14/);
  });
});

describe("#operational-brief-last-updated-label-d2 — '마지막 분석' 라벨", () => {
  it("popup.tsx 의 'Last Updated' 라벨이 한국어 '마지막 분석' 으로 swap", () => {
    // Line 754 영역 — `Last Updated · {lastUpdatedLabel}` → `마지막 분석 · ...`.
    // 영문 "Last Updated" 잔존하지 않음.
    expect(popup).not.toMatch(/Last Updated\s*·/);
    expect(popup).toMatch(/마지막 분석\s*·/);
  });

  it("cluster trace marker", () => {
    expect(popup).toMatch(/#operational-brief-last-updated-label-d2|마지막 분석|D2/);
  });
});

describe("#operational-brief-cta-shorten-d1 — drift sentinel", () => {
  it("popup.tsx 의 비교 검토 pattern 에 '비교표' 분기 추가", () => {
    // CTA_SHORT_LABEL pattern 에 `비교(?:표)?` 또는 `비교표` 명시.
    expect(popup).toMatch(/비교\(\?:표\)\?|비교표/);
  });
});
