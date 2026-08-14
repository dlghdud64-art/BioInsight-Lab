/**
 * §auth-dev-login — 개발 전용 로그인은 운영에서 존재하지 않는다
 *
 * 배경 (2026-08-12):
 *   인증 수단이 Google OAuth 단독이라 **우리 스스로 제품을 끝까지 밟을 수단이 없었다.**
 *   "사용자 앞에 세운다" 는 방향 전환을 실행하려면 왕복 검증이 상시 가능해야 한다.
 *   → dev credentials provider 를 붙이되, 운영에서는 providers 배열에 **포함조차 되지 않게** 한다.
 *
 * 계약:
 *   D1. 게이트는 `requiresDestructiveConfirmation()` 을 **재사용**한다.
 *       판정 규칙(운영 host 패턴 등)을 auth.ts 에 다시 쓰지 않는다 —
 *       두 곳에 있으면 갈리고, 갈리면 한쪽이 뚫린다.
 *   D2. provider 가 조건부로만 배열에 들어간다 (무조건 추가 금지).
 *   D3. authorize 안에 런타임 재확인이 있다 (이중 방어).
 *   D4. soft-deleted 사용자는 dev-login 으로도 들어올 수 없다.
 *
 * ⚠️ 이 sentinel 의 한계: 정적 검사다. 런타임에 `requiresDestructiveConfirmation()` 이
 *    올바른 값을 내는지는 §dev-prod-db-separation 쪽 sentinel(G3)이 담당한다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const WEB_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(WEB_ROOT, rel), "utf8");

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const AUTH = stripComments(read("src/auth.ts"));

describe("§auth-dev-login D1/D2 — 운영에서는 provider 가 존재하지 않는다", () => {
  it("수집이 실제로 동작한다 (공허 GREEN 방지)", () => {
    // 대상 0건은 성공이 아니라 실패다 — 파일을 못 읽거나 내용이 비면 여기서 걸린다.
    expect(AUTH.length).toBeGreaterThan(500);
    expect(AUTH).toMatch(/providers\s*:\s*\[/);
  });

  it("D1. 게이트가 requiresDestructiveConfirmation 을 재사용한다", () => {
    expect(AUTH).toMatch(/requiresDestructiveConfirmation\s*\(\s*\)/);
    expect(AUTH).toMatch(/ALLOW_DEV_LOGIN\s*=\s*!\s*requiresDestructiveConfirmation/);
  });

  it("D1-b. auth.ts 가 운영 판정 규칙을 재구현하지 않는다", () => {
    // host 패턴을 여기서 직접 매칭하면 규칙이 갈린다
    expect(AUTH).not.toMatch(/supabase/i);
    expect(AUTH).not.toMatch(/pooler/i);
  });

  it("D2. Credentials provider 가 조건부로만 추가된다", () => {
    expect(AUTH).toMatch(/Credentials\s*\(/);
    // 조건부 스프레드 안에 있어야 한다
    expect(AUTH).toMatch(/\.\.\.\(\s*ALLOW_DEV_LOGIN\s*\?\s*\[[\s\S]*?Credentials\s*\(/);
  });

  it("D3. authorize 안에 런타임 재확인이 있다", () => {
    expect(AUTH).toMatch(/if\s*\(\s*ALLOW_DEV_LOGIN\s*!==\s*true\s*\)\s*return\s+null/);
  });

  /**
   * 🔁 승계 (§auth-bootstrap-coupling, 2026-08-12) — 표현이 바뀌었고 계약은 같다.
   *   이전 `!user || user.deletedAt` 은 "없으면 거부" 를 함께 담고 있었다.
   *   지금 dev-login 은 **없으면 생성**하므로(가입 경로 검증을 위해),
   *   거부 조건은 **soft-deleted 뿐**이다: `user?.deletedAt`.
   *   ⚠️ 계약 자체("soft-deleted 는 들어올 수 없다")는 불변이며,
   *      삭제된 사용자가 **재생성되지 않는지**도 함께 잠근다 —
   *      findUnique 가 그 행을 찾으므로 생성 분기로 빠지지 않는다.
   */
  it("D4. soft-deleted 사용자는 dev-login 으로 들어올 수 없다", () => {
    expect(AUTH).toMatch(/deletedAt/);
    expect(AUTH).toMatch(/if \(user\?\.deletedAt\) return null/);
    // 생성 분기는 soft-deleted 판정 **뒤에** 온다(순서가 뒤집히면 삭제 계정이 부활한다)
    expect(AUTH).toMatch(/user\?\.deletedAt\) return null;[\s\S]{0,900}?if \(!user\)/);
  });
});
