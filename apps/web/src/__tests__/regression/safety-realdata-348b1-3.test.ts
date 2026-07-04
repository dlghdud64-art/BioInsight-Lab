/**
 * §11.348-B-1 B1-3 (§11.357 mock 해소) — 안전 페이지 실데이터 어댑터 + wiring sentinel
 *
 * mock safetyItems 제거 → /api/safety/products 실조회 + adaptSafetyProducts → 규칙엔진 유지.
 * id 충돌 회피 위해 로컬 index id(엔진/페이지 number-id 무변경).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { adaptSafetyProducts, type SafetyApiProduct } from "../../lib/safety/product-to-safety-item";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}
const PAGE = "src/app/dashboard/safety/page.tsx";

describe("§11.348-B-1 B1-3 — 어댑터 파생 규칙", () => {
  const products: SafetyApiProduct[] = [
    { id: "p_cuid_1", name: "황산", pictograms: ["corrosive", "toxic"], hazardCodes: ["H314"], ppe: ["gloves", "goggles"], storageCondition: "산성 전용", msdsUrl: "https://x/sds.pdf", createdAt: "2025-01-01T00:00:00Z", sdsDocuments: [] },
    { id: "p_cuid_2", name: "에탄올", pictograms: ["flammable"], hazardCodes: [], ppe: ["gloves"], msdsUrl: null, createdAt: "2025-02-01T00:00:00Z", sdsDocuments: [{ id: "s1", createdAt: "2025-03-01T00:00:00Z" }] },
    { id: "p_cuid_3", name: "정제수", pictograms: [], hazardCodes: [], ppe: [], msdsUrl: null, createdAt: "2025-02-15T00:00:00Z", sdsDocuments: [] },
  ];
  const { items, productIdByLocalId } = adaptSafetyProducts(products);

  it("로컬 index id(1..N) + productId 맵 보존", () => {
    expect(items.map((i) => i.id)).toEqual([1, 2, 3]);
    expect(productIdByLocalId[1]).toBe("p_cuid_1");
    expect(productIdByLocalId[3]).toBe("p_cuid_3");
  });
  it("hasMsds: msdsUrl 또는 sdsDocuments", () => {
    expect(items[0].hasMsds).toBe(true);  // msdsUrl
    expect(items[1].hasMsds).toBe(true);  // sdsDocuments
    expect(items[2].hasMsds).toBe(false); // 둘 다 없음
  });
  it("level/isHighRisk: 위험 픽토그램·hazardCode 기반", () => {
    expect(items[0].level).toBe("HIGH");   // corrosive+toxic
    expect(items[0].isHighRisk).toBe(true);
    expect(items[1].level).toBe("MEDIUM"); // flammable(비고위험 픽토)
    expect(items[2].level).toBe("LOW");    // 픽토 없음
  });
  it("actionStatus: MSDS 없으면 action_required", () => {
    expect(items[0].actionStatus).toBe("normal");
    expect(items[2].actionStatus).toBe("action_required");
  });
  it("icons=픽토그램, ppe 매핑, CAS 빈값", () => {
    expect(items[0].icons).toEqual(["corrosive", "toxic"]);
    expect(items[0].ppe).toEqual([{ type: "gloves", required: true }, { type: "goggles", required: true }]);
    expect(items[0].cas).toBe("");
  });
});

describe("§11.348-B-1 B1-3 — 페이지 wiring", () => {
  it("mock 제거 + useQuery /api/safety/products + 어댑터 sync", () => {
    const src = read(PAGE);
    expect(src).toContain("adaptSafetyProducts");
    // §safety-modal-upgrade P1 — 시약 필터(category=REAGENT) 추가된 canonical fetch.
    expect(src).toContain('"/api/safety/products?limit=100&category=REAGENT"');
    expect(src).toContain("const [items, setItems] = useState<SafetyItem[]>([])");
    // mock 하드코딩 배열 제거(코드 참조 0)
    expect(src).not.toContain("const safetyItems: SafetyItem[] = [");
  });
});
