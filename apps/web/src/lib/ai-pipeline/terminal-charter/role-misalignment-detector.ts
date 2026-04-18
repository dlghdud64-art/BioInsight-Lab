/**
 * @module role-misalignment-detector
 * @description 역할 이상징후 감지기 — 스트레스 상황에서 역할 경계가
 * 무너지는 것을 구조적으로 탐지하고 차단한다.
 *
 * 감지 대상:
 * 1. 비소유자(non-owner)의 승인 시도
 * 2. 비상 권한(Emergency)의 상시 개입
 * 3. 스튜어드 없는 동결 해제 시도
 * 4. Operator의 Steward 권한 침범
 * 5. 자동화 시스템의 비인가 코어 접촉
 */

import type { ActorRole } from "./constitutional-breach-simulation";

// ─────────────────────────────────────────────
// 1. 역할 혼선 유형
// ─────────────────────────────────────────────

/** 역할 혼선 유형 */
export type RoleMisalignmentType =
  | "NON_OWNER_APPROVAL"           // 비소유자 승인 시도
  | "EMERGENCY_PERSISTENT_USE"     // 비상 권한 상시 개입
  | "UNFREEZE_WITHOUT_STEWARD"     // 스튜어드 없는 동결 해제
  | "OPERATOR_STEWARD_OVERREACH"   // Operator의 Steward 권한 침범
  | "AUTOMATED_CORE_TOUCH"         // 자동화 시스템의 코어 접촉
  | "CROSS_ROLE_COLLUSION"         // 교차 역할 공모 의심
  | "AUTHORITY_ESCALATION_ABUSE";  // 권한 에스컬레이션 남용

/** 역할 혼선 인시던트 */
export interface RoleMisalignmentIncident {
  /** 인시던트 ID */
  incidentId: string;
  /** 혼선 유형 */
  type: RoleMisalignmentType;
  /** 행위자 ID */
  actorId: string;
  /** 행위자 역할 */
  actorRole: ActorRole;
  /** 시도한 작업 */
  attemptedAction: string;
  /** 필요 역할 */
  requiredRole: string;
  /** 감지 일시 */
  detectedAt: Date;
  /** 차단 여부 */
  blocked: boolean;
  /** 상세 설명 */
  detail: string;
  /** 후속 조치 */
  followUp: RoleMisalignmentFollowUp;
}

/** 후속 조치 */
export type RoleMisalignmentFollowUp =
  | "ACCESS_REVIEW_INITIATED"
  | "AUTHORITY_AUDIT_REQUIRED"
  | "STEWARD_NOTIFICATION_SENT"
  | "CONSTITUTIONAL_REVIEW_TRIGGERED"
  | "EMERGENCY_AUTHORITY_REVOKED";

// ─────────────────────────────────────────────
// 2. 역할 권한 격자 (최소 권한 원칙)
// ─────────────────────────────────────────────

/** 역할별 허용 작업 */
const ROLE_PERMISSIONS: Record<ActorRole, Set<string>> = {
  UNCERTIFIED_ACTOR: new Set(["VIEW_DASHBOARD", "SUBMIT_TICKET"]),
  CERTIFIED_OPERATOR: new Set([
    "VIEW_DASHBOARD", "SUBMIT_TICKET", "EXECUTE_RENEWAL",
    "UPDATE_NON_CORE_CONFIG", "VIEW_AUDIT_LOG",
  ]),
  STEWARD_APPROVER: new Set([
    "VIEW_DASHBOARD", "SUBMIT_TICKET", "EXECUTE_RENEWAL",
    "UPDATE_NON_CORE_CONFIG", "VIEW_AUDIT_LOG",
    "APPROVE_AMENDMENT", "RELEASE_FREEZE", "CONSTITUTIONAL_REVIEW",
    "ISSUE_TRUST_MARK",
  ]),
  EMERGENCY_ROLE: new Set([
    "VIEW_DASHBOARD", "EMERGENCY_FREEZE", "EMERGENCY_ISOLATE",
    "EMERGENCY_ROLLBACK",
    // ★ EMERGENCY_CORE_MODIFY는 없음 — 비상이어도 코어 수정 불가 ★
  ]),
  AUTOMATED_SYSTEM: new Set([
    "PROPOSE_OPTIMIZATION", "EXECUTE_SCHEDULED_RENEWAL",
    "REPORT_ANOMALY", "UPDATE_METRICS",
    // ★ MODIFY_CORE_POLICY는 없음 ★
  ]),
};

