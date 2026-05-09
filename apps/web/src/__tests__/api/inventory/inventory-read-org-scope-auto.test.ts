/**
 * #api-inventory-read-org-scope-auto — Phase 1 RED
 *
 * Goal: 3 read endpoint 의 ownerCondition 이 organizationId queryString
 *       없으면 userId only — pilot/multi-user organization 의 organizationId
 *       scoped row (PILOT_INVENTORY_CATALOG, 호영님 organization 의 다른 user
 *       가 만든 row) 가 안 보이는 drift 차단. M2 (#api-inventory-organization-
 *       scope-auto) 패턴 mirror.
 *
 * canonical truth lock:
 *   - 3 endpoint (auto-reorder GET / reorder-recommendations GET /
 *     export-labels GET) 모두 OrganizationMember.findMany 자동 호출 →
 *     orgIds 수집 → ownerCondition.OR (또는 export-labels 는 organizationId
 *     queryString 없으면 orgIds default).
 *   - { userId: user.id } 분기 보존 (legacy single-user row 호환).
 *   - organizationId queryString 보존 (single-org override path 유지).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const AUTO_REORDER_PATH = resolve(__dirname, "../../../app/api/inventory/auto-reorder/route.ts");
const REORDER_RECS_PATH = resolve(__dirname, "../../../app/api/inventory/reorder-recommendations/route.ts");
const EXPORT_LABELS_PATH = resolve(__dirname, "../../../app/api/inventory/export-labels/route.ts");

const autoReorder = readFileSync(AUTO_REORDER_PATH, "utf8");
const reorderRecs = readFileSync(REORDER_RECS_PATH, "utf8");
const exportLabels = readFileSync(EXPORT_LABELS_PATH, "utf8");

describe("#api-inventory-read-org-scope-auto — auto-reorder GET", () => {
  it("OrganizationMember.findMany 자동 호출", () => {
    expect(autoReorder).toMatch(/organizationMember\.findMany/);
  });

  it("orgIds spread (OR 분기)", () => {
    expect(autoReorder).toMatch(/orgIds|organizationIds|memberships/);
  });

  it("기존 OR ternary fallback (`: []`) 단독 잔존하지 않음", () => {
    expect(autoReorder).not.toMatch(/organizationId\s*\?\s*\[\{\s*organizationId\s*\}\s*\]\s*:\s*\[\]/);
  });

  it("cluster trace marker", () => {
    expect(autoReorder).toMatch(/#api-inventory-read-org-scope-auto|#api-inventory-organization-scope-auto|조직 멤버|organization member/);
  });
});

describe("#api-inventory-read-org-scope-auto — reorder-recommendations GET", () => {
  it("OrganizationMember.findMany 자동 호출", () => {
    expect(reorderRecs).toMatch(/organizationMember\.findMany/);
  });

  it("orgIds spread (OR 분기)", () => {
    expect(reorderRecs).toMatch(/orgIds|organizationIds|memberships/);
  });

  it("기존 OR ternary fallback 단독 잔존하지 않음", () => {
    expect(reorderRecs).not.toMatch(/organizationId\s*\?\s*\[\{\s*organizationId\s*\}\s*\]\s*:\s*\[\]/);
  });

  it("cluster trace marker", () => {
    expect(reorderRecs).toMatch(/#api-inventory-read-org-scope-auto|#api-inventory-organization-scope-auto|조직 멤버|organization member/);
  });
});

describe("#api-inventory-read-org-scope-auto — export-labels GET", () => {
  it("OrganizationMember.findMany 자동 호출 (queryString 없을 때 fallback)", () => {
    // 기존 organizationId 명시 시 OrganizationMember.findFirst 보유 (정합).
    // 추가로 organizationId 없을 때 user 의 모든 org 자동 fetch — findMany.
    expect(exportLabels).toMatch(/organizationMember\.findMany/);
  });

  it("orgIds 또는 organizationIds 키워드 (read scope auto)", () => {
    expect(exportLabels).toMatch(/orgIds|organizationIds|memberships/);
  });

  it("cluster trace marker", () => {
    expect(exportLabels).toMatch(/#api-inventory-read-org-scope-auto|#api-inventory-organization-scope-auto|조직 멤버|organization member/);
  });
});

describe("#api-inventory-read-org-scope-auto — handler invariant 보존", () => {
  it("3 endpoint 모두 GET export 보존", () => {
    expect(autoReorder).toMatch(/export\s+async\s+function\s+(GET|POST)/);
    expect(reorderRecs).toMatch(/export\s+async\s+function\s+GET/);
    expect(exportLabels).toMatch(/export\s+async\s+function\s+GET/);
  });

  it("queryString organizationId 보존 (3 endpoint)", () => {
    expect(autoReorder).toMatch(/organizationId/);
    expect(reorderRecs).toMatch(/searchParams\.get\(["']organizationId["']\)/);
    expect(exportLabels).toMatch(/searchParams\.get\(["']organizationId["']\)/);
  });
});
