/**
 * §inventory-org-required (호영님 2026-09-11) —
 * **재고는 조직의 것이다. 조직 없는 재고를 만들지 않고, 막다른 길로 끝내지 않는다.**
 *
 * ── 제품 판정 ──
 * LabAxis 는 랩 운영 OS 이고 개인 재고는 제품 개념이 아니다. `ProductInventory.organizationId`
 * nullable 은 허용이지 의도가 아니다.
 *
 * ── 결함 (2026-09-11 생성 경로 전수) ──
 *   POST /api/inventory        no_organization 을 "개인 재고" 로 흘렸다(729c73cc 의 fallback)
 *   inventory/import/commit    조직을 아예 해석하지 않았다(파일에 organizationId 0회)
 * 그 결과가 prod BCP 1행 · orgOwnership.ownerlessCount 1 이다. 두 곳을 막기 전에 DML 로
 * 보정하면 같은 자리에 또 쌓인다(호영님 순서: 전수 → 막기 → DML → NOT NULL DDL).
 *
 * ── 이 파일이 안 보는 것 (조항 11) ──
 *   1. smart-receiving 의 NO_ORGANIZATION 응답에는 아직 action(갈 길)이 없다. 그 문구가
 *      scan-org-identity 에 핀돼 있어 이번에 건드리지 않았다 · 별건.
 *   2. bulk 라우트는 body 의 organizationId 를 멤버십 검증 뒤 쓴다(org-session-authority 소관).
 *   3. GET /api/inventory 는 여전히 { userId } 분기로 옛 개인 재고를 보여 준다(과거 행 호환).
 *   4. DB 제약 — NOT NULL DDL 은 BCP 보정 뒤 별건.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  noOrganizationBody,
  NO_ORGANIZATION_CODE,
  ORGANIZATION_ENTRY_HREF,
} from "@/lib/organizations/no-organization";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const WEB_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => stripComments(readFileSync(join(WEB_ROOT, rel), "utf8"));

/** POST 핸들러 본문 — `export async function POST` 부터 다음 export 직전까지(블록 경계). */
function postHandler(code: string): string {
  const start = code.search(/export\s+async\s+function\s+POST\b/);
  expect(start, "POST 핸들러가 없다").toBeGreaterThan(-1);
  const rest = code.slice(start + 1);
  const next = rest.search(/\nexport\s+(async\s+)?function\s/);
  return next < 0 ? rest : rest.slice(0, next);
}

const ROUTES = [
  "src/app/api/inventory/route.ts",
  "src/app/api/inventory/import/commit/route.ts",
];

describe("§inventory-org-required · 조직 없는 재고를 만들지 않는다", () => {
  for (const rel of ROUTES) {
    it(`🛑 ${rel} · 조직이 없으면 422 로 거절하고, 그 거절은 enforceAction 보다 앞이다`, () => {
      const body = postHandler(read(rel));
      const resolveAt = body.search(/resolveOrganizationIdForMutation\s*\(/);
      const rejectAt = body.search(/if\s*\(\s*!orgResolution\.ok\s*\)\s*\{\s*return\s+noOrganizationResponse\(/);
      const enforceAt = body.indexOf("enforceAction({");
      expect(resolveAt, "세션 resolver 가 없다").toBeGreaterThan(-1);
      expect(rejectAt, "조직 없음 거절 분기가 없다").toBeGreaterThan(resolveAt);
      expect(enforceAt, "enforceAction 이 없다").toBeGreaterThan(-1);
      expect(rejectAt, "거절이 enforceAction 뒤에 있다").toBeLessThan(enforceAt);
    });
  }

  it("🛑 POST /api/inventory 에 개인 재고 fallback 이 남아 있지 않다", () => {
    const body = postHandler(read("src/app/api/inventory/route.ts"));
    expect(body).not.toMatch(/userId:\s*activeOrganizationId\s*\?\s*null/);
    expect(body).not.toMatch(/orgResolution\.ok\s*\?\s*orgResolution\.organizationId\s*:\s*null/);
  });

  it("🛑 import/commit 은 새 재고에 조직을 싣고, 기존 재고를 조직 축으로 찾는다", () => {
    const body = postHandler(read("src/app/api/inventory/import/commit/route.ts"));
    const create = body.slice(body.indexOf("db.productInventory.create({"));
    expect(create.slice(0, create.indexOf("},"))).toMatch(/\borganizationId\b/);
    const lookup = body.slice(body.indexOf("db.productInventory.findFirst({"));
    const where = lookup.slice(0, lookup.indexOf("});"));
    expect(where).toMatch(/\borganizationId\b/);
    expect(where).not.toMatch(/userId:\s*session\.user\.id/);
  });
});

describe("§inventory-org-required · 막다른 길로 끝내지 않는다", () => {
  it("🔑 422 본문은 코드와 함께 갈 길(action)을 싣는다", () => {
    const b = noOrganizationBody("재고를 등록할 수 없습니다");
    expect(b.code).toBe(NO_ORGANIZATION_CODE);
    expect(b.code).toBe("NO_ORGANIZATION"); // 리터럴 병기 · smart-receiving 과 같은 코드
    expect(b.action.href).toBe(ORGANIZATION_ENTRY_HREF);
    expect(b.error).toContain("재고를 등록할 수 없습니다");
  });

  it("🛑 갈 길 href 는 실재하는 화면이다 (링크가 또 막다른 길이면 안 된다)", () => {
    const page = join(WEB_ROOT, "src/app" + ORGANIZATION_ENTRY_HREF, "page.tsx");
    expect(existsSync(page), `${ORGANIZATION_ENTRY_HREF} 화면이 없다`).toBe(true);
    // 그 화면에서 조직을 실제로 만들 수 있어야 한다(POST /api/organizations)
    expect(read("src/app" + ORGANIZATION_ENTRY_HREF + "/page.tsx")).toMatch(
      /csrfFetch\(\s*["']\/api\/organizations["'][\s\S]{0,120}?method:\s*["']POST["']/,
    );
  });

  it("🛑 두 화면이 그 갈 길을 버튼으로 띄운다 (응답만 싣고 화면이 버리면 막다른 길이다)", () => {
    for (const rel of [
      "src/app/dashboard/inventory/inventory-content.tsx",
      "src/components/inventory/import-wizard.tsx",
    ]) {
      const code = read(rel);
      expect(code, `${rel} 가 오류의 action 을 넘기지 않는다`).toMatch(/action:\s*(e|error)\.action/);
      expect(code, `${rel} 가 ToastAction 을 띄우지 않는다`).toMatch(/<ToastAction[\s\S]{0,160}?router\.push\(\s*next\.href\s*\)/);
    }
  });
});
