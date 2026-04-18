/**
 * 다중 네트워크 상호운용 라우터 (Multi-Network Interop Router)
 *
 * 네트워크 간 라우팅 시 한계(limitations) 보존 및 이의 제기(contestation) 상태 유지를 검증.
 * 한계가 제거되거나 이의 제기 상태가 누락된 경우 HARD BLOCK.
 */

/** 라우터 검사 종류 */
export type RouterCheck =
  | "PROTOCOL_VERSION"
  | "JURISDICTION_COMPAT"
  | "CONTESTATION_STATUS"
  | "LIMITATION_PRESERVED"
  | "REVOCATION_CHECK";

/** 라우팅 결과 */
export interface RoutingResult {
  /** 허용 여부 */
  allowed: boolean;
  /** 지연 여부 */
  delayed: boolean;
  /** 차단 여부 */
  blocked: boolean;
  /** 사유 */
  reason: string;
  /** 수행된 검사 목록 */
  checksPerformed: RouterCheck[];
}

/** 라우팅 요청 */
export interface RoutingRequest {
  /** 요청 ID */
  id: string;
  /** 출발 네트워크 */
  sourceNetwork: string;
  /** 도착 네트워크 */
  targetNetwork: string;
  /** 프로토콜 버전 */
  protocolVersion: string;
  /** 관할권 */
  jurisdiction: string;
  /** 한계 목록 */
  limitations: string[];
  /** 이의 제기 상태 */
  contestationStatus: "NONE" | "CAUTION" | "SUSPENDED";
  /** 철회 여부 */
  isRevoked: boolean;
}

/** 감사 로그 항목 */
export interface RoutingAuditEntry {
  timestamp: number;
  requestId: string;
  result: RoutingResult;
}

// ─── 인메모리 저장소 ───
const auditLog: RoutingAuditEntry[] = [];

/**
 * 상호운용 라우트 평가
 *
 * CRITICAL: 한계가 제거되거나 이의 제기 상태가 누락되면 HARD BLOCK.
 *
 * @param request 라우팅 요청
 * @param originalLimitations 원본 한계 목록 (출발 시점)
 * @param originalContestationStatus 원본 이의 제기 상태
 */
export function evaluateInteropRoute(
  request: RoutingRequest,
  originalLimitations: string[],
  originalContestationStatus: "NONE" | "CAUTION" | "SUSPENDED"
): RoutingResult {
  const checksPerformed: RouterCheck[] = [];

  // 1) 철회 검사
  checksPerformed.push("REVOCATION_CHECK");
  if (request.isRevoked) {
    return recordAndReturn(request.id, {
      allowed: false,
      delayed: false,
      blocked: true,
      reason: "자산이 철회되었습니다.",
      checksPerformed,
    });
  }

  // 2) 한계 보존 검사 — HARD BLOCK
  checksPerformed.push("LIMITATION_PRESERVED");
  const missingLimitations = originalLimitations.filter(
    (l) => !request.limitations.includes(l)
  );
  if (missingLimitations.length > 0) {
    return recordAndReturn(request.id, {
      allowed: false,
      delayed: false,
      blocked: true,
      reason: `한계가 전송 중 제거됨: [${missingLimitations.join(", ")}]. HARD BLOCK.`,
      checksPerformed,
    });
  }

  // 3) 이의 제기 상태 보존 검사 — HARD BLOCK
  checksPerformed.push("CONTESTATION_STATUS");
  if (
    originalContestationStatus !== "NONE" &&
    request.contestationStatus === "NONE"
  ) {
    return recordAndReturn(request.id, {
      allowed: false,
      delayed: false,
      blocked: true,
      reason: `이의 제기 상태가 전송 중 누락됨 (원본: ${originalContestationStatus}). HARD BLOCK.`,
      checksPerformed,
    });
  }

  // 4) 프로토콜 버전 검사
  checksPerformed.push("PROTOCOL_VERSION");

  // 5) 관할권 호환성 검사
  checksPerformed.push("JURISDICTION_COMPAT");

  // SUSPENDED 상태는 지연
  if (request.contestationStatus === "SUSPENDED") {
    return recordAndReturn(request.id, {
      allowed: false,
      delayed: true,
      blocked: false,
      reason: "자산이 정지(SUSPENDED) 상태입니다. 해결될 때까지 지연됩니다.",
      checksPerformed,
    });
  }

  return recordAndReturn(request.id, {
    allowed: true,
    delayed: false,
    blocked: false,
    reason: "모든 검사 통과.",
    checksPerformed,
  });
}

/**
 * 라우트 차단
 */
export function blockRoute(requestId: string, reason: string): RoutingResult {
  const result: RoutingResult = {
    allowed: false,
    delayed: false,
    blocked: true,
    reason,
    checksPerformed: [],
  };
  auditLog.push({ timestamp: Date.now(), requestId, result });
  return result;
}

/**
 * 라우트 지연
 */
export function delayRoute(requestId: string, reason: string): RoutingResult {
  const result: RoutingResult = {
    allowed: false,
    delayed: true,
    blocked: false,
    reason,
    checksPerformed: [],
  };
  auditLog.push({ timestamp: Date.now(), requestId, result });
  return result;
}

/**
 * 라우팅 감사 로그 조회
 */
export function getRoutingAuditLog(limit?: number): RoutingAuditEntry[] {
  if (limit !== undefined) {
    return auditLog.slice(-limit);
  }
  return [...auditLog];
}

// ─── 헬퍼 ───
function recordAndReturn(requestId: string, result: RoutingResult): RoutingResult {
  auditLog.push({ timestamp: Date.now(), requestId, result });
  return result;
}
