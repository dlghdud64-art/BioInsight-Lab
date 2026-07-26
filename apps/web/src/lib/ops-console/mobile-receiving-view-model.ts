/**
 * §mobile-receiving-rcv-card Phase 1 (호영님 2026-07-26 핸드오프 — 모바일 입고 관리 개선)
 *
 * 모바일 입고 리스트 RCV 단위 뷰모델 — canonical(receivingBatches) 순수함수 파생.
 *
 * 원인: inbox-adapter buildInboxFromReceiving()이 RCV 1건을 최대 3개 이슈 item
 *   (quarantine_constrained / receiving_issue / posting_blocked)으로 분열 emit →
 *   모바일 카드 3장 분열. blocker 전무 batch는 item 0개 emit → ready RCV 미노출.
 * 해결: RCV 1건 = 카드 1장 + blockers[](해결 순서: 문서 → 보류 → 검수) 직접 파생.
 *   해결된 사유는 배열에서 소멸(취소선 잔류 없음). KPI 카운트도 동일 파생(단일 소스).
 *
 * 원칙:
 * - 신규 truth 저장 0 — 모든 값은 호출 시 재계산(파생 projection).
 * - 정직: 검수 blocker는 라이브 전이 규칙(complete_inspection: passed|failed 모두
 *   검수 종료)과 동일하게 pending/in_progress만 미해결로 본다.
 * - expected(도착 전)·posted/closed/cancelled(종결)는 처리 중 리스트에서 제외.
 * - 시간 파생(overdue)은 nowIso 주입 — 순수성/테스트 결정성 유지.
 */

import type {
  ReceivingBatchContract,
  ReceivingLineReceiptContract,
} from '../review-queue/receiving-inbound-contract';
import { RECEIVING_SLA_DEFAULTS } from '../review-queue/receiving-inbound-contract';
import { VENDOR_MAP } from './seed-data';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MobileReceivingBlockerKind = 'doc' | 'quarantine' | 'inspection';

/** 필수 문서 세트 — deriveLineDocStatus(scenario-transition-runner)와 동일 기준 */
export type RequiredDocType = 'coa' | 'msds';

export const REQUIRED_DOC_LABELS: Record<RequiredDocType, string> = {
  coa: '성적서(CoA)',
  msds: 'MSDS',
};

/** 라인별 미첨부 필수 문서 — 첨부 시트 프리셋 컨텍스트 */
export interface MobileReceivingMissingDoc {
  lineId: string;
  lineNumber: number;
  lineName: string;
  missingTypes: RequiredDocType[];
}

export interface MobileReceivingBlocker {
  kind: MobileReceivingBlockerKind;
  /** 체크리스트 줄 라벨 */
  label: string;
  /** 보조 설명(라인명 · 문서 종류 등) */
  detail: string;
  /**
   * 검수 줄 전용 — 선행(문서/보류) 미해결 시 true → 회색 비활성.
   * doc/quarantine 줄은 항상 false(존재 = 미해결 = 실행 가능).
   */
  dependsOnUnresolved: boolean;
}

export interface MobileReceivingCard {
  id: string;
  receivingNumber: string;
  vendorName: string | null;
  lineCount: number;
  receivedAt: string;
  /** 미해결 사유만 — 해결 순서(문서 → 보류 → 검수). 해결 시 줄 소멸. */
  blockers: MobileReceivingBlocker[];
  /** blockers.length 동일값 — "반영까지 남은 일 · N" */
  blockerCount: number;
  /** blockers 전무 = ready (서버 산출 의미론 — UI state 아님) */
  status: 'blocked' | 'ready';
  /** 첨부 시트 프리셋 — 미첨부 라인·문서 종류 */
  missingDocs: MobileReceivingMissingDoc[];
  /** 도착 후 검수 SLA(24h) 초과 여부 */
  isOverdue: boolean;
  overdueLabel: string;
}

