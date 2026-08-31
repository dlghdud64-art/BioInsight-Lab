/**
 * §receiving-list-redesign Phase 1 (호영님 2026-08-30 핸드오프 — 입고 관리 리스트 1a)
 *
 * 데스크탑 입고 리스트 RCV 단위 뷰모델 — canonical ReceivingDraft(DB) 파생.
 *
 * 원인 1: 구 리스트는 데모 그래프(unifiedInboxItems) 이슈 단위 행으로 케이스 1건이
 *   최대 3행(보류 품목/문서 누락/반영 차단)으로 분열(핸드오프 §0.2). "반영 차단"은
 *   앞 2건의 결과라 별도 이슈가 아님.
 * 원인 2: 상세 페이지는 이미 canonical ReceivingDraft 기반(§receiving-detail-redesign P1
 *   데모 시드 폐기)인데 리스트만 데모 그래프 → 표면 간 상태 모순 + 반영 front-only(§0.1).
 * 해결: 리스트도 동일 canonical(GET /api/receiving-drafts) 파생. 케이스 1건 = 1행,
 *   남은 조치 = 필수만, 반영 = POST /approve(기존 이중 반영 가드) 재사용.
 *
 * 원칙:
 * - 신규 truth 저장 0 — 모든 값은 draft DTO 에서 호출 시 재계산(파생 projection).
 * - 판정·조치 파생은 상세 페이지(§receiving-detail-redesign)와 동일 규칙:
 *   미판정 라인 = 검수 판정 조치 · COA/거래명세서 부재 = 문서 조치(order 단위).
 * - 보류(FAIL 판정)는 필수 조치가 아님 — "보류 보관 중" 상태 칩만(핸드오프 §2).
 *   반영은 보류 제외분 먼저 가능(라인 restockedAt 가드가 서버에 있음).
 * - CTA 문구는 caseCtaLabel() 단일 계약 — 접힌 행·펼침·일괄 처리 모달 전 표면 동일.
 * - UI 문구 구분자는 가운뎃점(·) — em dash 금지(CLAUDE.md 타이포 조항).
 */

// ---------------------------------------------------------------------------
// DTO — GET /api/receiving-drafts 응답 계약 (route.ts 와 정합)
// ---------------------------------------------------------------------------

export interface ReceivingDraftItemDto {
  id: string;
  name: string;
  productId: string | null;
  expectedQuantity: number | null;
  receivedQuantity: number | null;
  inspectedQuantity: number | null;
  unit: string | null;
  lotNumber: string | null;
  expiryDate: string | null;
  /** §scan-recognition-upgrade P1 — lot 출처 canonical ("vendor_reply"|"coa_ocr"|"manual"|null) */
  lotSource: string | null;
  decision: string | null;
  discrepancyAction: string | null;
  discrepancyReason: string | null;
  restockedAt: string | null;
}

export interface ReceivingDraftDocumentDto {
  id: string;
  docType: string;
  fileName: string;
}

export type ReceivingDraftStatus =
  | 'AWAITING_REPLY'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED';

export interface ReceivingDraftDto {
  id: string;
  status: ReceivingDraftStatus;
  submittedAt: string | null;
  restockSyncedAt: string | null;
  vendorName: string | null;
  order: { id: string; orderNumber: string } | null;
  documents: ReceivingDraftDocumentDto[];
  items: ReceivingDraftItemDto[];
}

// ---------------------------------------------------------------------------
// 파생 타입
// ---------------------------------------------------------------------------

/** 라인 판정 — 시안 1a 3분류. PASS=합격 · null=대기 · FAIL=보류 */
export type ReceivingLineJudgment = 'passed' | 'waiting' | 'hold';

export const LINE_JUDGMENT_LABELS: Record<ReceivingLineJudgment, string> = {
  passed: '합격',
  waiting: '대기',
  hold: '보류',
};

export type ReceivingActionKind = 'inspection' | 'doc';

export interface ReceivingCaseAction {
  kind: ReceivingActionKind;
  /** 칩 문구 — 예: `검수 판정 · 완충액 키트` / `COA 확보` */
  label: string;
  /** CTA·caption 파생용 동사구 — 예: `검수 판정` / `COA 확인` */
  shortLabel: string;
  itemId: string | null;
}

