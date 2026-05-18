/**
 * §11.254 — 헤더 로고 "LabAxis" → 메인 홈 (/) + "소싱" 서브 라벨 → /app/search 분리 링크.
 *
 * 호영님 spec:
 *   - "LabAxis" 텍스트 → 메인 홈페이지 (`/`) (모든 서비스 영역 통일 — 대시보드 /
 *     소싱 / 견적 / 재고 / 구매 운영 동일).
 *   - "소싱" 서브 라벨 → 소싱 검색 초기 화면 (`/app/search`) — 독립 링크 wrap.
 *   - 모바일 / 데스크탑 양쪽 동일 동작.
 *
 * 의도적 lineage reversal:
 *   - `#mobile-header-logo-home-link` (line 235~ dashboard-sidebar, 248~ Header)
 *     이전 결정 ("양쪽 모두 /dashboard") → §11.254 호영님 새 spec 우선.
 *   - 사유: 소싱은 구매 운영 대시보드와 별개 서비스 영역 → 로고가 /dashboard 로
 *     가는 것은 부자연스러움 (UX 충돌).
 *
 * canonical truth lock:
 *   - Header 모바일 로고 / sidebar 데스크탑 로고 / 소싱 페이지 헤더 LabAxis 모두
 *     `href="/"` 통일.
 *   - aria-label / min-h-[44px] / hover/active 시각 피드백 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const HEADER_PATH = resolve(__dirname, "../../components/dashboard/Header.tsx");
const SIDEBAR_PATH = resolve(__dirname, "../../app/_components/dashboard-sidebar.tsx");
const SOURCING_PATH = resolve(__dirname, "../../app/_workbench/search/page.tsx");
const headerCode = safeRead(HEADER_PATH);
const sidebarCode = safeRead(SIDEBAR_PATH);
const sourcingCode = safeRead(SOURCING_PATH);

describe("§11.254 #1 — Header 모바일 로고 → 메인 홈 (/)", () => {
  it("§11.254 trace marker (Header.tsx)", () => {
    expect(headerCode).toMatch(/§11\.254|11\.254/);
  });

  it("LabAxis 로고 Link href=\"/\" (메인 홈)", () => {
    // §11.254 trace ~ Link href="/" ~ LabAxis 모두 가까이.
    expect(headerCode).toMatch(/href=["']\/["'][\s\S]{0,400}LabAxis/);
  });

  it("기존 href=\"/dashboard\" 제거 (LabAxis 로고 안)", () => {
    // 모바일 로고 Link 영역 안 /dashboard 부재 검증.
    // §11.254 주석 ~ LabAxis 텍스트 사이에 /dashboard 매칭되면 fail.
    expect(headerCode).not.toMatch(/§11\.254[\s\S]{0,500}href=["']\/dashboard["'][\s\S]{0,300}LabAxis/);
  });

  it("aria-label \"LabAxis 홈으로 이동\" 보존 (a11y)", () => {
    expect(headerCode).toMatch(/aria-label=["']LabAxis\s*홈으로\s*이동["']/);
  });

  it("min-h-[44px] 터치 타깃 보존", () => {
    expect(headerCode).toMatch(/min-h-\[44px\]/);
  });
});

describe("§11.254 #2 — Sidebar 데스크탑 로고 → 메인 홈 (/)", () => {
  it("§11.254 trace marker (sidebar)", () => {
    expect(sidebarCode).toMatch(/§11\.254|11\.254/);
  });

  it("LabAxis 사이드바 로고 Link href=\"/\"", () => {
    // §11.254 주석 후 ~800자 안 href="/" + LabAxis 검증 (한국어 주석 길이 정합).
    expect(sidebarCode).toMatch(/§11\.254[\s\S]{0,800}href=["']\/["'][\s\S]{0,400}LabAxis/);
  });

  it("aria-label \"LabAxis 홈으로 이동\" 보존 (a11y)", () => {
    expect(sidebarCode).toMatch(/aria-label=["']LabAxis\s*홈으로\s*이동["']/);
  });
});

describe("§11.254 #3 — 소싱 헤더 'LabAxis' → / + '소싱' → /app/search 분리", () => {
  it("§11.254 trace marker (소싱 page)", () => {
    expect(sourcingCode).toMatch(/§11\.254|11\.254/);
  });

  it("LabAxis 로고 Link href=\"/\" (메인 홈)", () => {
    // 소싱 헤더 영역 안 LabAxis Link href="/".
    expect(sourcingCode).toMatch(/href=["']\/["'][\s\S]{0,300}LabAxis/);
  });

  it("'소싱' 라벨 Link href=\"/app/search\" 으로 wrap", () => {
    // 호영님 spec — "소싱" 서브 라벨 → /app/search.
    expect(sourcingCode).toMatch(/href=["']\/app\/search["'][\s\S]{0,300}소싱|소싱[\s\S]{0,300}href=["']\/app\/search["']/);
  });
});

describe("§11.254 — invariant 보존", () => {
  it("Header.tsx — lg:hidden 모바일 로고 분기 보존", () => {
    expect(headerCode).toMatch(/lg:hidden[\s\S]{0,500}LabAxis|LabAxis[\s\S]{0,500}lg:hidden/);
  });

  it("sidebar — hidden lg:flex 데스크탑 분기 보존", () => {
    expect(sidebarCode).toMatch(/hidden\s+lg:flex/);
  });

  it("소싱 page — '소싱' 라벨 보존 (텍스트 자체)", () => {
    expect(sourcingCode).toMatch(/>\s*소싱\s*<|소싱\s*<\/span/);
  });

  it("소싱 page — STAGE_LABELS sourcing '소싱' 매핑 보존", () => {
    expect(sourcingCode).toMatch(/sourcing:\s*["']소싱["']/);
  });
});
