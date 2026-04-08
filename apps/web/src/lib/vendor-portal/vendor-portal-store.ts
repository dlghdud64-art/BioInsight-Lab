/**
 * Vendor Portal Store — 외부 공급사 포털 전용 in-memory 상태
 *
 * 외부 공급사용 surface이며, 내부 ProcurementCase canonical truth를 직접 변경하지 않는다.
 * 포털에서는 다음만 관리한다:
 * 1. 노출 가능한 RFQ 항목 (status === "request_for_quote") 시드
 * 2. 공급사가 제출한 quote response (preview/staging truth)
 * 3. 제출 시 governance event bus로 신호 전송
 *
 * 실제 ProcurementCase의 stage/quoteStatus 갱신은 내부 engine이 event를 받아 처리한다.
 *
 * 보안 컨텍스트:
 * - URL ?vendorId=v1 파라미터 기반 필터링 (실 Auth는 mock).
 * - 다른 vendor의 데이터는 selector 단계에서 차단한다.
 */

import { create } from "zustand";
import { emitVendorQuoteSubmitted } from "./vendor-portal-events";

// ── Types ────────────────────────────────────────────────────────────

/** 외부 공급사가 보는 RFQ status (내부 ProcurementStage와 분리된 vendor-facing 상태) */
export type VendorFacingRfqStatus =
  | "request_for_quote"
  | "quote_received"
  | "closed";

export interface VendorRfq {
  /** 내부 ProcurementCase id와 1:1 매핑 */
  procurementCaseId: string;
  /** 외부 노출용 RFQ 번호 */
  rfqNumber: string;
  title: string;
  /** 본 RFQ를 받은 공급사 ID (URL 필터 키) */
  vendorId: string;
  vendorName: string;
  /** 요청 품목 요약 (외부 노출 안전한 정보만) */
  items: Array<{
    itemId: string;
    productName: string;
    quantity: number;
    unit: string;
  }>;
  /** 요청 발신일 */
  requestedAt: string;
  /** 응답 마감 (없으면 null) */
  responseDueAt: string | null;
  status: VendorFacingRfqStatus;
}

export interface VendorQuoteSubmission {
  procurementCaseId: string;
  vendorId: string;
  /** 항목별 단가 */
  unitPrices: Array<{ itemId: string; unitPrice: number }>;
  /** 합계 (자동 계산 결과 저장) */
  quotedTotal: number;
  /** 납기일 (영업일) */
  leadTimeDays: number;
  /** 비고 */
  notes: string;
  submittedAt: string;
}

// ── Seed RFQs (mock — 실제 환경에서는 내부 engine에서 주입) ──────────

const SEED_RFQS: VendorRfq[] = [
  {
    procurementCaseId: "pc_seed_001",
    rfqNumber: "RFQ-2026-0118",
    title: "PCR 시약 분기 발주",
    vendorId: "v1",
    vendorName: "BioReagent Korea",
    items: [
      { itemId: "it_001", productName: "Taq Polymerase 500U", quantity: 4, unit: "vial" },
      { itemId: "it_002", productName: "dNTP Mix 10mM", quantity: 2, unit: "kit" },
    ],
    requestedAt: "2026-04-02T09:00:00.000Z",
    responseDueAt: "2026-04-12T18:00:00.000Z",
    status: "request_for_quote",
  },
  {
    procurementCaseId: "pc_seed_002",
    rfqNumber: "RFQ-2026-0119",
    title: "세포 배양 소모품 — 4월",
    vendorId: "v1",
    vendorName: "BioReagent Korea",
    items: [
      { itemId: "it_010", productName: "T75 Flask, treated", quantity: 200, unit: "EA" },
      { itemId: "it_011", productName: "FBS, qualified", quantity: 6, unit: "bottle" },
    ],
    requestedAt: "2026-04-04T01:00:00.000Z",
    responseDueAt: "2026-04-14T18:00:00.000Z",
    status: "request_for_quote",
  },
  {
    procurementCaseId: "pc_seed_003",
    rfqNumber: "RFQ-2026-0120",
    title: "qPCR plate & seal",
    vendorId: "v2",
    vendorName: "LabSupply Plus",
    items: [
      { itemId: "it_020", productName: "96-well qPCR Plate", quantity: 20, unit: "EA" },
      { itemId: "it_021", productName: "Optical Sealing Film", quantity: 5, unit: "pack" },
    ],
    requestedAt: "2026-04-05T05:00:00.000Z",
    responseDueAt: "2026-04-15T18:00:00.000Z",
    status: "request_for_quote",
  },
  {
    procurementCaseId: "pc_seed_004",
    rfqNumber: "RFQ-2026-0117",
    title: "Western Blot 항체 패키지",
    vendorId: "v2",
    vendorName: "LabSupply Plus",
    items: [
      { itemId: "it_030", productName: "anti-GAPDH (HRP)", quantity: 1, unit: "vial" },
      { itemId: "it_031", productName: "anti-Actin", quantity: 1, unit: "vial" },
    ],
    requestedAt: "2026-04-01T03:00:00.000Z",
    responseDueAt: null,
    status: "request_for_quote",
  },
];