export interface ReceivingCaseLineRow {
  itemId: string;
  itemName: string;
  judgment: ReceivingLineJudgment;
  judgmentLabel: string;
  /** 대기: `검수 판정 필요` · 보류: `{사유}, 보류 보관 중` · 합격: '' */
  reason: string;
  /** `10/10 수령` (expected 없으면 `10 수령`, 수량 미확정 시 '') */
  quantityLabel: string;
  lotNumber: string | null;
  /** lot 출처 passthrough — "COA 인식" 배지는 lotSource === "coa_ocr" 파생만(UI state truth 금지) */
  lotSource: string | null;
  /** 반영 완료 라인 (restockedAt) */
  restocked: boolean;
}

export type ReceivingCaseTone = 'done' | 'ready' | 'attention' | 'muted';

export interface ReceivingCaseRow {
  id: string;
  /** 표시 번호 — PO 번호(mono). draft 에 RCV 채번 없음(정직 표기). */
  displayNumber: string;
  orderId: string | null;
  vendorName: string | null;
  submittedAt: string | null;
  status: ReceivingDraftStatus;
  statusLabel: string;
  statusTone: ReceivingCaseTone;
  lineCount: number;
  /** `합격 1 · 대기 1 · 보류 1` — 0 그룹 생략 */
  lineSummary: string;
  lines: ReceivingCaseLineRow[];
  /** 필수 조치만 — 보류 제외. PENDING_REVIEW 외 상태는 항상 [] */
  actions: ReceivingCaseAction[];
  remainingActionCount: number;
  /** `보류 보관 중 · {품목}` 상태 칩 (필수 조치 아님) */
  holdChips: string[];
  /** PENDING_REVIEW + 필수 조치 0 = 반영 가능 (보류 있어도 보류 제외분 반영) */
  postable: boolean;
  isDone: boolean;
  /** 펼침 푸터 활성 조건 캡션 */
  footerCaption: string;
  /** 미니 스텝퍼 — 1 입고 · 2 검수·문서 · 3 반영 */
  step: 1 | 2 | 3;
  /** 일괄 처리 모달 직행에 필요한 원본 */
  documents: ReceivingDraftDocumentDto[];
  rawItems: ReceivingDraftItemDto[];
  /** 검색 대상 문자열(소문자) */
  searchText: string;
}

export interface ReceivingPipelineSummary {
  /** 입고 대기 = AWAITING_REPLY(회신 대기) */
  waiting: { count: number; caption: string };
  /** 검수 대기 = 남은 조치가 검수 판정뿐인 케이스 */
  inspecting: { count: number; caption: string };
  /** 조치 필요 = 문서 조치 포함 케이스 */
  action: { count: number; remainingActions: number; caption: string };
  /** 재고 반영 완료 */
  posted: { count: number; caption: string };
}

export interface ReceivingCaseList {
  rows: ReceivingCaseRow[];
  pipeline: ReceivingPipelineSummary;
  filterCounts: { actionNeeded: number; all: number; done: number };
}

// ---------------------------------------------------------------------------
// 내부 파생
// ---------------------------------------------------------------------------

function judgeItem(it: ReceivingDraftItemDto): ReceivingLineJudgment {
  if (it.decision === 'PASS') return 'passed';
  if (it.decision === 'FAIL') return 'hold';
  return 'waiting';
}

function buildLineRow(it: ReceivingDraftItemDto): ReceivingCaseLineRow {
  const judgment = judgeItem(it);
  let reason = '';
  if (judgment === 'hold') {
    reason = it.discrepancyReason ? `${it.discrepancyReason}, 보류 보관 중` : '보류 보관 중';
  } else if (judgment === 'waiting') {
    reason = '검수 판정 필요';
  }
  const qty = it.inspectedQuantity ?? it.receivedQuantity;
  const quantityLabel =
    qty == null
      ? ''
      : it.expectedQuantity != null
        ? `${qty}/${it.expectedQuantity} 수령`
        : `${qty} 수령`;
  return {
    itemId: it.id,
    itemName: it.name,
    judgment,
    judgmentLabel: LINE_JUDGMENT_LABELS[judgment],
    reason,
    quantityLabel,
    lotNumber: it.lotNumber,
    lotSource: it.lotSource,
    restocked: it.restockedAt != null,
  };
}

