import { describe, it, expect } from "vitest";
import {
  buildReceivingCaseList,
  buildReceivingCaseRow,
  caseCtaLabel,
  type ReceivingDraftDto,
  type ReceivingDraftItemDto,
} from "@/lib/ops-console/receiving-desktop-view-model";

/**
 * §receiving-list-redesign Phase 1 — 데스크탑 RCV 단위 뷰모델 unit.
 * 핸드오프(입고 관리 리스트 1a): 케이스 1건 = 1행, 남은 조치 = 필수만(보류 제외),
 *   CTA 문구 단일 계약, 보류 제외 반영 가능(postable), 파이프라인 4버킷 단일 소스.
 * 판정·조치 파생은 상세 페이지(§receiving-detail-redesign)와 동일 규칙 — canonical ReceivingDraft.
 */

function item(over: Partial<ReceivingDraftItemDto> = {}): ReceivingDraftItemDto {
  return {
    id: "it-1",
    name: "BCP 시약 500mL",
    productId: "prod-1",
    expectedQuantity: 10,
    receivedQuantity: 10,
    inspectedQuantity: 10,
    unit: "EA",
    lotNumber: "LOT-K2406A",
    expiryDate: null,
    decision: "PASS",
    discrepancyAction: null,
    discrepancyReason: null,
    restockedAt: null,
    ...over,
  };
}

function draft(over: Partial<ReceivingDraftDto> = {}): ReceivingDraftDto {
  return {
    id: "rd-1",
    status: "PENDING_REVIEW",
    submittedAt: "2026-08-29T00:00:00.000Z",
    restockSyncedAt: null,
    vendorName: "Thermo Fisher Scientific",
    order: { id: "ord-1", orderNumber: "PO-2026-0005" },
    documents: [
      { id: "doc-coa", docType: "coa", fileName: "coa.pdf" },
      { id: "doc-inv", docType: "invoice", fileName: "invoice.pdf" },
    ],
    items: [item()],
    ...over,
  };
}

/** 핸드오프 §0.2 재현 — 합격 1 · 미판정 대기 1 · 보류 1 + COA 미확보 케이스 */
function mixedCase(): ReceivingDraftDto {
  return draft({
    documents: [{ id: "doc-inv", docType: "invoice", fileName: "invoice.pdf" }],
    items: [
      item(),
      item({ id: "it-2", name: "완충액 키트", decision: null, inspectedQuantity: null }),
      item({
        id: "it-3",
        name: "배지 플레이트",
        decision: "FAIL",
        discrepancyAction: "RESHIP",
        discrepancyReason: "온도 이상 의심",
      }),
    ],
  });
}

describe("§receiving-list-redesign P1 — 케이스 1건 = 1행", () => {
  it("이슈 3종(미판정/보류/문서)이 겹친 케이스가 행 1개로만 파생된다", () => {
    const { rows } = buildReceivingCaseList([mixedCase()]);
    expect(rows).toHaveLength(1);
    expect(rows[0].displayNumber).toBe("PO-2026-0005");
  });

  it("라인 요약은 가운뎃점 구분(합격 1 · 대기 1 · 보류 1) · em dash 0", () => {
    const row = buildReceivingCaseRow(mixedCase());
    expect(row.lineSummary).toBe("합격 1 · 대기 1 · 보류 1");
    expect(row.lineSummary).not.toContain("—");
  });
});

