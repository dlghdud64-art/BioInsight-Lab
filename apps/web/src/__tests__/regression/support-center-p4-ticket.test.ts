/**
 * §support-center P4 (호영님 2026-07-05) — 직접문의 배너 + CSRF fix.
 * 직접 문의 배너(/support 실배선). 🛑 handleSubmit /api/support/inquiry raw fetch → csrfFetch(전역 CSRF 게이트).
 * 🔁 티켓 파이프라인·SLA·answerBody 3종은 2026-09-20 은퇴 — 아래 승계 주석 참조(그릴 대상이 지어낸 티켓이었다).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const PAGE = readFileSync(join(__dirname, "..", "..", "app/dashboard/support-center/page.tsx"), "utf8");

describe("§support-center P4 — 티켓 파이프라인·SLA·답변본문·CSRF", () => {
  it("§4 CSRF fix — handleSubmit csrfFetch(raw fetch 제거, 403 해소)", () => {
    expect(PAGE).toMatch(/import \{ csrfFetch \} from "@\/lib\/api-client"/);
    expect(PAGE).toMatch(/csrfFetch\("\/api\/support\/inquiry"/);
    expect(PAGE).not.toMatch(/await fetch\("\/api\/support\/inquiry"/);
  });
  /* 🔁 은퇴→승계 (§support-center-fabricated-tickets · 2026-09-20 릴레이 판정)
   *
   *   구 계약: 티켓 상세가 상태 파이프라인(접수→배정→확인→답변→완료) · SLA 배지 · answerBody 를
   *            **실제로 노출**한다("담당자가 답변을 등록했습니다" 요약 대체).
   *   실상  : 그 셋이 그리던 대상은 티켓이 아니라 **하드코딩 2건(MOCK_TICKETS)** 이었다.
   *            TK-001 의 answerBody 는 하지 않은 조치를 한 답변처럼 적고 있었고,
   *            TK-002 의 slaHours=3 은 §support-center-sla-honesty 가 금지한 당일 약속과 같은 것이었다.
   *   신 계약: 그릴 데이터 출처가 없으면 **그리지 않는다** — 역계약으로
   *            regression/support-center-fabricated-tickets.test.ts ② 가 승계한다.
   *
   *   🔑 정책("요약으로 뭉개지 말고 실제를 보여준다")은 **불변**이다. 수단만 뒤집혔다.
   *      접수 내역 조회 API 가 생기면 이 계약을 **실데이터 축으로** 되살린다(지우지 말 것).
   *      그냥 삭제했으면 "요약으로 되돌리기" 를 막는 방어가 0 이 된다(302c·302d-1 선례). */
  it("§4 직접 문의 배너", () => {
    expect(PAGE).toMatch(/찾는 답이 없/);
  });
});
