/**
 * §11.348-A-4b (회귀) — 입고안 리뷰 UI sentinel
 *
 * A-4b: 연구소가 PENDING_REVIEW 입고안을 보고 승인/반려하는 same-canvas 패널 +
 * list API. receiving 랜딩에 통합(page-per-feature 금지). CSRF: 공급사 회신
 * POST 는 exempt(공개 token) 등록.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}
const LIST_API = "src/app/api/receiving-drafts/route.ts";
const PANEL = "src/components/receiving/receiving-review-panel.tsx";
const PAGE = "src/app/dashboard/receiving/page.tsx";
const CSRF = "src/lib/security/csrf-route-registry.ts";

describe("§11.348-A-4b — 파일 존재", () => {
  it("list API + 패널", () => {
    expect(existsSync(join(APP_WEB_ROOT, LIST_API))).toBe(true);
    expect(existsSync(join(APP_WEB_ROOT, PANEL))).toBe(true);
  });
});

describe("§11.348-A-4b — list API (스코프 조회, mutation 0)", () => {
  it("auth + 조직/본인 스코프 + PENDING_REVIEW 기본", () => {
    const src = read(LIST_API);
    expect(src).toContain("await auth()");
    expect(src).toContain("db.receivingDraft.findMany");
    expect(src).toContain('"PENDING_REVIEW"');
    expect(src).toContain("organizationId: { in: orgIds }");
  });
});

describe("§11.348-A-4b — 패널 (csrfFetch 승인/반려)", () => {
  it("list fetch + csrfFetch approve/reject + 0건 숨김", () => {
    const src = read(PANEL);
    expect(src).toContain('from "@/lib/api-client"'); // csrfFetch
    expect(src).toContain("/api/receiving-drafts?status=PENDING_REVIEW");
    expect(src).toContain("/api/receiving-drafts/${id}/${action}");
    expect(src).toContain("승인·입고");
    expect(src).toContain("if (drafts.length === 0) return null");
  });
});

describe("§11.348-A-4b — same-canvas 통합 (page-per-feature 금지)", () => {
  it("receiving 랜딩에 패널 마운트", () => {
    const src = read(PAGE);
    expect(src).toContain('from "@/components/receiving/receiving-review-panel"');
    expect(src).toContain("<ReceivingReviewPanel />");
  });
});

describe("§11.348-A-4b — CSRF: 공급사 회신 POST exempt", () => {
  it("/api/receiving/[token]/response public_token_auth 등록", () => {
    const src = read(CSRF);
    expect(src).toContain("/api/receiving/[token]/response");
    expect(src).toContain("public_token_auth");
  });
});
