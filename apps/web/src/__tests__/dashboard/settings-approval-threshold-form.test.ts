/**
 * #approver-routing-threshold-admin-ui Phase 1 — RED test
 *
 * settings/page.tsx 가 결재 임계치 form section 추가:
 *   - input number (KRW, default 10,000,000)
 *   - 한국어 label "결재 임계치"
 *   - ADMIN role 만 visible (form section 또는 input disable)
 *   - 저장 mutation (/api/workspaces/[id] PATCH)
 *   - onSuccess invalidate ['workspace'] 또는 비슷한 query key
 *
 * Source-level grep — UI runtime 별도 smoke (호영님 host).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const SETTINGS = "src/app/dashboard/settings/page.tsx";
const COMPONENT = "src/components/settings/approval-threshold-section.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("#approver-routing-threshold-admin-ui — settings page integration", () => {
  it("ApprovalThresholdSection import + render", () => {
    const src = read(SETTINGS);
    expect(src).toMatch(/ApprovalThresholdSection/);
    expect(src).toMatch(/from\s+["']@\/components\/settings\/approval-threshold-section["']/);
  });

  it("§11.209d-approver-routing 코멘트 명시 (drift 차단)", () => {
    const src = read(SETTINGS);
    expect(src).toMatch(/§11\.209d-approver-routing|11\.209d-approver-routing/);
  });
});

describe("#approver-routing-threshold-admin-ui — ApprovalThresholdSection component", () => {
  it("결재 임계치 한국어 label 명시", () => {
    const src = read(COMPONENT);
    expect(src).toMatch(/결재\s*임계치/);
  });

  it("approvalThresholdKrw state 또는 fetch 사용", () => {
    const src = read(COMPONENT);
    expect(src).toMatch(/approvalThresholdKrw/);
  });

  it("input type='number' 정의", () => {
    const src = read(COMPONENT);
    expect(src).toMatch(/type=["']number["']/);
  });

  it("저장 mutation — /api/workspaces/${...} PATCH 호출", () => {
    const src = read(COMPONENT);
    expect(src).toMatch(/\/api\/workspaces\/\$\{[^}]+\}/);
    expect(src).toMatch(/method:\s*["']PATCH["']/);
  });

  it("ADMIN role visibility 분기 (form section 이 ADMIN 일 때만)", () => {
    const src = read(COMPONENT);
    expect(src).toMatch(/role\s*===?\s*["']ADMIN["']|isAdmin|admin\s*&&/i);
    // ADMIN 외 → null return (dead button 0)
    expect(src).toMatch(/!isAdmin[\s\S]*?return\s+null|isAdmin[\s\S]*?return\s+null/);
  });
});
