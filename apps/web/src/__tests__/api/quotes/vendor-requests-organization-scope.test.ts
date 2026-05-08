/**
 * #quote-vendor-requests-organization-scope — RED test
 *
 * Goal: vendor-requests POST 의 checkQuoteAccess 가 organization member
 *       매칭 분기 추가. 같은 organization 내 다른 user 의 quote 도 dispatch 가능.
 *
 * canonical truth lock:
 *   - Multi-user organization collaboration 정합 — Quote.organizationId 가
 *     user 의 OrganizationMember.organizationId 와 매칭 시 access 허용.
 *   - 기존 user-level ownership 보존 (quote.userId === session.user.id).
 *   - guest key path 보존.
 *   - 3-source priority: user owner OR organization member OR guest key.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROUTE_PATH = resolve(__dirname, "../../../app/api/quotes/[id]/vendor-requests/route.ts");
const source = readFileSync(ROUTE_PATH, "utf8");

describe("#quote-vendor-requests-organization-scope — checkQuoteAccess organization member 분기", () => {
  it("organizationId 매칭 분기 존재 (Quote.organizationId 와 user OrganizationMember 매칭)", () => {
    // canonical: db.organizationMember.findFirst 또는 quote.organizationId 비교
    expect(source).toMatch(/organizationMember\.findFirst|quote\.organizationId|organizationId.*===.*organizationId/);
  });

  it("3-source priority — user owner OR organization member OR guest key", () => {
    // canonical: hasAccess 분기에 organization member 매칭 추가
    expect(source).toMatch(/hasAccess[\s\S]*?(organizationMember|organizationId)/);
  });

  it("기존 user-level ownership (quote.userId === session.user.id) 보존", () => {
    expect(source).toMatch(/quote\.userId\s*===\s*session\.user\.id/);
  });

  it("기존 guest key path 보존", () => {
    expect(source).toMatch(/quote\.guestKey/);
  });

  it("#quote-vendor-requests-organization-scope 주석 marker (cluster trace)", () => {
    expect(source).toMatch(/#quote-vendor-requests-organization-scope|organization member|organization-scope|조직 멤버/i);
  });
});
