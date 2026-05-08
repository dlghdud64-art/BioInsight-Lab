/**
 * #quote-share-organization-scope — RED test
 *
 * Goal: share POST/DELETE 의 checkQuoteAccess 가 organization member
 *       매칭 분기 추가. 같은 organization 내 다른 user 의 quote 도 share 가능.
 *
 * canonical truth lock:
 *   - Multi-user organization collaboration 정합 — Quote.organizationId 가
 *     user 의 OrganizationMember.organizationId 와 매칭 시 access 허용.
 *   - 기존 user-level ownership 보존 (quote.userId === session.user.id).
 *   - guest key path 보존.
 *   - 3-source priority: user owner OR organization member OR guest key.
 *   - enforceAction 의 actor = logged-in user (session forward), not quote owner.
 *
 * vendor-requests post-fix 패턴과 동일 sweep — drift 0 lock.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROUTE_PATH = resolve(__dirname, "../../../app/api/quotes/[id]/share/route.ts");
const source = readFileSync(ROUTE_PATH, "utf8");

describe("#quote-share-organization-scope — checkQuoteAccess organization member 분기", () => {
  it("organizationMember 매칭 분기 존재 (Quote.organizationId 와 user OrganizationMember 매칭)", () => {
    expect(source).toMatch(/organizationMember\.findFirst|quote\.organizationId|organizationId.*===.*organizationId/);
  });

  it("3-source priority — user owner OR organization member OR guest key", () => {
    expect(source).toMatch(/hasAccess[\s\S]*?(organizationMember|organizationId)/);
  });

  it("기존 user-level ownership (quote.userId === session.user.id) 보존", () => {
    expect(source).toMatch(/quote\.userId\s*===\s*session\.user\.id/);
  });

  it("기존 guest key path 보존", () => {
    expect(source).toMatch(/quote\.guestKey/);
  });

  it("#quote-share-organization-scope 주석 marker (cluster trace)", () => {
    expect(source).toMatch(/#quote-share-organization-scope|organization member|organization-scope|조직 멤버/i);
  });
});

describe("#quote-share-organization-scope — enforceAction actor session forward", () => {
  it("enforceAction 의 userId 는 session 우선 (quote.userId fallback)", () => {
    // canonical: session?.user?.id ?? quote.userId
    expect(source).toMatch(/userId:\s*session\?\.user\?\.id\s*\?\?\s*quote\.userId/);
  });

  it("enforceAction 의 userRole 은 session.user.role forward (undefined drift 차단)", () => {
    // canonical: session?.user?.role
    expect(source).toMatch(/userRole:\s*session\?\.user\?\.role/);
  });

  it("userRole: undefined drift 0 — `userRole: undefined` literal 잔존 금지", () => {
    expect(source).not.toMatch(/userRole:\s*undefined\b/);
  });

  it("userId: quote.userId (session 미forward) drift 0 — 단독 quote.userId 잔존 금지", () => {
    // session?.user?.id ?? quote.userId 는 허용 (?? 가 있음).
    // 단독 `userId: quote.userId,` 는 차단.
    expect(source).not.toMatch(/userId:\s*quote\.userId\s*,/);
  });
});
