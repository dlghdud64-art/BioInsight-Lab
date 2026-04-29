/**
 * §11.132 #aria-live-regions
 *
 * Source-level regression guard — admin/users page 의 inline mutation error
 * 표시에 role="alert" + aria-live 추가. WCAG 4.1.3 (Status Messages) 정합.
 *
 * sonner / shadcn Toaster 는 자동 aria-live 보유 (radix/sonner 내부 처리).
 * inline 표시 (formError / errorMsg) 만 명시적 보강 필요.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PATH = resolve(
  __dirname,
  "../../../app/admin/users/page.tsx",
);

describe("admin/users inline error aria-live — regression guard (§11.132)", () => {
  const source = readFileSync(PATH, "utf8");

  it("formError 표시 div 에 role=\"alert\" 또는 aria-live", () => {
    // formError && ( <div role="alert" ...> ) 패턴
    const formErrorBlocks = source.match(
      /\{formError\s*&&[\s\S]{0,500}?<\/div>\s*\)\}/g,
    );
    expect(formErrorBlocks).not.toBeNull();
    if (formErrorBlocks) {
      formErrorBlocks.forEach((block) => {
        expect(block).toMatch(/role="alert"|aria-live/);
      });
    }
  });

  it("errorMsg 표시 div 에 role=\"alert\" 또는 aria-live", () => {
    const errorMsgBlocks = source.match(
      /\{errorMsg\s*&&[\s\S]{0,500}?<\/div>\s*\)\}/g,
    );
    expect(errorMsgBlocks).not.toBeNull();
    if (errorMsgBlocks) {
      errorMsgBlocks.forEach((block) => {
        expect(block).toMatch(/role="alert"|aria-live/);
      });
    }
  });

  it("§11.123 hook 회귀 0 (useDialogA11y 유지)", () => {
    expect(source).toMatch(/useDialogA11y/);
  });

  it("§11.129 nav aria-label 회귀 0 (admin-sidebar 별도 file 이지만 page 의 dialog ARIA 유지)", () => {
    expect(source).toMatch(/role="dialog"/);
  });
});
