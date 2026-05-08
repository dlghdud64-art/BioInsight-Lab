/**
 * #quote-responses-organization-scope — RED test
 *
 * Goal: responses/route.ts GET (collection) + responses/[responseId]/route.ts
 *       GET (negotiation history) 두 endpoint 모두 ownership check 추가
 *       (info leak 차단). multi-user organization 정합 + security posture
 *       강화.
 *
 * canonical truth lock:
 *   - quote ownership 검증 — user owner OR organization member.
 *   - 다른 organization 멤버가 quote ID 알면 vendor response / 협상 history
 *     조회 차단.
 *   - PATCH 분기 (vendor 본인만 수정) 는 별개 — 외부 vendor actor 분리, 본
 *     cluster scope 0.
 *   - 404 fallback (existence leak avoidance) 일관 — "not yours" 노출 안 함.
 *
 * vendor-requests / share / select-reply cluster 와 동일 sweep pattern.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const COLLECTION_PATH = resolve(__dirname, "../../../app/api/quotes/[id]/responses/route.ts");
const ITEM_PATH = resolve(__dirname, "../../../app/api/quotes/[id]/responses/[responseId]/route.ts");

const collectionSource = readFileSync(COLLECTION_PATH, "utf8");
const itemSource = readFileSync(ITEM_PATH, "utf8");

describe("#quote-responses-organization-scope — collection GET ownership 분기", () => {
  it("organizationMember 매칭 분기 존재", () => {
    expect(collectionSource).toMatch(/organizationMember\.findFirst|isOrgMember|organizationId/);
  });

  it("user owner 분기 — quote.userId === session.user.id", () => {
    expect(collectionSource).toMatch(/quote\.userId\s*===\s*session\.user\.id|quote\.userId\s*!==\s*session\.user\.id/);
  });

  it("404 fallback (existence leak avoidance) 또는 403", () => {
    expect(collectionSource).toMatch(/견적을 찾을 수 없습니다|Forbidden|status:\s*404|status:\s*403/);
  });

  it("#quote-responses-organization-scope 주석 marker (cluster trace)", () => {
    expect(collectionSource).toMatch(/#quote-responses-organization-scope|organization member|조직 멤버|organization-scope|info leak/i);
  });
});

describe("#quote-responses-organization-scope — item GET (history) ownership 분기", () => {
  it("organizationMember 매칭 분기 존재", () => {
    expect(itemSource).toMatch(/organizationMember\.findFirst|isOrgMember|organizationId/);
  });

  it("user owner 분기 — quote.userId === session.user.id", () => {
    expect(itemSource).toMatch(/quote\.userId\s*===\s*session\.user\.id|quote\.userId\s*!==\s*session\.user\.id/);
  });

  it("history GET 안에 ownership check (response → quote 검증)", () => {
    // history GET 분기 안에 quote 검증이 들어가야
    // canonical: GET 함수 안에서 quoteResponse.findUnique → quote 조회 → ownership
    expect(itemSource).toMatch(/quoteResponse\.findUnique|quote\.findUnique|isOrgMember|quote\.userId/);
  });

  it("PATCH 분기 (vendor 본인 수정) 보존 — 외부 vendor actor 분리", () => {
    // PATCH 의 vendor email 매칭 + SUPPLIER role 보존
    expect(itemSource).toMatch(/role\s*!==\s*"SUPPLIER"|SUPPLIER/);
    expect(itemSource).toMatch(/existingResponse\.vendor\.email/);
  });

  it("#quote-responses-organization-scope 주석 marker (cluster trace)", () => {
    expect(itemSource).toMatch(/#quote-responses-organization-scope|organization member|조직 멤버|organization-scope|info leak/i);
  });
});
