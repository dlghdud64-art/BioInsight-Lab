import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

/**
 * §receiving-list-v2 P2 (호영님 2026-07-08) — 입고 목록 카드 v2 정합
 *   (입고 목록 웹 리디자인 v2.html §list). PLAN_receiving-list-v2 Phase 2.
 *
 * 시안의 2컬럼(입고일 + 담당) 밀도 반영. 단, projection에 입고일 필드 부재(updatedAt만) →
 * "갱신"으로 정직 표기(오라벨 방지). 담당 컬럼·행 wiring·focus 규칙 회귀 0.
 */

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}
const CMP = "src/components/receiving/receiving-desktop-list.tsx";

describe("§receiving-list-v2 P2 — 카드 갱신 컬럼(2컬럼 밀도)", () => {
  it("formatCardDate 헬퍼(updatedAt → MM·DD)", () => {
    const src = read(CMP);
    expect(src).toMatch(/function formatCardDate\(iso: string\)/);
    expect(src).toMatch(/padStart\(2, "0"\)/);
  });

  it("갱신 컬럼 = updatedAt 정직 표기(입고일 오라벨 아님)", () => {
    const src = read(CMP);
    expect(src).toMatch(/>갱신</);
    expect(src).toMatch(/formatCardDate\(item\.updatedAt\)/);
  });
});

describe("§receiving-list-v2 P2 — 회귀 0(담당·행 wiring 보존)", () => {
  it("담당 컬럼 보존", () => {
    const src = read(CMP);
    expect(src).toMatch(/item\.currentOwnerName/);
    expect(src).toMatch(/>담당</);
  });

  it("행 클릭 실 핸들러 보존(no-op 0)", () => {
    const src = read(CMP);
    expect(src).toMatch(/onClick=\{\(\) => onRowClick\(item\)\}/);
  });
});
