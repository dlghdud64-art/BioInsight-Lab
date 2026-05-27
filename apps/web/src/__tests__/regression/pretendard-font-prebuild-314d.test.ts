/**
 * §11.314-d #pretendard-font-prebuild — Regression sentinel
 *
 * 호영님 §11.308/§11.314 점검 발견:
 *   pdfkit PDF generator 가 public/fonts/PretendardVariable.ttf 를 찾는데
 *   파일이 없어 Helvetica fallback → PDF 한글 깨짐.
 *   pretendard@1.3.9 (dependency) TTF 를 prebuild 에서 복사해 해소.
 *
 * 보존: vercel-migrate prebuild + generator fontPath 정합.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.314-d — copy-pretendard-font prebuild script", () => {
  it("scripts/copy-pretendard-font.js 존재", () => {
    expect(existsSync(join(REPO_ROOT, "scripts/copy-pretendard-font.js"))).toBe(true);
  });

  it("pretendard TTF → public/fonts/PretendardVariable.ttf 복사 로직", () => {
    const src = read("scripts/copy-pretendard-font.js");
    expect(src).toMatch(/require\.resolve\("pretendard\/package\.json"\)/);
    expect(src).toMatch(/Pretendard-Regular\.ttf/);
    expect(src).toMatch(/PretendardVariable\.ttf/);
    expect(src).toMatch(/copyFileSync/);
  });

  it("graceful — 실패 시 process.exit(0) (빌드 차단 0)", () => {
    const src = read("scripts/copy-pretendard-font.js");
    expect(src).toMatch(/process\.exit\(0\)/);
    expect(src).toMatch(/catch/);
  });

  it("package.json prebuild 에 copy-pretendard-font 추가 (vercel-migrate 보존)", () => {
    const pkg = read("package.json");
    expect(pkg).toMatch(/"prebuild":\s*"node scripts\/vercel-migrate\.js && node scripts\/copy-pretendard-font\.js"/);
  });
});

describe("§11.314-d — generator fontPath 정합", () => {
  it("quote-request-pdf-generator public/fonts/PretendardVariable.ttf 참조", () => {
    const src = read("src/lib/quotes/quote-request-pdf-generator.ts");
    expect(src).toMatch(/"public",\s*"fonts",\s*"PretendardVariable\.ttf"/);
  });

  it("po-pdf-generator public/fonts/PretendardVariable.ttf 참조 (동일 폰트 공유)", () => {
    const src = read("src/lib/orders/po-pdf-generator.ts");
    expect(src).toMatch(/PretendardVariable\.ttf/);
  });

  it("pretendard dependency 존재 (^1.3.9)", () => {
    const pkg = read("package.json");
    expect(pkg).toMatch(/"pretendard":\s*"\^1\.3\.9"/);
  });
});
