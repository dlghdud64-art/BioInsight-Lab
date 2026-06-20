/**
 * §catalog-ingest 가동 가드 (호영님 2026-06-20) — 헬스체크 · 멱등 · 소량 시드 · env
 *
 * 과거 교훈: 조달청 게이트웨이 500 장애 / ledger 중복 적재.
 *   1. 헬스체크 1건 성공 후만 ingest(게이트웨이 죽었으면 gateway_unhealthy 로 중단).
 *   2. 멱등 upsert(prdctIdNo 기준) — 두 번 돌려도 중복 폭증 0.
 *   3. 소량 시드 모드(?maxRequests=&segments=) — 전체 덤프 금지, 좁게 시작.
 *   4. env 키 = DATA_GO_KR_SERVICE_KEY(호영님 명명) 환경변수.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const CRON = readFileSync(
  join(__dirname, "..", "..", "app/api/cron/catalog-ingest/route.ts"),
  "utf8",
);

describe("§catalog-ingest 가동 가드", () => {
  it("가드1 — 헬스체크 후만 ingest(실패 시 gateway_unhealthy 중단)", () => {
    expect(CRON).toMatch(/gateway_unhealthy/);
    // 헬스체크가 코드 해석 루프보다 먼저
    expect(CRON.indexOf("gateway_unhealthy")).toBeLessThan(CRON.indexOf("세그먼트별 8자리 코드"));
  });
  it("가드2 — 멱등 upsert(procurementCatalogRef, 중복 폭증 방지)", () => {
    expect(CRON).toMatch(/db\.procurementCatalogRef\.upsert/);
  });
  it("가드3 — 소량 시드 모드(maxRequests/segments override + seedMode 보고)", () => {
    expect(CRON).toMatch(/runCatalogIngest\(\{ maxRequests: seedMaxRequests, segments: seedSegments \}\)/);
    expect(CRON).toMatch(/seedMode/);
    expect(CRON).toMatch(/const maxRequests = opts\?\.maxRequests \?\? MAX_REQUESTS_PER_RUN/);
  });
  it("가드4 — env DATA_GO_KR_SERVICE_KEY(호영님 명명) 우선 + 호환", () => {
    expect(CRON).toMatch(/process\.env\.DATA_GO_KR_SERVICE_KEY \?\? process\.env\.PROCUREMENT_API_KEY/);
  });
});
