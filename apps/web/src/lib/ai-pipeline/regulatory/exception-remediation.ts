/**
 * @module exception-remediation
 * @description 예외 및 시정조치 관리 — 통제 예외 사항의 등록, 시정조치 추적, 위험 수용 처리를 담당하는 엔진
 */

/** 예외 심각도 */
export type ExceptionSeverity = 'CRITICAL' | 'MAJOR' | 'MINOR' | 'OBSERVATION';

/** 시정조치 상태 */
export type RemediationStatus = 'OPEN' | 'IN_PROGRESS' | 'REMEDIATED' | 'ACCEPTED_RISK' | 'OVERDUE';

/** 예외 항목 */
export interface Exception {
  /** 예외 ID */
  id: string;
  /** 통제 ID */
  controlId: string;
  /** 심각도 */
  severity: ExceptionSeverity;
  /** 상태 */
  status: RemediationStatus;
  /** 설명 */
  description: string;
  /** 근본 원인 */
  rootCause: string;
  /** 시정조치 계획 */
  remediationPlan: string;
  /** 시정 기한 */
  dueDate: Date;
  /** 책임자 */
  owner: string;
  /** 등록 일시 */
  raisedAt: Date;
  /** 해결 일시 */
  resolvedAt: Date | null;
}

/** 인메모리 예외 저장소 */
const exceptionStore: Exception[] = [];

/**
 * 새로운 예외를 등록한다.
 * @param params 예외 파라미터 (raisedAt, resolvedAt 자동 설정)
 * @returns 등록된 예외
 */
export function raiseException(params: Omit<Exception, 'raisedAt' | 'resolvedAt'>): Exception {
  const exception: Exception = {
    ...params,
    raisedAt: new Date(),
    resolvedAt: null,
  };
  exceptionStore.push(exception);
  return exception;
}

/**
 * 예외의 시정조치 상태를 갱신한다.
 * @param exceptionId 예외 ID
 * @param status 새로운 상태
 * @param remediationPlan 갱신된 시정조치 계획 (선택)
 * @returns 갱신된 예외 또는 null
 */
export function updateRemediation(
  exceptionId: string,
  status: RemediationStatus,
  remediationPlan?: string
): Exception | null {
  const exception = exceptionStore.find((e) => e.id === exceptionId);
  if (!exception) return null;

  exception.status = status;
  if (remediationPlan) exception.remediationPlan = remediationPlan;
  if (status === 'REMEDIATED') exception.resolvedAt = new Date();

  return exception;
}

/**
 * 예외를 위험 수용 처리한다.
 * @param exceptionId 예외 ID
 * @param justification 수용 사유
 * @returns 갱신된 예외 또는 null
 */
export function acceptRisk(exceptionId: string, justification: string): Exception | null {
  const exception = exceptionStore.find((e) => e.id === exceptionId);
  if (!exception) return null;

  exception.status = 'ACCEPTED_RISK';
  exception.remediationPlan = `[위험 수용] ${justification}`;
  exception.resolvedAt = new Date();

  return exception;
}

/**
 * 미해결 예외 목록을 반환한다.
 * @returns 미해결 예외 배열
 */
export function getOpenExceptions(): Exception[] {
  return exceptionStore.filter(
    (e) => e.status === 'OPEN' || e.status === 'IN_PROGRESS' || e.status === 'OVERDUE'
  );
}

/**
 * 기한 초과 시정조치 목록을 반환한다.
 * @param referenceDate 기준 일시 (기본: 현재)
 * @returns 기한 초과 예외 배열
 */
export function getOverdueRemediations(referenceDate?: Date): Exception[] {
  const now = referenceDate ?? new Date();
  return exceptionStore.filter(
    (e) => (e.status === 'OPEN' || e.status === 'IN_PROGRESS') && e.dueDate < now
  );
}
