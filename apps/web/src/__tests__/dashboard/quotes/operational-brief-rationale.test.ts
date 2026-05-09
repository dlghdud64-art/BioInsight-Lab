/**
 * §11.221 — RED test
 *
 * Goal: 운영 브리핑 "판단 근거" region 의 1차 노출을
 *       4 cell MetricCell grid → 한 줄 인과관계 요약 + collapsible 4 cell.
 *
 * 호영님 5월 8일 결론:
 *   - 빼지 않음 (판단 근거 = 차별점, 신뢰 보호)
 *   - 형태 개선 — "상태 반복" → "인과관계 + 실행 이유"
 *   - 1차 노출: 한 줄 ("→" 인과관계 + emoji + 굵게)
 *   - 2차: collapsible (default 접힘) — "상세 보기" toggle
 *
 * canonical truth lock:
 *   - selectedSignals (status / blocker / nextAction / compareReady / poReady) 보존.
 *   - 4 cell grid (현재 상태 / 회신 / 비교 가능 / 발주 전환) 가 collapsed 안에 보존.
 *   - dead button 0 (toggle button onClick wired).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const src = readFileSync(PAGE_PATH, "utf8");

describe("§11.221 — 운영 브리핑 판단 근거 인과관계 요약", () => {
  it("rationale 인과관계 요약 helper 또는 inline expression — '→' 매칭", () => {
    // "→" 인과관계 패턴 (한 줄 요약).
    expect(src).toMatch(/→[\s\S]{0,80}(차단|첫 단계|단계입니다|발송|회신|비교|승인)/);
  });

  it("collapsible state — useState 'factsExpanded' 또는 'rationaleExpanded' 또는 'detailsExpanded'", () => {
    expect(src).toMatch(/useState[\s<]*(?:boolean)?[\s>]*\(\s*false\s*\)[\s\S]{0,200}(factsExpanded|rationaleExpanded|detailsExpanded)|const\s+\[(factsExpanded|rationaleExpanded|detailsExpanded)/);
  });

  it("4 cell MetricCell grid — collapsed 안에 보존 (현재 상태 / 회신 / 비교 가능 / 발주 전환)", () => {
    expect(src).toMatch(/MetricCell[\s\S]{0,200}현재 상태/);
    expect(src).toMatch(/MetricCell[\s\S]{0,200}회신/);
    expect(src).toMatch(/MetricCell[\s\S]{0,200}비교 가능/);
    expect(src).toMatch(/MetricCell[\s\S]{0,200}발주 전환/);
  });

  it("'상세 보기' 또는 '접기' toggle CTA (한국어)", () => {
    expect(src).toMatch(/상세 보기|상세\s*펼치|상세\s*접|접기|펼치기/);
  });

  it("§11.221 cluster trace marker", () => {
    expect(src).toMatch(/§11\.221|운영 브리핑 판단 근거|판단 근거 인과관계/);
  });
});
