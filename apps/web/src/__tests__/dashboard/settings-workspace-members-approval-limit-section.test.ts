/**
 * #approver-routing-per-user-limit-admin-ui Phase 2 — RED→GREEN test
 *
 * WorkspaceMembersApprovalLimitSection component (NEW) — workspace ADMIN
 * 만 visible, member list (ADMIN role 들) + 각 ADMIN 의 approvalLimit
 * input + 저장 mutation.
 *
 * settings page (operator section) 안 inline — same-canvas 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const COMPONENT = "src/components/settings/workspace-members-approval-limit-section.tsx";
const SETTINGS = "src/app/dashboard/settings/page.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("#approver-routing-per-user-limit-admin-ui — component", () => {
  it("workspace-members-approval-limit-section.tsx 신규 file 존재", () => {
    const src = read(COMPONENT);
    expect(src.length).toBeGreaterThan(0);
  });

  it("결재 한도 한국어 label 명시", () => {
    const src = read(COMPONENT);
    expect(src).toMatch(/결재\s*한도|단일\s*건\s*한도/);
  });

  it("approvalLimit input 타입 number", () => {
    const src = read(COMPONENT);
    expect(src).toMatch(/type=["']number["']/);
  });

  it("workspace members fetch (/api/workspaces/[id]/members)", () => {
    const src = read(COMPONENT);
    expect(src).toMatch(/\/api\/workspaces\/\$\{[^}]+\}\/members/);
  });

  it("PATCH /api/workspaces/[id]/members/[memberId] mutation", () => {
    const src = read(COMPONENT);
    expect(src).toMatch(/\/api\/workspaces\/\$\{[^}]+\}\/members\/\$\{[^}]+\}/);
    expect(src).toMatch(/method:\s*["']PATCH["']/);
  });

  it("ADMIN role visibility 분기 (form section hide if not admin)", () => {
    const src = read(COMPONENT);
    expect(src).toMatch(/role\s*===?\s*["']ADMIN["']|isAdmin/);
    expect(src).toMatch(/!isAdmin[\s\S]*?return\s+null|isAdmin[\s\S]*?return\s+null/);
  });

  it("null 무제한 표시 (한국어 '무제한' 또는 비슷)", () => {
    const src = read(COMPONENT);
    expect(src).toMatch(/무제한|미설정|제한 없음/);
  });

  it("workspace ADMIN role member 만 list (MEMBER 제외)", () => {
    const src = read(COMPONENT);
    // filter ADMIN role 패턴
    expect(src).toMatch(/filter\([\s\S]*?role\s*===?\s*["']ADMIN["']|m\.role\s*===?\s*["']ADMIN["']/);
  });
});

describe("#approver-routing-per-user-limit-admin-ui — settings page integration", () => {
  it("WorkspaceMembersApprovalLimitSection import + render", () => {
    const src = read(SETTINGS);
    expect(src).toMatch(/WorkspaceMembersApprovalLimitSection/);
    expect(src).toMatch(/from\s+["']@\/components\/settings\/workspace-members-approval-limit-section["']/);
  });
});
