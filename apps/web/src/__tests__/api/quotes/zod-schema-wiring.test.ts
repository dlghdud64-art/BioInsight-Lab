/**
 * #quote-payload-zod-schema — route wiring source-level test
 *
 * /api/quotes POST 가 zod schema (quoteCreatePayloadSchema) 통과 +
 * 운영자 친화 메시지 (formatQuoteValidationError) 사용 검증.
 *
 * 기존 hand-rolled validation (line 55-60 + line 110-115 의 빈 items
 * 분기) 을 zod schema 로 swap. caller drift / silent assumption 차단.
 *
 * §11.203 lock 호환:
 *   - structured 400 + error: "QUOTE_SUBMIT_VALIDATION_FAILED" 보존
 *   - enforcement.fail() 호출 보존 (§11.21 lock)
 *   - raw stack trace 노출 0
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const ROUTE = "src/app/api/quotes/route.ts";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("#quote-payload-zod-schema — /api/quotes route wiring", () => {
  it("quoteCreatePayloadSchema import (validation single source)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/quoteCreatePayloadSchema[\s\S]*from\s+["']@\/lib\/validation\/quote-create-schema["']|import[\s\S]*quoteCreatePayloadSchema[\s\S]*quote-create-schema/);
  });

  it("formatQuoteValidationError import (운영자 친화 메시지)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/formatQuoteValidationError/);
  });

  it("safeParse 호출 (request.json() 후 parse)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/quoteCreatePayloadSchema\.safeParse/);
  });

  it("validation fail → structured 400 (§11.203 호환)", () => {
    const src = read(ROUTE);
    // QUOTE_SUBMIT_VALIDATION_FAILED 코드 사용 (formatQuoteValidationError 가
    // 자동으로 set) + status 400
    expect(src).toMatch(/QUOTE_SUBMIT_VALIDATION_FAILED/);
  });

  it("validation fail → enforcement.fail() 호출 (§11.21 lock 정합)", () => {
    const src = read(ROUTE);
    // enforcement?.fail(...) 또는 enforcement.fail(...) — validation 실패 시
    expect(src).toMatch(/enforcement[\s\S]*\.fail\(/);
  });

  it("#quote-payload-zod-schema 코멘트 명시 (drift 차단)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/#quote-payload-zod-schema|quote-create-schema/);
  });
});
