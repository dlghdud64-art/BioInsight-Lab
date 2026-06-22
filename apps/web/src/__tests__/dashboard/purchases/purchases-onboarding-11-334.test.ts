import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

// §11.334 — 구매 운영 빈상태 온보딩(시안 Improved). 데이터 0건일 때 얇은 empty
//   대신 히어로 + 진행 파이프라인 + 할 일 카드 + 미리보기. 파이프라인 상태는
//   canonical(stats.total 파생 hasSentRequest)에서만 도출 — 거짓 "완료" 표기 0.
const PAGE_PATH = join(
  __dirname,
  "..",
  "..",
  "..",
  "app",
  "dashboard",
  "purchases",
  "page.tsx",
);

describe("§11.334 — 구매 운영 빈상태 온보딩", () => {
  const src = readFileSync(PAGE_PATH, "utf8");

  it("데이터 0건 분기에서 온보딩 컴포넌트 렌더(검색/탭 무결과는 얇은 안내 유지)", () => {
    expect(src).toContain("PurchasesOnboarding");
    expect(src).toContain('data-testid="purchases-onboarding"');
    expect(src).toMatch(/items\.length === 0 \?\s*\(\s*<PurchasesOnboarding/);
    expect(src).toContain("에 해당하는 항목이 없습니다");
  });

  it("파이프라인 상태는 canonical(hasSentRequest) 파생 — 거짓 done 금지", () => {
    expect(src).toContain("hasSentRequest={stats.total > 0}");
    expect(src).toContain("hasSentRequest: boolean");
    expect(src).toContain('s: hasSentRequest ? "done" : "active"');
    expect(src).toContain('s: hasSentRequest ? "active" : "todo"');
  });

  it("견적서 스캔 CTA — 실제 QuoteScannerModal wiring (dead button 0)", () => {
    expect(src).toContain("QuoteScannerModal");
    expect(src).toContain('data-testid="purchases-onboarding-scan-cta"');
    expect(src).toContain("onScanOpen");
    expect(src).toContain("setScanOpen");
    expect(src).toContain("onScanComplete");
  });

  it("히어로 CTA — 실제 라우트 (소싱 / 견적 관리)", () => {
    expect(src).toContain('href="/app/search"');
    expect(src).toContain('href="/dashboard/quotes"');
    expect(src).toContain("소싱에서 견적 요청");
    expect(src).toContain("견적 관리 보기");
  });

  it("미리보기는 실제 데이터 아님 명시(ghost)", () => {
    expect(src).toContain("회신이 도착하면 이렇게 표시됩니다 (미리보기)");
    expect(src).toContain("border-dashed");
  });

  it("회귀 0 — 큐/레일/KPI/bulk-PO/결재 wiring 보존", () => {
    expect(src).toContain("purchase-conversion-queue");
    expect(src).toContain("bulkPoMutation");
    expect(src).toContain("KpiCard");
    expect(src).toContain('id="brief-next"');
    expect(src).toContain("STATUS_MAP");
  });
});
