import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const PAGE = "src/app/dashboard/quotes/page.tsx";
const MODAL = "src/components/quotes/dispatch/vendor-dispatch-workbench.tsx";

describe("§action-toast P3 — 견적 개별 발송 결과 토스트(실 API 집계 분기)", () => {
  it("VendorRequestModal onSuccess 가 발송 집계(sent/failed/recipientCount) 전달", () => {
    const src = read(MODAL);
    expect(src).toMatch(/onSuccess\?: \(result\?: \{ sent: number; failed: number; recipientCount: number \}\)/);
    expect(src).toMatch(/onSuccess\?\.\(\{ sent, failed, recipientCount \}\)/);
  });

  it("handleSendSuccess: failed>0 → partial, else success (front-only 아님)", () => {
    const src = read(PAGE);
    expect(src).toMatch(/labToast\.partial\("견적 발송 부분 완료"/);
    expect(src).toMatch(/labToast\.success\("견적 요청 발송 완료"/);
    expect(src).toMatch(/const failed = result\?\.failed \?\? 0/);
  });

  it("발송 후 견적 rail 정리(§ops-briefing 케이스3) + 액션 실 onClick(dead 아님)", () => {
    const src = read(PAGE);
    expect(src).toMatch(/setSelectedQuoteId\(null\)/);
    expect(src).toMatch(/onClick: \(\) => \{ if \(quoteId\) setSelectedQuoteId\(quoteId\); \}/);
  });
});
