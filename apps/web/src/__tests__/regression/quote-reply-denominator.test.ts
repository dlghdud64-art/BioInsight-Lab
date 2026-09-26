/**
 * §quote-reply-denominator (2026-09-25 · 호영님 판정)
 *
 * 「회신 1/1」 이 말하는 것은 **보낸 공급사 중 몇 곳이 답했나** 다.
 * 그런데 화면 전부가 분모로 **품목 수**(items.length)를 쓰고 있었다.
 *
 *   품목 3개를 공급사 1곳에 보내고 답을 받으면  →  「1/3」
 *   prod 견적이 전부 1품목이라 **우연히** 맞아 보였을 뿐이다.
 *
 * 호영님: 이 숫자는 지금 팔 수 있다고 한 기능 — 여러 공급사에 RFQ 를 돌리고 추적하는 것 —
 * 의 핵심 지표다. 가장 먼저 참이어야 하는 숫자다.
 *
 * 분모를 판정 단일 출처(lib/quotes/readiness.ts)의 invitedCount 로 옮기고,
 * 카드 · 목록 행 · 패널 · 모바일 브리핑이 **같은 필드**를 읽게 했다.
 *
 * 같이 드러난 것(전수하며 나온 같은 형태):
 *   · 「발송 공급사」 칸이 품목 수를 보여주고 있었다 — 셀 이름과 세는 것이 달랐다
 *   · 모바일 브리핑만 아직 QuoteResponse(prod 전 견적 0행)를 회신 수로 세고 있었다
 *   · `status !== "SENT"` 로 발송 여부를 판정하는 자리가 「회신 현황」 탭에 또 있었다
 *
 * 짝: regression/quote-completed-honesty.test.ts (선정 판정축 · 회신 수 출처)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const APPS_WEB = resolve(__dirname, "../../..");
const read = (rel: string) => readFileSync(resolve(APPS_WEB, rel), "utf8");

const pageCode = stripComments(read("src/app/dashboard/quotes/page.tsx"));
const readinessCode = stripComments(read("src/lib/quotes/readiness.ts"));

describe("§quote-reply-denominator · 분모는 요청한 공급사 수다", () => {
  it("① 판정 단일 출처가 분모를 가진다", () => {
    expect(readinessCode).toMatch(/invitedCount: number;/);
    // 포털 전용 회신은 초대 행이 없으므로 분모에도 더한다 · respondedCount ≤ invitedCount 보장.
    expect(readinessCode).toMatch(
      /const invitedCount = input\.vendorRequests\.length \+ portalOnly\.size;/,
    );
    expect(readinessCode).toMatch(/return \{[\s\S]{0,200}invitedCount,/);
  });

  it("② 세 표면이 그 필드를 읽는다 (카드 · 목록 행 · 패널)", () => {
    expect(pageCode).toMatch(/const replyTotal = cardReadiness\.invitedCount;/);
    expect(pageCode).toMatch(/const replyTotal = rowReadiness\.invitedCount;/);
    // 승계 §quote-brief-rail-removed (2026-09-26 · 호영님 판정) — 패널(레일)·모바일 브리핑 시트는 삭제됐다.
    //   그 두 자리(sqReadiness · mReadiness)의 양성 단언은 은퇴. 남은 두 표면(카드 · 목록 행)이 명제를 지킨다.
  });

  it("③ 회신 축에 품목 수가 분모로 남아 있지 않다", () => {
    expect(pageCode).not.toMatch(/회신 \{responseCount\}\/\{itemCount\}/);
    expect(pageCode).not.toMatch(/\{sqResponseCount\}\/\{selectedQuote\.items\.length\}/);
    expect(pageCode).not.toMatch(/const totalItems = selectedQuote\.items\.length;/);
    expect(pageCode).not.toMatch(/selectedQuote\.items\.length - sqResponseCount/);
    // 진행률 막대(카드 · 목록 행)도 분모가 바뀌었다.
    const bars = pageCode.match(/aria-valuemax=\{replyTotal\}/g);
    expect(bars ?? []).toHaveLength(2);
  });

  it("④ 「발송 공급사」 칸이 공급사 수를 센다", () => {
    // 셀 이름과 세는 것이 달랐다 — 품목 수를 「발송 공급사」 라고 부르고 있었다.
    expect(pageCode).not.toMatch(
      /발송 공급사[\s\S]{0,200}\{selectedQuote\.items\.length\}곳/,
    );
    // 승계 §quote-brief-rail-removed (2026-09-26) — 「발송 공급사」 칸은 레일 「회신 현황」 탭에 있었고 삭제됐다. 역단언만 유지.
  });

  it("⑤ 회신 수 출처가 모바일까지 하나다", () => {
    // 모바일 브리핑만 QuoteResponse 를 세고 있었다(prod 전 견적 0행 → 언제나 0).
    expect(pageCode).not.toMatch(/replyCount: selectedQuote\.responses/);
    // 승계 §quote-brief-rail-removed (2026-09-26) — replyCount 를 넘기던 두 호출(레일 · 모바일 브리핑)이 삭제됐다. 역단언만 유지.
  });

  it("⑥ 발송 여부 판정에 status 목록을 쓰는 자리가 0이다", () => {
    /* 같은 형태가 세 번 나왔다 — 카드 진행률 · 목록 행 · 「회신 현황」 탭.
       하나를 고치고 형제를 안 보면 남는다(§형태 수정 후 형제 슬롯 전수). */
    expect(pageCode).not.toMatch(/selectedQuote\.status !== "SENT"/);
    expect(pageCode).not.toMatch(/isSent: selectedQuote\.status === "SENT"/);
    /* 승계 §quote-brief-rail-removed (2026-09-26 · 호영님 판정) — 「회신 현황」 탭 · 레일 · 모바일 브리핑의 hasBeenSent(selectedQuote)
       자리는 모두 레일과 함께 삭제됐다. 남은 두 표면(카드 진행률 · 목록 행)이 같은 판정 함수를 쓰는지를 본다. */
    expect(pageCode.match(/hasBeenSent\(quote\)/g) ?? []).toHaveLength(3);
  });
});