export interface MobileReceivingSummary {
  /** blocked 먼저 → overdue 우선 → receivedAt 오래된 순 */
  cards: MobileReceivingCard[];
  /** KPI "문서 대기(차단)" — cards 파생 동일 소스 */
  blockedCount: number;
  /** KPI "반영 가능" — cards 파생 동일 소스 */
  readyCount: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** 처리 중 리스트 포함 상태 — expected(도착 전)·종결 상태 제외 */
const ACTIVE_STATUSES: ReadonlySet<ReceivingBatchContract['status']> = new Set([
  'arrived',
  'partially_received',
  'received',
  'inspection_in_progress',
  'ready_to_post',
  'issue_flagged',
]);

function hoursBetween(fromIso: string, nowIso: string): number {
  return (new Date(nowIso).getTime() - new Date(fromIso).getTime()) / 36e5;
}

/** 라인의 미첨부 필수 문서 종류 — lot 전수 기준(deriveLineDocStatus 정합) */
function missingTypesOfLine(line: ReceivingLineReceiptContract): RequiredDocType[] {
  if (line.documentStatus === 'not_required') return [];
  const lots = line.lotRecords;
  if (lots.length === 0) return [];
  const types: RequiredDocType[] = [];
  if (!lots.every((lot) => lot.coaAttached)) types.push('coa');
  if (!lots.every((lot) => lot.msdsAttached)) types.push('msds');
  return types;
}

function buildMissingDocs(rb: ReceivingBatchContract): MobileReceivingMissingDoc[] {
  const result: MobileReceivingMissingDoc[] = [];
  for (const line of rb.lineReceipts) {
    if (line.documentStatus !== 'missing' && line.documentStatus !== 'partial') continue;
    const missingTypes = missingTypesOfLine(line);
    if (missingTypes.length === 0) continue;
    result.push({
      lineId: line.id,
      lineNumber: line.lineNumber,
      lineName: line.itemName,
      missingTypes,
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// buildMobileReceivingCard — RCV 1건 파생
// ---------------------------------------------------------------------------

export function buildMobileReceivingCard(
  rb: ReceivingBatchContract,
  nowIso: string,
): MobileReceivingCard {
  const blockers: MobileReceivingBlocker[] = [];

  // 1. 문서 — documentStatus missing/partial 라인 존재 시 (inbox-adapter 기준 동일)
  const missingDocs = buildMissingDocs(rb);
  if (missingDocs.length > 0) {
    const first = missingDocs[0];
    const typeLabels = first.missingTypes.map((t) => REQUIRED_DOC_LABELS[t]).join(' · ');
    blockers.push({
      kind: 'doc',
      label: '필수 문서 미첨부',
      detail:
        missingDocs.length === 1
          ? `${first.lineName} · ${typeLabels}`
          : `${first.lineName} 외 ${missingDocs.length - 1}개 라인 · 필수 문서`,
      dependsOnUnresolved: false,
    });
  }

  // 2. 보류 — quarantined lot 존재 시 (해결 = released/blocked 판정 완료)
  const quarantinedCount = rb.lineReceipts.reduce(
    (acc, l) => acc + l.lotRecords.filter((lot) => lot.quarantineStatus === 'quarantined').length,
    0,
  );
  if (quarantinedCount > 0) {
    blockers.push({
      kind: 'quarantine',
      label: `보류 ${quarantinedCount}건 미해결`,
      detail: '보류 검사 실행 대기',
      dependsOnUnresolved: false,
    });
  }

  // 3. 검수 — inspectionRequired 라인 중 pending/in_progress (passed|failed = 종료, 라이브 전이 정합)
  const inspectionPending = rb.lineReceipts.some(
    (l) =>
      l.inspectionRequired &&
      (l.inspectionStatus === 'pending' || l.inspectionStatus === 'in_progress'),
  );
  if (inspectionPending) {
    blockers.push({
      kind: 'inspection',
      label: '검수 완료',
      detail: '검수 대기 라인 진행',
      dependsOnUnresolved: blockers.length > 0,
    });
  }

  const hours = hoursBetween(rb.receivedAt, nowIso);
  const isOverdue = hours > RECEIVING_SLA_DEFAULTS.inspectionHoursAfterArrival;

  return {
    id: rb.id,
    receivingNumber: rb.receivingNumber,
    vendorName: rb.vendorId ? VENDOR_MAP[rb.vendorId] ?? rb.vendorId : null,
    lineCount: rb.lineReceipts.length,
    receivedAt: rb.receivedAt,
    blockers,
    blockerCount: blockers.length,
    status: blockers.length === 0 ? 'ready' : 'blocked',
    missingDocs,
    isOverdue,
    overdueLabel: isOverdue
      ? `${RECEIVING_SLA_DEFAULTS.inspectionHoursAfterArrival}시간 초과`
      : `${RECEIVING_SLA_DEFAULTS.inspectionHoursAfterArrival}시간 이내`,
  };
}

// ---------------------------------------------------------------------------
// buildMobileReceivingSummary — 리스트 + KPI 단일 소스
// ---------------------------------------------------------------------------

export function buildMobileReceivingSummary(
  batches: ReceivingBatchContract[],
  nowIso: string,
): MobileReceivingSummary {
  const cards = batches
    .filter((rb) => ACTIVE_STATUSES.has(rb.status))
    .map((rb) => buildMobileReceivingCard(rb, nowIso))
    .sort((a, b) => {
      const ga = a.status === 'blocked' ? 0 : 1;
      const gb = b.status === 'blocked' ? 0 : 1;
      if (ga !== gb) return ga - gb;
      const oa = a.isOverdue ? 0 : 1;
      const ob = b.isOverdue ? 0 : 1;
      if (oa !== ob) return oa - ob;
      return a.receivedAt.localeCompare(b.receivedAt);
    });

  return {
    cards,
    blockedCount: cards.filter((c) => c.status === 'blocked').length,
    readyCount: cards.filter((c) => c.status === 'ready').length,
  };
}
