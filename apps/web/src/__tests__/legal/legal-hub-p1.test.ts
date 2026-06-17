/**
 * §P-leg P1 — 법적 고지 허브 데이터 계약 + 셸 sentinel
 *
 * 검증:
 *   (A) 데이터 계약 — 3문서(terms/privacy/policy) + 메타 + 법문 verbatim 무결성(특히 privacy v1.2
 *       국외이전 §5 / 위탁 §4 실수탁자 — 직전 트랙 land 보존).
 *   (B) 허브 셸 — 콘텐츠/표현 분리, 탭 스위처+슬라이딩 인디케이터, 스티키 목차, 해시 라우팅,
 *       읽기시간, 인쇄, 접근성(scroll-margin/prefers-reduced-motion).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const DOCS = readFileSync(join(ROOT, "lib/legal/legal-docs.tsx"), "utf8");
const PAGE = readFileSync(join(ROOT, "app/legal/page.tsx"), "utf8");

describe("§P-leg P1 (A) — 데이터 계약 3문서 + 메타", () => {
  it("LEGAL_DOCS 3문서 id(terms/privacy/policy)", () => {
    expect(DOCS).toMatch(/id:\s*"terms"/);
    expect(DOCS).toMatch(/id:\s*"privacy"/);
    expect(DOCS).toMatch(/id:\s*"policy"/);
    expect(DOCS).toMatch(/export const LEGAL_DOCS:\s*LegalDoc\[\]\s*=\s*\[TERMS, PRIVACY, POLICY\]/);
  });
  it("privacy v1.2 메타(국외이전 반영본)", () => {
    expect(DOCS).toMatch(/version:\s*"v1\.2"/);
    expect(DOCS).toMatch(/revised:\s*"2026\.06\.16"/);
  });
  it("terms 15조 / policy 11조 마지막 조항 존재", () => {
    expect(DOCS).toMatch(/제15조/); // terms
    expect(DOCS).toMatch(/제11조/); // policy
  });
});

describe("§P-leg P1 (A) — 법문 verbatim 무결성(직전 land 보존)", () => {
  it("privacy §5 국외이전 — 실이전 4사 + 국가 + 거부권", () => {
    expect(DOCS).toMatch(/개인정보의 국외 이전/);
    expect(DOCS).toMatch(/Vercel Inc\./);
    expect(DOCS).toMatch(/Supabase/);
    expect(DOCS).toMatch(/일본\(AWS 도쿄 리전\)/);
    expect(DOCS).toMatch(/Resend, Inc\./);
    expect(DOCS).toMatch(/국외 이전을 거부할 수 있으며/);
  });
  it("privacy §4 위탁 — 실수탁자(거짓 '해당없음' 시정본)", () => {
    expect(DOCS).toMatch(/Google LLC/);
    expect(DOCS).toMatch(/소셜 로그인\(OAuth\) 인증/);
  });
  it("CPO/사업자 placeholder 유지(휴업 대기 — 날조 금지)", () => {
    expect(DOCS).toMatch(/\[성명 \/ 직책\]/);
  });
});

describe("§P-leg P1 (B) — 허브 셸 배선", () => {
  it("콘텐츠/표현 분리 — LEGAL_DOCS 소비(법문 inline 미작성)", () => {
    expect(PAGE).toMatch(/from "@\/lib\/legal\/legal-docs"/);
    expect(PAGE).toMatch(/LEGAL_DOCS\.map/);
  });
  it("탭 스위처 + 슬라이딩 인디케이터(지시문 ①)", () => {
    expect(PAGE).toMatch(/role="tablist"/);
    expect(PAGE).toMatch(/aria-selected=\{active\}/);
    expect(PAGE).toMatch(/moveIndicator/);
    expect(PAGE).toMatch(/legal-ind/);
  });
  it("스티키 목차(248px) + 모바일 select(920↓)", () => {
    expect(PAGE).toMatch(/legal-toc/);
    expect(PAGE).toMatch(/grid-template-columns:\s*248px/);
    expect(PAGE).toMatch(/legal-toc-select/);
  });
  it("해시 라우팅(#privacy 등) + 읽기시간 + 인쇄", () => {
    expect(PAGE).toMatch(/hashchange/);
    expect(PAGE).toMatch(/readingMinutes/);
    expect(PAGE).toMatch(/window\.print\(\)/);
  });
  it("접근성 — scroll-margin(앵커) + prefers-reduced-motion", () => {
    expect(PAGE).toMatch(/scroll-margin-top/);
    expect(PAGE).toMatch(/prefers-reduced-motion/);
  });
  it("공개 페이지 셸 상속(MainLayout/Header/Footer)", () => {
    expect(PAGE).toMatch(/<MainLayout>/);
    expect(PAGE).toMatch(/<MainHeader \/>/);
    expect(PAGE).toMatch(/<MainFooter \/>/);
  });
});
