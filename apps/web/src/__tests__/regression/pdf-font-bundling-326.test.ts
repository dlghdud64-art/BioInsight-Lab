/**
 * §11.326 #pdf-font-bundling — Regression sentinel (Phase 3 closeout)
 *
 * 호영님 P0 (호영님 spec §11.324, 번호 매핑 §11.326):
 *   Vercel serverless 함수 번들에 PretendardVariable.ttf 자동 포함 안 됨
 *   → fontPath 미존재 → silent Helvetica fallback → Helvetica.afm 없음 → 500 ENOENT
 *
 *   Phase 0+1 mitigation (vendor-dispatch-workbench 토스트 + console.error)
 *   Phase 2 root cause fix (3 file):
 *   - next.config.js outputFileTracingIncludes: /api/quotes/[id]/generate-pdf
 *     + /api/orders/[id]/generate-pdf → './public/fonts/**' 강제 포함
 *   - quote-request-pdf-generator.ts: resolvePretendardPath() 헬퍼 + existsSync
 *     fallback chain 3 경로 + 미발견 시 throw + 옛 Helvetica fallback 제거
 *   - po-pdf-generator.ts: 동일 패턴
 *
 *   본 sentinel = Phase 3 가드. Phase 2 fix 회귀 방지.
 *
 * canonical 보존:
 *   - Pretendard 폰트 파일 자체 변경 0 (apps/web/public/fonts/PretendardVariable.ttf)
 *   - generator 함수 시그니처 변경 0 (caller 영향 0)
 *   - PDFDocument options (A4, margin 48) 보존
 *   - §11.314-b mailto + Quote status SENT 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const NEXT_CONFIG = "next.config.js";
const QUOTE_GEN = "src/lib/quotes/quote-request-pdf-generator.ts";
const PO_GEN = "src/lib/orders/po-pdf-generator.ts";
const FONT_FILE = "public/fonts/PretendardVariable.ttf";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.326 — Pretendard 폰트 파일 (canonical 보존)", () => {
  it("apps/web/public/fonts/PretendardVariable.ttf 존재", () => {
    expect(existsSync(join(REPO_ROOT, FONT_FILE))).toBe(true);
  });
});

describe("§11.326 Phase 2 — next.config.js outputFileTracingIncludes (Vercel 번들 포함)", () => {
  it("experimental.outputFileTracingIncludes 가 quote/order PDF endpoint 폰트 포함", () => {
    const src = read(NEXT_CONFIG);
    expect(src).toMatch(/outputFileTracingIncludes:/);
    expect(src).toMatch(/['"]\/api\/quotes\/\[id\]\/generate-pdf['"]:[\s\S]{0,200}public\/fonts/);
    expect(src).toMatch(/['"]\/api\/orders\/\[id\]\/generate-pdf['"]:[\s\S]{0,200}public\/fonts/);
  });

  it("§11.326 trace marker 주석 보존 (회귀 방지 anchor)", () => {
    const src = read(NEXT_CONFIG);
    expect(src).toMatch(/§11\.326/);
  });
});

describe("§11.326 Phase 2 — quote PDF generator (resolvePretendardPath + Helvetica fallback 제거)", () => {
  it("resolvePretendardPath() 헬퍼 신설 + existsSync 사용", () => {
    const src = read(QUOTE_GEN);
    expect(src).toMatch(/function resolvePretendardPath/);
    expect(src).toMatch(/import\s*\{[^}]*existsSync[^}]*\}\s*from\s*["']node:fs["']/);
  });

  it("후보 경로 3개 (process.cwd + monorepo + __dirname relative)", () => {
    const src = read(QUOTE_GEN);
    expect(src).toMatch(/process\.cwd\(\)[\s\S]{0,400}__dirname/);
    expect(src).toMatch(/PretendardVariable\.ttf/);
  });

  it("미발견 시 throw [§11.326] 메시지 (silent fallback 차단)", () => {
    const src = read(QUOTE_GEN);
    expect(src).toMatch(/throw new Error\([\s\S]{0,400}\[§11\.326\][\s\S]{0,200}Pretendard 폰트 미발견/);
  });

  it("옛 try { register } catch { Helvetica } 패턴 잔존 0", () => {
    const src = read(QUOTE_GEN);
    expect(src).not.toMatch(/catch[\s\S]{0,50}doc\.font\(["']Helvetica["']\)/);
  });

  it("doc.registerFont('Korean', fontBuffer) + doc.font('Korean') 보존 (Phase 4 Buffer swap)", () => {
    const src = read(QUOTE_GEN);
    expect(src).toMatch(/doc\.registerFont\(["']Korean["'],\s*fontBuffer\)/);
    expect(src).toMatch(/doc\.font\(["']Korean["']\)/);
  });

  it("§11.326 Phase 4 — PDFDocument constructor 에 font: fontBuffer 전달 (Helvetica auto-load 차단)", () => {
    const src = read(QUOTE_GEN);
    expect(src).toMatch(/import\s*\{[^}]*readFileSync[^}]*\}\s*from\s*["']node:fs["']/);
    expect(src).toMatch(/const fontBuffer = readFileSync\(fontPath\)/);
    expect(src).toMatch(/new PDFDocument\(\{[^}]*font:\s*fontBuffer[^}]*\}\)/);
  });
});

describe("§11.326 Phase 2 — PO PDF generator (동일 패턴)", () => {
  it("resolvePretendardPath() 헬퍼 신설 + existsSync 사용", () => {
    const src = read(PO_GEN);
    expect(src).toMatch(/function resolvePretendardPath/);
    expect(src).toMatch(/import\s*\{[^}]*existsSync[^}]*\}\s*from\s*["']node:fs["']/);
  });

  it("미발견 시 throw [§11.326] 메시지", () => {
    const src = read(PO_GEN);
    expect(src).toMatch(/throw new Error\([\s\S]{0,400}\[§11\.326\][\s\S]{0,200}Pretendard 폰트 미발견/);
  });

  it("옛 Helvetica fallback 잔존 0", () => {
    const src = read(PO_GEN);
    expect(src).not.toMatch(/catch[\s\S]{0,50}doc\.font\(["']Helvetica["']\)/);
  });

  it("§11.326 Phase 4 — PDFDocument constructor 에 font: fontBuffer 전달 (Helvetica auto-load 차단)", () => {
    const src = read(PO_GEN);
    expect(src).toMatch(/import\s*\{[^}]*readFileSync[^}]*\}\s*from\s*["']node:fs["']/);
    expect(src).toMatch(/const fontBuffer = readFileSync\(fontPath\)/);
    expect(src).toMatch(/new PDFDocument\(\{[^}]*font:\s*fontBuffer[^}]*\}\)/);
  });
});

describe("§11.326 Phase 1 — vendor-dispatch-workbench 토스트 actionable (호영님 spec §5)", () => {
  it("토스트 title friendly + description actionable", () => {
    const src = read("src/components/quotes/dispatch/vendor-dispatch-workbench.tsx");
    expect(src).toMatch(/견적서 PDF를 만들 수 없습니다/);
    expect(src).toMatch(/메시지 미리보기 내용을 복사해서 직접 메일/);
  });

  it("console.error 로깅 ([§11.326] + status + serverDetail + quoteId)", () => {
    const src = read("src/components/quotes/dispatch/vendor-dispatch-workbench.tsx");
    expect(src).toMatch(/console\.error\(["']\[§11\.326\][\s\S]{0,200}status[\s\S]{0,100}serverDetail[\s\S]{0,100}quoteId/);
  });

  it("errorTag 라벨 분기 (403/404/5xx/4xx)", () => {
    const src = read("src/components/quotes/dispatch/vendor-dispatch-workbench.tsx");
    expect(src).toMatch(/status === 403[\s\S]{0,50}인증\/권한/);
    expect(src).toMatch(/status === 404[\s\S]{0,50}견적 없음/);
    expect(src).toMatch(/status >= 500[\s\S]{0,50}서버 오류/);
  });
});
