import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const HEADER = "src/components/dashboard/Header.tsx";

describe("§11.332 — 모바일 앱바 네이비(max-lg), 데스크탑 원본 흰 헤더 보존", () => {
  it("컨테이너 데스크탑 흰 배경 + 네이비는 max-lg 모바일 전용 (하단 줄 제거)", () => {
    const src = read(HEADER);
    // 데스크탑 흰 배경 + 하단 border 없음(호영님 2026-07-08 상단 줄 제거). 모바일만 네이비.
    expect(src).toMatch(/border-b border-transparent backdrop-blur-sm bg-white\/97 max-lg:bg-slate-900/);
    // 구 slate-200 하단 줄·lg-override 잔재 0
    expect(src).not.toMatch(/border-b border-slate-200 backdrop-blur-sm/);
    expect(src).not.toMatch(/bg-slate-900[^"]*lg:bg-white\/97/);
  });

  it("로고 텍스트 데스크탑 slate 원본 + max-lg white", () => {
    const src = read(HEADER);
    expect(src).toMatch(/text-xl font-bold tracking-tight text-slate-900 max-lg:text-white/);
  });

  it("스캔·알림 아이콘 데스크탑 slate 원본 + max-lg white (데스크탑 무변)", () => {
    const src = read(HEADER);
    expect(src).toMatch(/text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 max-lg:text-white\/85 max-lg:hover:text-white max-lg:hover:bg-white\/10/);
    expect(src).toMatch(/text-slate-500 hover:text-blue-600 hover:bg-blue-50 max-lg:text-white\/85 max-lg:hover:text-white max-lg:hover:bg-white\/10/);
    // 구 lg-override 방식 잔재 0
    expect(src).not.toMatch(/lg:text-slate-500 lg:hover:text-emerald-600/);
    expect(src).not.toMatch(/lg:text-slate-500 lg:hover:text-blue-600/);
  });
});

describe("§11.332 — 회귀 보호 (wiring·데스크탑 계약 유지)", () => {
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
