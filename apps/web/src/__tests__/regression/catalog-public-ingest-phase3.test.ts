// §catalog-A Phase 3 — Search Union + Provenance Wiring 계약 (호영님 P1, 2026-06-10)
// 계약: ref 검색(미승격만·select 제한) / 승격 = 별도 명시 경로(idempotent) /
//       검색 route union(flag 게이트·additive) / UI 배지+실 액션(dead-end 0) / 기존 검색 회귀 0.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildRefSearchWhere,
  toRefSearchItem,
  refToProductCreateInput,
} from "@/lib/catalog/procurement-search";

const REPO_WEB = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_WEB, rel), "utf8");
}

const refRow = {
  prdctIdNo: "24341501-00001",
  prdctClsfcNo: "41115404",
  dtilPrdctClsfcNo: null,
  mfrtNm: "써모피셔",
  prdctNm: "분광광도계",
  dtilPrdctNm: "자외선가시광선분광광도계",
  engPrdctNm: "UV-Vis Spectrophotometer",
  modelNm: "NanoDrop One",
  source: "public_procurement" as const,
  linkedProductId: null,
  sourceUpdatedAt: null,
};

// ── 1. ref 검색 where (unit) ──────────────────────────────────────────
describe("§catalog-A P3 — buildRefSearchWhere", () => {
  it("미승격(linkedProductId null) 고정 — 승격된 ref는 canonical이 검색되므로 제외(중복 0)", () => {
    const where = buildRefSearchWhere("nanodrop");
    expect(where.linkedProductId).toBeNull();
  });

  it("품명·세부품명·영문품명·모델명·제조사·식별번호 OR contains insensitive", () => {
    const where = buildRefSearchWhere("nanodrop");
    const fields = (where.OR as Array<Record<string, unknown>>).map((c) => Object.keys(c)[0]);
    for (const f of ["prdctNm", "dtilPrdctNm", "engPrdctNm", "modelNm", "mfrtNm", "prdctIdNo"]) {
      expect(fields).toContain(f);
    }
  });
});

// ── 2. ref 검색 projection (unit) ─────────────────────────────────────
describe("§catalog-A P3 — toRefSearchItem", () => {
  it("UI 최소 필드 projection + provenance 명시", () => {
    const item = toRefSearchItem(refRow);
    expect(item.prdctIdNo).toBe("24341501-00001");
    expect(item.name).toBe("자외선가시광선분광광도계"); // 세부품명 우선
    expect(item.brand).toBe("써모피셔");
    expect(item.modelNm).toBe("NanoDrop One");
    expect(item.source).toBe("public_procurement");
  });

  it("세부품명 없으면 품명 fallback", () => {
    expect(toRefSearchItem({ ...refRow, dtilPrdctNm: null }).name).toBe("분광광도계");
  });
});

// ── 3. 승격 매핑 (unit) — 별도 명시 경로의 product INSERT input ────────
describe("§catalog-A P3 — refToProductCreateInput", () => {
  it("Seg 41 → EQUIPMENT, Seg 12 → REAGENT, 그 외 → EQUIPMENT", () => {
    expect(refToProductCreateInput(refRow).category).toBe("EQUIPMENT");
    expect(refToProductCreateInput({ ...refRow, prdctClsfcNo: "12161501" }).category).toBe("REAGENT");
    expect(refToProductCreateInput({ ...refRow, prdctClsfcNo: null }).category).toBe("EQUIPMENT");
  });

  it("name=세부품명 우선 / nameEn=영문품명 / 제조사·모델 매핑 / 설명에 출처 명시", () => {
    const input = refToProductCreateInput(refRow);
    expect(input.name).toBe("자외선가시광선분광광도계");
    expect(input.nameEn).toBe("UV-Vis Spectrophotometer");
    expect(input.manufacturer).toBe("써모피셔");
    expect(input.brand).toBe("써모피셔");
    expect(input.modelNumber).toBe("NanoDrop One");
    expect(input.description).toContain("공공조달");
  });
});

