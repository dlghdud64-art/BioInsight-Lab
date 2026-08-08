/**
 * §pocandidate-vendor-split Phase 1 — createPOCandidatesFromQuote 계약 (RED → P2 GREEN).
 *
 * 계약 (계획서 §12 Phase 0 — 호영님 A안 "유일-응답 파생" 확정, 2026-08-07):
 *   V1. 품목별 respondedVendors 가 유일(1개) → 그 vendor 로 그룹핑, vendor 별
 *       candidate N개 생성. 각 candidate 는 자기 items 만 보유(무손실 분할).
 *   V2. 다중 응답(2+)·응답 0(빈/미제공) 품목 → vendor "" 잔여 candidate 1개
 *       (자동 가격 판단 0 — 구매 의사결정 대행 금지, NULL-vendor 변환 경로 보존).
 *   V3. 회귀 동등성: 분할 근거 없으면(전 품목 잔여) 단일 candidate vendor "" —
 *       단, 기존 단수형 caller 가 넘기던 vendorName(selectedReply)이 있으면
 *       잔여 candidate 의 vendor 로 승계(기존 동작 보존).
 *   V4. items 0 → null (단수형 S3 승계 — 내역 없는 발주 후보 금지).
 *   V5. totalAmount 정직성: N>1 분할 시 candidate 별 Σ(자기 items lineTotal).
 *       PR totalAmount(전체 금액)를 각 후보에 복제 금지(중복 합산 왜곡).
 *       N=1(잔여 단일)일 때만 기존 우선순위(PR > quote > Σ) 유지 — 단수형 동등.
 *   V6. projection 계약 승계: approvalStatus 기본 in_app_approved ·
 *       stage po_conversion_candidate · quoteId 결속 (candidate 전부 동일).
 *
 * 커버리지 경계: 서비스 unit 만. approve 라우트 wiring·멱등(3중 필터와의 양립)·
 *   예산 1회(M2b)는 P3 통합 테스트가 잠근다.
 */
import { describe, it, expect, vi } from "vitest";
import { createPOCandidatesFromQuote } from "@/lib/persistence/po-candidate-server";

function makeClient() {
  let seq = 0;
  const create = vi.fn(async ({ data }: any) => ({
    id: `poc-${++seq}`,
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
    createdAt: new Date("2026-08-07T00:00:00Z"),
    updatedAt: new Date("2026-08-07T00:00:00Z"),
    items: (data.items?.create ?? []).map((i: any) => ({ ...i })),
  }));
  return { client: { pOCandidate: { create } }, create };
}

const ITEM = (name: string, lineTotal: number, respondedVendors?: string[]) => ({
  name,
  catalogNumber: "",
  quantity: 1,
  unitPrice: lineTotal,
  lineTotal,
  leadTime: null,
  respondedVendors: respondedVendors ?? null,
});

const BASE = {
  userId: "user-1",
  organizationId: "org-1" as string | null,
};

describe("§pocandidate-vendor-split V1 — 유일-응답 그룹핑 (vendor 별 N개)", () => {
  it("vendor A 유일 2품목 + vendor B 유일 1품목 → candidate 2개, items 무손실 분할", async () => {
    const { client, create } = makeClient();
    const result = await createPOCandidatesFromQuote(client as any, {
      ...BASE,
      quote: {
        id: "q-1",
        totalAmount: 60000,
        items: [
          ITEM("FBS", 10000, ["VendorA"]),
          ITEM("PBS", 20000, ["VendorA"]),
          ITEM("BCP", 30000, ["VendorB"]),
        ],
      },
    });
    expect(result).not.toBeNull();
    expect(result!.length).toBe(2);
    expect(create).toHaveBeenCalledTimes(2);
    const byVendor = Object.fromEntries(result!.map((c) => [c.vendor, c]));
    expect(byVendor["VendorA"].items.length).toBe(2);
    expect(byVendor["VendorB"].items.length).toBe(1);
    // 무손실: 전 items 합 = 원 quote items 수
    expect(result!.reduce((n, c) => n + c.items.length, 0)).toBe(3);
  });
});

