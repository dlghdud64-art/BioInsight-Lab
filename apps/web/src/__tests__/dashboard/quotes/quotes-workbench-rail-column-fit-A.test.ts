/**
 * §quotes-workbench-rail Layer A — 컬럼 깨짐 방지 (table min-w + supplier nowrap)
 *
 * 근본 원인(Phase 0 정찰): 견적 테이블이 overflow-x-auto 래퍼(L2701) 안에 있으나
 *   <table>가 w-full 단독이라 컨테이너 폭에 맞춰 압축만 되고 절대 넘치지 않음 →
 *   래퍼 스크롤 무력화 → 컬럼 붕괴 + 글자 중간 깨짐("공급사 미정"→"공급 미경").
 * 수정: <table>에 min-w-[900px] 강제(래퍼가 실제 가로 스크롤) + 공급사 빈상태 whitespace-nowrap.
 *
 * Layer B(rail push→overlay breakpoint)는 별도 배치(rail w-[480px]/min-[1200px] sentinel 진화 필요).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}
const PAGE = "src/app/dashboard/quotes/page.tsx";
const AVATARS = "src/components/quotes/supplier-avatars.tsx";

describe("§quotes-workbench-rail A — 테이블 min-w 강제", () => {
  it("견적 테이블 <table> min-w-[900px] (overflow-x-auto 래퍼 스크롤 활성)", () => {
    const src = read(PAGE);
    expect(src).toMatch(/<table className="w-full min-w-\[900px\] text-xs">/);
  });
  it("회귀 0 — overflow-x-auto bg-pn 래퍼 보존(§11.248d fade-hint)", () => {
    const src = read(PAGE);
    expect(src).toMatch(/overflow-x-auto bg-pn rounded-xl border border-bd\/80/);
  });
});

describe("§quotes-workbench-rail A — supplier 빈상태 nowrap", () => {
  it("'공급사 미정' span whitespace-nowrap (글자 중간 깨짐 방지)", () => {
    const src = read(AVATARS);
    expect(src).toMatch(/text-xs text-slate-400 whitespace-nowrap">공급사 미정/);
  });
  it("회귀 0 — SupplierAvatars 0건 empty state 보존", () => {
    const src = read(AVATARS);
    expect(src).toContain("공급사 미정");
    expect(src).toMatch(/suppliers\.length === 0/);
  });
});
