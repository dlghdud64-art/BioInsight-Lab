import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE = readFileSync(
  resolve(__dirname, "../../../app/dashboard/quotes/page.tsx"),
  "utf8",
);

describe("견적 전달 검토 안전 진입", () => {
  it("파일럿 경로 상단에 한글 다음 행동과 차단 사유를 표시한다", () => {
    expect(PAGE).toMatch(
      /isBrowserPilotQuoteDispatch[\s\S]{0,200}data-testid="quote-dispatch-review-entry"/,
    );
    expect(PAGE).toContain("다음: 견적 전달 검토");
    expect(PAGE).toContain("차단 사유: 공급사 또는 연락처 미확인 시 전송 불가");
  });

  it("검토 CTA는 전송이 아니라 기존 검토 워크벤치를 연다", () => {
    expect(PAGE).toMatch(
      /data-testid="quote-dispatch-review-entry-cta"[\s\S]{0,300}data-safe-action="reveal-only"[\s\S]{0,300}onClick=\{openQuoteDraftWorkbench\}/,
    );
    expect(PAGE).toContain('setActiveWorkWindow("request_send")');
    expect(PAGE).toContain('url.searchParams.set("selected", targetQuote.id)');
    expect(PAGE).toContain('url.searchParams.set("task", "request_send")');
  });
});