describe("§pocandidate-vendor-split V2 — 다중 응답·응답 0 은 잔여 vendor ''", () => {
  it("다중 응답(2 vendor) 품목 → 자동 배정 0, 잔여 '' candidate 로", async () => {
    const { client } = makeClient();
    const result = await createPOCandidatesFromQuote(client as any, {
      ...BASE,
      quote: {
        id: "q-2",
        totalAmount: null,
        items: [
          ITEM("FBS", 10000, ["VendorA"]),
          ITEM("PBS", 20000, ["VendorA", "VendorB"]), // 다중 — 의사결정 대행 금지
          ITEM("BCP", 30000, []), // 응답 0
        ],
      },
    });
    expect(result!.length).toBe(2); // VendorA 1 + 잔여 "" 1
    const rest = result!.find((c) => c.vendor === "")!;
    expect(rest.items.map((i) => i.name).sort()).toEqual(["BCP", "PBS"]);
  });
});

describe("§pocandidate-vendor-split V3 — 회귀 동등성 (분할 근거 없음)", () => {
  it("전 품목 응답 미제공 + vendorName 有 → 단일 candidate, vendor=vendorName (단수형 동등)", async () => {
    const { client, create } = makeClient();
    const result = await createPOCandidatesFromQuote(client as any, {
      ...BASE,
      quote: { id: "q-3", totalAmount: 50000, items: [ITEM("FBS", 10000), ITEM("PBS", 20000)] },
      vendorName: "SelectedVendor",
    });
    expect(result!.length).toBe(1);
    expect(create).toHaveBeenCalledTimes(1);
    expect(result![0].vendor).toBe("SelectedVendor");
    expect(result![0].items.length).toBe(2);
  });

  it("전 품목 응답 미제공 + vendorName null → 단일 candidate vendor '' (S4 승계)", async () => {
    const { client } = makeClient();
    const result = await createPOCandidatesFromQuote(client as any, {
      ...BASE,
      quote: { id: "q-3b", totalAmount: null, items: [ITEM("FBS", 10000)] },
      vendorName: null,
    });
    expect(result!.length).toBe(1);
    expect(result![0].vendor).toBe("");
  });
});

describe("§pocandidate-vendor-split V4 — items 0 → null (S3 승계)", () => {
  it("items 빈 배열 → null 반환·create 미호출", async () => {
    const { client, create } = makeClient();
    const result = await createPOCandidatesFromQuote(client as any, {
      ...BASE,
      quote: { id: "q-4", totalAmount: null, items: [] },
    });
    expect(result).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });
});

describe("§pocandidate-vendor-split V5 — totalAmount 정직성", () => {
  it("N>1 분할 → candidate 별 Σ(자기 lineTotal), PR 전체액 복제 0", async () => {
    const { client } = makeClient();
    const result = await createPOCandidatesFromQuote(client as any, {
      ...BASE,
      quote: {
        id: "q-5",
        totalAmount: 999999, // quote 전체액 — 분할 시 복제 금지
        items: [ITEM("A", 10000, ["V1"]), ITEM("B", 20000, ["V2"])],
      },
      totalAmount: 888888, // PR 전체액 — 분할 시 복제 금지
    });
    const byVendor = Object.fromEntries(result!.map((c) => [c.vendor, c.totalAmount]));
    expect(byVendor["V1"]).toBe(10000);
    expect(byVendor["V2"]).toBe(20000);
  });

  it("N=1(잔여 단일) → 기존 우선순위 PR > quote > Σ 유지 (단수형 동등)", async () => {
    const { client } = makeClient();
    const result = await createPOCandidatesFromQuote(client as any, {
      ...BASE,
      quote: { id: "q-5b", totalAmount: 50000, items: [ITEM("A", 10000)] },
      totalAmount: 77777,
    });
    expect(result!.length).toBe(1);
    expect(result![0].totalAmount).toBe(77777);
  });
});

