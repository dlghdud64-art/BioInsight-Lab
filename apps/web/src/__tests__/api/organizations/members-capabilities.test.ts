/**
 * §11.193d Phase 2.4 #organization-member-capabilities-edit
 *
 * PATCH /api/organizations/[id]/members/[memberId]/capabilities
 *
 * 검증 대상 (source-level + handler shape):
 *   - PatchBodySchema (zod whitelist 강제)
 *   - 401 / 403 / 404 / 400 분기 존재
 *   - enforceAction + audit (complete/fail) 호출
 *   - workflowCapabilities Json column update
 *
 * 본 test 는 actual DB / auth 없이 source-level 검증 — fast vitest.
 * E2E (실제 PATCH + DB persist) 는 prod smoke 단계 (Phase 2.5) 에서.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROUTE_PATH = resolve(
  __dirname,
  "../../../app/api/organizations/[id]/members/[memberId]/capabilities/route.ts",
);
const SOURCE = readFileSync(ROUTE_PATH, "utf8");

describe("§11.193d Phase 2.4 capabilities PATCH endpoint — security 분기", () => {
  it("auth required (401 분기)", () => {
    expect(SOURCE).toMatch(/auth\(\)/);
    expect(SOURCE).toMatch(/Unauthorized[\s\S]*?status:\s*401/);
  });

  it("requester 권한 (OWNER/ADMIN) check + 403", () => {
    expect(SOURCE).toMatch(
      /role:\s*\{\s*in:\s*\[OrganizationRole\.OWNER,\s*OrganizationRole\.ADMIN\]/,
    );
    expect(SOURCE).toMatch(/Admin access required[\s\S]*?status:\s*403/);
  });

  it("cross-org 차단 — target member 가 해당 organization 에 속해야 함 + 404", () => {
    expect(SOURCE).toMatch(/findFirst\(\{[\s\S]*?id:\s*memberId[\s\S]*?organizationId/);
    expect(SOURCE).toMatch(/Member not found[\s\S]*?status:\s*404/);
  });
});

describe("§11.193d Phase 2.4 capabilities PATCH endpoint — body validation", () => {
  it("zod schema PatchBodySchema 정의 + WORKFLOW_CAPABILITIES whitelist 강제", () => {
    expect(SOURCE).toMatch(
      /PatchBodySchema\s*=\s*z\.object\(\{[\s\S]*?capabilities:\s*z\.array\(z\.enum\(WORKFLOW_CAPABILITIES\)\)/,
    );
  });

  it("invalid body → 400 (parsed.success false)", () => {
    expect(SOURCE).toMatch(/parsed\.success/);
    expect(SOURCE).toMatch(/Invalid body[\s\S]*?status:\s*400/);
  });
});

describe("§11.193d Phase 2.4 capabilities PATCH endpoint — audit + persistence", () => {
  it("enforceAction (action='member_capabilities_change') + complete/fail audit", () => {
    expect(SOURCE).toMatch(/enforceAction\(\{[\s\S]*?action:\s*["']member_capabilities_change["']/);
    expect(SOURCE).toMatch(/enforcement\.complete\(\{/);
    expect(SOURCE).toMatch(/enforcement(?:\?\.|\.)?fail\(\)/);
  });

  it("DB update — workflowCapabilities Json column write", () => {
    expect(SOURCE).toMatch(
      /db\.organizationMember\.update\(\{[\s\S]*?data:\s*\{\s*workflowCapabilities:\s*capabilities/,
    );
  });

  it("audit beforeState/afterState capture (capabilities diff)", () => {
    expect(SOURCE).toMatch(/beforeState:\s*\{[\s\S]*?previousCapabilities/);
    expect(SOURCE).toMatch(/afterState:\s*\{[\s\S]*?newCapabilities/);
  });
});

describe("§11.193d Phase 2.4 — import 정합", () => {
  it("WORKFLOW_CAPABILITIES import (whitelist source)", () => {
    expect(SOURCE).toMatch(
      /import\s*\{\s*WORKFLOW_CAPABILITIES\s*\}\s*from\s*["']@\/lib\/permissions\/workflow-capabilities["']/,
    );
  });
  it("zod import", () => {
    expect(SOURCE).toMatch(/import\s*\{\s*z\s*\}\s*from\s*["']zod["']/);
  });
});
