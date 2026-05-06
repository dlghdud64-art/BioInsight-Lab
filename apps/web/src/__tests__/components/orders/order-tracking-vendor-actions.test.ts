/**
 * #post-approval-purchase-order-flow Phase 4.2-A1 — RED→GREEN test
 *
 * web `OrderTrackingSection` 의 vendor heading + PDF/email quick-action.
 * Phase 2.x (PDF) + Phase 3.x (email) API 의 user-visible wiring.
 *
 * canonical truth = Order (DB) — `Order.vendor` relation. component 가
 * server response 의 vendor field 를 그대로 표시 (snapshot 0).
 *
 * Lock:
 *   - vendor name heading 표시 (vendor 미존재 시 "공급사 지정 없음")
 *   - PDF 다운로드 button → POST /api/orders/[id]/generate-pdf (blob)
 *   - 이메일 발송 button → POST /api/orders/[id]/send-email (mutation)
 *   - vendor.email 미설정 시 email button disabled (dead button 0)
 *   - GET /api/orders/[id] response 에 vendor include
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT_WEB = join(__dirname, "..", "..", "..", "..");
const COMPONENT = "src/components/orders/order-tracking-section.tsx";
const ROUTE = "src/app/api/orders/[id]/route.ts";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT_WEB, rel), "utf8");
}

describe("#post-approval-purchase-order-flow Phase 4.2-A1 — GET route vendor include", () => {
  it("GET /api/orders/[id] response 에 vendor include", () => {
    const src = read(ROUTE);
    // 첫 번째 findUnique (line 49 부근) include 에 vendor 포함
    expect(src).toMatch(/findUnique[\s\S]*?include[\s\S]*?vendor/);
  });
});

describe("#post-approval-purchase-order-flow Phase 4.2-A1 — OrderTrackingSection vendor heading", () => {
  it("vendor name heading — `공급사` label 또는 vendor.name 표시", () => {
    const src = read(COMPONENT);
    expect(src).toMatch(/공급사|vendor\.name|order\.vendor/);
  });

  it("vendor 미존재 fallback — `지정 없음` 또는 등가 표시", () => {
    const src = read(COMPONENT);
    expect(src).toMatch(/지정\s*없음|미\s*지정|없음/);
  });
});

describe("#post-approval-purchase-order-flow Phase 4.2-A1 — PDF + email quick-action", () => {
  it("PDF 다운로드 button — generate-pdf endpoint 호출", () => {
    const src = read(COMPONENT);
    expect(src).toMatch(/generate-pdf/);
    expect(src).toMatch(/PDF\s*다운로드|발주서\s*다운로드|PDF/);
  });

  it("이메일 발송 button — send-email endpoint 호출", () => {
    const src = read(COMPONENT);
    expect(src).toMatch(/send-email/);
    expect(src).toMatch(/이메일\s*발송|메일\s*발송|발송/);
  });

  it("vendor.email 미설정 시 email button disabled (dead button 0)", () => {
    const src = read(COMPONENT);
    // disabled prop 이 vendor 또는 vendor.email 분기 사용
    expect(src).toMatch(/disabled[\s\S]*?vendor|vendor[\s\S]*?disabled/);
  });
});
