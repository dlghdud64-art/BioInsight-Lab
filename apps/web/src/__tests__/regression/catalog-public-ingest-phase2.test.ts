// §catalog-A Phase 2 — Core Ingest (fetch→transform→upsert) 계약 (호영님 P1, 2026-06-10)
// 계약: 응답 파싱(resultCode 00 강제) / 페이징 종료 보장 / 요청 예산(일일 1000) cursor /
//       upsert 소비(ref만, db.product 0) / 키 부재 = 명시 에러(fake success 금지).
// fixture 기반 unit — 실 data.go.kr 호출은 호영님 env smoke (Phase 4).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  parseProcurementResponse,
  buildItemSearchUrl,
  runIngest,
  type IngestDeps,
} from "@/lib/catalog/procurement-ingest";

const REPO_WEB = join(__dirname, "..", "..", "..");

// ── fixtures ──────────────────────────────────────────────────────────
const apiItem = (id: string, clsfc = "41115404") => ({
  prdctIdntNo: id,
  prdctClsfcNo: clsfc,
  mfrtNm: "써모피셔",
  prdctNm: "분광광도계",
  mdlNm: `Model-${id}`,
});

const okBody = (items: unknown[], totalCount: number) => ({
  response: {
    header: { resultCode: "00", resultMsg: "NORMAL SERVICE." },
    body: { items, numOfRows: items.length, pageNo: 1, totalCount },
  },
});

// ── 1. 응답 파싱 ──────────────────────────────────────────────────────
describe("§catalog-A P2 — parseProcurementResponse", () => {
  it("정상(resultCode 00) → items + totalCount", () => {
    const parsed = parseProcurementResponse(okBody([apiItem("A-1")], 7));
    expect(parsed.items).toHaveLength(1);
    expect(parsed.totalCount).toBe(7);
  });

  it("resultCode ≠ 00 → throw (silent skip 금지)", () => {
    const bad = okBody([], 0);
    bad.response.header.resultCode = "30";
    bad.response.header.resultMsg = "SERVICE_KEY_IS_NOT_REGISTERED_ERROR";
    expect(() => parseProcurementResponse(bad)).toThrow(/30|SERVICE_KEY/);
  });

  it("items 누락/null → 빈 배열 (totalCount 0 페이지 안전)", () => {
    const empty = okBody([], 0);
    (empty.response.body as Record<string, unknown>).items = null;
    expect(parseProcurementResponse(empty).items).toEqual([]);
  });
});

// ── 2. URL 빌더 ──────────────────────────────────────────────────────
describe("§catalog-A P2 — buildItemSearchUrl", () => {
  it("base+operation+serviceKey+type=json+페이징+분류 파라미터", () => {
    const url = buildItemSearchUrl({
      serviceKey: "KEY",
      clsfcNo: "41115404",
      pageNo: 2,
      numOfRows: 500,
    });
    expect(url).toContain("apis.data.go.kr/1230000/ao/ThngListInfoService");
    expect(url).toContain("getThngPrdnmLocplcAccotListInfoInfoPrdlstSearch");
    expect(url).toContain("serviceKey=KEY");
    expect(url).toContain("type=json");
    expect(url).toContain("pageNo=2");
    expect(url).toContain("numOfRows=500");
    expect(url).toContain("41115404");
  });
});

// ── 3. runIngest — 페이징·예산·upsert 소비 ────────────────────────────
function makeDeps(pages: Record<string, unknown[][]>, totalByCode: Record<string, number>) {
  const upserts: { where: { prdctIdNo: string } }[] = [];
  let requests = 0;
  const deps: IngestDeps = {
    serviceKey: "KEY",
    fetchJson: async (url: string) => {
      requests += 1;
      const u = new URL(url);
      const code = url.match(/4\d{7}|12\d{6}/)?.[0] ?? "";
      const pageNo = Number(u.searchParams.get("pageNo") ?? "1");
      const items = pages[code]?.[pageNo - 1] ?? [];
      const body = okBody(items, totalByCode[code] ?? 0);
      body.response.body.pageNo = pageNo;
      return body;
    },
    upsertRef: async (args) => {
      upserts.push(args as { where: { prdctIdNo: string } });
    },
  };
  return { deps, upserts, requestCount: () => requests };
}

describe("§catalog-A P2 — runIngest", () => {
  it("페이징 완주: totalCount만큼 fetch 후 종료(무한루프 0), 전 항목 upsert", async () => {
    const { deps, upserts } = makeDeps(
      { "41115404": [[apiItem("A-1"), apiItem("A-2")], [apiItem("A-3")]] },
      { "41115404": 3 },
    );
    const result = await runIngest({ codes: ["41115404"], maxRequests: 10, numOfRows: 2 }, deps);
    expect(upserts.map((u) => u.where.prdctIdNo)).toEqual(["A-1", "A-2", "A-3"]);
    expect(result.processedCodes).toEqual(["41115404"]);
    expect(result.remainingCodes).toEqual([]);
    expect(result.upserted).toBe(3);
  });

  it("식별번호 없는 항목 skip 카운트 (silent drop 금지)", async () => {
    const noId = { ...apiItem("X"), prdctIdntNo: "" };
    const { deps, upserts } = makeDeps({ "41115404": [[apiItem("A-1"), noId]] }, { "41115404": 2 });
    const result = await runIngest({ codes: ["41115404"], maxRequests: 10, numOfRows: 10 }, deps);
    expect(upserts).toHaveLength(1);
    expect(result.skipped).toBe(1);
  });

  it("요청 예산 소진 → 잔여 코드 cursor 반환 (일일 1000 제약, 조용한 overrun 금지)", async () => {
    const { deps, requestCount } = makeDeps(
      { "12161501": [[apiItem("B-1", "12161501")]], "41115404": [[apiItem("A-1")]] },
      { "12161501": 1, "41115404": 1 },
    );
    const result = await runIngest(
      { codes: ["12161501", "41115404"], maxRequests: 1, numOfRows: 10 },
      deps,
    );
    expect(requestCount()).toBe(1);
    expect(result.processedCodes).toEqual(["12161501"]);
    expect(result.remainingCodes).toEqual(["41115404"]);
  });

  it("serviceKey 부재 → 명시 에러 (fake success 금지)", async () => {
    const { deps } = makeDeps({}, {});
    await expect(
      runIngest({ codes: ["41115404"], maxRequests: 1, numOfRows: 10 }, { ...deps, serviceKey: "" }),
    ).rejects.toThrow(/serviceKey|PROCUREMENT/i);
  });

  it("upsert args가 Phase 1 계약 그대로 (update에 linkedProductId 미포함)", async () => {
    const captured: Record<string, unknown>[] = [];
    const { deps } = makeDeps({ "41115404": [[apiItem("A-1")]] }, { "41115404": 1 });
    deps.upsertRef = async (args) => {
      captured.push(args as Record<string, unknown>);
    };
    await runIngest({ codes: ["41115404"], maxRequests: 10, numOfRows: 10 }, deps);
    const update = captured[0].update as Record<string, unknown>;
    expect("linkedProductId" in update).toBe(false);
    expect("source" in update).toBe(false);
  });
});

// ── 4. canonical truth boundary (sentinel) ────────────────────────────
describe("§catalog-A P2 — canonical 보호", () => {
  it("ingest lib에 db.product write 0 + ref 외 모델 접근 0", () => {
    const src = readFileSync(
      join(REPO_WEB, "src", "lib", "catalog", "procurement-ingest.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/product\.(create|update|upsert|delete)/);
    expect(src).not.toMatch(/\$executeRaw|\$queryRaw/);
  });
});