/** 비상 권한 사용 기록 (production: DB-backed) */
const emergencyUsageLog: Array<{
  actorId: string;
  action: string;
  usedAt: Date;
}> = [];

/** 인시던트 저장소 (production: DB-backed) */
const incidentStore: RoleMisalignmentIncident[] = [];

// ─────────────────────────────────────────────
// 3. 감지 함수
// ─────────────────────────────────────────────

/**
 * 역할 권한 검증을 수행한다.
 * 권한 초과 시도 시 즉시 ROLE_CONFLICT_DETECTED 경보 발화.
 */
export function validateRolePermission(params: {
  actorId: string;
  actorRole: ActorRole;
  attemptedAction: string;
}): {
  permitted: boolean;
  incident: RoleMisalignmentIncident | null;
} {
  const permissions = ROLE_PERMISSIONS[params.actorRole];

  // 허용된 작업이면 통과
  if (permissions.has(params.attemptedAction)) {
    return { permitted: true, incident: null };
  }

  // 혼선 유형 결정
  let type: RoleMisalignmentType;
  let followUp: RoleMisalignmentFollowUp;
  let requiredRole: string;

  if (params.attemptedAction === "APPROVE_AMENDMENT" || params.attemptedAction === "CONSTITUTIONAL_REVIEW") {
    type = params.actorRole === "CERTIFIED_OPERATOR"
      ? "OPERATOR_STEWARD_OVERREACH"
      : "NON_OWNER_APPROVAL";
    followUp = "STEWARD_NOTIFICATION_SENT";
    requiredRole = "STEWARD_APPROVER";
  } else if (params.attemptedAction === "RELEASE_FREEZE") {
    type = "UNFREEZE_WITHOUT_STEWARD";
    followUp = "CONSTITUTIONAL_REVIEW_TRIGGERED";
    requiredRole = "STEWARD_APPROVER";
  } else if (params.actorRole === "EMERGENCY_ROLE") {
    type = "AUTHORITY_ESCALATION_ABUSE";
    followUp = "EMERGENCY_AUTHORITY_REVOKED";
    requiredRole = "STEWARD_APPROVER (through proper amendment)";
  } else if (params.actorRole === "AUTOMATED_SYSTEM") {
    type = "AUTOMATED_CORE_TOUCH";
    followUp = "AUTHORITY_AUDIT_REQUIRED";
    requiredRole = "STEWARD_APPROVER";
  } else {
    type = "NON_OWNER_APPROVAL";
    followUp = "ACCESS_REVIEW_INITIATED";
    requiredRole = "STEWARD_APPROVER or higher";
  }

  const incident: RoleMisalignmentIncident = {
    incidentId: `ROLE-${Date.now()}-${incidentStore.length}`,
    type,
    actorId: params.actorId,
    actorRole: params.actorRole,
    attemptedAction: params.attemptedAction,
    requiredRole,
    detectedAt: new Date(),
    blocked: true, // ★ 항상 차단 ★
    detail: `역할 ${params.actorRole}(이)가 권한 초과 작업 '${params.attemptedAction}' 시도 — 필요 역할: ${requiredRole}`,
    followUp,
  };

  incidentStore.push(incident);
  return { permitted: false, incident };
}

/**
 * 비상 권한 상시 사용 패턴을 감지한다.
 * 최근 24시간 내 Emergency Role 사용이 임계치를 초과하면 경보.
 */
