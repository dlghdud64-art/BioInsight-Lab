/**
 * §sso-phantom-wiring — SSO 설정 표면은 **스키마 컬럼과 짝으로만 존재한다**
 *
 * 배경 (실측 2026-08-12):
 *   `Organization` 에 `ssoEnabled` · `ssoConfig` · `ssoProvider` · `ssoMetadataUrl` ·
 *   `ssoEntityId` · `ssoCertificate` — **6개 컬럼이 전부 없다**(schema 전역 0).
 *   그런데 `api/organizations/[id]/sso` 가 그 6개에 `update`/`select` 를 걸고,
 *   `dashboard/settings/enterprise` 가 그 라우트를 **라이브로 호출**했다.
 *   `db` 가 `any` 라 컴파일은 통과한다 — §phantom-model-call 의 **필드판**이다.
 *
 * 사용자 체감 실측 (교정 전 관측):
 *   ① 라우트 → `catch` 가 잡아 **500 `{error:"Failed to update SSO config"}`** (삼키지 않음)
 *   ② 저장 UI → `onError` **destructive toast "SSO 설정 저장 실패"** (거짓 성공 아님)
 *   ③ 🛑 **조회 실패는 조용했다** — `ssoLoading`·에러 상태를 렌더에 쓰지 않아
 *      화면이 `ssoEnabled=false` 기본값으로 그려졌다. 사용자는 **"SSO 가 꺼져 있다"**
 *      로 읽는다(설정이 없다고 믿는다). 거짓 성공보다는 약하나 거짓 표시다.
 *
 * 계약 (짝 강제):
 *   S1. 컬럼이 **없는 동안** SSO 설정 폼을 렌더하지 않는다 (disabled 아님 — 미생성)
 *   S2. 항상 실패하는 조회를 자동 실행하지 않는다
 *   S3. 라우트는 **유지**한다 (컬럼이 서면 그대로 쓴다 — 지우면 다시 만들어야 한다)
 *   S0. 🔔 컬럼이 생기면 **RED** — UI 를 되살리고 이 단언들을 승계하라
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const WEB_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(WEB_ROOT, rel), "utf8");
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

const SCHEMA = read("prisma/schema.prisma");
const PAGE_REL = "src/app/dashboard/settings/enterprise/page.tsx";
const PAGE_CODE = stripComments(read(PAGE_REL));
const ROUTE_REL = "src/app/api/organizations/[id]/sso/route.ts";

/** Organization 모델 블록만 잘라낸다 — 다른 모델의 동명 필드에 속지 않기 위해. */
const ORG_BLOCK = (() => {
  const i = SCHEMA.indexOf("\nmodel Organization {");
  const j = SCHEMA.indexOf("\n}", i);
  return i >= 0 ? SCHEMA.slice(i, j) : "";
})();

const SSO_COLUMNS = [
  "ssoEnabled",
  "ssoConfig",
  "ssoProvider",
  "ssoMetadataUrl",
  "ssoEntityId",
  "ssoCertificate",
];

describe("§sso-phantom S0 — 수집이 실제로 동작한다 + 컬럼 도입 알림", () => {
  it("Organization 모델 블록이 실제로 잘렸다", () => {
    expect(ORG_BLOCK.length).toBeGreaterThan(500);
    // 실재하는 필드로 절단 검증 — 공허 GREEN 방지
    expect(ORG_BLOCK).toMatch(/\n {2}name {2,}String/);
  });

  it("🔔 sso 컬럼이 생기면 UI 를 되살리고 이 단언들을 승계할 것", () => {
    const present = SSO_COLUMNS.filter((c) => new RegExp(`\\n\\s{2}${c}\\s`).test(ORG_BLOCK));
    expect(
      present,
      "Organization 에 sso 컬럼이 생겼다. S1·S2 를 승계하고 SSO 설정 UI 를 복원할 것(§sso-phantom-wiring).",
    ).toEqual([]);
  });
});

describe("§sso-phantom S1 — 컬럼 없이 설정 폼을 만들지 않는다", () => {
  it("SSO 스위치·입력·저장 버튼이 렌더되지 않는다", () => {
    expect(PAGE_CODE).not.toMatch(/checked=\{ssoEnabled\}/);
    expect(PAGE_CODE).not.toMatch(/onClick=\{handleSaveSSO\}/);
    expect(PAGE_CODE).not.toMatch(/id="sso-provider"/);
  });

  it("준비 중임을 화면에 밝힌다 (조용한 미생성 금지)", () => {
    expect(PAGE_CODE).toMatch(/SSO 는 준비 중입니다/);
  });
});

describe("§sso-phantom S2 — 항상 실패하는 조회를 자동 실행하지 않는다", () => {
  it("sso-config 쿼리가 비활성화돼 있다", () => {
    expect(PAGE_CODE).toMatch(/queryKey: \["sso-config"[\s\S]{0,400}?enabled: false/);
  });
});

describe("§sso-phantom S3 — 라우트는 유지한다", () => {
  it("라우트 파일이 살아 있다", () => {
    expect(existsSync(join(WEB_ROOT, ROUTE_REL))).toBe(true);
    expect(read(ROUTE_REL)).toMatch(/export async function PUT/);
  });
});