describe("§pocandidate-vendor-split V6 — projection 계약 승계", () => {
  it("candidate 전부: quoteId 결속·in_app_approved·po_conversion_candidate", async () => {
    const { client, create } = makeClient();
    const result = await createPOCandidatesFromQuote(client as any, {
      ...BASE,
      quote: { id: "q-6", totalAmount: null, items: [ITEM("A", 1, ["V1"]), ITEM("B", 2, ["V2"])] },
    });
    // quoteId 는 serializeCandidate 직렬화 계약 밖(기존 POCandidateRow 유지) —
    // DB write 인자에서 결속을 검증한다.
    for (const call of create.mock.calls) {
      expect(call[0].data.quoteId).toBe("q-6");
    }
    for (const c of result!) {
      expect(c.approvalStatus).toBe("in_app_approved");
      expect(c.stage).toBe("po_conversion_candidate");
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// §quote-item-vendor-selection P4 — 소비 계층 (선택 > 유일-응답 파생 > 잔여 "")
// ══════════════════════════════════════════════════════════════════════════════

const ITEM_SEL = (
  name: string,
  lineTotal: number,
  opts: { selectedVendor?: string | null; respondedVendors?: string[] | null } = {},
) => ({
  ...ITEM(name, lineTotal, opts.respondedVendors ?? undefined),
  selectedVendor: opts.selectedVendor ?? null,
});

describe("§quote-item-vendor-selection V7 — 선택이 파생보다 우선", () => {
  it("선택 vendor 가 유일-응답과 다르면 선택이 이긴다 (사용자 확정 > 시스템 파생)", async () => {
    const { client } = makeClient();
    const result = await createPOCandidatesFromQuote(client as any, {
      ...BASE,
      quote: {
        id: "q-7",
        totalAmount: null,
        items: [ITEM_SEL("A", 10000, { selectedVendor: "PickedVendor", respondedVendors: ["AutoVendor"] })],
      },
    });
    expect(result!.length).toBe(1);
    expect(result![0].vendor).toBe("PickedVendor");
  });

  it("다중 응답 품목도 선택이 있으면 그 vendor 로 확정 (잔여 '' 탈출)", async () => {
    const { client } = makeClient();
    const result = await createPOCandidatesFromQuote(client as any, {
      ...BASE,
      quote: {
        id: "q-7b",
        totalAmount: null,
        items: [
          ITEM_SEL("A", 10000, { selectedVendor: "PickedVendor", respondedVendors: ["V1", "V2"] }),
          ITEM_SEL("B", 20000, { respondedVendors: ["V1", "V2"] }), // 미선택 → 잔여
        ],
      },
    });
    const byVendor = Object.fromEntries(result!.map((c) => [c.vendor, c.items.map((i) => i.name)]));
    expect(byVendor["PickedVendor"]).toEqual(["A"]);
    expect(byVendor[""]).toEqual(["B"]);
  });

  it("선택 없으면 유일-응답 파생 폴백 (Track B 계약 보존)", async () => {
    const { client } = makeClient();
    const result = await createPOCandidatesFromQuote(client as any, {
      ...BASE,
      quote: {
        id: "q-7c",
        totalAmount: null,
        items: [ITEM_SEL("A", 10000, { respondedVendors: ["AutoVendor"] })],
      },
    });
    expect(result![0].vendor).toBe("AutoVendor");
  });

  it("선택 + 파생 혼재 → 각자 vendor 로 그룹핑 (계층 독립 적용)", async () => {
    const { client } = makeClient();
    const result = await createPOCandidatesFromQuote(client as any, {
      ...BASE,
      quote: {
        id: "q-7d",
        totalAmount: null,
        items: [
          ITEM_SEL("A", 10000, { selectedVendor: "Picked" }),
          ITEM_SEL("B", 20000, { respondedVendors: ["Auto"] }),
          ITEM_SEL("C", 30000, { respondedVendors: [] }),
        ],
      },
    });
    const byVendor = Object.fromEntries(result!.map((c) => [c.vendor, c.items.map((i) => i.name)]));
    expect(byVendor["Picked"]).toEqual(["A"]);
    expect(byVendor["Auto"]).toEqual(["B"]);
    expect(byVendor[""]).toEqual(["C"]);
  });
});
