/**
 * @module revocation-and-contestation
 * @description 철회 및 이의 제기
 *
 * 주장의 철회와 이의 제기를 처리한다.
 * 핵심 원칙: 이의 제기가 접수되면 해당 주장은 즉시 라우팅에서 중단된다.
 * 철회 신호는 모든 참여자에게 전파된다.
 */

/** 이의 제기 상태 */
export type ContestationStatus =
  | "FILED"
  | "UNDER_REVIEW"
  | "UPHELD"
  | "DISMISSED"
  | "WITHDRAWN";

/** 이의 제기 */
export interface Contestation {
  /** 이의 제기 고유 식별자 */
  id: string;
  /** 대상 주장 ID */
  assertionId: string;
  /** 제기자 ID */
  filedBy: string;
  /** 제기 사유 */
  reason: string;
  /** 제기 증거 목록 */
  evidence: string[];
  /** 현재 상태 */
  status: ContestationStatus;
  /** 제기 시각 */
  filedAt: number;
  /** 해결 시각 */
  resolvedAt: number | null;
}

/** 철회 방송 레코드 */
export interface RevocationBroadcast {
  /** 주장 ID */
  assertionId: string;
  /** 철회 사유 */
  reason: string;
  /** 방송 시각 */
  broadcastAt: number;
  /** 수신 참여자 ID 목록 */
  recipientIds: string[];
}

// --- 인메모리 저장소 ---
const contestationStore: Contestation[] = [];
const revocationBroadcasts: RevocationBroadcast[] = [];
const suspendedAssertionIds: Set<string> = new Set();

/**
 * 이의 제기를 접수한다.
 * 접수 즉시 해당 주장이 라우팅에서 중단된다.
 * @param assertionId - 대상 주장 ID
 * @param filedBy - 제기자 ID
 * @param reason - 제기 사유
 * @param evidence - 증거 목록
 * @returns 생성된 이의 제기
 */
export function fileContestation(
  assertionId: string,
  filedBy: string,
  reason: string,
  evidence: string[]
): Contestation {
  const contestation: Contestation = {
    id: `ct-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    assertionId,
    filedBy,
    reason,
    evidence,
    status: "FILED",
    filedAt: Date.now(),
    resolvedAt: null,
  };
  contestationStore.push(contestation);

  // 즉시 주장 중단 — 이의 제기 접수 시 라우팅 차단
  suspendedAssertionIds.add(assertionId);

  return contestation;
}

/**
 * 이의 제기를 검토 상태로 전환한다.
 * @param contestationId - 이의 제기 ID
 * @returns 업데이트된 이의 제기 또는 null
 */
export function reviewContestation(contestationId: string): Contestation | null {
  const contestation = contestationStore.find((c) => c.id === contestationId);
  if (!contestation || contestation.status !== "FILED") return null;
  contestation.status = "UNDER_REVIEW";
  return contestation;
}

/**
 * 이의 제기를 인정(upheld)한다.
 * 주장이 영구 철회되며 철회 방송이 발생한다.
 * @param contestationId - 이의 제기 ID
 * @param participantIds - 방송 수신 참여자 ID 목록
 * @returns 업데이트된 이의 제기 또는 null
 */
export function upholdContestation(
  contestationId: string,
  participantIds: string[]
): Contestation | null {
  const contestation = contestationStore.find((c) => c.id === contestationId);
  if (!contestation) return null;
  if (contestation.status !== "FILED" && contestation.status !== "UNDER_REVIEW") return null;

  contestation.status = "UPHELD";
  contestation.resolvedAt = Date.now();

  // 철회 방송
  broadcastRevocation(contestation.assertionId, contestation.reason, participantIds);

  return contestation;
}

/**
 * 이의 제기를 기각(dismissed)한다.
 * 주장의 라우팅 중단이 해제된다.
 * @param contestationId - 이의 제기 ID
 * @returns 업데이트된 이의 제기 또는 null
 */
export function dismissContestation(contestationId: string): Contestation | null {
  const contestation = contestationStore.find((c) => c.id === contestationId);
  if (!contestation) return null;
  if (contestation.status !== "FILED" && contestation.status !== "UNDER_REVIEW") return null;

  contestation.status = "DISMISSED";
  contestation.resolvedAt = Date.now();

  // 중단 해제
  suspendedAssertionIds.delete(contestation.assertionId);

  return contestation;
}

/**
 * 철회 신호를 모든 참여자에게 방송한다.
 * @param assertionId - 철회 대상 주장 ID
 * @param reason - 철회 사유
 * @param recipientIds - 수신 참여자 ID 목록
 * @returns 방송 레코드
 */
export function broadcastRevocation(
  assertionId: string,
  reason: string,
  recipientIds: string[]
): RevocationBroadcast {
  const broadcast: RevocationBroadcast = {
    assertionId,
    reason,
    broadcastAt: Date.now(),
    recipientIds,
  };
  revocationBroadcasts.push(broadcast);
  return broadcast;
}

/**
 * 특정 주장이 이의 제기에 의해 중단되었는지 확인한다.
 * @param assertionId - 주장 ID
 * @returns 중단 여부
 */
export function isAssertionSuspended(assertionId: string): boolean {
  return suspendedAssertionIds.has(assertionId);
}

/**
 * 특정 주장에 대한 이의 제기 목록을 반환한다.
 * @param assertionId - 주장 ID
 * @returns 이의 제기 배열
 */
export function getContestationsForAssertion(assertionId: string): Contestation[] {
  return contestationStore.filter((c) => c.assertionId === assertionId);
}
