// #catalog-spec-backfill ①-b Phase 1 — Contract & Failing Tests (호영님 P-track, 2026-06-11)
// 계약: 견적 item → Product 매칭 tier(exact/candidate/none) /
//       catalog exact 단일일치만 auto / spec=매칭키 아님 / spec max 200 클램프(조용한 절단 금지) /
//       canonical(db.product) write 0(순수 함수).
// 패턴: pure unit + sentinel(readFileSync). DB mount 없음.
// ⚠️ Phase 1 = stub 대상 RED. Phase 2 GREEN 후 통과 예상.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  matchQuoteItemToProduct,
  clampSpecForPromotion,
  normMatchKey,
  SPEC_MAX_LEN,
  type QuoteMatchInput,
  type QuoteProductTarget,
} from "@/lib/catalog/quote-product-match";

const REPO_WEB = join(__dirname, "..", "..", "..");
const read = (rel: string): string => readFileSync(join(REPO_WEB, rel), "utf8");

const P = (over: Partial<QuoteProductTarget>): QuoteProductTarget => ({
  id: "p1",
  name: null,
  catalogNumber: null,
  modelNumber: null,
  ...over,
});
const Q = (over: Partial<QuoteMatchInput>): QuoteMatchInput => ({
  productName: null,
  catalogNumber: null,
  specification: null,
  ...over,
});

// ── 1. tier 판정 ──────────────────────────────────────────────────────
describe("§①-b P1 — matchQuoteItemToProduct tier", () => {
  it("catalog exact 단일일치 → exact (1건)", () => {
    const r = matchQuoteItemToProduct(
      Q({ catalogNumber: "ABC-123" }),
      [P({ id: "x", catalogNumber: "ABC-123" }), P({ id: "y", catalogNumber: "ZZZ-999" })],
    );
    expect(r.tier).toBe("exact");
    expect(r.matches.map((m) => m.id)).toEqual(["x"]);
  });

  it("catalog exact → Product.modelNumber 도 매칭 대상", () => {
    const r = matchQuoteItemToProduct(
      Q({ catalogNumber: "M-500" }),
      [P({ id: "m", modelNumber: "M-500" })],
    );
    expect(r.tier).toBe("exact");
    expect(r.matches[0]?.id).toBe("m");
  });

  it("catalog 복수 Product 일치 → candidate (auto 아님)", () => {
    const r = matchQuoteItemToProduct(
      Q({ catalogNumber: "DUP-1" }),
      [P({ id: "a", catalogNumber: "DUP-1" }), P({ id: "b", catalogNumber: "DUP-1" })],
    );
    expect(r.tier).toBe("candidate");
    expect(r.matches.length).toBe(2);
  });

  it("catalog 무일치 + productName fuzzy → candidate", () => {
    const r = matchQuoteItemToProduct(
      Q({ productName: "Trypsin" }),
      [P({ id: "t", name: "Trypsin-EDTA 0.25%" })],
    );
    expect(r.tier).toBe("candidate");
    expect(r.matches[0]?.id).toBe("t");
  });

  it("무일치 → none (0건, CTA 미노출 신호)", () => {
    const r = matchQuoteItemToProduct(
      Q({ productName: "Unobtainium", catalogNumber: "NOPE-0" }),
      [P({ id: "z", name: "Saline", catalogNumber: "S-1" })],
    );
    expect(r.tier).toBe("none");
    expect(r.matches).toEqual([]);
  });
});

// ── 2. canonical 오염 차단 가드 ───────────────────────────────────────
describe("§①-b P1 — auto-merge 게이트", () => {
  it("exact 는 catalog 단일일치에서만 — name 일치만으론 exact 승격 금지", () => {
    const r = matchQuoteItemToProduct(
      Q({ productName: "Acetone" }),
      [P({ id: "n", name: "Acetone" })],
    );
    expect(r.tier).not.toBe("exact");
  });

  it("specification 은 매칭키 아님 — spec 변경이 tier 판정에 영향 0", () => {
    const products = [P({ id: "s", catalogNumber: "CAT-9" })];
    const a = matchQuoteItemToProduct(Q({ catalogNumber: "CAT-9", specification: "500mL" }), products);
    const b = matchQuoteItemToProduct(Q({ catalogNumber: "CAT-9", specification: "1L" }), products);
    expect(a.tier).toBe(b.tier);
    expect(a.matches.map((m) => m.id)).toEqual(b.matches.map((m) => m.id));
  });

  it("빈 catalog + 빈 name → none (빈 신호로 over-match 금지)", () => {
    const r = matchQuoteItemToProduct(Q({}), [P({ id: "any", name: "X", catalogNumber: "Y" })]);
    expect(r.tier).toBe("none");
  });
});

// ── 3. spec 승격 클램프 (조용한 절단 금지) ────────────────────────────
describe("§①-b P1 — clampSpecForPromotion (max 200)", () => {
  it("SPEC_MAX_LEN = 200 (route zod 정합)", () => {
    expect(SPEC_MAX_LEN).toBe(200);
  });

  it("정상 spec → ok + 값 보존", () => {
    const r = clampSpecForPromotion("500mL, ≥99%");
    expect(r.ok).toBe(true);
    expect(r.value).toBe("500mL, ≥99%");
  });

  it("200 초과 → 거부(too_long), 조용한 절단 금지", () => {
    const r = clampSpecForPromotion("x".repeat(201));
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("too_long");
    expect(r.value).toBeNull();
  });

  it("빈/null → 거부(empty)", () => {
    expect(clampSpecForPromotion(null).ok).toBe(false);
    expect(clampSpecForPromotion("   ").ok).toBe(false);
  });
});

// ── 4. norm 엄격도 (procurement-ref 동형) ─────────────────────────────
describe("§①-b P1 — normMatchKey 엄격도", () => {
  it("소문자 + 공백압축까지만 (그 이상 느슨화 금지)", () => {
    expect(normMatchKey("  ABC  123 ")).toBe("abc 123");
    // 하이픈/특수문자는 보존 — 제거하면 오매칭 위험
    expect(normMatchKey("AB-12")).toBe("ab-12");
  });

  it("느슨화 회귀 차단 — 소스에 하이픈/언더스코어 strip 분기 부재", () => {
    const src = read("src/lib/catalog/quote-product-match.ts");
    const normBody = src.split("normMatchKey")[1]?.split("\n")[0] ?? "";
    expect(normBody).not.toMatch(/replace\([^)]*[-_]/);
  });
});

// ── 5. canonical boundary (순수 함수, DB write 0) ─────────────────────
describe("§①-b P1 — canonical boundary", () => {
  it("매처 소스에 db/prisma write 분기 부재", () => {
    const src = read("src/lib/catalog/quote-product-match.ts");
    expect(src).not.toMatch(/db\.\w+\.(update|create|upsert|delete)/);
    expect(src).not.toMatch(/prisma\./);
  });
});
