/**
 * §email-rebrand(호영님, 2026-06-17 승인) — 발송 메일 BioCompare → LabAxis 리브랜딩
 *
 * 스샷 증거: 견적 메일 from "BioCompare <noreply@labaxis.co.kr>", support@biocompare.kr,
 *   stepper 회색 빈 박스(CSS 원형 배지 Gmail 미렌더). 발송 도메인은 labaxis.co.kr(verified).
 * 결정: 브랜드=LabAxis, 도메인=labaxis.co.kr 단일. 구 도메인(biocompare.kr) + SendGrid 잔재(labaxis.io) 제거.
 *   stepper = 모든 메일 클라이언트 안전한 텍스트 기반(원문자/체크)으로 교체(CSS 원형 배지 금지).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const EMAIL_LIB = read("lib/email.ts");
const RECEIVED = read("emails/quote-received.tsx");
const COMPLETED = read("emails/quote-completed.tsx");
const DELIVERED = read("emails/order-delivered.tsx");
const MAIL_FILES = { EMAIL_LIB, RECEIVED, COMPLETED, DELIVERED };

describe("§email-rebrand — 구 브랜드/도메인 0", () => {
  for (const [name, src] of Object.entries(MAIL_FILES)) {
    it(`${name} — BioCompare 0`, () => {
      expect(src).not.toMatch(/BioCompare/);
    });
    it(`${name} — biocompare.kr 0`, () => {
      expect(src).not.toMatch(/biocompare\.kr/);
    });
  }
  it("email.ts — SendGrid labaxis.io 잔재 0(도메인 정합)", () => {
    expect(EMAIL_LIB).not.toMatch(/labaxis\.io/);
  });
});

describe("§email-rebrand — LabAxis/labaxis.co.kr 정합", () => {
  it("email.ts — from·subject·footer LabAxis + FROM_EMAIL 기본 labaxis.co.kr", () => {
    expect(EMAIL_LIB).toMatch(/LabAxis <\$\{FROM_EMAIL\}>/);
    expect(EMAIL_LIB).toMatch(/\[LabAxis\]/);
    expect(EMAIL_LIB).toMatch(/"noreply@labaxis\.co\.kr"/);
  });
  it("템플릿 — 로고/footer LabAxis", () => {
    expect(RECEIVED).toMatch(/LabAxis/);
    expect(COMPLETED).toMatch(/LabAxis/);
    expect(DELIVERED).toMatch(/LabAxis/);
  });
  it("견적접수 — support 주소 labaxis.co.kr", () => {
    expect(RECEIVED).toMatch(/support@labaxis\.co\.kr/);
  });
});

describe("§email-rebrand — stepper 텍스트화(CSS 원형 배지 깨짐 제거)", () => {
  it("3 템플릿 모두 CSS 원형 배지(stepNumber bg+radius) 제거", () => {
    for (const src of [RECEIVED, COMPLETED, DELIVERED]) {
      expect(src).not.toMatch(/stepNumber/);
      expect(src).not.toMatch(/stepLineCompleted/);
    }
  });
  it("3 템플릿 모두 텍스트 기반 timelineSteps 도입", () => {
    for (const src of [RECEIVED, COMPLETED, DELIVERED]) {
      expect(src).toMatch(/timelineSteps/);
    }
  });
});
