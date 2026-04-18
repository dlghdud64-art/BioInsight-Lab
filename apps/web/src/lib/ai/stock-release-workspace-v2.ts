/**
 * Stock Release Workspace v2 — disposition 완료 후 재고 반영 운영면
 *
 * TRUTH CONTRACT:
 * - reads: ReceivingVarianceDispositionSessionV2 (releasable/hold/rejected qty, lineDispositions)
 * - writes: 없음 — workspace는 read-only. resolution engine이 release truth write.
 * - center: releasable line set + location/bin assignment + release execution
 * - rail: disposition evidence + receiving execution snapshot
 * - dock: assign location / execute release / hold / route correction
 * - forbidden: disposition 미완료 시 release, hold/rejected qty를 releasable에 포함
 */

import type { ReceivingVarianceDispositionSessionV2, ReceivingLineDispositionV2 } from "./receiving-variance-disposition-v2-engine";

export type StockReleaseWorkspaceStatusV2 = "release_not_started" | "release_in_progress" | "release_complete" | "release_partial" | "release_hold" | "release_blocked";

export interface StockReleaseLineV2 { lineId: string; releasableQty: number; holdQty: number; rejectedQty: number; disposition: string; locationAssigned: string; binAssigned: string; releaseStatus: "pending" | "released" | "held" | "blocked"; }

export interface StockReleaseWorkspaceStateV2 {
  workspaceId: string; caseId: string; sentStateRecordId: string; dispositionSessionId: string;
  workspaceStatus: StockReleaseWorkspaceStatusV2;
  releaseLines: StockReleaseLineV2[];
  totalReleasableQty: number; totalReleasedQty: number; totalHeldQty: number;
  allLinesReleased: boolean; canCompleteRelease: boolean;
  operatorNote: string; generatedAt: string;
}

export function buildStockReleaseWorkspaceStateV2(dispSession: ReceivingVarianceDispositionSessionV2): StockReleaseWorkspaceStateV2 {
  const releaseLines: StockReleaseLineV2[] = dispSession.lineDispositions.filter(l => l.releasableQty > 0).map(l => ({ lineId: l.lineId, releasableQty: l.releasableQty, holdQty: l.holdQty, rejectedQty: l.rejectedQty, disposition: l.disposition, locationAssigned: "", binAssigned: "", releaseStatus: "pending" as const }));
  const totalReleasable = releaseLines.reduce((s, l) => s + l.releasableQty, 0);

  return { workspaceId: `stkrlws_${Date.now().toString(36)}`, caseId: dispSession.caseId, sentStateRecordId: dispSession.sentStateRecordId, dispositionSessionId: dispSession.dispositionSessionId, workspaceStatus: releaseLines.length > 0 ? "release_not_started" : "release_blocked", releaseLines, totalReleasableQty: totalReleasable, totalReleasedQty: 0, totalHeldQty: dispSession.totalHoldQty, allLinesReleased: false, canCompleteRelease: releaseLines.length > 0, operatorNote: "", generatedAt: new Date().toISOString() };
}
