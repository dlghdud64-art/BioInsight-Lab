/**
 * §pocandidate-creation-flow Phase 1 — createPOCandidateFromQuote 계약 (RED → P2 GREEN).
 *
 * 계약 (계획서 §12 Phase 0 확정):
 *   S1. quote → candidate 매핑 무손실: quoteId 결속·vendor=vendorName·items
 *       (수량·단가·lineTotal·leadTime ?? "")·totalAmount 우선순위(PR > quote > Σ).
 *   S2. approvalStatus projection 기본값 = in_app_approved (승인통과집합 진입).
 *       결재 truth 는 PurchaseRequest — 이 값은 변환 필터 입력 전용.
 *   S3. items 0 → null (생성 skip — empty-items 입구 가드 취지, caller legacy 유지).
 *   S4. vendorName NULL → vendor "" (변환부 vendorId NULL Order — legacy 동등).
 *
 * 커버리지 경계: 서비스 unit 만. approve 라우트 wiring·멱등(caller 책임)은
 *   approve-pocandidate-creation.test.ts 가 잠근다.
 */
import { describe, it, expect, vi } from "vitest";
import { createPOCandidateFromQuote } from "@/lib/persistence/po-candidate-server";

function makeClient() {
  const create = vi.fn(async ({ data, include }: any) => ({
    id: "poc-new",
    userId: data.userId,
    organizationId: data.organizationId,
    quoteId: data.quoteId,
    title: data.title,
    vendor: data.vendor,
    totalAmount: data.totalAmount,
    expectedDelivery: null,
    selectionReason: null,
    blockers: data.blockers ?? [],
    approvalPolicy: data.approvalPolicy,
    approvalStatus: data.approvalStatus,
    stage: data.stage ?? "po_conversion_candidate",
    createdAt: new Date("2026-08-04T00:00:00Z"),
    updatedAt: new Date("2026-08-04T00:00:00Z"),
    items: (data.items?.create ?? []).map((i: any) => ({ ...i })),
  }));
  return { client: { pOCandidate: { create } }, create };
}

const QUOTE = {
  id: "q-1",
  totalAmount: 5000,
  items: [
    { name: "FBS 500ml", catalogNumber: "C-1", quantity: 2, unitPrice: 1000, lineTotal: 2000, leadTime: "3일" },
    { name: "Trypsin", catalogNumber: null, quantity: 3, unitPrice: 1000, lineTotal: 3000, leadTime: null },
  ],
};

describe("§pocandidate-creation-flow S1·S2 — 매핑 무손실 + projection", () => {
  it("quoteId 결속·vendor·items 무손실·PR totalAmount 우선·in_app_approved 기본", async () => {
    const { client, create } = makeClient();
    const row = await createPOCandidateFromQuote(client, {
      quote: QUOTE,
      userId: "u-1",
      organizationId: "org-1",
      vendorName: "Thermo Fisher",
      totalAmount: 4500, // PR 기준 우선
    });

    expect(row).not.toBeNull();
    expect(create).toHaveBeenCalledTimes(1);
    const data = create.mock.calls[0][0].data;
    expect(data.quoteId).toBe("q-1");
    expect(data.vendor).toBe("Thermo Fisher");
    expect(data.totalAmount).toBe(4500);
    expect(data.approvalStatus).toBe("in_app_approved");
    expect(data.approvalPolicy).toBe("in_app_approval");
    expect(data.stage ?? "po_conversion_candidate").toBe("po_conversion_candidate");
    // items 무손실 (수량·단가·lineTotal, nullable 필드 폴백)
    const items = data.items.create;
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ name: "FBS 500ml", catalogNumber: "C-1", quantity: 2, unitPrice: 1000, lineTotal: 2000, leadTime: "3일" });
    expect(items[1]).toMatchObject({ name: "Trypsin", catalogNumber: "", quantity: 3, unitPrice: 1000, lineTotal: 3000, leadTime: "" });
  });

  it("totalAmount 폴백 순서: PR 부재 → quote.totalAmount → Σ lineTotal", async () => {
    const { client, create } = makeClient();
    await createPOCandidateFromQuote(client, { quote: QUOTE, userId: "u-1" });
    expect(create.mock.calls[0][0].data.totalAmount).toBe(5000); // quote.totalAmount

    const { client: c2, create: cr2 } = makeClient();
    await createPOCandidateFromQuote(c2, {
      quote: { ...QUOTE, totalAmount: null },
      userId: "u-1",
    });
    expect(cr2.mock.calls[0][0].data.totalAmount).toBe(5000); // Σ lineTotal (2000+3000)
  });
});

describe("§pocandidate-creation-flow S3 — items 0 은 생성 skip", () => {
  it("items 빈 배열 → null 반환·create 미호출 (caller legacy 유지)", async () => {
    const { client, create } = makeClient();
    const row = await createPOCandidateFromQuote(client, {
      quote: { id: "q-e", totalAmount: 0, items: [] },
      userId: "u-1",
    });
    expect(row).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });
});

describe("§pocandidate-creation-flow S4 — vendorName NULL 처리", () => {
  it("vendorName null/공백 → vendor '' (fake vendor lookup 유발 금지)", async () => {
    const { client, create } = makeClient();
    await createPOCandidateFromQuote(client, { quote: QUOTE, userId: "u-1", vendorName: "  " });
    expect(create.mock.calls[0][0].data.vendor).toBe("");
  });
});
