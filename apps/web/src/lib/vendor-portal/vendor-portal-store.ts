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
import {
  emitVendorQuoteSubmitted,
  emitVendorPoAcknowledged,
  emitVendorPoDisputed,
} from "./vendor-portal-events";

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

// ── PO confirmation types ───────────────────────────────────────────
//
// Vendor Portal에서 공급사가 “보낸 PO”를 확인/수락/이의제기할 수 있는 탭.
// 캐노니컬 PO truth는 내부 po-created / dispatch / supplier-confirmation
// 체인이 관리하며, 여기서는 외부 노출 가능한 필드만 복제해 보여준다.

/** 외부 공급사가 보는 PO 상태 */
export type VendorFacingPoStatus =
  | "sent" // 내부에서 발송 완료, 공급사 확인 대기
  | "acknowledged" // 공급사 수락 완료
  | "disputed"; // 공급사 이의 제기

export interface VendorPoDocument {
  /** 연관 ProcurementCase id */
  procurementCaseId: string;
  /** 내부 PO 번호 (canonical) */
  poNumber: string;
  /** 본 PO를 받은 공급사 ID */
  vendorId: string;
  vendorName: string;
  /** 외부 노출용 제목 */
  title: string;
  /** 발송일 */
  sentAt: string;
  /** 납품 요청일 */
  requestedDeliveryDate: string | null;
  /** 품목 요약 (외부 노출 안전 필드만) */
  items: Array<{
    itemId: string;
    productName: string;
    quantity: number;
    unit: string;
    unitPrice: number;
  }>;
  /** 합계 (원) */
  totalAmount: number;
  status: VendorFacingPoStatus;
  /** 공급사가 수락/이의제기한 시각 */
  respondedAt: string | null;
  /** 이의 사유 (disputed일 때만) */
  disputeReason: string | null;
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

// ── Seed POs (mock — 실제 환경에서는 내부 dispatch engine에서 주입) ───

const SEED_POS: VendorPoDocument[] = [
  {
    procurementCaseId: "pc_po_001",
    poNumber: "PO-2026-0312",
    vendorId: "v1",
    vendorName: "BioReagent Korea",
    title: "qPCR 시약 긴급 보충",
    sentAt: "2026-04-06T06:30:00.000Z",
    requestedDeliveryDate: "2026-04-16",
    items: [
      { itemId: "itp_001", productName: "SYBR Green Master Mix", quantity: 5, unit: "kit", unitPrice: 210000 },
      { itemId: "itp_002", productName: "ROX Reference Dye", quantity: 2, unit: "vial", unitPrice: 85000 },
    ],
    totalAmount: 5 * 210000 + 2 * 85000,
    status: "sent",
    respondedAt: null,
    disputeReason: null,
  },
  {
    procurementCaseId: "pc_po_002",
    poNumber: "PO-2026-0305",
    vendorId: "v2",
    vendorName: "LabSupply Plus",
    title: "세포 배양 소모품 정기",
    sentAt: "2026-04-04T02:15:00.000Z",
    requestedDeliveryDate: "2026-04-14",
    items: [
      { itemId: "itp_010", productName: "T175 Flask, treated", quantity: 120, unit: "EA", unitPrice: 4200 },
      { itemId: "itp_011", productName: "10% FBS, qualified", quantity: 4, unit: "bottle", unitPrice: 465000 },
    ],
    totalAmount: 120 * 4200 + 4 * 465000,
    status: "sent",
    respondedAt: null,
    disputeReason: null,
  },
];

// ── Store ────────────────────────────────────────────────────────────

interface VendorPortalState {
  rfqs: VendorRfq[];
  submissions: VendorQuoteSubmission[];
  pos: VendorPoDocument[];

  // ── Actions ──
  /** 공급사 견적 제출. 상태를 quote_received로 전환하고 governance event 발행 */
  submitQuote: (input: {
    procurementCaseId: string;
    vendorId: string;
    unitPrices: Array<{ itemId: string; unitPrice: number }>;
    leadTimeDays: number;
    notes: string;
  }) => { success: boolean; error?: string };

  /** 공급사 PO 수락 */
  acknowledgePo: (input: {
    procurementCaseId: string;
    poNumber: string;
    vendorId: string;
  }) => { success: boolean; error?: string };

  /** 공급사 PO 이의 제기 */
  disputePo: (input: {
    procurementCaseId: string;
    poNumber: string;
    vendorId: string;
    reason: string;
  }) => { success: boolean; error?: string };

  /** vendor scope 외 데이터에 접근하지 못하도록 selector */
  getRfqsForVendor: (vendorId: string) => VendorRfq[];
  getSubmissionFor: (procurementCaseId: string, vendorId: string) => VendorQuoteSubmission | null;
  getPosForVendor: (vendorId: string) => VendorPoDocument[];
}

export const useVendorPortalStore = create<VendorPortalState>((set, get) => ({
  rfqs: SEED_RFQS,
  submissions: [],
  pos: SEED_POS,

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

  acknowledgePo: (input) => {
    const state = get();
    const target = state.pos.find(
      (p) =>
        p.procurementCaseId === input.procurementCaseId &&
        p.poNumber === input.poNumber &&
        p.vendorId === input.vendorId,
    );
    if (!target) {
      return { success: false, error: "해당 PO를 찾을 수 없습니다." };
    }
    if (target.status !== "sent") {
      return { success: false, error: "이미 처리된 PO입니다." };
    }

    const respondedAt = new Date().toISOString();
    set((s) => ({
      pos: s.pos.map((p) =>
        p.procurementCaseId === input.procurementCaseId &&
        p.poNumber === input.poNumber &&
        p.vendorId === input.vendorId
          ? { ...p, status: "acknowledged" as VendorFacingPoStatus, respondedAt }
          : p,
      ),
    }));

    emitVendorPoAcknowledged({
      procurementCaseId: target.procurementCaseId,
      vendorId: target.vendorId,
      vendorName: target.vendorName,
      poNumber: target.poNumber,
      acknowledgedAt: respondedAt,
    });

    return { success: true };
  },

  disputePo: (input) => {
    const state = get();
    const target = state.pos.find(
      (p) =>
        p.procurementCaseId === input.procurementCaseId &&
        p.poNumber === input.poNumber &&
        p.vendorId === input.vendorId,
    );
    if (!target) {
      return { success: false, error: "해당 PO를 찾을 수 없습니다." };
    }
    if (target.status !== "sent") {
      return { success: false, error: "이미 처리된 PO입니다." };
    }
    const reason = input.reason.trim();
    if (reason.length < 2) {
      return { success: false, error: "이의 사유를 입력해주세요." };
    }

    const respondedAt = new Date().toISOString();
    set((s) => ({
      pos: s.pos.map((p) =>
        p.procurementCaseId === input.procurementCaseId &&
        p.poNumber === input.poNumber &&
        p.vendorId === input.vendorId
          ? {
              ...p,
              status: "disputed" as VendorFacingPoStatus,
              respondedAt,
              disputeReason: reason,
            }
          : p,
      ),
    }));

    emitVendorPoDisputed({
      procurementCaseId: target.procurementCaseId,
      vendorId: target.vendorId,
      vendorName: target.vendorName,
      poNumber: target.poNumber,
      reason,
      disputedAt: respondedAt,
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

  getPosForVendor: (vendorId) => {
    if (!vendorId) return [];
    return get().pos.filter((p) => p.vendorId === vendorId);
  },
}));
