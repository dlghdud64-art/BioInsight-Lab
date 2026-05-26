/**
 * §11.307 #quotes-header-mobile-scan — Regression sentinel
 *
 * 견적 관리 헤더 (dashboard/quotes/page.tsx) 모바일 3건 (호영님 P1):
 *   (1) "파싱" → "스캔" 명칭 변경 (사용자 용어 정합)
 *   (2) Upload icon → ScanLine icon (lucide-react)
 *   (3) 버튼 순서 [+ 새 견적 요청] → [📷 스캔] → [⋯ 더보기]
 *       + 모바일 ⋯ 드롭다운 짤림 fix (⋯이 우측 끝으로 이동 → right-0 viewport 안)
 *
 * 짤림 진짜 root cause (sandbox 진단 2026-05-26):
 *   - 모바일 375px line 1940 부모 flex-col → 액션 그룹 별도 row
 *   - line 1949 액션 컨테이너 flex-wrap + justify-end 없음 → 좌측 정렬
 *   - ⋯ button 위치 x ≈ 122px (좌측 가까움)
 *   - 드롭다운 right-0 w-52(208px) → 좌측 -66px viewport 밖 → "견" 글자 짤림
 *   - Fix: JSX 순서 변경으로 ⋯ 우측 끝 이동 → right-0 viewport 안
 *
 * §11.298d 보존 (Radix 부활 0):
 *   - useState (isMobileMoreOpen) plain dropdown
 *   - aria-expanded={isMobileMoreOpen}
 *   - role="menu" / role="menuitem"
 *   - data-testid="quote-header-more-actions-mobile"
 *
 * §11.248b 보존 (반응형 분기):
 *   - flex-wrap lg:flex-nowrap
 *   - 견적서 비교 (hidden md:inline-flex)
 *   - 견적 요청 초안 만들기 (hidden md:flex)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const QUOTES_PAGE_PATH = "src/app/dashboard/quotes/page.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.307 — (1) '파싱' → '스캔' 명칭 정합", () => {
  it("헤더 라벨 '견적서 스캔' / '스캔' 존재", () => {
    const src = read(QUOTES_PAGE_PATH);
    expect(src).toMatch(/견적서 스캔/);
    // 모바일 단축 라벨 — `sm:hidden">스캔` 패턴
    expect(src).toMatch(/sm:hidden">스캔</);
  });

  it("AI 모달 toast '스캔 완료' 정합", () => {
    const src = read(QUOTES_PAGE_PATH);
    expect(src).toMatch(/AI 견적서 스캔 완료/);
  });

  it("사용자 노출 '파싱' literal 0 occurrence", () => {
    const src = read(QUOTES_PAGE_PATH);
    // 헤더 라벨 (line 1956) — "견적서 파싱" / "파싱" 차단
    expect(src).not.toMatch(/견적서 파싱/);
    expect(src).not.toMatch(/sm:hidden">파싱</);
    // AI 모달 toast (line 4250) 차단
    expect(src).not.toMatch(/AI 견적서 파싱 완료/);
  });

  it("aiParseModalOpen state name 보존 (내부 변수)", () => {
    const src = read(QUOTES_PAGE_PATH);
    // 호영님 spec — 내부 state 이름은 보존, 사용자 노출 텍스트만 swap
    expect(src).toMatch(/aiParseModalOpen/);
    expect(src).toMatch(/setAiParseModalOpen/);
  });
});

describe("§11.307 — (2) Upload icon → ScanLine icon 정합", () => {
  it("ScanLine import 존재 (lucide-react)", () => {
    const src = read(QUOTES_PAGE_PATH);
    expect(src).toMatch(/import\s*\{[^}]*ScanLine[^}]*\}\s*from\s*["']lucide-react["']/);
  });

  it("ScanLine JSX 사용 (헤더 스캔 button)", () => {
    const src = read(QUOTES_PAGE_PATH);
    expect(src).toMatch(/<ScanLine\s+className="h-3\.5\s+sm:h-4\s+w-3\.5\s+sm:w-4"/);
  });

  it("<Upload> JSX 0 occurrence", () => {
    const src = read(QUOTES_PAGE_PATH);
    expect(src).not.toMatch(/<Upload\b/);
  });

  it("Upload import 제거 (다른 사용처 0 confirmed)", () => {
    const src = read(QUOTES_PAGE_PATH);
    // import line 에서 Upload 단독 또는 콤마 분리 패턴 차단
    expect(src).not.toMatch(/import\s*\{[^}]*\bUpload\b[^}]*\}\s*from\s*["']lucide-react["']/);
  });
});

describe("§11.307 — (3) 버튼 순서 [+ 새 견적 요청] → [스캔] → [⋯] + 짤림 fix", () => {
  it("DOM 순서: 새 견적 요청 < 스캔 button < 더보기 button", () => {
    const src = read(QUOTES_PAGE_PATH);
    const idxNewQuote = src.indexOf('PermissionGate permission="quotes.create"');
    const idxScan = src.indexOf("setAiParseModalOpen(true)");
    const idxMore = src.indexOf('data-testid="quote-header-more-actions-mobile"');
    expect(idxNewQuote).toBeGreaterThan(0);
    expect(idxScan).toBeGreaterThan(0);
    expect(idxMore).toBeGreaterThan(0);
    // [+ 새 견적 요청] 이 가장 먼저 — DOM 순서 (좌측)
    expect(idxNewQuote).toBeLessThan(idxScan);
    // [⋯ 더보기] 가 마지막 — DOM 순서 (우측)
    expect(idxScan).toBeLessThan(idxMore);
  });

  it("⋯ 더보기 드롭다운 위치 right-0 보존 (viewport 안)", () => {
    const src = read(QUOTES_PAGE_PATH);
    // 짤림 fix 후에도 right-0 보존 — ⋯ 위치만 우측 끝으로 이동
    expect(src).toMatch(/absolute\s+right-0\s+top-full\s+mt-1\s+w-52/);
  });
});

describe("§11.307 — §11.298d 보존 (Radix 부활 0)", () => {
  it("isMobileMoreOpen useState (plain dropdown) 보존", () => {
    const src = read(QUOTES_PAGE_PATH);
    expect(src).toMatch(/isMobileMoreOpen/);
    expect(src).toMatch(/setIsMobileMoreOpen/);
  });

  it("aria-expanded + role=menu + role=menuitem 보존", () => {
    const src = read(QUOTES_PAGE_PATH);
    expect(src).toMatch(/aria-expanded=\{isMobileMoreOpen\}/);
    expect(src).toMatch(/role="menu"/);
    expect(src).toMatch(/role="menuitem"/);
  });

  it("DropdownMenu (Radix) import 0 occurrence", () => {
    const src = read(QUOTES_PAGE_PATH);
    expect(src).not.toMatch(/from\s+["']@\/components\/ui\/dropdown-menu["']/);
    expect(src).not.toMatch(/@radix-ui\/react-dropdown-menu/);
  });
});

describe("§11.307 — §11.248b 반응형 보존 (데스크탑 변화 0)", () => {
  it("flex-wrap lg:flex-nowrap 보존", () => {
    const src = read(QUOTES_PAGE_PATH);
    expect(src).toMatch(/flex-wrap\s+lg:flex-nowrap/);
  });

  it("'견적서 비교' hidden md:inline-flex 보존", () => {
    const src = read(QUOTES_PAGE_PATH);
    expect(src).toMatch(/hidden\s+md:inline-flex[^>]*>[\s\S]{0,500}?견적서 비교/);
  });

  it("'견적 요청 초안 만들기' hidden md:flex 보존", () => {
    const src = read(QUOTES_PAGE_PATH);
    expect(src).toMatch(/hidden\s+md:flex/);
    expect(src).toMatch(/견적 요청 초안 만들기/);
  });
});
