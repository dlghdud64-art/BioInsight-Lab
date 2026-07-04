/**
 * §msds-bulk-registration B-P1+B-P2 (호영님 2026-07-04)
 *  B-P1: safety-extractor 에 매칭 identity(casNumber/productName) 추가(additive).
 *  B-P2: MSDS→재고 품목 매칭 순수함수(CAS/Cat/명, 다중=수동 확인, auto 금지).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { matchMsdsToProducts, type MatchProduct } from "@/lib/safety/msds-match";
const R = join(__dirname, "..", "..");

describe("§msds-bulk B-P1 — 추출 identity 확장", () => {
  const EX = readFileSync(join(R, "lib/ai/safety-extractor.ts"), "utf8");
  it("SafetySummary 에 productName·casNumber(additive)", () => {
    expect(EX).toMatch(/productName\?:\s*string \| null/);
    expect(EX).toMatch(/casNumber\?:\s*string \| null/);
  });
  it("prompt 에 제품명·CAS 추출 지침", () => {
    expect(EX).toMatch(/"productName":/);
    expect(EX).toMatch(/"casNumber":/);
  });
});

const P: MatchProduct[] = [
  { id: "p1", name: "염산 35%", catalogNumber: "H1758", casNo: "7647-01-0" },
  { id: "p2", name: "메탄올 HPLC", catalogNumber: "M1029", casNo: "67-56-1" },
  { id: "p3", name: "메탄올 ACS", catalogNumber: "M9999", casNo: "67-56-1" },
];

describe("§msds-bulk B-P2 — 매칭기(auto 금지·수동 확인)", () => {
  it("Cat No. 유일 → auto 매칭(SKU 유일 식별자)", () => {
    const r = matchMsdsToProducts({ catalogNo: "H1758" }, P);
    expect(r.productId).toBe("p1"); expect(r.basis).toBe("catalog"); expect(r.ambiguous).toBe(false);
  });
  it("CAS 유일 → auto 매칭", () => {
    const r = matchMsdsToProducts({ casNo: "7647-01-0" }, P);
    expect(r.productId).toBe("p1"); expect(r.basis).toBe("cas");
  });
  it("CAS 다중(같은 CAS·다른 SKU) → ambiguous, auto 금지", () => {
    const r = matchMsdsToProducts({ casNo: "67-56-1" }, P);
    expect(r.productId).toBeNull(); expect(r.ambiguous).toBe(true); expect(r.candidates.length).toBe(2);
  });
  it("제품명만 → 후보 제시(auto 확정 금지)", () => {
    const r = matchMsdsToProducts({ productName: "메탄올 HPLC" }, P);
    expect(r.productId).toBeNull(); expect(r.basis).toBe("name"); expect(r.ambiguous).toBe(true);
  });
  it("Cat 우선(Cat+CAS 동시)", () => {
    expect(matchMsdsToProducts({ catalogNo: "M1029", casNo: "67-56-1" }, P).productId).toBe("p2");
  });
  it("무매칭 → none", () => {
    expect(matchMsdsToProducts({ casNo: "99999-99-9" }, P).basis).toBe("none");
  });
});
