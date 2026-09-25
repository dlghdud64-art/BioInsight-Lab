/**
 * §quote-completed-honesty · §quote-reply-count-split (2026-09-25 · 호영님 판정)
 *
 * 역계약. 「선정 완료」 라는 말이 **참이 아니었다**.
 *
 * 실측(operator-shell → Supabase xhid… Session Pooler · SELECT 만 · 2026-09-25):
 *   COMPLETED 로 가는 경로가 둘이고 기록이 다르다.
 *     사용자 「구매 진행 처리」 PATCH /api/quotes/[id]        → markQuoteAsPurchased → PurchaseRecord 생성
 *     관리자                 PATCH /api/quotes/[id]/status  → PurchaseRecord 생성 **안 함**
 *   두 경로 어디서도 Quote.selectedReplyId 를 쓰지 않는다
 *     select-reply 라우트의 UI 호출자 0 · QuoteReply **0행** · 전 견적 7건 selectedReplyId **전부 null**
 *   → 두 경로에서 모두 참인 문장은 「견적이 완료 처리됐다」 뿐이다.
 *
 * 그리고 같은 화면이 **자기 자신과 모순**되고 있었다(호영님 라이브 실측):
 *   뱃지 「선정 완료」 · 상단 「첫 액션이 필요합니다」 · 근거 「최적안 선택이 다음 단계입니다」
 *   선정이 끝났다면서 첫 액션과 선택을 동시에 요구했다.
 *
 * 회신 수도 갈라져 있었다 — 같은 견적을 목록은 「회신 전」, 패널은 「회신 1/1」 로 말했다.
 *   원인이 둘이다. 하나만 고치면 다른 하나가 남는다:
 *     ① 게이트   목록·카드가 status SENT|RESPONDED 로 열려 COMPLETED 가 밖으로 떨어졌다
 *     ② 출처     목록·카드는 QuoteResponse(prod 전 견적 0행), 패널은 vendorRequests 를 셌다
 *
 * 이 파일은 그 문장들이 되돌아오지 못하게 한다.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const APPS_WEB = resolve(__dirname, "../../..");
const read = (rel: string) => readFileSync(resolve(APPS_WEB, rel), "utf8");

const PAGE = "src/app/dashboard/quotes/page.tsx";
const RATIONALE = "src/lib/operational-brief/build-rationale.ts";

const pageSrc = read(PAGE);
const pageCode = stripComments(pageSrc);
const rationaleSrc = read(RATIONALE);
const rationaleCode = stripComments(rationaleSrc);

/** 블록 경계로 연다 · 고정 폭 슬라이스 금지(§4원칙 ⑤). */
function objectBlock(src: string, startAnchor: string): string {
  const start = src.indexOf(startAnchor);
  expect(start, `앵커 부재: ${startAnchor}`).toBeGreaterThan(-1);
  const open = src.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  throw new Error(`닫는 중괄호 없음: ${startAnchor}`);
}

