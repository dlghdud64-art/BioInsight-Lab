/**
 * §11.337 (회귀) — 감사 추적 이벤트 분류 + 표시 정정 sentinel
 *
 * Decision B: 표면 + 이벤트 분류 수정. raw AuditLog record 불변 — 분류·라벨은
 *   표시 매핑 레이어(AUDIT_ACTION_MAP)에서만 파생.
 *   - quote_pdf_generate → "조회·출력"(output 톤), 사유 "견적서 PDF 생성"
 *   - raw key(User Token) → "사용자 토큰", 대상 cuid → 견적번호
 *   - 브레드크럼 audit → "감사 추적"
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}
const LABELS = "src/lib/audit/event-labels.ts";
const PAGE = "src/app/dashboard/audit/page.tsx";
const HEADER = "src/components/dashboard/Header.tsx";

describe("§11.337 — 분류 매핑 레이어", () => {
  it("AUDIT_ACTION_MAP: quote_pdf_generate → 조회·출력 / output / 견적서 PDF 생성", () => {
    const src = read(LABELS);
    expect(src).toMatch(/quote_pdf_generate:\s*\{[^}]*reason:\s*"견적서 PDF 생성"/);
    expect(src).toMatch(/categoryLabel:\s*"조회·출력"/);
    expect(src).toMatch(/tone:\s*"output"/);
  });
  it("output 중립 톤이 tone 맵에 등록", () => {
    const src = read(LABELS);
    expect(src).toMatch(/output:\s*"bg-slate-50/);
    expect(src).toMatch(/output:\s*"bg-slate-400/);
  });
  it("매핑은 표시 전용 — event-labels 에 DB write 없음(불변 보존)", () => {
    const src = read(LABELS);
    expect(src).not.toMatch(/db\.|prisma|\.update\(|\.create\(/);
  });
});

describe("§11.337 — adaptLog 표시 override", () => {
  it("actionMeta 로 배지 라벨/톤 override", () => {
    const src = read(PAGE);
    expect(src).toMatch(/const actionMeta = AUDIT_ACTION_MAP\[log\.action\]/);
    expect(src).toMatch(/action: actionMeta \? actionMeta\.categoryLabel : meta\.label/);
    expect(src).toMatch(/actionTone: actionMeta \? actionMeta\.tone : meta\.tone/);
  });
  it("사유는 actionMeta.reason 우선(raw key 대체)", () => {
    const src = read(PAGE);
    expect(src).toMatch(/let reason = actionMeta\?\.reason \?\? log\.action/);
  });
  it("대상은 견적번호(metadata) 우선 — cuid 노출 최소화", () => {
    const src = read(PAGE);
    expect(src).toMatch(/견적 \$\{m\.quoteNumber\}/);
  });
  it("인증 라벨 한글화 (사용자 토큰)", () => {
    const src = read(PAGE);
    expect(src).toMatch(/label:\s*"사용자 토큰"/);
    expect(src).not.toMatch(/label:\s*"User Token"/);
  });
});

describe("§11.337 — 브레드크럼 한글 통일", () => {
  it("Header: audit → 감사 추적", () => {
    const src = read(HEADER);
    expect(src).toMatch(/audit:\s*"감사 추적"/);
  });
});
