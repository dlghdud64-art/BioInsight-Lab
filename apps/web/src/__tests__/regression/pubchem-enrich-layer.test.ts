/**
 * §pubchem-enrich (호영님 2026-06-30) — Tier 2 substance 보강 레이어
 *   (PLAN_pubchem-enrich-layer)
 *
 * lib: CAS/name → PubChem 정규화명·동의어·분자식(무키). best-effort(무결과/실패 → null).
 * route: GET /api/catalog/enrich (auth 401 가드, best-effort null, canonical 무접촉).
 * UI: LabelScannerModal 승인형 [적용] 보강 행(미매칭일 때만, loading/무결과 calm).
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pubchemEnrich } from "@/lib/catalog/pubchem-enrich";

const SRC = resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(resolve(SRC, rel), "utf8");

function mockFetch(...responses: Array<{ ok: boolean; body: any }>) {
  const fn = vi.fn();
  responses.forEach((r) => fn.mockResolvedValueOnce({ ok: r.ok, json: async () => r.body }));
  fn.mockResolvedValue({ ok: false, json: async () => ({}) }); // 그 외 호출 → 404 류
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("§pubchem-enrich — lib (mock fetch, best-effort)", () => {
  it("CAS → 정규화명·분자식·동의어(쿼리 제외)", async () => {
    mockFetch(
      { ok: true, body: { PropertyTable: { Properties: [{ CID: 887, Title: "Methanol", MolecularFormula: "CH4O", IUPACName: "methanol" }] } } },
      { ok: true, body: { InformationList: { Information: [{ CID: 887, Synonym: ["Methanol", "carbinol", "67-56-1"] }] } } },
    );
    const r = await pubchemEnrich({ cas: "67-56-1-uniqA" });
    expect(r).not.toBeNull();
    expect(r!.source).toBe("pubchem");
    expect(r!.cid).toBe(887);
    expect(r!.canonicalName).toBe("Methanol");
    expect(r!.molecularFormula).toBe("CH4O");
    expect(r!.synonyms).toContain("carbinol");
  });

  it("무매칭(property 404) → null", async () => {
    mockFetch({ ok: false, body: { Fault: {} } });
    expect(await pubchemEnrich({ cas: "nope-uniqB" })).toBeNull();
  });

  it("빈 쿼리 → null (fetch 미호출)", async () => {
    const fn = mockFetch();
    expect(await pubchemEnrich({ cas: "", name: "" })).toBeNull();
    expect(fn).not.toHaveBeenCalled();
  });

  it("property OK + synonyms 실패 → 보강은 유지(synonyms 빈 배열)", async () => {
    mockFetch(
      { ok: true, body: { PropertyTable: { Properties: [{ CID: 702, Title: "Ethanol", MolecularFormula: "C2H6O" }] } } },
      { ok: false, body: {} },
    );
    const r = await pubchemEnrich({ name: "ethanol-uniqC" });
    expect(r!.canonicalName).toBe("Ethanol");
    expect(r!.synonyms).toEqual([]);
  });
});

describe("§pubchem-enrich — route (best-effort, auth)", () => {
  const ROUTE = read("app/api/catalog/enrich/route.ts");
  it("GET export + auth 401 가드", () => {
    expect(ROUTE).toMatch(/export async function GET/);
    expect(ROUTE).toMatch(/await auth\(\)/);
    expect(ROUTE).toMatch(/status:\s*401/);
  });
  it("pubchemEnrich 호출 + enrichment 반환(best-effort null)", () => {
    expect(ROUTE).toMatch(/pubchemEnrich\(\{ cas, name \}\)/);
    expect(ROUTE).toMatch(/enrichment/);
  });
});

describe("§pubchem-enrich — UI 승인형 보강(LabelScannerModal)", () => {
  const MODAL = read("components/inventory/LabelScannerModal.tsx");
  it("enrichment 상태 + scanResult 기반 비동기 조회", () => {
    expect(MODAL).toMatch(/const \[enrichment, setEnrichment\]/);
    expect(MODAL).toMatch(/\/api\/catalog\/enrich\?/);
    expect(MODAL).toMatch(/scanResult\?\.parsed\?\.casNumber/);
  });
  it("미매칭일 때만 보강 행(dead button 0) + loading 상태", () => {
    expect(MODAL).toMatch(/!scanResult\.matchedProduct && enrichment && \(/);
    expect(MODAL).toMatch(/enrichLoading && \(/);
  });
  it("승인형 [적용] = 제품명 폼에만 반영(canonical 무접촉)", () => {
    expect(MODAL).toMatch(/onClick=\{\(\) => updateField\("productName", enrichment\.canonicalName\)\}/);
    expect(MODAL).toMatch(/제품명에 적용/);
  });
});
