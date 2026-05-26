/**
 * §11.311b #audit-page-mobile — Regression sentinel
 *
 * 호영님 P1 spec (2026-05-26) "더보기 모바일 최적화" — audit page 한정:
 *   1. "보안 및 컴플라이언스" eyebrow 모바일 hidden (md:flex)
 *   2. 제목 + 건수 통합 ("감사 증적 · N건")
 *   3. description 모바일 hidden (md:block)
 *   4. 액션 4 button (고침/인쇄/PDF/내보내기) 모바일 → kebab + Sheet
 *   5. 필터 + 검색 가로 인라인 1행 (모바일 포함)
 *   6. 모바일 검색 아이콘 → 탭 시 input expand
 *
 * CLAUDE.md "## Mobile Patterns" 섹션 추가 (호영님 Q34 = A)
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const PATH = "src/app/dashboard/audit/page.tsx";
const CLAUDE_MD_PATH = join(REPO_ROOT, "..", "..", "CLAUDE.md");

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.311b — 헤더 모바일 정합", () => {
  it("eyebrow '보안 및 컴플라이언스' 모바일 hidden md:flex", () => {
    const src = read(PATH);
    expect(src).toMatch(/hidden md:flex items-center gap-2 text-slate-400[\s\S]{0,200}보안 및 컴플라이언스/);
  });

  it("제목 + 건수 통합 (감사 증적 · N건 inline)", () => {
    const src = read(PATH);
    expect(src).toMatch(/<h2[^>]*>[\s\S]{0,300}<span>감사 증적<\/span>[\s\S]{0,400}data\.total\.toLocaleString\("ko-KR"\)/);
  });

  it("description 모바일 hidden (hidden md:block)", () => {
    const src = read(PATH);
    expect(src).toMatch(/hidden md:block text-sm text-slate-500[\s\S]{0,200}주요 시스템 데이터 변경 및 접근 기록/);
  });
});

describe("§11.311b — 액션 4 button 모바일 kebab + Sheet", () => {
  it("데스크탑 4 button (hidden md:flex)", () => {
    const src = read(PATH);
    expect(src).toMatch(/<div className="hidden md:flex gap-2 flex-shrink-0">/);
  });

  it("모바일 kebab button (audit-actions-kebab testid)", () => {
    const src = read(PATH);
    expect(src).toMatch(/data-testid="audit-actions-kebab"/);
    expect(src).toMatch(/setIsActionsSheetOpen\(true\)/);
    expect(src).toMatch(/md:hidden h-10 w-10/);
  });

  it("Sheet (audit-actions-sheet testid) + 4 액션 testid", () => {
    const src = read(PATH);
    expect(src).toMatch(/data-testid="audit-actions-sheet"/);
    expect(src).toMatch(/data-testid="audit-actions-sheet-refresh"/);
    expect(src).toMatch(/data-testid="audit-actions-sheet-print"/);
    expect(src).toMatch(/data-testid="audit-actions-sheet-pdf"/);
    expect(src).toMatch(/data-testid="audit-actions-sheet-csv"/);
  });

  it("Sheet 액션 — refetch / handlePdfDownload / handleCompliancePdf / handleCsvExport wiring", () => {
    const src = read(PATH);
    expect(src).toMatch(/refetch\(\);\s*setIsActionsSheetOpen\(false\)/);
    expect(src).toMatch(/handlePdfDownload\(\);\s*setIsActionsSheetOpen\(false\)/);
    expect(src).toMatch(/handleCompliancePdf\(\);\s*setIsActionsSheetOpen\(false\)/);
    expect(src).toMatch(/handleCsvExport\(\);\s*setIsActionsSheetOpen\(false\)/);
  });

  it("Sheet 액션 button h-11 justify-start (한국어 라벨 잘림 방지)", () => {
    const src = read(PATH);
    const matches = src.match(/h-11 justify-start/g);
    expect(matches?.length ?? 0).toBeGreaterThanOrEqual(4);
  });
});

describe("§11.311b — 필터 + 검색 가로 인라인", () => {
  it("필터 컨테이너 flex-row (모바일 포함)", () => {
    const src = read(PATH);
    expect(src).toMatch(/flex flex-row gap-2 items-center print:hidden/);
  });

  it("이전 flex-col md:flex-row gap-2 md:items-center 제거", () => {
    const src = read(PATH);
    expect(src).not.toMatch(/flex flex-col md:flex-row gap-2 md:items-center print:hidden/);
  });

  it("데스크탑 검색 input hidden md:flex max-w-sm", () => {
    const src = read(PATH);
    expect(src).toMatch(/relative hidden md:flex md:max-w-sm/);
  });

  it("모바일 검색 토글 button (audit-search-toggle testid)", () => {
    const src = read(PATH);
    expect(src).toMatch(/data-testid="audit-search-toggle"/);
    expect(src).toMatch(/setIsSearchExpanded\(\(v\) => !v\)/);
  });

  it("isSearchExpanded 시 모바일 input expand (audit-search-input-mobile testid)", () => {
    const src = read(PATH);
    expect(src).toMatch(/isSearchExpanded && \(/);
    expect(src).toMatch(/data-testid="audit-search-input-mobile"/);
    expect(src).toMatch(/autoFocus/);
  });
});

describe("§11.311b — CLAUDE.md Mobile Patterns 섹션 (Q34 = A)", () => {
  it("CLAUDE.md 파일 존재", () => {
    expect(existsSync(CLAUDE_MD_PATH)).toBe(true);
  });

  it("## Mobile Patterns 섹션 존재", () => {
    const src = readFileSync(CLAUDE_MD_PATH, "utf8");
    expect(src).toMatch(/## Mobile Patterns/);
  });

  it("KPI 카드 한 줄 압축 원칙 명시", () => {
    const src = readFileSync(CLAUDE_MD_PATH, "utf8");
    expect(src).toMatch(/KPI.*한 줄 압축/);
    expect(src).toMatch(/grid-cols-3/);
  });

  it("액션 3 개 초과 시 kebab 원칙 명시", () => {
    const src = readFileSync(CLAUDE_MD_PATH, "utf8");
    expect(src).toMatch(/kebab/);
    expect(src).toMatch(/Sheet/);
  });

  it("§11.302 신호등 색상 체계 명시 (amber 금지)", () => {
    const src = readFileSync(CLAUDE_MD_PATH, "utf8");
    expect(src).toMatch(/amber\s*\/\s*orange\s*사용 금지/);
  });
});

describe("§11.311b — 회귀 0 (보존)", () => {
  it("PERIOD_OPTIONS + EVENT_TYPE_OPTIONS Select 보존", () => {
    const src = read(PATH);
    expect(src).toMatch(/PERIOD_OPTIONS\.map/);
    expect(src).toMatch(/EVENT_TYPE_OPTIONS\.map/);
  });

  it("Table (일시/ID, 작업자/IP 등) 보존", () => {
    const src = read(PATH);
    expect(src).toMatch(/일시 \/ ID/);
    expect(src).toMatch(/작업자 \/ IP/);
    expect(src).toMatch(/액션 및 대상/);
  });

  it("Empty state '감사 로그가 없습니다' 보존", () => {
    const src = read(PATH);
    expect(src).toMatch(/감사 로그가 없습니다/);
  });

  it("§11.89 인쇄용 헤더 (print 시만 표시) 보존", () => {
    const src = read(PATH);
    expect(src).toMatch(/LabAxis 감사 증적/);
  });
});
