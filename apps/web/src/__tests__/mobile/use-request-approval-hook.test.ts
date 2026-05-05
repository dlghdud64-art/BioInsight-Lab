/**
 * §11.209d-mobile-request-approval-cta Phase 1 — RED test
 *
 * apps/mobile/hooks/useApi.ts 에 useRequestApproval mutation hook export.
 * canonical truth = web POST /api/work-queue/purchase-conversion/[quoteId]/request-approval.
 * mobile = thin wrapper (axios mutation + invalidation).
 *
 * Invalidation discipline (4 keys):
 *   - ["quote-approval", quoteId] → useQuoteApproval refetch
 *   - ["quote", quoteId] → useQuoteDetail refetch
 *   - ["quotes"] → list refetch
 *   - ["dashboard-summary"] → 카운터 sync
 *
 * Out of scope:
 *   - manual approver select (workspace 첫 ADMIN 자동 매핑 lesson 정합)
 *   - mutation 직접 실행 (jest-expo 미설치 — source-level grep)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..", "..");
const HOOKS = "apps/mobile/hooks/useApi.ts";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.209d-mobile-request-approval-cta Phase 1 — useRequestApproval", () => {
  it("useRequestApproval export 정의", () => {
    const src = read(HOOKS);
    expect(src).toMatch(/export\s+function\s+useRequestApproval/);
  });

  it("apiClient.post(`/api/work-queue/purchase-conversion/${...}/request-approval`) 호출", () => {
    const src = read(HOOKS);
    expect(src).toMatch(/\/api\/work-queue\/purchase-conversion\/\$\{[^}]+\}\/request-approval/);
  });

  it("onSuccess invalidate ['quote-approval', quoteId] + ['quote', quoteId]", () => {
    const src = read(HOOKS);
    const fnMatch = src.match(/export\s+function\s+useRequestApproval[\s\S]*?(?=export\s+function|\Z)/);
    expect(fnMatch).not.toBeNull();
    if (fnMatch) {
      expect(fnMatch[0]).toMatch(/queryKey:\s*\[\s*["']quote-approval["']/);
      expect(fnMatch[0]).toMatch(/queryKey:\s*\[\s*["']quote["']/);
    }
  });

  it("onSuccess invalidate ['quotes'] + ['dashboard-summary']", () => {
    const src = read(HOOKS);
    const fnMatch = src.match(/export\s+function\s+useRequestApproval[\s\S]*?(?=export\s+function|\Z)/);
    expect(fnMatch).not.toBeNull();
    if (fnMatch) {
      expect(fnMatch[0]).toMatch(/queryKey:\s*\[\s*["']quotes["']\s*\]/);
      expect(fnMatch[0]).toMatch(/queryKey:\s*\[\s*["']dashboard-summary["']/);
    }
  });
});

describe("§11.209d-mobile-request-approval-cta Phase 1 — drift 차단", () => {
  it("§11.209d-mobile-request-approval-cta 코멘트 명시", () => {
    const src = read(HOOKS);
    expect(src).toMatch(/§11\.209d-mobile-request-approval-cta|11\.209d-mobile-request-approval-cta/);
  });
});

describe("§11.209d-mobile-request-approval-cta Phase 1 — mobile UI CTA", () => {
  // __dirname = apps/web/src/__tests__/mobile — 5단계 up = repo root
  const REPO_ROOT_UI = join(__dirname, "..", "..", "..", "..", "..");
  const SCREEN = "apps/mobile/app/quotes/[id].tsx";

  function readUi(rel: string): string {
    return readFileSync(join(REPO_ROOT_UI, rel), "utf8");
  }

  it("useRequestApproval hook import", () => {
    const src = readUi(SCREEN);
    expect(src).toMatch(/useRequestApproval/);
  });

  it("canRequestApproval visibility 분기 명시 (PENDING 분기 외)", () => {
    const src = readUi(SCREEN);
    expect(src).toMatch(/canRequestApproval/);
  });

  it("결재 요청 button label", () => {
    const src = readUi(SCREEN);
    expect(src).toMatch(/결재\s*요청/);
  });
});
