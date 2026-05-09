/**
 * #quote-multi-user-ownership-sweep-final — RED test
 *
 * Goal: vendor-requests cluster sub-trial 의 마지막 sweep — rfq-token / versions /
 *       history 의 ownership check 정합 (organizationMember 분기 추가).
 *
 * canonical truth lock:
 *   - rfq-token POST: verifyQuoteAccess 가 user owner OR organization member.
 *   - versions: 2 spots (60-65 + 187-192) 의 ownership check 가 organization 분기 추가.
 *   - history GET: ownership check 신설 (info leak 차단, vendor-responses 패턴).
 *   - detail GET 은 이미 GREEN (변경 0).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const RFQ_PATH = resolve(__dirname, "../../../app/api/quotes/[id]/rfq-token/route.ts");
const VERSIONS_PATH = resolve(__dirname, "../../../app/api/quotes/[id]/versions/route.ts");
const HISTORY_PATH = resolve(__dirname, "../../../app/api/quotes/[id]/history/route.ts");

const rfq = readFileSync(RFQ_PATH, "utf8");
const versions = readFileSync(VERSIONS_PATH, "utf8");
const history = readFileSync(HISTORY_PATH, "utf8");

describe("#quote-multi-user-ownership-sweep-final — rfq-token POST", () => {
  it("organizationMember 분기 추가", () => {
    expect(rfq).toMatch(/organizationMember\.findFirst|isOrgMember|organizationId/);
  });

  it("기존 user owner path 보존", () => {
    expect(rfq).toMatch(/userId/);
  });

  it("cluster trace marker", () => {
    expect(rfq).toMatch(/#quote-multi-user-ownership-sweep-final|organization member|조직 멤버/);
  });
});

describe("#quote-multi-user-ownership-sweep-final — versions", () => {
  it("organizationMember 분기 추가", () => {
    expect(versions).toMatch(/organizationMember\.findFirst|isOrgMember/);
  });

  it("기존 user-level check 잔존하지 않음 — isOwner OR isOrgMember 형태", () => {
    // 단독 `quote.userId !== session.user.id` block 이 fallback 없이 fail throw 하면 안 됨.
    // 대신 isOwner OR isOrgMember 패턴.
    expect(versions).toMatch(/isOwner[\s\S]{0,200}isOrgMember|!isOwner\s*&&\s*!isOrgMember/);
  });

  it("cluster trace marker", () => {
    expect(versions).toMatch(/#quote-multi-user-ownership-sweep-final|organization member|조직 멤버/);
  });
});

describe("#quote-multi-user-ownership-sweep-final — history GET", () => {
  it("ownership check 추가 — quote.findUnique + isOwner/isOrgMember", () => {
    expect(history).toMatch(/quote\.findUnique|quote\.findFirst/);
    expect(history).toMatch(/isOwner|isOrgMember|organizationMember/);
  });

  it("404 fallback (existence leak avoidance)", () => {
    expect(history).toMatch(/견적을 찾을 수 없습니다|status:\s*404/);
  });

  it("cluster trace marker", () => {
    expect(history).toMatch(/#quote-multi-user-ownership-sweep-final|organization member|info leak|조직 멤버/);
  });
});