export function detectEmergencyPersistentUse(
  actorId: string,
  action: string
): {
  alert: boolean;
  incident: RoleMisalignmentIncident | null;
  recentUsageCount: number;
} {
  const now = new Date();
  emergencyUsageLog.push({ actorId, action, usedAt: now });

  // 최근 24시간 내 사용 횟수
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const recentUsage = emergencyUsageLog.filter(
    (u) => u.actorId === actorId && u.usedAt >= cutoff
  );

  const THRESHOLD = 3; // 24시간 내 3회 초과 시 경보

  if (recentUsage.length > THRESHOLD) {
    const incident: RoleMisalignmentIncident = {
      incidentId: `ROLE-EMR-${Date.now()}-${incidentStore.length}`,
      type: "EMERGENCY_PERSISTENT_USE",
      actorId,
      actorRole: "EMERGENCY_ROLE",
      attemptedAction: action,
      requiredRole: "N/A — 비상 권한 남용 패턴",
      detectedAt: now,
      blocked: true,
      detail: `비상 권한 24시간 내 ${recentUsage.length}회 사용 (임계치: ${THRESHOLD}) — 상시 남용 의심`,
      followUp: "EMERGENCY_AUTHORITY_REVOKED",
    };

    incidentStore.push(incident);
    return { alert: true, incident, recentUsageCount: recentUsage.length };
  }

  return { alert: false, incident: null, recentUsageCount: recentUsage.length };
}

/**
 * 교차 역할 공모 의심을 감지한다.
 * 동일 시간대에 서로 다른 역할의 actor가 보완적 패턴의 요청을 제출하면 경보.
 */
export function detectCrossRoleCollusion(
  requests: Array<{
    actorId: string;
    actorRole: ActorRole;
    action: string;
    timestamp: Date;
  }>
): {
  collusionDetected: boolean;
  incident: RoleMisalignmentIncident | null;
} {
  // 5분 윈도우 내 다른 역할의 보완적 요청 패턴
  const complementaryPairs = [
    ["RELEASE_FREEZE", "MODIFY_CORE_POLICY"],
    ["EMERGENCY_FREEZE", "APPROVE_AMENDMENT"],
    ["RELEASE_FREEZE", "EXPAND_SCOPE"],
  ];

  for (let i = 0; i < requests.length; i++) {
    for (let j = i + 1; j < requests.length; j++) {
      const a = requests[i];
      const b = requests[j];
      const timeDiff = Math.abs(a.timestamp.getTime() - b.timestamp.getTime());
      if (timeDiff > 5 * 60 * 1000) continue; // 5분 초과
      if (a.actorRole === b.actorRole) continue; // 동일 역할

      const pair = [a.action, b.action];
      const isComplementary = complementaryPairs.some(
        (cp) => (pair.includes(cp[0]) && pair.includes(cp[1]))
      );

      if (isComplementary) {
        const incident: RoleMisalignmentIncident = {
          incidentId: `ROLE-COLLUSION-${Date.now()}-${incidentStore.length}`,
          type: "CROSS_ROLE_COLLUSION",
          actorId: `${a.actorId}+${b.actorId}`,
          actorRole: a.actorRole,
          attemptedAction: `${a.action} + ${b.action}`,
          requiredRole: "N/A — 공모 의심 패턴",
          detectedAt: new Date(),
          blocked: true,
          detail: `교차 역할 공모 의심: ${a.actorRole}(${a.action}) + ${b.actorRole}(${b.action}) — ${timeDiff}ms 간격`,
          followUp: "CONSTITUTIONAL_REVIEW_TRIGGERED",
        };

        incidentStore.push(incident);
        return { collusionDetected: true, incident };
      }
    }
  }

  return { collusionDetected: false, incident: null };
}

// ─────────────────────────────────────────────
// 4. 조회 함수
// ─────────────────────────────────────────────

/** 역할 혼선 인시던트 조회 */
export function getRoleMisalignmentIncidents(): RoleMisalignmentIncident[] {
  return [...incidentStore];
}

/** 비상 권한 사용 로그 조회 */
export function getEmergencyUsageLog(): typeof emergencyUsageLog {
  return [...emergencyUsageLog];
}

/** 역할 권한 격자 조회 */
export function getRolePermissions(): Record<ActorRole, string[]> {
  const result: Record<string, string[]> = {};
  for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) {
    result[role] = Array.from(perms);
  }
  return result as Record<ActorRole, string[]>;
}