describe("§quote-completed-honesty · 완료 견적이 선정을 단정하지 않는다", () => {
  it("① 완료 상태 신호가 「선정」 을 주장하지 않는다", () => {
    const block = objectBlock(pageCode, "ready_for_po_conversion:");
    // 선정 기록이 0이므로 선정을 말할 수 없다.
    expect(block).not.toMatch(/선정/);
    // 두 경로에서 모두 참인 문장.
    expect(block).toMatch(/badge:\s*"견적 완료"/);
    expect(block).toMatch(/status:\s*"견적 완료"/);
    // 「다음 조치」 가 제자리를 맴돌지 않는다 — 실제 행동을 적는다.
    expect(block).toMatch(/nextAction:\s*"입고 등록"/);
    expect(block).not.toMatch(/nextAction:\s*"다음 단계"/);
    // 목적지를 CTA 가 그대로 말한다(클릭 한 번).
    expect(block).toMatch(/ctaLabel:\s*"입고 관리 열기"/);
    expect(block).toMatch(/railCtaLabel:\s*"입고 관리 열기"/);
  });

  it("② 완료 견적에 「첫 액션이 필요합니다」 가 붙지 않는다", () => {
    // 구 판본: status !== "SENT" 면 전부 첫 액션 — COMPLETED 가 그대로 걸렸다.
    expect(pageCode).not.toMatch(/status\s*!==\s*"SENT"[\s\S]{0,80}첫 액션이 필요합니다/);
    // 완료를 **먼저** 가른다.
    expect(pageCode).toMatch(
      /selectedQuote\.status\s*===\s*"COMPLETED"[\s\S]{0,120}첫 액션이 필요합니다/,
    );
  });

  it("③ 판단 근거가 완료 견적에 「최적안 선택」 을 요구하지 않는다", () => {
    // 완료 분기가 회신-완료 분기보다 **앞**에 온다. 순서가 곧 우선순위다.
    const completedAt = rationaleCode.indexOf('poReady === "입고 등록"');
    const replyAt = rationaleCode.indexOf("최적안 선택이 다음 단계입니다");
    expect(completedAt).toBeGreaterThan(-1);
    expect(replyAt).toBeGreaterThan(-1);
    expect(completedAt).toBeLessThan(replyAt);
    // 제품에 없는 다음 단계를 근거가 약속하지 않는다.
    expect(rationaleCode).not.toMatch(/발주 전환/);
    expect(rationaleCode).not.toMatch(/PO 생성/);
  });

  it("④ 완료 CTA 가 작업창을 거치지 않고 입고 관리로 간다", () => {
    // 도달 경로 0이 된 작업창 렌더는 남기지 않는다(다음 사람이 배선 없이 되살린다).
    expect(pageCode).not.toMatch(/activeWorkWindow\s*===\s*"po_conversion"\s*&&/);
    // 레일 sticky · 모바일 시트 · 하단 시트 primary — **세 자리 전부**. 하나가 끊겨도 회귀다.
    const direct = pageCode.match(
      /selectedSignals\.actionKey\s*===\s*"po_conversion"\s*\)\s*\{\s*router\.push\("\/dashboard\/receiving"\)/g,
    );
    expect(direct ?? []).toHaveLength(3);
    // 행 CTA 도 같은 목적지.
    expect(pageCode).toMatch(
      /ctaLabel\s*===\s*"입고 관리 열기"\s*\)\s*\{\s*router\.push\("\/dashboard\/receiving"\)/,
    );
  });
});

describe("§quote-reply-count-split · 회신 수는 한 함수에서만 나온다", () => {
  it("⑤ 카드·목록·패널이 같은 함수를 쓴다", () => {
    // 회신 축의 출처는 quoteReadiness 하나다. QuoteResponse 를 회신 수로 세지 않는다.
    expect(pageCode).not.toMatch(/const\s+responseCount\s*=\s*quote\.responses/);
    const fromReadiness = pageCode.match(
      /const\s+responseCount\s*=\s*quoteReadiness\(quote\)\.respondedCount/g,
    );
    expect(fromReadiness ?? []).toHaveLength(2); // 카드 · 목록 행
    // 패널은 같은 객체의 같은 필드를 읽는다.
    expect(pageCode).toMatch(/const\s+responseCount\s*=\s*readiness\.respondedCount/);
    // 가격 축은 그대로 QuoteResponse 에서 온다 — 섞지 않았다는 증거.
    expect(pageCode).toMatch(/const\s+prices\s*=\s*\(quote\.responses\s*\?\?\s*\[\]\)/);
  });

  it("⑥ 「회신 전」 은 발송 전에만 나온다", () => {
    // 구 게이트가 COMPLETED·PURCHASED·CANCELLED 를 「회신 전」 으로 밀어냈다.
    expect(pageCode).not.toMatch(
      /quote\.status\s*===\s*"SENT"\s*\|\|\s*quote\.status\s*===\s*"RESPONDED"/,
    );
    // 명제에 이름이 있다.
    expect(pageCode).toMatch(/function hasBeenSent\(/);
    expect(pageCode).toMatch(
      /NOT_YET_SENT_STATUSES[\s\S]{0,120}new Set\(\["PENDING",\s*"PARSED"\]\)/,
    );
    // 목록 행 · 카드 진행률 두 자리 모두 그 이름을 쓴다.
    const gates = pageCode.match(/hasBeenSent\(quote\)\s*&&\s*itemCount\s*>\s*0/g);
    expect(gates ?? []).toHaveLength(2);
    expect(pageCode).toMatch(/!hasBeenSent\(quote\)\s*\?\s*"발송 전"/);
  });
});

describe("회귀 0 · API·DB 는 건드리지 않았다", () => {
  it("⑦ 구매 기록 경로와 선정 라우트가 그대로 있다", () => {
    const patch = read("src/app/api/quotes/[id]/route.ts");
    expect(patch).toMatch(/markQuoteAsPurchased\(\{/);
    expect(patch).toMatch(/const isCompletingPurchase =/);
    // 선정 저장 필드·라우트는 살아 있다(UI 호출자가 0일 뿐이다 — 지우지 않았다).
    expect(read("prisma/schema.prisma")).toMatch(/selectedReplyId\s+String\?/);
  });
});
