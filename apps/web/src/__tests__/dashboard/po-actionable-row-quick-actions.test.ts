/**
 * #post-approval-purchase-order-flow B+H step 3 — RED→GREEN test
 *
 * 발주 관리 page 의 ActionableRow 안 PDF/email quick-action button 추가.
 * step 2 prerequisite (vendorEmail propagation) 위에서 작동.
 *
 * Lock:
 *   - 2 button (PDF / email) — entityId 기반 mutation
 *   - email button: item.vendorEmail null 시 disabled (dead button 0)
 *   - onClick stopPropagation — row click 의 detail navigation 영향 0
 *   - hover state 또는 항상 표시 (compact UX)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT_WEB = join(__dirname, "..", "..", "..");
const PAGE = "src/app/dashboard/purchase-orders/page.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT_WEB, rel), "utf8");
}

describe("#post-approval-purchase-order-flow B+H step 3 — quick-action button", () => {
  it("ActionableRow 안 generate-pdf endpoint 호출", () => {
    const src = read(PAGE);
    expect(src).toMatch(/generate-pdf/);
  });

  it("ActionableRow 안 send-email endpoint 호출", () => {
    const src = read(PAGE);
    expect(src).toMatch(/send-email/);
  });

  it("email button vendorEmail 미설정 시 disabled (dead button 0)", () => {
    const src = read(PAGE);
    // disabled prop 이 vendorEmail 분기 사용
    expect(src).toMatch(/disabled[\s\S]*?vendorEmail|vendorEmail[\s\S]*?disabled/);
  });

  it("button onClick stopPropagation — row navigation 영향 0", () => {
    const src = read(PAGE);
    expect(src).toMatch(/stopPropagation/);
  });

  it("PDF / 이메일 한국어 label 또는 lucide icon 명시", () => {
    const src = read(PAGE);
    expect(src).toMatch(/PDF|발주서|FileText|Mail/);
  });
});
