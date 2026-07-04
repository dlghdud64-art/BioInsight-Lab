/**
 * §scan-cas-match-restore (호영님 2026-07-04) — casNo 컬럼(P1) 이후 CAS 매칭 복원.
 * CAS = 물질 식별자(SKU 아님) → auto-match 금지, 승인형 후보로만(오매칭·중복 마스터 방지).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const R = join(__dirname, "..", "..");
const rd = (p: string) => readFileSync(join(R, p), "utf8");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

describe("§scan-cas-match-restore — 타입", () => {
  it("ScoredCandidate.basis 에 cas 추가", () => {
    expect(strip(rd("lib/inventory/reverse-match.ts"))).toMatch(/basis:[^;]*\|\s*"cas"/);
  });
});

describe("§scan-cas-match-restore — route (후보 복원, auto-match 금지)", () => {
  const S = strip(rd("app/api/inventory/scan-label/route.ts"));
  it("casNo 로 후보 조회(정규화 CAS)", () => {
    expect(S).toMatch(/normalizeCas\(merged\.casNumber\)/);
    expect(S).toMatch(/where:\s*\{\s*casNo:\s*normCas\s*\}/);
    expect(S).toMatch(/basis:\s*"cas"/);
  });
  it("CAS 는 matchedProduct 자동확정 아님(후보만) — 병합·cap3", () => {
    expect(S).toMatch(/casCands/);
    expect(S).toMatch(/\.slice\(0,\s*3\)/);
    // matchedProduct 는 catalogNo 경로에서만 세팅(=... product) — CAS 로 재할당 없음
    expect(S).not.toMatch(/matchedProduct\s*=\s*casCands/);
  });
  it("stale 제거 주석(CAS 매칭 제거) 잔존 0", () => {
    expect(S).not.toMatch(/CAS 기반 제품 매칭 제거/);
  });
});

describe("§scan-cas-match-restore — 클라 헤딩 정직화", () => {
  it("CAS/이름 후보 공통 헤딩(유사→일치 가능)", () => {
    const M = rd("components/inventory/LabelScannerModal.tsx");
    expect(M).toMatch(/일치 가능 품목 후보/);
  });
});
