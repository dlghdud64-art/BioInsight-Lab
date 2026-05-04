/**
 * #api-products-id-image-route-create — route stub source-level test
 *
 * §11.203 후속 — /api/products/[id]/image route 신설 검증.
 * - placeholder SVG 정합 (Content-Type: image/svg+xml)
 * - imageUrl 존재 시 307 redirect
 * - product 부재 / DB error → placeholder fallback (4xx noise 0)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const ROUTE = "src/app/api/products/[id]/image/route.ts";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("#api-products-id-image-route-create — route stub", () => {
  it("route file 존재", () => {
    expect(() => read(ROUTE)).not.toThrow();
  });

  it("GET handler export", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/export\s+async\s+function\s+GET/);
  });

  it("dynamic = 'force-dynamic' (Next.js route caching 회피)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/export\s+const\s+dynamic\s*=\s*["']force-dynamic["']/);
  });

  it("Product.imageUrl DB 조회 (canonical truth)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/db\.product\.findUnique/);
    expect(src).toMatch(/imageUrl:\s*true/);
  });

  it("imageUrl 존재 → 307 redirect", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/NextResponse\.redirect[\s\S]*\{\s*status:\s*307/);
  });

  it("placeholder SVG 정합 (Content-Type: image/svg+xml)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/Content-Type["']\s*:\s*["']image\/svg\+xml/);
    expect(src).toMatch(/<svg[\s\S]*xmlns/);
  });

  it("DB error fallback → placeholder (4xx noise 0)", () => {
    const src = read(ROUTE);
    // try/catch + catch 안에서 placeholderResponse 호출
    expect(src).toMatch(/catch[\s\S]*placeholderResponse/);
  });

  it("status 200 placeholder (4xx 0)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/status:\s*200/);
    // 4xx 패턴 잔존 0
    expect(src).not.toMatch(/status:\s*40[0-9]/);
  });

  it("Cache-Control header (브라우저 캐시 정합)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/Cache-Control/);
  });

  it("#api-products-id-image-route-create 코멘트 명시", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/#api-products-id-image-route-create/);
  });
});
