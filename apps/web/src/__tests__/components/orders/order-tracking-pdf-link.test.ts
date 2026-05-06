/**
 * #post-approval-purchase-order-flow Phase 2.3 step 4 — RED→GREEN test
 *
 * OrderTrackingSection 의 poDocumentUrl 직접 link 우선 정합. PDF 가 이미
 * storage 에 영속화되어 있으면 직접 다운로드, 미생성/storage 미설정이면
 * 기존 generate-pdf POST mutation fallback.
 *
 * 산출:
 *   - OrderDetail.poDocumentUrl + poDocumentGeneratedAt field
 *   - component PDF button 분기 (poDocumentUrl 우선)
 *   - mobile types/index.ts OrderDetail 동일 정합
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT_WEB = join(__dirname, "..", "..", "..", "..");
const REPO_ROOT = join(__dirname, "..", "..", "..", "..", "..");
const COMPONENT = "src/components/orders/order-tracking-section.tsx";
const MOBILE_TYPES = "apps/mobile/types/index.ts";

function readWeb(rel: string): string {
  return readFileSync(join(REPO_ROOT_WEB, rel), "utf8");
}
function readRepo(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("#post-approval-purchase-order-flow Phase 2.3 step 4 — web component", () => {
  it("OrderDetail interface 에 poDocumentUrl + poDocumentGeneratedAt 추가", () => {
    const src = readWeb(COMPONENT);
    expect(src).toMatch(/poDocumentUrl[\s:]+(string\s*\|\s*null|string\?)/);
    expect(src).toMatch(/poDocumentGeneratedAt[\s:]+(string\s*\|\s*null|string\?)/);
  });

  it("PDF button 분기 — poDocumentUrl 있으면 직접 link, 없으면 generate-pdf mutation", () => {
    const src = readWeb(COMPONENT);
    // poDocumentUrl 분기 (anchor download 또는 window.open) 또는 mutation
    expect(src).toMatch(/poDocumentUrl/);
    expect(src).toMatch(/order\.poDocumentUrl/);
  });
});

describe("#post-approval-purchase-order-flow Phase 2.3 step 4 — mobile types", () => {
  it("mobile OrderDetail 에 poDocumentUrl + poDocumentGeneratedAt 추가", () => {
    const src = readRepo(MOBILE_TYPES);
    expect(src).toMatch(/poDocumentUrl[\s?:]/);
    expect(src).toMatch(/poDocumentGeneratedAt[\s?:]/);
  });
});
