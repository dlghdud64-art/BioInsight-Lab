import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const HEADER = "src/components/dashboard/Header.tsx";

describe("§11.332 — 모바일 글로벌 앱바 네이비 통일(시안 §0)", () => {
  it("헤더 컨테이너가 모바일 네이비 + lg 데스크탑 흰색 복원", () => {
    const src = read(HEADER);
    expect(src).toMatch(/bg-slate-900[^"]*lg:bg-white\/97/);
    expect(src).toMatch(/border-transparent[^"]*lg:border-slate-200/);
  });

  it("로고 텍스트가 모바일 white", () => {
    const src = read(HEADER);
    expect(src).toMatch(/text-xl font-bold tracking-tight text-white/);
  });

  it("모바일 유틸 아이콘이 white/85 + lg 데스크탑 slate 복원", () => {
    const src = read(HEADER);
    // 스캔 아이콘: 모바일 white → lg emerald 복원
    expect(src).toMatch(/text-white\/85 hover:text-white hover:bg-white\/10 lg:text-slate-500 lg:hover:text-emerald-600/);
    // 알림 아이콘: 모바일 white → lg blue 복원
    expect(src).toMatch(/text-white\/85 hover:text-white hover:bg-white\/10 lg:text-slate-500 lg:hover:text-blue-600/);
  });
});

describe("§11.332 — 회귀 보호 (wiring·데스크탑 유지)", () => {
  it("유틸 wiring 유지 (검색·스캔·알림)", () => {
    const src = read(HEADER);
    expect(src).toMatch(/router\.push\("\/app\/search"\)/);
    expect(src).toMatch(/openModal\("scan_hub"\)/);
    expect(src).toMatch(/setIsNotificationOpen\(\(v\) => !v\)/);
  });
  it("데스크탑 프로필·브레드크럼 계약 유지", () => {
    const src = read(HEADER);
    expect(src).toMatch(/hidden lg:block relative/);
    expect(src).toMatch(/hidden md:flex items-center gap-1\.5 text-sm/);
  });
});
