/**
 * §placeholder-success-audit — vendor 견적 회신 포털 경로는 성공을 반환하지 않는다
 *
 * 배경 (2026-08-10 §enforcement-handle-close-sweep 배치11 관측 → 호영님 P1 분리):
 *   `/api/vendor/requests/[id]/respond` 는 DB 에 아무것도 쓰지 않으면서
 *   `{ success: true }` 를 반환하도록 작성돼 있었다.
 *   (실측 보정: zod 스키마가 `items` 를 요구하는데 UI 는 `responses` 를 보내
 *    실제로는 항상 500 이었다 — 저장도, 성공 응답도 없었다.)
 *
 *   피해가 자기교정되지 않는 클래스라 다른 스텁 2건(templates)과 분리해 즉시 처리했다:
 *   구매자는 회신을 못 받고, 벤더는 자기가 답했다고 알거나 원인 모를 실패만 본다.
 *
 * 계약:
 *   V1. 라우트는 `success: true` 를 반환하지 않는다 (UI 차단만으로는 부족 —
 *       모바일·외부 호출자가 있을 수 있다).
 *   V2. 라우트는 501 + 미구현 코드로 응답한다.
 *   V3. 포털 화면에 제출 표면이 **존재하지 않는다** (disabled 가 아니라 미생성).
 *   V4. 실제 동작하는 토큰 경로는 무손상 — 이 sentinel 이 그쪽을 막아선 안 된다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(WEB_ROOT, rel), "utf8");
}

/** 주석은 제외하고 코드만 본다 — 설명 주석이 부정 단언을 오염시키지 않도록 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const ROUTE = "src/app/api/vendor/requests/[id]/respond/route.ts";
const PAGE = "src/app/vendor/requests/[id]/page.tsx";
const TOKEN_ROUTE = "src/app/api/vendor-requests/[token]/response/route.ts";

describe("§placeholder-success-audit V1/V2 — respond 라우트는 성공을 반환하지 않는다", () => {
  it("V1. success: true 를 반환하지 않는다", () => {
    const code = stripComments(read(ROUTE));
    expect(code).not.toMatch(/success\s*:\s*true/);
  });

  it("V2. 501 + 미구현 코드로 응답한다", () => {
    const code = stripComments(read(ROUTE));
    expect(code).toMatch(/status:\s*501/);
    expect(code).toMatch(/VENDOR_RESPOND_NOT_IMPLEMENTED/);
  });

  it("V2-b. DB 쓰기를 하지 않는다 (미구현 상태의 사실 고정)", () => {
    const code = stripComments(read(ROUTE));
    expect(code).not.toMatch(/db\.\w+\.(create|update|upsert|delete)/);
  });
});

describe("§placeholder-success-audit V3 — 포털 화면에 제출 표면이 없다", () => {
  it("V3. QuoteForm 을 렌더하지 않는다 (disabled 가 아니라 미생성)", () => {
    const code = stripComments(read(PAGE));
    expect(code).not.toMatch(/<QuoteForm/);
    expect(code).not.toMatch(/from\s+"@\/components\/vendor\/quote-form"/);
  });

  it("V3-b. respond 엔드포인트를 호출하지 않는다", () => {
    const code = stripComments(read(PAGE));
    expect(code).not.toMatch(/\/respond/);
  });

  it("V3-c. 요청 내용은 계속 읽을 수 있다 (빈 화면 금지)", () => {
    const code = stripComments(read(PAGE));
    expect(code).toMatch(/request\.items\.map/);
  });
});

describe("§placeholder-success-audit V4 — 동작하는 토큰 경로는 무손상", () => {
  it("V4. 토큰 회신 경로는 실제 쓰기를 유지한다", () => {
    const code = stripComments(read(TOKEN_ROUTE));
    expect(code).toMatch(/quoteVendorResponseItem\.upsert/);
    expect(code).toMatch(/quoteVendorRequest\.update/);
  });
});
