/**
 * §11.345-B4 (회귀) — 멤버십/승인요청 write단 IP 보강 sentinel
 *
 * 결재 한도 변경(MEMBER_APPROVAL_LIMIT_CHANGED)·승인 요청 생성(PURCHASE_REQUEST_CREATED)은
 *   거버넌스 감사 이벤트. createAuditLog 가 auditRequestMeta(request)로 IP/UA 캡처하는지 확인.
 *   문자열 매칭은 toContain 사용(esbuild ts-loader 모호성 + NUL 회피).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}

describe("§11.345-B4 — 멤버십/승인요청 라우트 IP 보강", () => {
  it("organizations/[id]/members (approval_limit): auditRequestMeta(request)", () => {
    const src = read("src/app/api/organizations/[id]/members/route.ts");
    expect(src).toContain("auditRequestMeta(request)");
  });

  it("work-queue request-approval (PURCHASE_REQUEST_CREATED): auditRequestMeta(request)", () => {
    const src = read("src/app/api/work-queue/purchase-conversion/[quoteId]/request-approval/route.ts");
    expect(src).toContain("auditRequestMeta(request)");
  });

  it("workspaces/[id]/members/[memberId] (approval_limit): auditRequestMeta(request)", () => {
    const src = read("src/app/api/workspaces/[id]/members/[memberId]/route.ts");
    expect(src).toContain("auditRequestMeta(request)");
  });
});