/**
 * 필수 조치 — 상세 페이지 다음 조치 파생과 동일 규칙.
 *   미판정 라인 → 검수 판정(라인별) · COA 부재 → COA 확보 · 거래명세서 부재 → 거래명세서 확보.
 *   보류(FAIL)는 판정이 이미 끝난 라인이므로 조치를 만들지 않는다(핸드오프 §2).
 */
function buildActions(draft: ReceivingDraftDto): ReceivingCaseAction[] {
  if (draft.status !== 'PENDING_REVIEW') return [];
  const actions: ReceivingCaseAction[] = [];
  for (const it of draft.items) {
    if (it.decision == null) {
      actions.push({
        kind: 'inspection',
        label: `검수 판정 · ${it.name}`,
        shortLabel: '검수 판정',
        itemId: it.id,
      });
    }
  }
  const hasCoa = draft.documents.some((d) => d.docType === 'coa');
  const hasInvoice = draft.documents.some((d) => d.docType === 'invoice');
  if (!hasCoa) {
    actions.push({ kind: 'doc', label: 'COA 확보', shortLabel: 'COA 확인', itemId: null });
  }
  if (!hasInvoice) {
    actions.push({
      kind: 'doc',
      label: '거래명세서 확보',
      shortLabel: '거래명세서 확인',
      itemId: null,
    });
  }
  return actions;
}

function buildLineSummary(lines: ReceivingCaseLineRow[]): string {
  const counts: Record<ReceivingLineJudgment, number> = { passed: 0, waiting: 0, hold: 0 };
  for (const l of lines) counts[l.judgment] += 1;
  const parts: string[] = [];
  (['passed', 'waiting', 'hold'] as const).forEach((j) => {
    if (counts[j] > 0) parts.push(`${LINE_JUDGMENT_LABELS[j]} ${counts[j]}`);
  });
  return parts.join(' · ');
}

function buildFooterCaption(
  status: ReceivingDraftStatus,
  actions: ReceivingCaseAction[],
  holdCount: number,
): string {
  if (status === 'APPROVED') return '재고 반영 완료';
  if (status === 'AWAITING_REPLY') return '공급사 회신 대기 중';
  if (status === 'REJECTED') return '반려된 입고안';
  if (status === 'EXPIRED') return '회신 링크 만료';
  const holdTail = holdCount > 0 ? ', 보류 라인은 해제 후 반영' : '';
  if (actions.length === 0) {
    return holdCount > 0
      ? `보류 제외 라인 재고 반영 가능${holdTail}`
      : '전체 라인 재고 반영 가능';
  }
  const uniqueShorts = [...new Set(actions.map((a) => a.shortLabel))].join(' · ');
  return `${uniqueShorts} 완료 시 합격 라인 재고 반영 가능${holdTail}`;
}

// ---------------------------------------------------------------------------
// buildReceivingCaseRow — 케이스 1건 = 1행
// ---------------------------------------------------------------------------

