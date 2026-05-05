/**
 * §11.209d-mobile-mutation Phase 1 #quote-detail-canapprove — RED test
 *
 * /api/quotes/[id] GET response.approval 안에 canApprove boolean 노출.
 * mobile UI (그리고 web detail panel) 가 "승인"/"반려" CTA visibility
 * 분기에 사용. dead button 0 lock — canApprove === false 시 CTA hide.
 *
 * canonical truth: PurchaseRequest + teamMember.role check
 *   - PENDING + (current user 가 같은 team 의 ADMIN 또는 OWNER) → true
 *   - NOT_REQUIRED / APPROVED / REJECTED → false (이미 종결됨 또는 결재 불필요)
 *   - member (TeamRole !== ADMIN) → false
 *
 * Out of scope:
 *   - 실제 권한 enforcement (server enforceAction + ADMIN role check 가
 *     canonical — 본 field 는 visibility 분기일 뿐)
 *   - canApprove 가 false 인데 mutation 호출 시 server 가 403 반환
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const ROUTE = "src/app/api/quotes/[id]/route.ts";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.209d-mobile-mutation Phase 1 — quote detail canApprove", () => {
  it("response.approval 에 canApprove field 노출", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/canApprove/);
  });

  it("teamMember 조회 (current user.id + quote.organizationId 또는 teamId 기반)", () => {
    const src = read(ROUTE);
    // teamMember 또는 organizationMember 조회 + role 체크
    expect(src).toMatch(/teamMember|TeamRole\.ADMIN|teamMember\.role/);
  });

  it("ADMIN role 일 때만 canApprove === true 가능 (TeamRole.ADMIN 명시)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/TeamRole\.ADMIN/);
  });

  it("internalApprovalStatus PENDING 가 canApprove === true 의 전제 (PENDING 검사 명시)", () => {
    const src = read(ROUTE);
    // PENDING 또는 internalApprovalStatus === "PENDING" 패턴 — canApprove
    // 분기 안에 있어야 함 (내부 분기, source-level grep 한계 — 단순 존재만)
    expect(src).toMatch(/internalApprovalStatus\s*===\s*["']PENDING["']|PENDING/);
  });

  it("§11.209d-mobile-mutation 코멘트 명시 (drift 차단)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/§11\.209d-mobile-mutation|11\.209d-mobile-mutation/);
  });
});

describe("§11.209d-mobile-mutation Phase 1 — types/index.ts QuoteApproval.canApprove", () => {
  // __dirname = apps/web/src/__tests__/api/quotes — 6단계 up = repo root
  const REPO_ROOT_MOBILE = join(__dirname, "..", "..", "..", "..", "..", "..");
  const TYPES = "apps/mobile/types/index.ts";

  function readMobile(rel: string): string {
    return readFileSync(join(REPO_ROOT_MOBILE, rel), "utf8");
  }

  it("QuoteApproval interface 안에 canApprove?: boolean", () => {
    const src = readMobile(TYPES);
    // optional field — 기존 GET response 의 backward compat 유지
    expect(src).toMatch(/canApprove\?:\s*boolean/);
  });

  it("§11.209d-mobile-mutation 코멘트 명시 (drift 차단)", () => {
    const src = readMobile(TYPES);
    expect(src).toMatch(/§11\.209d-mobile-mutation|11\.209d-mobile-mutation/);
  });
});
