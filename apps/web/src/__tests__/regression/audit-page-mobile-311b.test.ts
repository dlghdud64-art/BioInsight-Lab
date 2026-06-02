/**
 * §11.311b / §11.337 #audit-page-mobile — Regression sentinel
 *
 * §11.311b: eyebrow/제목/description 모바일 정합, 필터+검색 가로 인라인.
 * §11.337 Phase 3: 구 4-button 모바일 kebab → export one-primary
 *   ([새로 고침 아이콘 분리] + [내보내기 단일 primary → Sheet(인쇄/정형PDF/CSV)]).
 *
 * NOTE: 정규식 내 escaped-slash/angle-bracket 회피 위해 문자열 매칭은 toContain 사용
 *   (esbuild ts-loader lexer 모호성 회피).
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
    expect(src).toMatch(/hidden md:flex items-center gap-2 text-slate-400/);
    expect(src).toContain("보안 및 컴플라이언스");
  });

  it("제목 + 건수 통합 (감사 추적 · N건)", () => {
    const src = read(PATH);
    expect(src).toContain("감사 추적");
    expect(src).toMatch(/data\.total\.toLocaleString\("ko-KR"\)/);
  });

  it("description 모바일 hidden (hidden md:block)", () => {
    const src = read(PATH);
    expect(src).toMatch(/hidden md:block text-sm text-slate-500/);
    expect(src).toContain("주요 시스템 데이터 변경 및 접근 기록");
  });
});

// §11.337 Phase 3 — 구 §11.311b "4 button 모바일 kebab" 을 export one-primary 로 대체.
describe("§11.337 — export one-primary (구 4-button kebab 대체)", () => {
  it("새로 고침 아이콘 분리 (audit-refresh)", () => {
    expect(read(PATH)).toContain('data-testid="audit-refresh"');
  });

  it("내보내기 단일 trigger (audit-export-trigger) → Sheet 열기", () => {
    const src = read(PATH);
    expect(src).toContain('data-testid="audit-export-trigger"');
    expect(src).toMatch(/setIsActionsSheetOpen\(true\)/);
  });

  it("구 kebab 제거 (audit-actions-kebab / sheet-refresh 미존재)", () => {
    const src = read(PATH);
    expect(src).not.toContain("audit-actions-kebab");
    expect(src).not.toContain("audit-actions-sheet-refresh");
  });

  it("Sheet 3 export testid 보존 (print/pdf/csv)", () => {
    const src = read(PATH);
    expect(src).toContain('data-testid="audit-actions-sheet"');
    expect(src).toContain('data-testid="audit-actions-sheet-print"');
    expect(src).toContain('data-testid="audit-actions-sheet-pdf"');
    expect(src).toContain('data-testid="audit-actions-sheet-csv"');
  });

  it("Sheet wiring (handlePdfDownload / handleCompliancePdf / handleCsvExport)", () => {
    const src = read(PATH);
    expect(src).toMatch(/handlePdfDownload\(\);\s*setIsActionsSheetOpen\(false\)/);
    expect(src).toMatch(/handleCompliancePdf\(\);\s*setIsActionsSheetOpen\(false\)/);
    expect(src).toMatch(/handleCsvExport\(\);\s*setIsActionsSheetOpen\(false\)/);
  });

  it("Sheet export button h-11 justify-start 3개 이상", () => {
    const matches = read(PATH).match(/h-11 justify-start/g);
    const count = matches ? matches.length : 0;
    expect(count).toBeGreaterThanOrEqual(3);
  });
});

describe("§11.311b — 필터 + 검색 가로 인라인", () => {
  it("필터 컨테이너 flex-row (모바일 포함)", () => {
    expect(read(PATH)).toMatch(/flex flex-row gap-2 items-center print:hidden/);
  });

  it("이전 flex-col md:flex-row 패턴 제거", () => {
    expect(read(PATH)).not.toMatch(/flex flex-col md:flex-row gap-2 md:items-center print:hidden/);
  });

  it("데스크탑 검색 input hidden md:flex max-w-sm", () => {
    expect(read(PATH)).toMatch(/relative hidden md:flex md:max-w-sm/);
  });

  it("모바일 검색 토글 button (audit-search-toggle)", () => {
    const src = read(PATH);
    expect(src).toContain('data-testid="audit-search-toggle"');
    expect(src).toMatch(/setIsSearchExpanded\(\(v\) => !v\)/);
  });

  it("isSearchExpanded 시 모바일 input expand (audit-search-input-mobile)", () => {
    const src = read(PATH);
    expect(src).toMatch(/isSearchExpanded && \(/);
    expect(src).toContain('data-testid="audit-search-input-mobile"');
    expect(src).toContain("autoFocus");
  });
});

describe("§11.311b — CLAUDE.md Mobile Patterns 섹션", () => {
  it("CLAUDE.md 파일 존재", () => {
    expect(existsSync(CLAUDE_MD_PATH)).toBe(true);
  });

  it("## Mobile Patterns 섹션 존재", () => {
    expect(readFileSync(CLAUDE_MD_PATH, "utf8")).toContain("## Mobile Patterns");
  });

  it("KPI 카드 한 줄 압축 원칙 명시", () => {
    const src = readFileSync(CLAUDE_MD_PATH, "utf8");
    expect(src).toMatch(/KPI.*한 줄 압축/);
    expect(src).toContain("grid-cols-3");
  });

  it("액션 kebab + Sheet 원칙 명시", () => {
    const src = readFileSync(CLAUDE_MD_PATH, "utf8");
    expect(src).toContain("kebab");
    expect(src).toContain("Sheet");
  });
});

describe("§11.311b — 회귀 0 (보존)", () => {
  it("PERIOD_OPTIONS + EVENT_TYPE_OPTIONS Select 보존", () => {
    const src = read(PATH);
    expect(src).toMatch(/PERIOD_OPTIONS\.map/);
    expect(src).toMatch(/EVENT_TYPE_OPTIONS\.map/);
  });

  it("Table 헤더 보존", () => {
    const src = read(PATH);
    expect(src).toContain("일시 / ID");
    expect(src).toContain("작업자 / IP");
    expect(src).toContain("액션 및 대상");
  });

  it("Empty state '감사 로그가 없습니다' 보존", () => {
    expect(read(PATH)).toContain("감사 로그가 없습니다");
  });

  it("§11.89 인쇄용 헤더 'LabAxis 감사 추적' 보존", () => {
    expect(read(PATH)).toContain("LabAxis 감사 추적");
  });
});
