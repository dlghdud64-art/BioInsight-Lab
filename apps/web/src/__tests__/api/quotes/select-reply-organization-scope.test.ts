/**
 * #quote-select-reply-organization-scope — RED test
 *
 * Goal: select-reply POST 의 ownership check 가 organization member 매칭 분기
 *       추가. 같은 organization 내 다른 user 의 quote 도 select-reply 가능.
 *
 * canonical truth lock:
 *   - Multi-user organization collaboration 정합 — Quote.organizationId 가
 *     user 의 OrganizationMember.organizationId 와 매칭 시 select-reply 허용.
 *   - 기존 user-level ownership 보존 (quote.userId === session.user.id).
 *   - 404 fallback (NOT FOUND) 보존 — "not yours" 구분 회피 (existence leak 차단).
 *   - quote.findUnique select 에 organizationId 포함 (조직 매칭 query 정합).
 *
 * vendor-requests / share cluster 와 동일 sweep — drift 0 lock.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROUTE_PATH = resolve(__dirname, "../../../app/api/quotes/[id]/select-reply/route.ts");
const source = readFileSync(ROUTE_PATH, "utf8");

describe("#quote-select-reply-organization-scope — ownership organization member 분기", () => {
  it("organizationMember 매칭 분기 존재 (Quote.organizationId 와 user OrganizationMember 매칭)", () => {
    expect(source).toMatch(/organizationMember\.findFirst|isOrgMember|organizationId/);
  });

  it("quote.findUnique select 에 organizationId 포함 (조직 단위 매칭 가능)", () => {
    // canonical: select: { ..., organizationId: true, ... }
    expect(source).toMatch(/organizationId:\s*true/);
  });

  it("ownership 분기 — user owner OR organization member", () => {
    // user owner + isOrgMember disjunction
    expect(source).toMatch(/isOrgMember|organizationMember/);
  });

  it("기존 user-level ownership (quote.userId === session.user.id) 보존", () => {
    expect(source).toMatch(/quote\.userId\s*===\s*session\.user\.id|quote\.userId\s*!==\s*session\.user\.id/);
  });

  it("404 fallback 보존 — existence leak 회피", () => {
    expect(source).toMatch(/견적을 찾을 수 없습니다/);
    expect(source).toMatch(/NOT_FOUND/);
  });

  it("#quote-select-reply-organization-scope 주석 marker (cluster trace)", () => {
    expect(source).toMatch(/#quote-select-reply-organization-scope|organization member|조직 멤버|organization-scope/i);
  });

  it("enforceAction actor 이미 정합 (session.user.id / session.user.role) — 보존 검사", () => {
    expect(source).toMatch(/userId:\s*session\.user\.id/);
    expect(source).toMatch(/userRole:\s*session\.user\.role/);
  });
});
