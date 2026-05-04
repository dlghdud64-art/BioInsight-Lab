/**
 * §11.209c Phase 3 #checkout-business-monthly — RED test
 *
 * /api/billing/checkout 의 BUSINESS_MONTHLY 분기 source-level 검증.
 * - checkoutSchema 가 optional planIntent 받음 (caller 호환 — caller
 *   미전달 시 보수적 'team')
 * - line_items 의 price 가 planIntent 기반 분기 (TEAM_MONTHLY /
 *   BUSINESS_MONTHLY)
 * - STRIPE_PRICE_ID_BUSINESS_MONTHLY env 부재 + planIntent='business'
 *   → graceful 400 (운영자 친화 메시지, dead button 0)
 *
 * canonical truth: PLAN_DESCRIPTOR (§11.201 lock) + workspacePlanToIntent
 * (§11.209c Phase 1 lock).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const ROUTE = "src/app/api/billing/checkout/route.ts";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.209c Phase 3 — checkout BUSINESS_MONTHLY 분기", () => {
  it("checkoutSchema 가 optional planIntent 받음", () => {
    const src = read(ROUTE);
    // planIntent: z.enum([...]).optional() 또는 동등 패턴
    expect(src).toMatch(/planIntent[\s\S]*z\.(enum|string|literal)/);
  });

  it("STRIPE_PRICE_ID_BUSINESS_MONTHLY env 사용 (BUSINESS_MONTHLY 분기)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/STRIPE_PRICE_ID_BUSINESS_MONTHLY/);
  });

  it("line_items 의 price 분기 (planIntent === 'business' → BUSINESS_MONTHLY)", () => {
    const src = read(ROUTE);
    // ternary 또는 if/else 분기 (planIntent 기반)
    expect(src).toMatch(/planIntent\s*===?\s*["']business["']|business[\s\S]*BUSINESS_MONTHLY/);
  });

  it("BUSINESS_MONTHLY env 부재 + planIntent='business' → graceful 400", () => {
    const src = read(ROUTE);
    // env 부재 검증 (직접 process.env 부재 또는 변수 할당 후 falsy 체크)
    // + 400 응답 + 운영자 친화 메시지
    expect(src).toMatch(/STRIPE_PRICE_ID_BUSINESS_MONTHLY[\s\S]*?(if\s*\(!|!process\.env|\?\?)/);
    expect(src).toMatch(/status:\s*400/);
    expect(src).toMatch(/BUSINESS_PRICE_ID_NOT_CONFIGURED|R&D Operations 결제 설정/);
  });

  it("§11.209c Phase 3 코멘트 명시 (drift 차단)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/§11\.209c|11\.209c/);
  });

  it("기존 TEAM_MONTHLY 분기 보존 (caller 호환)", () => {
    const src = read(ROUTE);
    // TEAM_MONTHLY env 사용 잔존
    expect(src).toMatch(/STRIPE_PRICE_ID_TEAM_MONTHLY/);
  });
});
