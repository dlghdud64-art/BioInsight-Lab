import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

// §catalog-A P3c — BOM catalog-scoped batch-match (N+1 해소 + 안전정보 dead 복구 + conflate 인라인).
//   배치: src/__tests__/regression/ (REPO_WEB = 3단계 상승, phase3a/3b 동형).
//   패턴: readFileSync + regex. ⚠️ P3c-1/3 은 route/BOM 구현 전엔 RED(의도). P2/회귀는 GREEN.

const REPO_WEB = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_WEB, rel), "utf8");
}
function exists(rel: string): boolean {
  return existsSync(join(REPO_WEB, rel));
}

const ROUTE = "src/app/api/products/batch-match/route.ts";
const MACHINE = "src/lib/catalog/bom-product-match.ts";
const BOM = "src/app/protocol/bom/page.tsx";
const OLD_ROUTE = "src/app/api/quotes/match-products/route.ts";

describe("§catalog-A P3c-1 — batch-match: catalog-scoped 계약 + N+1 0", () => {
  it("POST + buildSearchQuery·sortByRelevance 머신 재사용(재구현 금지)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/export async function POST/);
    expect(src).toMatch(/buildSearchQuery/);
    expect(src).toMatch(/sortByRelevance/);
  });

  it("N+1 0 — findMany 1회만(루프 내 호출 금지)", () => {
    const src = read(ROUTE);
    const finds = src.match(/db\.product\.findMany/g) || [];
    expect(finds.length).toBe(1);
  });

  it("응답이 productId(quoteItemId 아님 — catalog-scoped)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/productId/);
    expect(src).not.toMatch(/quoteItemId/);
  });

  it("안전필드 select 포함 — BOM 안전정보 dead 복구", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/hazardCodes:\s*true/);
    expect(src).toMatch(/pictograms:\s*true/);
    expect(src).toMatch(/safetyNote:\s*true/);
  });
});

describe("§catalog-A P3c-2 — batch-match: read 게이트(401 only, role-free)", () => {
  it("401 인증 게이트", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/await auth\(\)/);
    expect(src).toMatch(/status:\s*401/);
  });

  it("role 게이트(403/ADMIN/SUPPLIER) 부재 — BOM RESEARCHER 보존", () => {
    const src = read(ROUTE);
    expect(src).not.toMatch(/status:\s*403/);
    expect(src).not.toMatch(/UserRole\.(ADMIN|SUPPLIER)/);
  });
});

describe("§catalog-A P3c-3 — BOM 전환: per-item fetch 0 + 인라인 후보교체", () => {
  it("per-item search?limit=1 fetch 제거(N+1 해소)", () => {
    const src = read(BOM);
    expect(src).not.toMatch(/products\/search\?query=.*limit=1/);
  });

  it("batch-match 단일 호출로 전환", () => {
    const src = read(BOM);
    expect(src).toMatch(/products\/batch-match/);
  });

  it("conflate 인라인 후보교체 존재(2+ 후보 override) — dead-end 0", () => {
    const src = read(BOM);
    // 인라인 select/드롭다운 + 후보 교체 핸들러(자동 top-1 override).
    expect(src).toMatch(/candidates|otherCandidates|후보/);
    expect(src).toMatch(/onChange|onValueChange|setReagents/);
  });

  it("deprecate: 구 quotes/match-products(전 카탈로그) 삭제됨(P3 작업)", () => {
    // 호출처 0 확인됨(P0) → P3 에서 삭제. 잔존하면 RED(혼란 제거 강제).
    expect(exists(OLD_ROUTE)).toBe(false);
  });
});

describe("§catalog-A P3c-4 — 머신(P2) + 회귀 0 (GREEN)", () => {
  it("머신: computeIsHighRisk + HIGH_RISK_PICTOGRAMS 계약", () => {
    const src = read(MACHINE);
    expect(src).toMatch(/export function computeIsHighRisk/);
    expect(src).toMatch(/HIGH_RISK_PICTOGRAMS\s*=\s*\[\s*"skull",\s*"flame",\s*"corrosive"/);
  });

  it("머신: toBomCandidate 안전정보 투영(isHighRisk 서버 계산)", () => {
    const src = read(MACHINE);
    expect(src).toMatch(/export function toBomCandidate/);
    expect(src).toMatch(/isHighRisk:\s*computeIsHighRisk/);
  });

  it("회귀: quote-scoped 라우트(P3b)는 보존", () => {
    expect(exists("src/app/api/quotes/[id]/match-products/route.ts")).toBe(true);
  });
});
