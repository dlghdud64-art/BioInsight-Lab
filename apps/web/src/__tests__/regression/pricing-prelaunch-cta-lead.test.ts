/**
 * §pricing-launch-manual P1/P3 — 도입 신청 CTA + 인라인 신청 폼 (호영님 2026-06-27)
 *
 * 수동 결제 즉시 출시: Basic/Pro 결제 CTA → "도입 신청"(EnrollmentRequest). dead button 0(CTA→#notify 폼).
 * (트랙2 포트원 정기결제 전까지 수동. PG 결제수단 등록 0.)
 *   - descriptor Basic/Pro ctaLabel "도입 신청"
 *   - /pricing handlePlanSelect: team/business → #notify 스크롤(결제 resolver 미호출)
 *   - /pricing 인라인 폼(id="notify"): 회사·담당자·이메일·플랜 + /api/leads POST(결제수단 0)
 *   - /api/leads: EnrollmentRequest insert. schema EnrollmentRequest 모델(prod migration).
 *   - FAQ "결제 후 바로 활성화" fake claim 제거.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

const DESC = read("lib/billing/plan-descriptor.ts");
const PRICING = read("app/pricing/page.tsx");
const LEADS = read("app/api/leads/route.ts");
const SCHEMA = readFileSync(join(SRC, "..", "prisma", "schema.prisma"), "utf8");

describe("§pricing-launch-manual P3 — CTA 도입 신청", () => {
  it("descriptor Basic/Pro ctaLabel 도입 신청 (출시 알림/Basic·Pro 시작하기 0)", () => {
    expect(DESC).toMatch(/ctaLabel:\s*"도입 신청"/);
    expect(DESC).not.toMatch(/ctaLabel:\s*"출시 알림 신청"/);
    expect(DESC).not.toMatch(/ctaLabel:\s*"Basic 시작하기"/);
    expect(DESC).not.toMatch(/ctaLabel:\s*"Pro 시작하기"/);
  });
  it("/pricing handlePlanSelect — team/business → #notify 스크롤(결제 미호출)", () => {
    expect(PRICING).toMatch(/plan === "team" \|\| plan === "business"/);
    expect(PRICING).toMatch(/getElementById\("notify"\)/);
  });
});

describe("§pricing-launch-manual P3 — 인라인 도입 신청 폼", () => {
  it("id=notify + /api/leads POST + 이메일 + 플랜 select + 도입 신청 버튼", () => {
    expect(PRICING).toMatch(/id="notify"/);
    expect(PRICING).toMatch(/fetch\("\/api\/leads"/);
    expect(PRICING).toMatch(/type="email"/);
    expect(PRICING).toMatch(/도입 신청/);
    expect(PRICING).toMatch(/billingCycle: annual \? "yearly" : "monthly"/);
  });
  it("결제수단 등록 0 (card/결제 input 없음)", () => {
    expect(PRICING).not.toMatch(/결제 정보를 입력|카드 번호|cardNumber/);
  });
  it("/api/leads — EnrollmentRequest insert + 이메일·플랜·주기 검증", () => {
    expect(LEADS).toMatch(/db\.enrollmentRequest\.create/);
    expect(LEADS).toMatch(/contactEmail:\s*z\.string\(\)\.email\(\)/);
    expect(LEADS).toMatch(/planIntent:\s*z\.enum\(\["team", "business"\]\)/);
    expect(LEADS).toMatch(/billingCycle:\s*z\.enum\(\["monthly", "yearly"\]\)/);
    expect(LEADS).toMatch(/status:\s*"requested"/);
  });
  it("(b) 영업 알림 — sendEmail best-effort(non-blocking try/catch)", () => {
    expect(LEADS).toMatch(/import \{ sendEmail \} from "@\/lib\/email\/sender"/);
    expect(LEADS).toMatch(/도입 신청/);
    expect(LEADS).toMatch(/non-blocking/);
  });
  it("schema EnrollmentRequest 모델(contactEmail·planIntent·billingCycle·status·lifecycle)", () => {
    expect(SCHEMA).toMatch(/model EnrollmentRequest \{/);
    expect(SCHEMA).toMatch(/contactEmail\s+String/);
    expect(SCHEMA).toMatch(/planIntent\s+String/);
    expect(SCHEMA).toMatch(/billingCycle\s+String/);
    expect(SCHEMA).toMatch(/status\s+String\s+@default\("requested"\)/);
    expect(SCHEMA).not.toMatch(/model LeadSignup \{/);
  });
});

describe("§pricing-launch-manual — FAQ honesty (결제 후 활성화 fake 제거)", () => {
  it("'결제 후 바로 활성화' 카피 0", () => {
    expect(PRICING).not.toMatch(/결제 후 바로 활성화/);
  });
});
