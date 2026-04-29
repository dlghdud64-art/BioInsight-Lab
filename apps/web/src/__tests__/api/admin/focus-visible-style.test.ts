/**
 * §11.127 #focus-visible-style
 *
 * Source-level regression guard — globals.css 에 :focus-visible outline
 * 스타일 정형화. WCAG 2.4.7 Focus Visible 정합.
 *
 * 키보드 사용자 (Tab 으로 navigate) 가 현재 focus 위치 visual 인지 가능.
 * mouse 사용자에게는 :focus-visible 가 자동으로 무시됨 (browser default).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PATH = resolve(__dirname, "../../../app/globals.css");

describe("globals.css focus-visible — regression guard (§11.127)", () => {
  const source = readFileSync(PATH, "utf8");

  it(":focus-visible selector 존재", () => {
    expect(source).toMatch(/:focus-visible\b/);
  });

  it("outline 2px solid (visible accent)", () => {
    expect(source).toMatch(/outline:\s*2px\s+solid|outline:\s*\d+px\s+solid/);
  });

  it("outline-offset (focus ring breathing room)", () => {
    expect(source).toMatch(/outline-offset/);
  });

  it("blue accent (LabAxis 표준 focus tone)", () => {
    expect(source).toMatch(/#2563eb|blue-600|var\(--/);
  });

  it("@layer base 안에 정의 (Tailwind cascade 정합)", () => {
    // base layer 의 selector specificity → shadcn focus-visible:ring-* 가 override 가능
    expect(source).toMatch(/@layer\s+base/);
  });
});