export function buildReceivingCaseRow(draft: ReceivingDraftDto): ReceivingCaseRow {
  const lines = draft.items.map(buildLineRow);
  const actions = buildActions(draft);
  const holdChips = lines
    .filter((l) => l.judgment === 'hold')
    .map((l) => `보류 보관 중 · ${l.itemName}`);
  const isDone = draft.status === 'APPROVED';
  const postable = draft.status === 'PENDING_REVIEW' && actions.length === 0;

  let statusLabel: string;
  let statusTone: ReceivingCaseTone;
  switch (draft.status) {
    case 'APPROVED':
      statusLabel = '재고 반영 완료';
      statusTone = 'done';
      break;
    case 'AWAITING_REPLY':
      statusLabel = '회신 대기';
      statusTone = 'muted';
      break;
    case 'REJECTED':
      statusLabel = '반려';
      statusTone = 'muted';
      break;
    case 'EXPIRED':
      statusLabel = '만료';
      statusTone = 'muted';
      break;
    default:
      statusLabel = postable ? '반영 가능' : '검수·문서 진행 중';
      statusTone = postable ? 'ready' : 'attention';
  }

  return {
    id: draft.id,
    displayNumber: draft.order?.orderNumber ?? draft.id,
    orderId: draft.order?.id ?? null,
    vendorName: draft.vendorName,
    submittedAt: draft.submittedAt,
    status: draft.status,
    statusLabel,
    statusTone,
    lineCount: lines.length,
    lineSummary: buildLineSummary(lines),
    lines,
    actions,
    remainingActionCount: actions.length,
    holdChips,
    postable,
    isDone,
    footerCaption: buildFooterCaption(draft.status, actions, holdChips.length),
    step: isDone ? 3 : postable ? 3 : draft.status === 'AWAITING_REPLY' ? 1 : 2,
    documents: draft.documents,
    rawItems: draft.items,
    searchText: [
      draft.order?.orderNumber ?? '',
      draft.vendorName ?? '',
      ...draft.items.map((i) => i.name),
    ]
      .join(' ')
      .toLowerCase(),
  };
}

// ---------------------------------------------------------------------------
// caseCtaLabel — CTA 문구 단일 계약 (접힌 행 · 펼침 · 일괄 처리 모달 동일)
// ---------------------------------------------------------------------------

export function caseCtaLabel(row: ReceivingCaseRow): string | null {
  if (row.status !== 'PENDING_REVIEW') return null;
  if (row.actions.length === 0) return '재고 반영';
  const shorts = [...new Set(row.actions.map((a) => a.shortLabel))];
  if (shorts.length === 1) return `${shorts[0]}하고 반영`;
  return `남은 ${row.actions.length}건 처리하고 반영`;
}

// ---------------------------------------------------------------------------
// buildReceivingCaseList — 리스트 + 파이프라인 + 필터 카운트 단일 소스
// ---------------------------------------------------------------------------

const SORT_GROUP: Record<ReceivingCaseTone, number> = {
  attention: 0,
  ready: 1,
  muted: 2,
  done: 3,
};

export function buildReceivingCaseList(drafts: ReceivingDraftDto[]): ReceivingCaseList {
  const rows = drafts.map(buildReceivingCaseRow).sort((a, b) => {
    const ga = SORT_GROUP[a.statusTone];
    const gb = SORT_GROUP[b.statusTone];
    if (ga !== gb) return ga - gb;
    return (a.submittedAt ?? '').localeCompare(b.submittedAt ?? '');
  });

  const waitingRows = rows.filter((r) => r.status === 'AWAITING_REPLY');
  const activeRows = rows.filter((r) => r.status === 'PENDING_REVIEW');
  const doneRows = rows.filter((r) => r.isDone);
  const actionRows = activeRows.filter((r) => r.actions.some((a) => a.kind === 'doc'));
  const inspectingRows = activeRows.filter(
    (r) => r.actions.length > 0 && r.actions.every((a) => a.kind === 'inspection'),
  );
  const remainingTotal = actionRows.reduce((acc, r) => acc + r.remainingActionCount, 0);
  const actionCaption =
    actionRows.length === 0
      ? '남은 필수 조치 없음'
      : [...new Set(actionRows.flatMap((r) => r.actions.map((a) => a.shortLabel)))].join(' · ');

  return {
    rows,
    pipeline: {
      waiting: {
        count: waitingRows.length,
        caption: waitingRows.length === 0 ? '도착 예정 없음' : `${waitingRows.length}건 회신 대기`,
      },
      inspecting: { count: inspectingRows.length, caption: '도착 후 검수 필요' },
      action: {
        count: actionRows.length,
        remainingActions: remainingTotal,
        caption: actionCaption,
      },
      posted: { count: doneRows.length, caption: '입고 종결' },
    },
    filterCounts: {
      actionNeeded: activeRows.filter((r) => r.remainingActionCount > 0).length,
      all: rows.filter((r) => !r.isDone).length,
      done: doneRows.length,
    },
  };
}
