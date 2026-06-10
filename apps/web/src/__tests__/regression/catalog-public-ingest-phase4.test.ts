// §catalog-A Phase 4 — Rollout / Smoke / Rollback 계약 (호영님 P1, 2026-06-10)
// 계약: cron route(CRON_SECRET 게이트·logCronExecution wrap·flag 게이트) /
//       env 부재 시 no-op(빈 작업 보고, fake success 금지) / 분류 코드 화이트리스트 /
//       vercel.json cron 등록 / db.product write 0 (ingest는 ref만).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CATALOG_INGEST_SEGMENTS,
  buildUnit8RangeUrl,
  parseUnit8Codes,
} from "@/lib/catalog/procurement-codes";

const REPO_WEB = join(__dirname, "..", "..", "..");
function readWeb(rel: string): string {
  return readFileSync(join(REPO_WEB, rel), "utf8");
}

// ── 1. 세그먼트 화이트리스트 + 런타임 코드 해석 (unit) ─────────────────
// Phase 0은 카운트만 실측 — 1,108개 8자리 실코드는 미보유. 날조 금지 →
// 검증된 세그먼트(12·41)만 고정, 8자리 코드는 런타임 Unit8 range로 해석.
describe("§catalog-A P4 — CATALOG_INGEST_SEGMENTS", () => {
  it("Phase 0 검증 세그먼트 = 12(시약)·41(실험장비)만", () => {
    expect(CATALOG_INGEST_SEGMENTS).toEqual(["12", "41"]);
  });
});

describe("§catalog-A P4 — buildUnit8RangeUrl (Phase 0 §4-b 정합)", () => {
  it("getPrdctClsfcNoUnit8Info + bgn/end 범위 + type=json", () => {
    const url = buildUnit8RangeUrl({ serviceKey: "KEY", segment: "41", pageNo: 1, numOfRows: 100 });
    expect(url).toContain("getPrdctClsfcNoUnit8Info");
    expect(url).toContain("prdctClsfcNoBgnNo=41000000");
    expect(url).toContain("prdctClsfcNoEndNo=41999999");
    expect(url).toContain("type=json");
  });
});

describe("§catalog-A P4 — parseUnit8Codes", () => {
  it("resultCode 00 → 8자리 코드만 추출 (세그먼트 prefix 일치)", () => {
    const body = {
      response: {
        header: { resultCode: "00" },
        body: {
          totalCount: 2,
          items: [
            { prdctClsfcNo: "41115404", prdctClsfcNoNm: "분광광도계" },
            { prdctClsfcNo: "41113118", prdctClsfcNoNm: "다중가스검출기" },
          ],
        },
      },
    };
    const { codes, totalCount } = parseUnit8Codes(body, "41");
    expect(codes).toEqual(["41115404", "41113118"]);
    expect(totalCount).toBe(2);
  });

  it("세그먼트 불일치 코드 제외 (방어)", () => {
    const body = {
      response: {
        header: { resultCode: "00" },
        body: { totalCount: 2, items: [{ prdctClsfcNo: "41115404" }, { prdctClsfcNo: "99999999" }] },
      },
    };
    expect(parseUnit8Codes(body, "41").codes).toEqual(["41115404"]);
  });

  it("resultCode ≠ 00 → throw (silent skip 금지)", () => {
    const bad = { response: { header: { resultCode: "30" }, body: {} } };
    expect(() => parseUnit8Codes(bad, "41")).toThrow();
  });
});

// ── 2. cron route (sentinel) ──────────────────────────────────────────
describe("§catalog-A P4 — /api/cron/catalog-ingest", () => {
  const src = readWeb("src/app/api/cron/catalog-ingest/route.ts");

  it("CRON_SECRET 게이트 (기존 cron 패턴 정합)", () => {
    expect(src).toMatch(/CRON_SECRET/);
    expect(src).toMatch(/401/);
  });

  it("logCronExecution wrap (admin cron 모니터링 정합)", () => {
    expect(src).toMatch(/logCronExecution/);
    expect(src).toMatch(/\/api\/cron\/catalog-ingest/);
  });

  it("flag + serviceKey 부재 → no-op 보고 (fake success·throw 금지)", () => {
    expect(src).toMatch(/CATALOG_PUBLIC_INGEST/);
    expect(src).toMatch(/PROCUREMENT_API_KEY/);
    expect(src).toMatch(/skipped|disabled|noop|no-op/i);
  });

  it("runIngest 소비 + db.procurementCatalogRef.upsert 바인딩 (db.product write 0)", () => {
    expect(src).toMatch(/runIngest/);
    expect(src).toMatch(/procurementCatalogRef\.upsert/);
    expect(src).not.toMatch(/product\.(create|update|delete)/);
  });

  it("cursor 영속화 — remainingCodes 다음 run 이어받기 (일일 예산 정합)", () => {
    expect(src).toMatch(/remainingCodes/);
  });

  it("maxDuration 명시 (Vercel 함수 한도)", () => {
    expect(src).toMatch(/maxDuration/);
  });
});

// ── 3. vercel.json cron 등록 (sentinel) ───────────────────────────────
describe("§catalog-A P4 — vercel.json", () => {
  it("catalog-ingest cron 등록 (apps/web/vercel.json)", () => {
    const vercel = JSON.parse(readWeb("vercel.json"));
    const paths = (vercel.crons ?? []).map((c: { path: string }) => c.path);
    expect(paths).toContain("/api/cron/catalog-ingest");
  });
});
