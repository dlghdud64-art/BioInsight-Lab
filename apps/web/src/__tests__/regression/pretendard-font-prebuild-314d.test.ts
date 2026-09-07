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
    /* 🛑 2026-09-07 재작성 — 이전 판본은 prebuild **전체 문자열**을 통짜로 핀했다:
     *     /"prebuild":\s*"node scripts\/vercel-migrate\.js && node scripts\/copy-pretendard-font\.js"/
     *   그 뒤 `generate-migration-manifest.cjs` 가 정당하게 앞에 추가되자 RED 가 됐다 —
     *   구현은 계약을 지키고 있었고 **검사가 구현을 못 따라간** 쪽이다(4원칙 ⑤ 판별법).
     *   잠글 명제는 두 개다: ① 폰트 복사가 prebuild 에서 돈다 ② vercel-migrate 가 보존된다.
     *   그 둘만 보고, 다른 스텝이 늘어나는 것은 계약 위반이 아니므로 허용한다. */
    const prebuild = JSON.parse(read("package.json")).scripts?.prebuild ?? "";
    expect(prebuild).toContain("scripts/copy-pretendard-font.js");
    expect(prebuild).toContain("scripts/vercel-migrate.js");
    /* 🔑 순서는 계약이다 — 마이그레이션이 폰트 복사보다 먼저 돌아야
     *   배포 실패 시 폰트만 복사된 채 끝나지 않는다. */
    expect(prebuild.indexOf("scripts/vercel-migrate.js")).toBeLessThan(
      prebuild.indexOf("scripts/copy-pretendard-font.js"),
    );
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
