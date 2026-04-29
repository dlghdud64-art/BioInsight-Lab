/**
 * §11.126 #admin-skip-link
 *
 * Source-level regression guard — admin/layout.tsx 신규 with skip-link +
 * main wrapper. 7 admin page 자동 적용.
 *
 * §11.125 dashboard skip-link 와 동일 패턴.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const PATH = resolve(__dirname, "../../../app/admin/layout.tsx");

describe("admin layout skip-link — regression guard (§11.126)", () => {
  it("admin/layout.tsx 파일 존재", () => {
    expect(existsSync(PATH)).toBe(true);
  });

  it("default export (Next.js layout convention)", () => {
    if (!existsSync(PATH)) return;
    const source = readFileSync(PATH, "utf8");
    expect(source).toMatch(/export\s+default\s+function/);
  });

  it("skip-link anchor (href=#admin-main)", () => {
    if (!existsSync(PATH)) return;
    const source = readFileSync(PATH, "utf8");
    expect(source).toMatch(/href="#admin-main"/);
  });

  it("main 에 id=\"admin-main\" + tabIndex=-1", () => {
    if (!existsSync(PATH)) return;
    const source = readFileSync(PATH, "utf8");
    expect(source).toMatch(/id="admin-main"/);
    expect(source).toMatch(/tabIndex=\{-1\}|tabIndex="-1"/);
  });

  it("sr-only by default + focus:not-sr-only", () => {
    if (!existsSync(PATH)) return;
    const source = readFileSync(PATH, "utf8");
    expect(source).toMatch(/sr-only/);
    expect(source).toMatch(/focus:not-sr-only/);
  });

  it("한국어 텍스트 \"본문 바로가기\"", () => {
    if (!existsSync(PATH)) return;
    const source = readFileSync(PATH, "utf8");
    expect(source).toMatch(/본문 바로가기/);
  });

  it("children render — Next.js layout convention", () => {
    if (!existsSync(PATH)) return;
    const source = readFileSync(PATH, "utf8");
    expect(source).toMatch(/\{children\}|React\.ReactNode/);
  });
});
