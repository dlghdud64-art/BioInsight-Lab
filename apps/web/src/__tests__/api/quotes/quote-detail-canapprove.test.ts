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

/* 🛑 주석 제거본으로 본다. 이 파일의 단언은 소스 전체 grep 이라, 승계 근거를 적은
 * 주석에 옛 토큰(TeamRole 등)이 들어가면 **주석이 단언을 통과시킨다.**
 * 실제로 (나)-2 에서 그렇게 false GREEN 이 났다. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.209d-mobile-mutation Phase 1 — quote detail canApprove", () => {
  it("response.approval 에 canApprove field 노출", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/canApprove/);
  });

  it("승인권자 조회 — organizationMember(userId_organizationId) + role 체크", () => {
    /* 🔑 승계 (§approver-axis (나)-2 · 2026-08-30 · **결정 교체**).
     * 옛 결정: latestPending PR.teamId 의 TeamRole.ADMIN.
     * 교체 이유: (나)-1b 가 서버 승인 게이트를 조직 축(APPROVER·ADMIN·OWNER)으로
     *   옮겼다. 표면만 팀 축에 남으면 승인 권한자에게 CTA 가 숨는다 —
     *   dead button 의 반대 방향(살아 있는데 감춰진 버튼)이다.
     * 🛑 이 sentinel 이 잠그는 결정은 "canApprove 가 서버 권한 축과 같다" 이지
     *   어느 enum 이냐가 아니다. 축이 바뀌었으므로 축을 승계한다. */
    const src = stripComments(read(ROUTE));
    expect(src).toMatch(/db\.organizationMember\.findUnique/);
    expect(src).toMatch(/userId_organizationId/);
    /* 🛑 select 부재 잠금 — organizationId 를 안 실으면 canApprove 가 항상 false 다.
     * db 가 any 라 tsc 가 못 잡는 자리라 여기서 잡는다. */
    expect(src).toMatch(/organizationId: true,/);
  });

  it("A축 정본으로 판정한다 — 사본 금지 (APPROVER · ADMIN · OWNER)", () => {
    const src = stripComments(read(ROUTE));
    expect(src).toMatch(/import \{ isOrgApprover \} from "@\/lib\/permissions\/org-approver-roles"/);
    expect(src).toMatch(/canApprove = isOrgApprover\(memberForApproval\?\.role\)/);
    /* 역방향 잠금 — 팀 축이 되살아나면 RED. prod TeamMember 0 이라 항상 false 가 된다. */
    expect(src).not.toMatch(/TeamRole/);
    expect(src).not.toMatch(/db\.teamMember/);
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
