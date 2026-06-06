/**
 * §11.359 C (회귀 보호) — 모바일 더보기 시트 로그아웃 진입점.
 *
 * 모바일 메뉴 진입이 햄버거(계정/설정)·더보기(운영) 둘로 분리돼 있으나 로그아웃이
 * 더보기 시트엔 부재였음. C안(역할 분리 유지) — 더보기 시트 하단에 로그아웃 추가.
 *
 * sentinel(readFileSync+regex).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}

const SHEET = "src/components/layout/bottom-nav-more-sheet.tsx";

describe("§11.359 — 더보기 시트 로그아웃", () => {
  it("signOut import + 호출(callbackUrl '/')", () => {
    const src = read(SHEET);
    expect(src).toMatch(/import \{ useSession, signOut \} from "next-auth\/react"/);
    expect(src).toMatch(/signOut\(\{ callbackUrl: "\/" \}\)/);
  });

  it("로그아웃 버튼 + 시트 닫기 + red 톤", () => {
    const src = read(SHEET);
    expect(src).toMatch(/onClick=\{handleSignOut\}/);
    expect(src).toMatch(/<span>로그아웃<\/span>/);
    expect(src).toMatch(/text-red-600/);
    // 클릭 시 시트 먼저 닫고 signOut
    expect(src).toMatch(/onOpenChange\(false\);\s*void signOut/);
  });
});

describe("§11.359 — 회귀 0", () => {
  it("기존 메뉴 그룹·admin·렌더 보존", () => {
    const src = read(SHEET);
    expect(src).toMatch(/menuGroups\.map/);
    expect(src).toMatch(/adminItems\.map/);
    expect(src).toMatch(/전체 메뉴/);
  });
});
