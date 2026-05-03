/**
 * §11.208 #wizard-quote-item-name-preserve — RED test
 *
 * RequestWizardModal 의 targetProducts 가 quoteItems store 의 productName
 * 을 정확히 보존하는지 source-level 검증. 이전엔 qi.name (store schema 부재)
 * 로 fallback "제품" 노출 → 견적 detail 의 generic 라벨.
 *
 * lock §11.142 호환:
 *   - canonical QuoteCandidateItem schema (productName / productId) 정합
 *   - fake "제품" generic 라벨 sweep (운영자 신뢰성 ↑)
 *   - dead code 0 (qi.name 잔존 fallback 만 — 호환성)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const WIZARD = "src/app/_workbench/_components/request-wizard-modal.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.208 wizard targetProducts — qi.productName 우선 narrowing", () => {
  it("targetProducts 가 qi.productName 을 우선 사용 (store schema 정합)", () => {
    const src = read(WIZARD);
    // qi.productName 이 첫 번째 fallback (store 의 canonical field)
    expect(src).toMatch(/qi\.productName\s*\?\?\s*qi\.name\s*\?\?\s*prod\?\.name/);
  });

  it("productId 도 qi.productId 우선 (store schema 정합)", () => {
    const src = read(WIZARD);
    // qi.productId 가 store schema 의 정확한 field — qi.id 는 internal item.id
    expect(src).toMatch(/qi\.productId\s*\?\?\s*qi\.id/);
  });

  it("§11.208 hot fix 코멘트 명시 (drift 차단)", () => {
    const src = read(WIZARD);
    expect(src).toMatch(/§11\.208/);
    // store schema 정합 명시
    expect(src).toMatch(/store\s*schema|productName/);
  });
});
