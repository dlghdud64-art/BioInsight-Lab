/**
 * #approver-routing-per-user-limit-organization-member-admin-ui Phase 2 —
 * RED→GREEN test
 *
 * OrgMembersApprovalLimitSection (NEW) — organization 의 OWNER/ADMIN
 * role member list (escalation 결재자) + 각 member 의 approvalLimit form.
 * settings page operator section 안 inline mount (same-canvas).
 *
 * 직전 WorkspaceMembersApprovalLimitSection 패턴 정합 — UI 일관성.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const COMPONENT = "src/components/settings/org-members-approval-limit-section.tsx";
const SETTINGS = "src/app/dashboard/settings/page.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("#approver-routing-per-user-limit-organization-member-admin-ui — component", () => {
  it("org-members-approval-limit-section.tsx 신규 file 존재", () => {
    const src = read(COMPONENT);
    expect(src.length).toBeGreaterThan(0);
  });

  it("결재 한도 한국어 label", () => {
    const src = read(COMPONENT);
    expect(src).toMatch(/결재\s*한도|단일\s*건\s*한도/);
  });

  it("input type=number", () => {
    const src = read(COMPONENT);
    expect(src).toMatch(/type=["']number["']/);
  });

  it("organization members fetch (/api/organizations/[id]/members)", () => {
    const src = read(COMPONENT);
    expect(src).toMatch(/\/api\/organizations\/\$\{[^}]+\}\/members/);
  });

  it("PATCH /api/organizations/[id]/members mutation", () => {
    const src = read(COMPONENT);
    expect(src).toMatch(/method:\s*["']PATCH["']/);
  });

  it("OWNER + ADMIN role member list (VIEWER/REQUESTER/APPROVER 제외)", () => {
    const src = read(COMPONENT);
    // role 이 OWNER 또는 ADMIN 인 멤버만 list (escalation 결재자만)
    expect(src).toMatch(/OWNER[\s\S]{0,80}ADMIN|ADMIN[\s\S]{0,80}OWNER/);
  });

  it("ADMIN/OWNER role visibility 분기 (form section hide if not org admin/owner)", () => {
    const src = read(COMPONENT);
    expect(src).toMatch(/role\s*===?\s*["']ADMIN["']|role\s*===?\s*["']OWNER["']|isOrgAdmin/);
    expect(src).toMatch(/return\s+null/);
  });

  it("null 무제한 표시", () => {
    const src = read(COMPONENT);
    expect(src).toMatch(/무제한|미설정|제한 없음/);
  });
});

describe("#approver-routing-per-user-limit-organization-member-admin-ui — settings page integration", () => {
  it("OrgMembersApprovalLimitSection import + render", () => {
    const src = read(SETTINGS);
    expect(src).toMatch(/OrgMembersApprovalLimitSection/);
    expect(src).toMatch(/from\s+["']@\/components\/settings\/org-members-approval-limit-section["']/);
  });
});
