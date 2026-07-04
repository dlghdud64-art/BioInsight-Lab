/**
 * §safety-csrf-fix (호영님 2026-07-04) — 안전 모달 POST(sds·inspection) CSRF 토큰 부착.
 * 근본원인(런타임 로그): raw fetch 는 x-csrf-token 미포함 → edge-middleware 403(레지스트리 기본
 * protection:'required', /api/products/[id]/(sds|inspection) exempt 미등록). csrfFetch 로 해소.
 * ⚠ CSRF 는 엣지/런타임 이슈 — 빌드(tsc)로 못 잡음. 배포 후 런타임 smoke 필수.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const PAGE = readFileSync(join(__dirname, "..", "..", "app/dashboard/safety/page.tsx"), "utf8");

describe("§safety-csrf-fix — 안전 모달 POST csrfFetch", () => {
  it("csrfFetch import(@/lib/api-client)", () => {
    expect(PAGE).toMatch(/import \{ csrfFetch \} from "@\/lib\/api-client"/);
  });
  it("MSDS 등록·점검 저장 POST = csrfFetch(raw fetch 아님)", () => {
    expect(PAGE).toMatch(/csrfFetch\(`\/api\/products\/\$\{productId\}\/sds`/);
    expect(PAGE).toMatch(/csrfFetch\(`\/api\/products\/\$\{productId\}\/inspection`/);
    // 안전 모달 POST 를 raw fetch 로 하는 잔재 0(CSRF 미포함 → 403 재발 방지). GET fetch 는 허용.
    expect(PAGE).not.toMatch(/await fetch\(`\/api\/products\/\$\{productId\}\/(sds|inspection)`/);
  });
});