// ── 4. 검색 route union (sentinel) ────────────────────────────────────
describe("§catalog-A P3 — /api/products/search union", () => {
  const src = read("src/app/api/products/search/route.ts");

  it("feature flag 게이트 (CATALOG_PUBLIC_INGEST) — rollback = env off", () => {
    expect(src).toMatch(/CATALOG_PUBLIC_INGEST/);
  });

  it("procurementCatalogRef 조회 — select 제한(overfetch 금지) + 미승격만", () => {
    expect(src).toMatch(/procurementCatalogRef\.findMany/);
    expect(src).toMatch(/buildRefSearchWhere/);
    expect(src).toMatch(/take:\s*\d/); // 상한 명시
  });

  it("additive — 기존 products 응답 계약 보존 (response.products 유지)", () => {
    expect(src).toMatch(/procurementRefs/);
    expect(src).toMatch(/products: paginatedProducts\.map/);
  });

  it("ref 실패가 canonical 검색을 죽이지 않음 (graceful catch)", () => {
    const block = src.split("CATALOG_PUBLIC_INGEST")[1] ?? "";
    expect(block).toMatch(/catch/);
  });
});

// ── 5. 승격 route (sentinel) — demand-driven, 별도 명시 경로 ──────────
describe("§catalog-A P3 — /api/catalog/promote", () => {
  const src = read("src/app/api/catalog/promote/route.ts");

  it("POST + auth 게이트 (비로그인 401)", () => {
    expect(src).toMatch(/export async function POST/);
    expect(src).toMatch(/auth\(\)/);
    expect(src).toMatch(/401/);
  });

  it("idempotent — 이미 승격(linkedProductId)이면 기존 product 반환, 재INSERT 0", () => {
    expect(src).toMatch(/linkedProductId/);
    expect(src).toMatch(/promoted:\s*false/);
  });

  it("product.create = 이 route 1곳(별도 명시 경로) + ref link update", () => {
    expect(src.match(/product\.create/g)?.length).toBe(1);
    expect(src).toMatch(/procurementCatalogRef\.update/);
    expect(src).toMatch(/refToProductCreateInput/);
  });

  it("존재하지 않는 ref → 404 (fake success 금지)", () => {
    expect(src).toMatch(/404/);
  });
});

// ── 6. provider + UI wiring (sentinel) ────────────────────────────────
describe("§catalog-A P3 — provider/페이지 wiring", () => {
  it("provider가 procurementRefs expose", () => {
    const src = read("src/app/_workbench/_components/test-flow-provider.tsx");
    expect(src).toMatch(/procurementRefs/);
  });

  it("ref 결과 컴포넌트 — 배지 '공공조달 참조' + 견적 CTA(승격→담기) + pending 상태", () => {
    const src = read("src/app/_workbench/_components/procurement-ref-results.tsx");
    expect(src).toMatch(/공공조달 참조/);
    expect(src).toMatch(/onAddToQuote/);
    expect(src).toMatch(/disabled/); // pending 시 비활성 — dead button 아님, 상태 가시화
    expect(src).not.toMatch(/console\.log/);
  });

  it("페이지가 ref 섹션 렌더 + promote→addProductToQuote 실 wiring (no-op 0)", () => {
    const src = read("src/app/_workbench/search/page.tsx");
    expect(src).toMatch(/ProcurementRefResults/);
    expect(src).toMatch(/api\/catalog\/promote/);
    expect(src).toMatch(/addProductToQuote\(/);
  });
});

// ── 7. 회귀 0 — 기존 검색 surface 보존 ────────────────────────────────
describe("§catalog-A P3 — 회귀 0", () => {
  it("기존 결과 렌더(SourcingResultRow)·견적/비교 wiring 보존", () => {
    const src = read("src/app/_workbench/search/page.tsx");
    expect(src).toMatch(/SourcingResultRow/);
    expect(src).toMatch(/QuoteCartPanel/);
    expect(src).toMatch(/toggleCompare/);
  });

  it("검색 route 기존 계약 보존 — facets·searchHistory·min 2글자 게이트", () => {
    const src = read("src/app/api/products/search/route.ts");
    expect(src).toMatch(/minLength: 2/);
    expect(src).toMatch(/vendorCounts/);
    expect(src).toMatch(/searchHistory/);
  });
});
