/**
 * §brief-quote-status-email (호영님 2026-06-29) — 운영 브리핑 견적 상태(완료/취소) 고객 통보
 *
 * 호영님 확정 안전장치: **발송 전 미리보기(받는사람·제목·본문) + 명시 확인 → 발송**.
 *   - 8초 deferred-commit 폐기. 즉시 발송 금지 — 미리보기 패널 거쳐 "확인하고 발송"만.
 *   - 발송 = 기존 PATCH /api/quotes/[id]/status (csrfFetch) + 기존 로그. 신규 백엔드 0.
 *   - 미리보기 ≡ 발송: 제목·본문을 공유 모듈(quote-status-email-content)에서만 정의 → drift 0.
 *   - 완료=COMPLETED / 취소=CANCELLED+사유. validateTransition(QUOTE) 게이팅(dead button 0).
 *   - 가짜 성공 0: done 은 PATCH 200 이후에만.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = resolve(__dirname, "../../..");
const read = (rel: string) => readFileSync(resolve(SRC, rel), "utf8");

const POPUP = read("components/operational-brief/popup.tsx");
const CONTENT = read("lib/email/quote-status-email-content.ts");
const MAILER = read("lib/email.ts");
const COMPLETED_EMAIL = read("emails/quote-completed.tsx");

describe("§brief-quote-status-email — 공유 카피 모듈(미리보기 ≡ 발송 단일 소스)", () => {
  it("제목·본문 빌더 export", () => {
    expect(CONTENT).toMatch(/export function quoteStatusEmailSubject/);
    expect(CONTENT).toMatch(/export function quoteStatusEmailBody/);
    expect(CONTENT).toMatch(/export type QuoteStatusEmailKind/);
  });
  it("메일러(발송)가 공유 모듈 사용 — 제목 리터럴 복제 0", () => {
    expect(MAILER).toMatch(/quoteStatusEmailSubject\("completed"/);
    expect(MAILER).toMatch(/quoteStatusEmailSubject\("cancelled"/);
    expect(MAILER).toMatch(/quoteStatusEmailBody\("cancelled"/);
    expect(MAILER).not.toContain("견적서가 도착했습니다! (견적번호");
    expect(MAILER).not.toContain("견적 요청 관련 안내 (요청번호");
  });
  it("완료 이메일 컴포넌트가 공유 본문 사용(디자인 보존·문구 공유)", () => {
    expect(COMPLETED_EMAIL).toMatch(/quoteStatusEmailBody\("completed"/);
    expect(COMPLETED_EMAIL).toMatch(/completedBody\[0\]/);
    expect(COMPLETED_EMAIL).toMatch(/completedBody\[1\]/);
  });
});

describe("§brief-quote-status-email — popup 미리보기→확인→발송", () => {
  it("견적 모듈 카드에만 통보 액션(dead button 0 게이팅)", () => {
    // §brief-demo-guard — 견적 모듈 게이트 보존 + QuoteNotifyAction(동일 props)은 LIVE 분기에서 유지.
    expect(POPUP).toMatch(/brief\.module === "quote" &&/);
    expect(POPUP).toMatch(/<QuoteNotifyAction quoteId=\{item\.entityId\} \/>/);
  });
  it("발송 전 미리보기(받는사람·제목·본문) + 명시 확인", () => {
    expect(POPUP).toContain("이 내용 그대로 전송됩니다");
    expect(POPUP).toContain("받는사람");
    expect(POPUP).toContain("확인하고 발송");
  });
  it("미리보기 제목·본문 = 공유 모듈(literal 재작성 0)", () => {
    expect(POPUP).toMatch(/quoteStatusEmailSubject\(kind, quoteNumber\)/);
    expect(POPUP).toMatch(/quoteStatusEmailBody\(kind, \{ customerName, reason \}\)/);
  });
  it("전이 게이팅 — validateTransition(QUOTE) + 부적격 정직 안내", () => {
    expect(POPUP).toMatch(/validateTransition\("QUOTE", status, target\)/);
    expect(POPUP).toContain("현재 상태에서는 이 통보를 보낼 수 없습니다");
  });
  it("발송 = 기존 PATCH status (csrfFetch) — 신규 백엔드 0", () => {
    expect(POPUP).toMatch(/csrfFetch\(`\/api\/quotes\/\$\{quoteId\}\/status`/);
    expect(POPUP).toContain('method: "PATCH"');
  });
  it("미리보기 데이터 = 기존 GET detail 재사용", () => {
    expect(POPUP).toMatch(/fetch\(`\/api\/quotes\/\$\{quoteId\}\/detail`\)/);
  });
  it("quoteNumber = id.slice(-8)(PATCH 정합)", () => {
    expect(POPUP).toContain("quoteId.slice(-8).toUpperCase()");
  });
  it("가짜 성공 0 — done 은 res.ok 이후에만", () => {
    expect(POPUP).toMatch(/if \(!res\.ok\)[\s\S]{0,200}throw/);
    expect(POPUP).toContain('setPhase("done")');
  });
  it("취소는 사유 필수", () => {
    expect(POPUP).toMatch(/kind === "cancelled" && !reason\.trim\(\)/);
  });
});

describe("§brief-quote-status-email — 보존(회귀 0)", () => {
  it("track-3 dismiss/idle 보존", () => {
    expect(POPUP).toContain("오늘 숨김");
    expect(POPUP).toContain("4개 모듈을 모니터링");
    expect(POPUP).toContain("넘기기");
  });
  it("popup 핵심 보존(단일큐·헤더폭·a11y)", () => {
    expect(POPUP).toContain("지금 처리");
    expect(POPUP).toContain("md:w-[400px]");
    expect(POPUP).toContain("aria-expanded={expanded}");
  });
});
