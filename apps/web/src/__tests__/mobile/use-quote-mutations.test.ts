/**
 * §11.209d-mobile-mutation Phase 1 #use-quote-mutations — RED test
 *
 * apps/mobile/hooks/useApi.ts 가 결재 mutation hook 2개 export:
 *   - useApproveQuote(purchaseRequestId) — POST /api/request/{id}/approve
 *   - useRejectQuote(purchaseRequestId, reason) — POST /api/request/{id}/reject
 *
 * canonical truth = web mutation route (/api/request/[id]/approve|reject).
 * mobile = thin wrapper (axios mutation + invalidation).
 *
 * Invalidation discipline:
 *   - ["quote-approval", quoteId] → useQuoteApproval refetch
 *   - ["quote", quoteId] → useQuoteDetail refetch
 *   - ["quotes"] → list refetch (status badge sync)
 *
 * Out of scope:
 *   - useRequestApproval (결재 요청) — 별도 batch (결재자 select UX 복잡)
 *   - mutation 직접 실행 (jest-expo 미설치 — source-level grep 으로 검증)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..", "..");
const HOOKS = "apps/mobile/hooks/useApi.ts";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.209d-mobile-mutation Phase 1 — useApproveQuote", () => {
  it("useApproveQuote export 정의", () => {
    const src = read(HOOKS);
    expect(src).toMatch(/export\s+function\s+useApproveQuote/);
  });

  it("apiClient.post(`/api/request/${...}/approve`) 호출", () => {
    const src = read(HOOKS);
    expect(src).toMatch(/\/api\/request\/\$\{[^}]+\}\/approve/);
  });

  it("onSuccess invalidate ['quote-approval', quoteId] + ['quote', quoteId]", () => {
    const src = read(HOOKS);
    // useApproveQuote 함수 안에 둘 다 invalidate
    const fnMatch = src.match(/export\s+function\s+useApproveQuote[\s\S]*?(?=export\s+function|\Z)/);
    expect(fnMatch).not.toBeNull();
    if (fnMatch) {
      expect(fnMatch[0]).toMatch(/queryKey:\s*\[\s*["']quote-approval["']/);
      expect(fnMatch[0]).toMatch(/queryKey:\s*\[\s*["']quote["']/);
    }
  });
});

describe("§11.209d-mobile-mutation Phase 1 — useRejectQuote", () => {
  it("useRejectQuote export 정의", () => {
    const src = read(HOOKS);
    expect(src).toMatch(/export\s+function\s+useRejectQuote/);
  });

  it("apiClient.post(`/api/request/${...}/reject`, { reason })", () => {
    const src = read(HOOKS);
    expect(src).toMatch(/\/api\/request\/\$\{[^}]+\}\/reject/);
    // body 에 reason 전달
    expect(src).toMatch(/reason/);
  });

  it("onSuccess invalidate ['quote-approval', quoteId] + ['quote', quoteId]", () => {
    const src = read(HOOKS);
    const fnMatch = src.match(/export\s+function\s+useRejectQuote[\s\S]*?(?=export\s+function|\Z)/);
    expect(fnMatch).not.toBeNull();
    if (fnMatch) {
      expect(fnMatch[0]).toMatch(/queryKey:\s*\[\s*["']quote-approval["']/);
      expect(fnMatch[0]).toMatch(/queryKey:\s*\[\s*["']quote["']/);
    }
  });
});

describe("§11.209d-mobile-mutation Phase 1 — drift 차단", () => {
  it("§11.209d-mobile-mutation 코멘트 명시 (drift 차단)", () => {
    const src = read(HOOKS);
    expect(src).toMatch(/§11\.209d-mobile-mutation|11\.209d-mobile-mutation/);
  });

  // §11.209d-mobile-request-approval-cta — 직전 batch 의 "useRequestApproval
  // 미정의" lock 은 후속 batch (§11.209d-mobile-request-approval-cta) 가
  // 명시적으로 enable 했으므로 자연 해제. drift 차단 의도 = "별도 batch
  // 로 land" — 후속 batch 의 명시적 ADR entry 로 enable.
});
