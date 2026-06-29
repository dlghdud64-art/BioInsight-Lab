/**
 * §quote-dispatch-real-send-unify P1 #vendor-dispatch-real-send — Regression sentinel (client)
 *   (PLAN: docs/plans/PLAN_quote-dispatch-real-send-unify.md)
 *
 * ★ §11.314-b-2 옵션 A 역전 (호영님 2026-06-24):
 *   단일 발송을 generate-pdf + mailto(실 발송 0) → vendor-requests(실 Resend 발송, 일괄과 동일 경로)로
 *   교체. Resend 라이브 전제. 첫 발송 = quote_request_submit(requester 허용, §11.314-a).
 *   PDF는 별도 "견적서 다운로드"(generate-pdf GET, status 전이 0)로 분리(P2).
 *
 * 보존(불변): 공급사 선택/이메일 검증/expiresInDays · sentTracking + localStorage · sendReadiness 분기.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const PATH = "src/components/quotes/dispatch/vendor-dispatch-workbench.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§quote-dispatch-real-send-unify P1 — executeDispatch 실 이메일 발송 교체", () => {
  it("vendor-requests endpoint 호출 (실 발송)", () => {
    const src = read(PATH);
    expect(src).toMatch(/csrfFetch\(`\/api\/quotes\/\$\{quoteId\}\/vendor-requests`/);
    expect(src).toMatch(/vendors: validVendors/);
    expect(src).toMatch(/expiresInDays: clampedExpires/);
  });

  it("PDF는 발송 아닌 별도 export — generate-pdf GET(status 전이 0)으로만 호출", () => {
    const src = read(PATH);
    // 발송 경로는 vendor-requests(위). generate-pdf 는 다운로드 전용 GET 만 — POST(발송 행위) 호출 0.
    expect(src).toMatch(/csrfFetch\(`\/api\/quotes\/\$\{quoteId\}\/generate-pdf`,\s*\{\s*method:\s*"GET"/);
  });

  it("mailto 흐름 제거 (실 발송이므로 수동 메일 0)", () => {
    const src = read(PATH);
    expect(src).not.toMatch(/window\.location\.href = `mailto:/);
  });

  it("실 발송 결과 기반 토스트 (emailsSent/Failed, 가짜 성공 0)", () => {
    const src = read(PATH);
    expect(src).toMatch(/result\?\.summary\?\.emailsSent/);
    expect(src).toMatch(/result\?\.summary\?\.emailsFailed/);
    expect(src).toMatch(/title:\s*failed > 0 \? "일부 공급사 발송 실패" : "공급사 발송 완료"/);
  });

  it("에러 메시지 — '공급사 발송 실패'", () => {
    const src = read(PATH);
    expect(src).toMatch(/title:\s*"공급사 발송 실패"/);
  });
});

describe("§quote-dispatch-real-send-unify P1 — 버튼 라벨 발송 정합", () => {
  it("aria-label '공급사에 견적 요청 발송'", () => {
    const src = read(PATH);
    expect(src).toMatch(/aria-label="공급사에 견적 요청 발송"/);
  });

  it("visible 라벨 발송 (공급사에 발송 / 발송 중… / 발송 완료)", () => {
    const src = read(PATH);
    expect(src).toMatch(/공급사에 발송/);
    expect(src).toMatch(/발송 중…/);
    expect(src).toMatch(/발송 완료/);
  });

  it("옛 PDF 라벨 제거 (견적서 PDF 다운로드 = 발송 버튼 아님)", () => {
    const src = read(PATH);
    expect(src).not.toMatch(/PDF 다운로드 완료/);
  });

  // §B2-D (호영님 2026-06-29) — 라벨 정명: 버튼이 받는 파일은 우리 RFQ(견적요청서-*.pdf)라
  //   "견적서"(공급사 회신 견적서) → "견적요청서"로 정정(honesty: 라벨 ≡ 실제 산출물).
  it("P2 — 견적요청서 다운로드 별도 버튼(executeDownloadPdf) 존치 (발송과 분리, dead button 0)", () => {
    const src = read(PATH);
    expect(src).toMatch(/executeDownloadPdf/);
    expect(src).toMatch(/견적요청서 다운로드/);
  });
});

describe("§quote-dispatch-real-send-unify P1 — 회귀 0 (선택/검증 + tracking + sendReadiness 보존)", () => {
  const src = read(PATH);
  it("공급사 이메일 형식 검증 보존", () => {
    expect(src).toMatch(/emailRegex/);
    expect(src).toMatch(/이메일 형식 오류/);
  });
  it("includedSuppliers → validVendors (email/name) 보존", () => {
    expect(src).toMatch(/const validVendors = includedSuppliers\.map/);
    expect(src).toMatch(/email:\s*s\.email/);
  });
  it("sentTracking + localStorage 보존", () => {
    expect(src).toMatch(/setSentTracking/);
    expect(src).toMatch(/trackingStorageKey/);
    expect(src).toMatch(/window\.localStorage\.setItem/);
  });
  it("sendReadiness 분기 보존", () => {
    expect(src).toMatch(/sendReadiness !== "ready"/);
    expect(src).toMatch(/전송 전 확인 필요/);
  });
  it("setConfirmationOpen + onSuccess 보존", () => {
    expect(src).toMatch(/setConfirmationOpen\(false\)/);
    expect(src).toMatch(/onSuccess\?\.\(\)/);
  });
});
