/**
 * §11.131 #reduce-motion-respect
 *
 * Source-level regression guard — globals.css 의 prefers-reduced-motion
 * media query 가 universal selector 로 animation/transition 비활성.
 *
 * WCAG 2.3.3 (Animation from Interactions) + 사용자 OS reduce-motion 설정
 * 정합. 멀미·전정 장애·집중력 저하 사용자 보호.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PATH = resolve(__dirname, "../../../app/globals.css");

describe("globals.css prefers-reduced-motion — regression guard (§11.131)", () => {
  const source = readFileSync(PATH, "utf8");

  it("prefers-reduced-motion media query 존재", () => {
    expect(source).toMatch(/@media\s*\([^)]*prefers-reduced-motion:\s*reduce/);
  });

  it("universal selector 로 animation/transition 비활성 (* selector)", () => {
    // *::before, *::after, * 등 universal 패턴
    expect(source).toMatch(/\*,?\s*\n?\s*\*::before|\*\s*\{[^}]*animation/);
  });

  it("animation-duration 0 또는 animation: none 단축", () => {
    expect(source).toMatch(
      /animation-duration:\s*0\.0?1?ms|animation:\s*none/,
    );
  });

  it("transition-duration 0 또는 transition: none 단축", () => {
    expect(source).toMatch(
      /transition-duration:\s*0\.0?1?ms|transition:\s*none/,
    );
  });

  it("scroll-behavior: auto (smooth scroll 비활성)", () => {
    expect(source).toMatch(/scroll-behavior:\s*auto/);
  });

  it("기존 §11.127 :focus-visible 회귀 0", () => {
    expect(source).toMatch(/:focus-visible/);
  });
});
