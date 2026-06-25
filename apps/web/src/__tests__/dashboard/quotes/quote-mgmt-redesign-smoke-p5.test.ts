/**
 * §quote-management-redesign P5 — 반응형 + end-to-end smoke (호영님 시안, 최종 종결)
 *   (PLAN: docs/plans/PLAN_quote-management-redesign.md Phase 5)
 *
 * 코드 변경 0(검증 phase). P1a~P4 전 표면이 한 파일에 정합 land 됐는지 smoke + 신규 표면
 *   (ConfirmSendModal·우선순위 pill) 반응형 불변(375px 잘림 0·max-w-md·truncate) 회귀 가드.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE = readFileSync(
  resolve(__dirname, "../../../app/dashboard/quotes/page.tsx"),
  "utf8",
);
const CARD = readFileSync(
  resolve(__dirname, "../../../components/quotes/priority-recommendation-card.tsx"),
  "utf8",
);

describe("§quote-management-redesign P5 — end-to-end smoke(P1a~P4 정합 land)", () => {
  it("P1a — stage 라벨 '발송 대기'(요청_접수)", () => {
    expect(PAGE).toMatch(/요청_접수:[\s\S]{0,40}label: "발송 대기"/);
  });
  it("P1b — 마감(dueDate) 컬럼 제거(order price→actions)", () => {
    expect(PAGE).toMatch(/"price",\s*"actions"/);
    expect(PAGE).not.toMatch(/dueDate:\s*"마감"/);
  });
  it("P2 — 발송 인텐트(2-step) 모달", () => {
    expect(PAGE).toMatch(/const \[sendIntentQuoteId, setSendIntentQuoteId\]/);
    expect(PAGE).toMatch(/견적 요청을 발송할까요\?/);
  });
  it("P3 — 우선순위 세션 override(prioMap) + pill toggle", () => {
    expect(PAGE).toMatch(/const \[prioMap, setPrioMap\]/);
    expect(PAGE).toMatch(/data-testid="quote-priority-override-toggle"/);
  });
  it("P4 — 카드 대시보드 navy 토큰", () => {
    expect(CARD).toMatch(/linear-gradient\(100deg, #1b2b50 0%, #243a72 55%, #2f6be0 130%\)/);
  });
});

describe("§quote-management-redesign P5 — 신규 표면 반응형(375px 잘림 0)", () => {
  it("ConfirmSendModal = max-w-md(375px서 w-full 축소) + 제목 truncate", () => {
    expect(PAGE).toMatch(/<DialogContent className="max-w-md">/);
    expect(PAGE).toMatch(/text-right truncate/);
  });
  it("우선순위 pill = 테이블 셀 컨트롤 터치 영역(min-h\/min-w 28px)", () => {
    expect(PAGE).toMatch(/min-h-\[28px\] min-w-\[28px\]/);
  });
});
