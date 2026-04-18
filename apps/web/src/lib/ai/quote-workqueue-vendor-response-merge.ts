/**
 * Quote Workqueue × Vendor Response Inbox — read-model merge helper
 *
 * 목적:
 * - vendor-response-inbox가 수집한 SupplierQuoteResponse를
 *   quote-workqueue-engine이 제공한 QuoteWorkqueueRow[]에 read-model로 투영.
 * - 운영 workbench는 "응답 수신 여부 / 제출 총액 / 납기 / 최종 수신시각" 을
 *   본 helper의 출력으로 바로 렌더할 수 있다.
 *
 * Mutation boundary:
 * - 본 helper는 순수 함수다. canonical ProcurementCase나 canonical
 *   QuoteWorkqueueState를 변경하지 않는다.
 * - 입력 rows는 immutable하게 취급되며, 출력은 새 배열 + 새 row 객체다.
 * - 실제 stage 전이(예: awaiting_responses → quotes_ready_for_review)는
 *   recomputeProcurementSummary / quote-workqueue-engine 쪽에서 별도 수행.
 *
 * 반영 규칙:
 * - (case, supplierId) pair가 inbox에 존재하면
 *   responseStatus = "quote_received", quoteReceivedFlag = true
 * - 기존 row가 이미 "ready_for_compare" 이상이면 downgrade 하지 않는다
 *   (즉, 이미 정규화/비교 준비 단계면 inbox 수신 사실을 덮어쓰지 않음).
 * - lastUpdatedAt은 max(기존, inbox.receivedAt).
 * - nextAction은 수신 상태에 맞게 최소 갱신.
 * - line coverage는 이벤트 payload에 항목이 없어 본 helper에서 계산하지 않는다.
 *   정규화 단계에서 보강되어야 한다.
 */

import type { QuoteWorkqueueRow } from "./quote-workqueue-engine";
import type { SupplierQuoteResponse } from "@/lib/procurement/procurement-case";

export interface VendorResponseMergeInput {
  /** quote-workqueue-engine이 빌드한 current rows (내부 workbench가 보는 것) */
  rows: QuoteWorkqueueRow[];
  /** vendor-response-inbox 수신 record */
  responses: SupplierQuoteResponse[];
  /** 현재 workbench가 보고 있는 ProcurementCase id */
  procurementCaseId: string;
}

export interface VendorResponseMergeResult {
  rows: QuoteWorkqueueRow[];
  /** 새로 수신으로 표시된 row 수 (운영 UI toast 용) */
  updatedCount: number;
  /** 가장 최근 수신 timestamp (없으면 null) */
  latestReceivedAt: string | null;
}

/**
 * vendor-response-inbox 응답을 workqueue rows에 투영한다.
 * rows / row 객체는 새로 생성되며, 입력을 변형하지 않는다.
 */
export function mergeVendorResponsesIntoWorkqueueRows(
  input: VendorResponseMergeInput,
): VendorResponseMergeResult {
  const { rows, responses, procurementCaseId } = input;

  // 해당 case에 속한 response만 대상으로 삼고, supplierId → latest response map 구성
  const latestBySupplier = new Map<string, SupplierQuoteResponse>();
  for (const r of responses) {
    if (r.procurementCaseId !== procurementCaseId) continue;
    const existing = latestBySupplier.get(r.supplierId);
    if (!existing) {
      latestBySupplier.set(r.supplierId, r);
      continue;
    }
    const a = existing.receivedAt ? new Date(existing.receivedAt).getTime() : 0;
    const b = r.receivedAt ? new Date(r.receivedAt).getTime() : 0;
    if (b >= a) latestBySupplier.set(r.supplierId, r);
  }

  let updatedCount = 0;
  let latestReceivedAt: string | null = null;

  const nextRows = rows.map((row) => {
    const matched = latestBySupplier.get(row.vendorTargetId);
    if (!matched) return row;

    // 이미 compare-ready 이상이면 상태를 downgrade 하지 않는다.
    const alreadyDownstream =
      row.responseStatus === "ready_for_compare" ||
      row.compareReadinessStatus === "ready";

    if (alreadyDownstream) {
      // lastUpdatedAt 만 최신으로 반영 (관측성)
      const nextLastUpdated = pickLater(row.lastUpdatedAt, matched.receivedAt);
      if (nextLastUpdated !== row.lastUpdatedAt) {
        latestReceivedAt = pickLater(latestReceivedAt, matched.receivedAt);
        return { ...row, lastUpdatedAt: nextLastUpdated };
      }
      return row;
    }

    updatedCount += 1;
    latestReceivedAt = pickLater(latestReceivedAt, matched.receivedAt);

    return {
      ...row,
      responseStatus: "quote_received" as const,
      quoteReceivedFlag: true,
      // display name 보강: inbox가 vendorName을 알고 있으면 사용
      vendorDisplayName: matched.supplierName || row.vendorDisplayName,
      lastUpdatedAt: pickLater(row.lastUpdatedAt, matched.receivedAt),
      nextAction:
        row.missingLineCount > 0
          ? "정규화 필요 — 라인 커버리지 확인"
          : "정규화 검토 후 비교 준비",
    };
  });

  return {
    rows: nextRows,
    updatedCount,
    latestReceivedAt,
  };
}

function pickLater(
  a: string | null | undefined,
  b: string | null | undefined,
): string | null {
  if (!a && !b) return null;
  if (!a) return b ?? null;
  if (!b) return a ?? null;
  return new Date(b).getTime() > new Date(a).getTime() ? b : a;
}