describe("§receiving-list-redesign P1 — 남은 조치 = 필수만 (보류 제외)", () => {
  it("미판정 라인·COA 부재는 필수 조치, 보류(FAIL)는 actions 에 없고 보류 칩만", () => {
    const row = buildReceivingCaseRow(mixedCase());
    // 검수 판정(완충액 키트) + COA 확보 = 2. 보류(배지 플레이트)는 조치 아님.
    expect(row.actions).toHaveLength(2);
    expect(row.actions[0]).toMatchObject({ kind: "inspection", label: "검수 판정 · 완충액 키트" });
    expect(row.actions[1]).toMatchObject({ kind: "doc", label: "COA 확보" });
    expect(row.actions.some((a) => a.itemId === "it-3")).toBe(false);
    expect(row.holdChips).toEqual(["보류 보관 중 · 배지 플레이트"]);
    expect(row.remainingActionCount).toBe(2);
  });

  it("보류만 있고 필수 조치 0 이면 postable (보류 제외 반영 가능)", () => {
    const holdOnly = draft({
      items: [
        item(),
        item({ id: "it-3", name: "배지 플레이트", decision: "FAIL", discrepancyReason: "온도 이상" }),
      ],
    });
    const row = buildReceivingCaseRow(holdOnly);
    expect(row.remainingActionCount).toBe(0);
    expect(row.postable).toBe(true);
    expect(row.footerCaption).toBe("보류 제외 라인 재고 반영 가능, 보류 라인은 해제 후 반영");
    expect(caseCtaLabel(row)).toBe("재고 반영");
  });
});

describe("§receiving-list-redesign P1 — CTA 단일 계약 (필수 조치 기준)", () => {
  it("COA 조치만 남음 → `COA 확인하고 반영`", () => {
    const coaOnly = draft({
      documents: [{ id: "doc-inv", docType: "invoice", fileName: "invoice.pdf" }],
    });
    expect(caseCtaLabel(buildReceivingCaseRow(coaOnly))).toBe("COA 확인하고 반영");
  });

  it("검수 판정만 남음 → `검수 판정하고 반영`", () => {
    const inspectOnly = draft({ items: [item({ decision: null })] });
    expect(caseCtaLabel(buildReceivingCaseRow(inspectOnly))).toBe("검수 판정하고 반영");
  });

  it("복수 조치 → `남은 N건 처리하고 반영` (상세 페이지 계약 정합)", () => {
    expect(caseCtaLabel(buildReceivingCaseRow(mixedCase()))).toBe("남은 2건 처리하고 반영");
  });

  it("APPROVED 케이스는 완료 행 (CTA 없음) · AWAITING_REPLY 도 CTA 없음", () => {
    const done = buildReceivingCaseRow(draft({ status: "APPROVED" }));
    expect(done.isDone).toBe(true);
    expect(caseCtaLabel(done)).toBeNull();
    const waiting = buildReceivingCaseRow(draft({ status: "AWAITING_REPLY" }));
    expect(waiting.postable).toBe(false);
    expect(caseCtaLabel(waiting)).toBeNull();
  });
});

describe("§receiving-list-redesign P1 — 파이프라인 4버킷 단일 소스", () => {
  it("AWAITING_REPLY → 입고 대기 / 문서 조치 → 조치 필요 / APPROVED → 반영 완료", () => {
    const { pipeline, filterCounts } = buildReceivingCaseList([
      draft({ id: "rd-w", status: "AWAITING_REPLY" }),
      mixedCase(),
      draft({ id: "rd-d", status: "APPROVED" }),
    ]);
    expect(pipeline.waiting.count).toBe(1);
    expect(pipeline.action.count).toBe(1);
    expect(pipeline.action.remainingActions).toBe(2);
    expect(pipeline.posted.count).toBe(1);
    expect(filterCounts.actionNeeded).toBe(1);
    expect(filterCounts.done).toBe(1);
  });

  it("검수 판정만 남은 케이스는 검수 대기 버킷 (조치 필요 아님)", () => {
    const inspectOnly = draft({ items: [item({ decision: null })] });
    const { pipeline } = buildReceivingCaseList([inspectOnly]);
    expect(pipeline.inspecting.count).toBe(1);
    expect(pipeline.action.count).toBe(0);
  });

  it("정렬 — 조치 필요 먼저, 완료 마지막", () => {
    const { rows } = buildReceivingCaseList([
      draft({ id: "rd-d", status: "APPROVED" }),
      mixedCase(),
    ]);
    expect(rows[0].id).toBe("rd-1");
    expect(rows[1].id).toBe("rd-d");
  });
});
