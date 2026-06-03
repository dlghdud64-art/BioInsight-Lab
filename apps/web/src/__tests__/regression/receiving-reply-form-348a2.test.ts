/**
 * §11.348-A-2 (회귀) — 공급사 입고 회신 폼/라우트 sentinel
 *
 * A-2: /receiving/[token] 폼 + GET/POST 라우트. 공급사가 PO snapshot 기준
 * LOT·실수량·유효기간 회신 → ReceivingDraft status AWAITING_REPLY→PENDING_REVIEW.
 *
 * 핵심 불변(§11.336): 회신 제출은 ReceivingDraft(Item)만 변경. 재고/입고
 * (ProductInventory/InventoryRestock) 절대 미변경 — 입고 확정은 A-4 사람 승인.
 * 문자열 매칭은 toContain.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}
const GET_ROUTE = "src/app/api/receiving/[token]/route.ts";
const POST_ROUTE = "src/app/api/receiving/[token]/response/route.ts";
const PAGE = "src/app/receiving/[token]/page.tsx";

describe("§11.348-A-2 — 파일 존재", () => {
  it("GET/POST 라우트 + 폼 페이지", () => {
    for (const f of [GET_ROUTE, POST_ROUTE, PAGE]) {
      expect(existsSync(join(APP_WEB_ROOT, f))).toBe(true);
    }
  });
});

describe("§11.348-A-2 — GET 라우트 (snapshot freeze + 가드)", () => {
  it("token 검증 + receivingDraft 조회 + 만료/종결 가드", () => {
    const src = read(GET_ROUTE);
    expect(src).toContain("isValidVendorRequestToken(token)");
    expect(src).toContain("db.receivingDraft.findUnique");
    expect(src).toContain("draft.expiresAt < new Date()");
    expect(src).toContain('draft.status === "APPROVED"');
    // snapshot 기준 품목 노출
    expect(src).toContain("draft.snapshot");
  });
});

describe("§11.348-A-2 — POST 라우트 (회신 제출 → PENDING_REVIEW)", () => {
  it("zod 검증 + snapshot orderItemId 검증 + 항목 교체", () => {
    const src = read(POST_ROUTE);
    expect(src).toContain("SubmitSchema.safeParse(body)");
    expect(src).toContain("receivedQuantity");
    expect(src).toContain("lotNumber");
    expect(src).toContain("expiryDate");
    expect(src).toContain("tx.receivingDraftItem.deleteMany");
    expect(src).toContain("tx.receivingDraftItem.create");
    expect(src).toContain('status: "PENDING_REVIEW"');
  });
  it("불변 — 재고/입고 mutation 0 (§11.336)", () => {
    // 주석 제거 후 실제 코드에 재고/입고 mutation 호출 부재만 검증(언급은 허용)
    const code = read(POST_ROUTE)
      .replace(/\/\*[\s\S]*?\*\//g, "") // 블록 주석 제거
      .split("\n")
      .map((ln) => ln.replace(/\/\/.*$/, "")) // 라인 주석 제거
      .join("\n");
    expect(code).not.toContain("productInventory");
    expect(code).not.toContain("inventoryRestock");
    expect(code).not.toContain("InventoryRestock");
  });
});

describe("§11.348-A-2 — 회신 폼 페이지", () => {
  it("GET fetch + 품목 입력 + POST 제출", () => {
    const src = read(PAGE);
    expect(src).toContain("/api/receiving/${token}");
    expect(src).toContain("/api/receiving/${token}/response");
    expect(src).toContain("실수량");
    expect(src).toContain("LOT");
    expect(src).toContain("입고 정보 제출");
  });
});
