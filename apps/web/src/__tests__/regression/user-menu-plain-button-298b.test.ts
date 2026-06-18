/**
 * §11.298b #user-menu-plain-button — auth profile dropdown plain button.
 *
 * 호영님 spec (2026-05-24): 단일 dropdown 11 file 중 가장 큰 user-menu.tsx
 *   (130 line, 10+ menuItem). §11.295 프로필 패턴 정합. Radix DropdownMenu*
 *   import 제거 + plain button + useState + 조건부 backdrop + role="menu".
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = readFileSync(
  resolve(__dirname, "../../components/auth/user-menu.tsx"),
  "utf8",
);

describe("§11.298b — user-menu plain button", () => {
  it("§11.298b trace marker + isUserMenuOpen useState", () => {
    expect(SRC).toMatch(/§11\.298b/);
    expect(SRC).toMatch(/const \[isUserMenuOpen, setIsUserMenuOpen\] = useState\(false\)/);
  });

  it('plain Button aria-label="사용자 메뉴" + aria-expanded + onClick toggle', () => {
    expect(SRC).toMatch(/aria-label="사용자 메뉴"/);
    expect(SRC).toMatch(/aria-expanded=\{isUserMenuOpen\}/);
    expect(SRC).toMatch(/onClick=\{\(\)\s*=>\s*setIsUserMenuOpen/);
  });

  it("Radix DropdownMenu* import 완전 제거 + 사용 부재", () => {
    expect(SRC).not.toMatch(/from "@\/components\/ui\/dropdown-menu"/);
    expect(SRC).not.toMatch(/<DropdownMenu(?:Trigger|Content|Item|Label|Separator)?\s/);
  });

  it("조건부 backdrop + role=\"menu\" + 7 menuItem (대시보드/견적/구매/재고/설정/청구/고객센터) 보존", () => {
    expect(SRC).toMatch(/fixed inset-0[\s\S]{0,100}setIsUserMenuOpen\(false\)/);
    expect(SRC).toMatch(/role="menu"/);
    expect(SRC).toMatch(/href="\/dashboard"[\s\S]{0,300}대시보드/);
    expect(SRC).toMatch(/href="\/dashboard\/quotes"[\s\S]{0,300}견적 관리/);
    expect(SRC).toMatch(/href="\/dashboard\/purchases"[\s\S]{0,300}구매 운영/);
    expect(SRC).toMatch(/href="\/dashboard\/inventory"[\s\S]{0,300}재고 관리/);
    expect(SRC).toMatch(/href="\/dashboard\/settings"[\s\S]{0,300}설정/);
    expect(SRC).toMatch(/href="\/dashboard\/settings\?tab=billing"[\s\S]{0,300}청구 및 구독/);
    // §ui-rebrand — 연락처 도메인 labaxis.io(미verified) → labaxis.co.kr(Resend/Zoho verified) 통일.
    //   298b 보호 의도(고객센터 mailto menuItem 보존)는 유지, 도메인만 정합.
    expect(SRC).toMatch(/mailto:support@labaxis\.co\.kr[\s\S]{0,300}고객센터/);
  });

  it("로그아웃 button — signOut + resetWorkbenchSessionOnLogout + invalidateWorkbenchQueryCache 보존", () => {
    expect(SRC).toMatch(/signOut\(\{\s*callbackUrl:\s*"\/"\s*\}\)/);
    expect(SRC).toMatch(/resetWorkbenchSessionOnLogout\(\)/);
    expect(SRC).toMatch(/invalidateWorkbenchQueryCache\(queryClient\)/);
  });

  it("사용자 정보 header (name + email + role) onClick → /dashboard/settings 보존", () => {
    expect(SRC).toMatch(/router\.push\("\/dashboard\/settings"\)/);
    expect(SRC).toMatch(/session\.user\.name/);
    expect(SRC).toMatch(/session\.user\.email/);
    expect(SRC).toMatch(/USER_ROLES\[session\.user\.role/);
  });

  it("status loading + null guard 보존 (회귀 0)", () => {
    expect(SRC).toMatch(/status === "loading" && showLoading/);
    expect(SRC).toMatch(/if \(!session\?\.user\)/);
  });
});
