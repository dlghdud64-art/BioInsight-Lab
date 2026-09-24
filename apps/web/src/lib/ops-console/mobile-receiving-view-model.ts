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


// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MobileReceivingBlockerKind = 'doc' | 'quarantine' | 'inspection';

/** 필수 문서 세트. 근거였던 deriveLineDocStatus(시드 러너)는 §po-seed-cutoff 2차(2026-09-24)에서 삭제됐다 —
 * 정본(ReceivingDraft) 축에는 같은 판정이 없다. 이 타입은 화면 계약으로만 남는다. */
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

/* §po-seed-cutoff 2차 (2026-09-24 · 호영님 판정) — 시드 빌더 제거, **타입만 남긴다.**
 * buildMobileReceivingSummary(시드 receivingBatches 파생)는 §receiving-mobile-canonical(2026-09-22)에서
 * 정본 파생(mobile-receiving-from-drafts.ts)으로 교체되며 앱 소비자가 0 이 됐고, 이번에 시드 파일 자체가 삭제됐다.
 * 카드·요약 계약(타입)은 화면과 정본 파생기가 계속 쓰므로 남긴다. 구현 복원은 git 이력에서. */