// ── Store ────────────────────────────────────────────────────────────

interface VendorPortalState {
  rfqs: VendorRfq[];
  submissions: VendorQuoteSubmission[];

  // ── Actions ──
  /** 공급사 견적 제출. 상태를 quote_received로 전환하고 governance event 발행 */
  submitQuote: (input: {
    procurementCaseId: string;
    vendorId: string;
    unitPrices: Array<{ itemId: string; unitPrice: number }>;
    leadTimeDays: number;
    notes: string;
  }) => { success: boolean; error?: string };

  /** vendor scope 외 데이터에 접근하지 못하도록 selector */
  getRfqsForVendor: (vendorId: string) => VendorRfq[];
  getSubmissionFor: (procurementCaseId: string, vendorId: string) => VendorQuoteSubmission | null;
}

export const useVendorPortalStore = create<VendorPortalState>((set, get) => ({
  rfqs: SEED_RFQS,
  submissions: [],

  submitQuote: (input) => {
    const state = get();
    const target = state.rfqs.find(
      (r) => r.procurementCaseId === input.procurementCaseId && r.vendorId === input.vendorId,
    );

    if (!target) {
      return { success: false, error: "해당 RFQ를 찾을 수 없습니다." };
    }
    if (target.status !== "request_for_quote") {
      return { success: false, error: "이미 제출되었거나 마감된 RFQ입니다." };
    }

    // 단가 검증
    const validPrices = input.unitPrices.filter(
      (p) => Number.isFinite(p.unitPrice) && p.unitPrice > 0,
    );
    if (validPrices.length !== target.items.length) {
      return { success: false, error: "모든 품목에 유효한 단가를 입력해주세요." };
    }
    if (!Number.isFinite(input.leadTimeDays) || input.leadTimeDays <= 0) {
      return { success: false, error: "납기일은 1일 이상으로 입력해주세요." };
    }

    // 합계 계산 (preview truth — 외부 노출용)
    const quotedTotal = target.items.reduce((sum, item) => {
      const price = validPrices.find((p) => p.itemId === item.itemId);
      return sum + (price ? price.unitPrice * item.quantity : 0);
    }, 0);

    const submission: VendorQuoteSubmission = {
      procurementCaseId: input.procurementCaseId,
      vendorId: input.vendorId,
      unitPrices: validPrices,
      quotedTotal,
      leadTimeDays: input.leadTimeDays,
      notes: input.notes,
      submittedAt: new Date().toISOString(),
    };

    set((s) => ({
      rfqs: s.rfqs.map((r) =>
        r.procurementCaseId === input.procurementCaseId && r.vendorId === input.vendorId
          ? { ...r, status: "quote_received" as VendorFacingRfqStatus }
          : r,
      ),
      submissions: [...s.submissions.filter(
        (sub) => !(sub.procurementCaseId === input.procurementCaseId && sub.vendorId === input.vendorId),
      ), submission],
    }));

    // governance event bus emit (내부 engine listener가 ProcurementCase 갱신)
    emitVendorQuoteSubmitted({
      procurementCaseId: input.procurementCaseId,
      vendorId: input.vendorId,
      vendorName: target.vendorName,
      quotedTotal,
      leadTimeDays: input.leadTimeDays,
    });

    return { success: true };
  },

  getRfqsForVendor: (vendorId) => {
    if (!vendorId) return [];
    return get().rfqs.filter((r) => r.vendorId === vendorId);
  },

  getSubmissionFor: (procurementCaseId, vendorId) => {
    return (
      get().submissions.find(
        (s) => s.procurementCaseId === procurementCaseId && s.vendorId === vendorId,
      ) ?? null
    );
  },
}));
