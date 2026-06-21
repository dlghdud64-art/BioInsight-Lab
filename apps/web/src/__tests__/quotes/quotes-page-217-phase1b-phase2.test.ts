/**
 * §11.217 Phase 1B + Phase 2 — quotes/page.tsx source-level regression guard
 *
 * Phase 1B (Issue 5): AI 추천 page-top banner 1회.
 *   - inline AI 추천 row (4번 반복) 제거 후 page header 직후 1줄 banner.
 *   - priorityQuoteForBanner = urgentQuotes[0] ?? inProgressQuotes[0].
 *   - banner = getOpSignals(priorityQuoteForBanner).aiRecommendation.
 *
 * Phase 2 (Issue 2): "회신 추적 필요" semantic split.
 *   - request_not_sent → dispatchPending bucket (label "발송 대기").
 *   - awaiting_responses + response_delayed → responseTracking (label "회신 추적").
 *   - KPI grid 4 → 5 cells (md:grid-cols-3 lg:grid-cols-5).
 *
 * canonical truth lock:
 *   - getOpSignals (rail map) 의 aiRecommendation 만 사용 (single source).
 *   - dispatchPending / responseTracking 분리 — bucket 의미 명확.
 *   - filter mapping: dispatchPending → "PENDING", responseTracking → "SENT".
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PATH = resolve(__dirname, "../../app/dashboard/quotes/page.tsx");
const source = readFileSync(PATH, "utf8");

describe("§11.217 Phase 1B → §quote-management P4-core-B — '우선 추천' 카드(배너 대체)", () => {
  // 진화: 룰베이스를 'AI 추천'으로 라벨하던 page-top 배너(violet+Sparkles)를
  //   computePriority 기반 PriorityRecommendationCard 로 대체(가드② 정정).
  it("PriorityRecommendationCard 렌더로 배너 대체", () => {
    expect(source).toMatch(/<PriorityRecommendationCard/);
    // §quote-screen-sian P6.3 §07 — onOpen 이 다음 액션(handleQuoteCardSelect) 직접 연결로 진화(발송 단계→발송 모달).
    expect(source).toMatch(/onOpen=\{\(id\) =>[\s\S]{0,260}handleQuoteCardSelect/);
  });

  it("구 'AI 추천' 배너 파생/JSX 폐기(priorityAiRecommendation · violet 배너)", () => {
    expect(source).not.toMatch(/priorityAiRecommendation/);
    expect(source).not.toMatch(/bg-violet-50\/60/);
  });
});

// §11.217 Phase 2(KPI 의미 분리) describe 제거 — §quote-flat KPI-dedup(2026-06-21)로 KPI Control Cards 자체 폐기.
//   dispatchPending/responseTracking bucket·KPI 라벨·grid-cols-5 단언은 더 이상 유효하지 않음. Phase 1B(우선 추천 카드)만 유지.
