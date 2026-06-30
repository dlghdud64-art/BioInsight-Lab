/**
 * §scan-reverse-match-v2 (호영님 2026-06-30) — reverse-match 스코어링 유닛.
 *
 * 양방향 정규화 contains + 토큰(≥2 가드) + per-candidate 신뢰도 + 정렬 + cap 3.
 * mock db.product.findMany 로 pool 주입 — 스코어링 로직만 검증(DB 필터 X).
 */

import { describe, it, expect, vi } from "vitest";
import { rankReverseCandidates, rankSynonymCandidates, type ScoredCandidate } from "@/lib/inventory/reverse-match";

type Raw = { id: string; name: string; brand: string | null; catalogNumber: string | null };
function dbWith(pool: Raw[]) {
  return { product: { findMany: vi.fn().mockResolvedValue(pool) } };
}
const P = (id: string, name: string, brand: string | null = null, cat: string | null = null): Raw => ({
  id, name, brand, catalogNumber: cat,
});

describe("§scan-reverse-match-v2 — exact / 양방향 contains", () => {
  it("exact name + brand → high(0.95)", async () => {
    const r = await rankReverseCandidates({ productName: "BCP", brand: "Sigma" }, { db: dbWith([P("a", "BCP", "Sigma", "B9673")]) });
    expect(r[0].confidence).toBe(0.95);
    expect(r[0].level).toBe("high");
    expect(r[0].basis).toBe("exact");
  });

  it("정규화: 하이픈·대소문자 차이 흡수 → exact", async () => {
    const r = await rankReverseCandidates({ productName: "trypsin-edta" }, { db: dbWith([P("a", "Trypsin EDTA")]) });
    expect(r[0].basis).toBe("exact");
    expect(r[0].confidence).toBe(0.85);
  });

  it("양방향: 스캔 ⊇ 기존 (풀네임 스캔 → 약어 등록 아님, 부분 스캔)", async () => {
    // 스캔 'Bromocresol Purple Solution' ⊇ 기존 'Bromocresol Purple'
    const r = await rankReverseCandidates({ productName: "Bromocresol Purple Solution" }, { db: dbWith([P("a", "Bromocresol Purple")]) });
    expect(r.length).toBe(1);
    expect(r[0].basis).toBe("contains");
  });

  it("양방향: 기존 ⊇ 스캔 (약어 스캔 → 풀 등록) + exact 와 신뢰도 분리·정렬", async () => {
    // 스캔 'BCP' → 기존 'BCP'(exact, high) vs 'BCP (1-Bromo-3-chloropropane)'(contains, < exact)
    const r = await rankReverseCandidates(
      { productName: "BCP" },
      { db: dbWith([P("long", "BCP (1-Bromo-3-chloropropane)", null, "B9673"), P("exact", "BCP", "Sigma", "B9673")]) },
    );
    expect(r[0].id).toBe("exact"); // 정렬: exact 가 먼저
    expect(r[0].confidence).toBeGreaterThan(r[1].confidence);
    expect(r[1].basis).toBe("contains");
  });
});

describe("§scan-reverse-match-v2 — 토큰 가드(FP 방지)", () => {
  it("단일 토큰 공유 → 후보 아님 (Sodium Chloride vs Sodium Phosphate)", async () => {
    const r = await rankReverseCandidates({ productName: "Sodium Chloride" }, { db: dbWith([P("a", "Sodium Phosphate")]) });
    expect(r).toEqual([]);
  });

  it("≥2 토큰 공유 → 후보 (Trypsin EDTA 0.25% vs Trypsin EDTA 0.05%)", async () => {
    const r = await rankReverseCandidates({ productName: "Trypsin EDTA 0.25%" }, { db: dbWith([P("a", "Trypsin EDTA 0.05%")]) });
    expect(r.length).toBe(1);
    expect(r[0].basis).toBe("token");
    expect(r[0].confidence).toBeLessThan(0.8); // 토큰은 high 아님
  });

  it("brand 단독 매칭 금지 — 이름 신호 0 + brand 일치 → 후보 아님", async () => {
    const r = await rankReverseCandidates({ productName: "Never Seen Reagent", brand: "Sigma" }, { db: dbWith([P("a", "BCP", "Sigma")]) });
    expect(r).toEqual([]);
  });
});

describe("§scan-reverse-match-v2 — 정렬·cap·빈입력", () => {
  it("신뢰도순 정렬 + cap 3", async () => {
    const pool = [
      P("t1", "Glucose Anhydrous Powder"), // token (2 공유: glucose, anhydrous) with scan below
      P("c1", "D-Glucose Anhydrous"),       // contains-ish
      P("e1", "Glucose Anhydrous"),          // exact
      P("t2", "Glucose Anhydrous USP"),
      P("t3", "Glucose Anhydrous Fine"),
    ];
    const r = await rankReverseCandidates({ productName: "Glucose Anhydrous" }, { db: dbWith(pool) });
    expect(r.length).toBeLessThanOrEqual(3);
    for (let i = 1; i < r.length; i++) {
      expect(r[i - 1].confidence).toBeGreaterThanOrEqual(r[i].confidence);
    }
  });

  it("빈 입력 → [] (fetch 미호출)", async () => {
    const db = dbWith([]);
    const r = await rankReverseCandidates({ productName: "", brand: "" }, { db });
    expect(r).toEqual([]);
    expect(db.product.findMany).not.toHaveBeenCalled();
  });

  it("per-candidate 필드(confidence/level/basis) 존재", async () => {
    const r: ScoredCandidate[] = await rankReverseCandidates({ productName: "BCP" }, { db: dbWith([P("a", "BCP")]) });
    expect(r[0]).toHaveProperty("confidence");
    expect(r[0]).toHaveProperty("level");
    expect(r[0]).toHaveProperty("basis");
  });
});

describe("§scan-synonym-bridge — rankSynonymCandidates", () => {
  it("동의어에 등록 약어 포함 → 후보(약어↔풀네임 다리)", async () => {
    // 스캔 'Bromocresol Purple' → PubChem 동의어에 'BCP' → 기존 'BCP' 매칭
    const r = await rankSynonymCandidates(
      { synonyms: ["BCP", "115-40-2", "BROMCRESOL PURPLE"], canonicalName: "Bromocresol Purple" },
      { db: dbWith([P("a", "BCP", "Sigma", "B9673")]) },
    );
    expect(r.length).toBe(1);
    expect(r[0].basis).toBe("synonym");
    expect(r[0].confidence).toBeLessThanOrEqual(0.8); // synonym=간접 → 상한 0.8
  });

  it("alias <3자 → FP 가드(미매칭)", async () => {
    const r = await rankSynonymCandidates({ synonyms: ["xy"], canonicalName: "ab" }, { db: dbWith([P("a", "XY")]) });
    expect(r).toEqual([]);
  });

  it("빈 동의어 + 정규화명 없음 → [] (fetch 미호출)", async () => {
    const db = dbWith([]);
    const r = await rankSynonymCandidates({ synonyms: [], canonicalName: null }, { db });
    expect(r).toEqual([]);
    expect(db.product.findMany).not.toHaveBeenCalled();
  });

  it("동일 품목 다중 alias 매칭 → dedupe(1건) + cap 3", async () => {
    const r = await rankSynonymCandidates(
      { synonyms: ["Bromocresol Purple", "Bromocresol"], canonicalName: "Bromocresol Purple" },
      { db: dbWith([P("dup", "Bromocresol Purple Solution")]) },
    );
    expect(r.length).toBe(1);
    expect(r[0].id).toBe("dup");
  });
});
