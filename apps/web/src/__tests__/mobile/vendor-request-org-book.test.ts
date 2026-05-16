/**
 * §11.229b-4 #mobile-vendor-request-org-book — 호영님 §11.229b-3 자연 후속.
 *
 * 호영님 spec: NEW /api/organizations/[id]/vendors endpoint — 조직 전체 vendor
 *   directory (이 quote 이전 발송 외 모든 등록 vendor). modal recall section 옆
 *   "공급사 등록 목록" section 추가.
 *
 * Strategy:
 *   - NEW server route GET /api/organizations/[id]/vendors. auth + org member
 *     check + db.organizationVendor.findMany. select vendorName + vendorEmail
 *     + isPrimary. orderBy isPrimary desc, vendorName asc.
 *   - NEW mobile hook useOrgVendors(organizationId) — useQuery.
 *   - modal 안 "공급사 등록 목록" section — recall 와 동일 패턴 (checkbox list).
 *   - handleSubmit 안 selectedOrgVendor + selectedRecall + manual 3-way merge.
 *   - canSubmit OR gate 확장 (3 source 중 1+ 시 enabled).
 *
 * canonical truth lock:
 *   - §11.229b/-2/-3 RN Modal + message + recall section 모두 보존.
 *   - 서버 POST /api/quotes/[id]/vendor-requests 변경 0 (vendors array shape 동일).
 *   - §11.229c TLD blacklist + bare IP refine 보존 (org book vendor 도 자동 적용).
 *   - OrganizationVendor model @@unique([organizationId, vendorEmail]) 정합.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const ROUTE_PATH = resolve(
  __dirname,
  "../../app/api/organizations/[id]/vendors/route.ts",
);
const HOOK_PATH = resolve(
  __dirname,
  "../../../../../apps/mobile/hooks/useApi.ts",
);
const MODAL_PATH = resolve(
  __dirname,
  "../../../../../apps/mobile/components/quotes/vendor-request-modal.tsx",
);
const PAGE_PATH = resolve(
  __dirname,
  "../../../../../apps/mobile/app/quotes/[id].tsx",
);
const ROUTE_POST_PATH = resolve(
  __dirname,
  "../../app/api/quotes/[id]/vendor-requests/route.ts",
);

const route = safeRead(ROUTE_PATH);
const hook = safeRead(HOOK_PATH);
const modal = safeRead(MODAL_PATH);
const page = safeRead(PAGE_PATH);
const routePost = safeRead(ROUTE_POST_PATH);

describe("§11.229b-4 #1 — NEW /api/organizations/[id]/vendors GET", () => {
  it("server route file 존재", () => {
    expect(route.length).toBeGreaterThan(0);
  });

  it("GET handler export", () => {
    expect(route).toMatch(/export\s+async\s+function\s+GET/);
  });

  it("auth() session gate + 401", () => {
    expect(route).toMatch(/auth\(\)/);
    expect(route).toMatch(/status:\s*401/);
  });

  it("org member check + 403", () => {
    expect(route).toMatch(/organizationMember/);
    expect(route).toMatch(/status:\s*403/);
  });

  it("db.organizationVendor.findMany — select vendorName + vendorEmail + isPrimary", () => {
    expect(route).toMatch(/organizationVendor\.findMany/);
    expect(route).toMatch(/vendorName:\s*true/);
    expect(route).toMatch(/vendorEmail:\s*true/);
    expect(route).toMatch(/isPrimary:\s*true/);
  });

  it("orderBy isPrimary desc + vendorName asc (운영자 자주 사용 vendor 우선)", () => {
    expect(route).toMatch(/isPrimary[\s\S]{0,100}desc/);
    expect(route).toMatch(/vendorName[\s\S]{0,100}asc/);
  });
});

describe("§11.229b-4 #2 — mobile useOrgVendors hook", () => {
  it("useOrgVendors hook export", () => {
    expect(hook).toMatch(/useOrgVendors/);
  });

  it("useQuery /api/organizations/{id}/vendors", () => {
    expect(hook).toMatch(/\/api\/organizations\/[^"`]+\/vendors/);
  });

  it("enabled gate — organizationId truthy 만 fetch", () => {
    // enabled: !!organizationId 패턴
    expect(hook).toMatch(/useOrgVendors[\s\S]{0,500}enabled/);
  });
});

describe("§11.229b-4 #3 — modal 안 organization book section", () => {
  it("orgVendors prop 추가 (또는 hook 직접 호출)", () => {
    expect(modal).toMatch(/(orgVendors|orgBookVendors|organizationVendors)/);
  });

  it("selectedOrgVendor state (Set 또는 Array)", () => {
    expect(modal).toMatch(/(selectedOrgVendor|selectedBook|orgSelected)/);
  });

  it("section header 한국어 — 공급사 등록 목록 또는 조직 공급사", () => {
    expect(modal).toMatch(/(공급사 등록|조직 공급사|등록 공급사|등록된 공급사)/);
  });

  it("handleSubmit 안 3-source merge — recall + orgBook + manual", () => {
    // selectedOrgVendor iteration (for..of / forEach / map / spread)
    expect(modal).toMatch(/(for\s*\(\s*const\s+\w+\s+of\s+(selectedOrgVendor|selectedBook|orgSelected)|\.\.\.[\w]*(OrgVendor|Book|orgSelected))/);
  });

  it("canSubmit OR gate 3-source 확장", () => {
    // canSubmit 가 manual || recall || orgBook 양방향 OR
    expect(modal).toMatch(/canSubmit/);
    expect(modal).toMatch(/(selectedOrgVendor\.size|selectedBook\.size|orgSelected\.size)/);
  });
});

describe("§11.229b-4 #4 — quotes/[id].tsx orgVendors prop forward", () => {
  it("VendorRequestModal orgVendors prop forward", () => {
    expect(page).toMatch(/(orgVendors|orgBookVendors|organizationVendors)\s*=/);
  });

  it("useOrgVendors hook 호출 또는 quote.organizationId 사용", () => {
    expect(page).toMatch(/(useOrgVendors|organizationId)/);
  });
});

describe("§11.229b-4 #5 — invariant 보존", () => {
  it("§11.229b RN Modal + KeyboardAvoidingView 보존", () => {
    expect(modal).toMatch(/animationType=["']fade["']/);
    expect(modal).toMatch(/KeyboardAvoidingView/);
  });

  it("§11.229b-2 message TextInput multiline 보존", () => {
    expect(modal).toMatch(/multiline/);
  });

  it("§11.229b-3 vendorRequests recall selectedRecall 보존", () => {
    expect(modal).toMatch(/selectedRecall/);
    expect(modal).toMatch(/vendorRequests/);
  });

  it("§11.229c 서버 POST CreateVendorRequestsSchema + INVALID_TLDS 보존", () => {
    expect(routePost).toMatch(/CreateVendorRequestsSchema/);
    expect(routePost).toMatch(/INVALID_TLDS/);
  });

  it("§11.229b-4 trace marker comment", () => {
    expect(modal).toMatch(/§11\.229b-4|11\.229b-4/);
  });
});
