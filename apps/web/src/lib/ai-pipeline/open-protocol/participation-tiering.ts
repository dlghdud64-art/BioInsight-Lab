/**
 * @module participation-tiering
 * @description 참여 계층화
 *
 * 보증 생태계 참여자의 계층(Tier)을 관리한다.
 * 각 계층별 능력(Capabilities)을 정의하고, 성숙도 기반으로 승급/강등을 처리한다.
 * 저성숙도 참여자는 ASSERTION_ISSUER 계층 진입이 차단된다.
 */

/** 참여자 계층 */
export type ParticipantTier =
  | "OBSERVER"
  | "CONSUMER"
  | "VERIFIED_PARTICIPANT"
  | "ASSERTION_ISSUER"
  | "PROTOCOL_STEWARD";

/** 계층별 능력 */
export interface TierCapabilities {
  /** 계층 */
  tier: ParticipantTier;
  /** 읽기 가능 여부 */
  canRead: boolean;
  /** 발행 가능 여부 */
  canIssue: boolean;
  /** 철회 가능 여부 */
  canRevoke: boolean;
  /** 거버넌스 참여 가능 여부 */
  canGovern: boolean;
  /** 프로토콜 수정 가능 여부 */
  canAmendProtocol: boolean;
}

/** 참여자 프로필 */
export interface ParticipantProfile {
  /** 참여자 고유 식별자 */
  id: string;
  /** 참여자 이름 */
  name: string;
  /** 현재 계층 */
  tier: ParticipantTier;
  /** 가입 시각 */
  joinedAt: number;
  /** 성숙도 점수 (0~100) */
  maturityScore: number;
  /** 발행 횟수 */
  issuanceCount: number;
  /** 수신된 이의 제기 횟수 */
  contestationsReceived: number;
}

/** 계층별 능력 맵 */
const TIER_CAPABILITIES: Record<ParticipantTier, TierCapabilities> = {
  OBSERVER: {
    tier: "OBSERVER",
    canRead: true,
    canIssue: false,
    canRevoke: false,
    canGovern: false,
    canAmendProtocol: false,
  },
  CONSUMER: {
    tier: "CONSUMER",
    canRead: true,
    canIssue: false,
    canRevoke: false,
    canGovern: false,
    canAmendProtocol: false,
  },
  VERIFIED_PARTICIPANT: {
    tier: "VERIFIED_PARTICIPANT",
    canRead: true,
    canIssue: false,
    canRevoke: true,
    canGovern: false,
    canAmendProtocol: false,
  },
  ASSERTION_ISSUER: {
    tier: "ASSERTION_ISSUER",
    canRead: true,
    canIssue: true,
    canRevoke: true,
    canGovern: true,
    canAmendProtocol: false,
  },
  PROTOCOL_STEWARD: {
    tier: "PROTOCOL_STEWARD",
    canRead: true,
    canIssue: true,
    canRevoke: true,
    canGovern: true,
    canAmendProtocol: true,
  },
};

/** ASSERTION_ISSUER 진입을 위한 최소 성숙도 점수 */
const ISSUER_MIN_MATURITY = 70;

// --- 인메모리 저장소 ---
const participantStore: ParticipantProfile[] = [];

/**
 * 참여자에게 계층을 배정한다.
 * @param id - 참여자 ID
 * @param name - 참여자 이름
 * @param tier - 배정할 계층
 * @param maturityScore - 성숙도 점수
 * @returns 생성된 참여자 프로필 또는 null (저성숙도로 ISSUER 차단 시)
 */
export function assignTier(
  id: string,
  name: string,
  tier: ParticipantTier,
  maturityScore: number
): ParticipantProfile | null {
  // 저성숙도 참여자는 ASSERTION_ISSUER 이상 진입 차단
  if (
    (tier === "ASSERTION_ISSUER" || tier === "PROTOCOL_STEWARD") &&
    maturityScore < ISSUER_MIN_MATURITY
  ) {
    return null;
  }

  const profile: ParticipantProfile = {
    id,
    name,
    tier,
    joinedAt: Date.now(),
    maturityScore,
    issuanceCount: 0,
    contestationsReceived: 0,
  };
  participantStore.push(profile);
  return profile;
}

/**
 * 참여자를 상위 계층으로 승급시킨다.
 * @param participantId - 참여자 ID
 * @param newTier - 승급 대상 계층
 * @returns 업데이트된 프로필 또는 null
 */
export function upgradeTier(
  participantId: string,
  newTier: ParticipantTier
): ParticipantProfile | null {
  const profile = participantStore.find((p) => p.id === participantId);
  if (!profile) return null;

  // ASSERTION_ISSUER 이상 승급 시 성숙도 검증
  if (
    (newTier === "ASSERTION_ISSUER" || newTier === "PROTOCOL_STEWARD") &&
    profile.maturityScore < ISSUER_MIN_MATURITY
  ) {
    return null;
  }

  profile.tier = newTier;
  return profile;
}

/**
 * 참여자를 하위 계층으로 강등시킨다.
 * @param participantId - 참여자 ID
 * @param newTier - 강등 대상 계층
 * @returns 업데이트된 프로필 또는 null
 */
export function downgradeTier(
  participantId: string,
  newTier: ParticipantTier
): ParticipantProfile | null {
  const profile = participantStore.find((p) => p.id === participantId);
  if (!profile) return null;
  profile.tier = newTier;
  return profile;
}

/**
 * 계층별 능력을 반환한다.
 * @param tier - 조회할 계층
 * @returns 계층별 능력 정의
 */
export function getTierCapabilities(tier: ParticipantTier): TierCapabilities {
  return TIER_CAPABILITIES[tier];
}

/**
 * 특정 계층의 참여자가 해당 작업을 수행할 수 있는지 검증한다.
 * @param participantId - 참여자 ID
 * @param action - 수행하려는 작업 ("read" | "issue" | "revoke" | "govern" | "amendProtocol")
 * @returns 허용 여부 및 사유
 */
export function validateTierAction(
  participantId: string,
  action: "read" | "issue" | "revoke" | "govern" | "amendProtocol"
): { allowed: boolean; reason: string } {
  const profile = participantStore.find((p) => p.id === participantId);
  if (!profile) {
    return { allowed: false, reason: "참여자를 찾을 수 없습니다." };
  }

  const caps = TIER_CAPABILITIES[profile.tier];
  const actionMap: Record<string, boolean> = {
    read: caps.canRead,
    issue: caps.canIssue,
    revoke: caps.canRevoke,
    govern: caps.canGovern,
    amendProtocol: caps.canAmendProtocol,
  };

  const allowed = actionMap[action] ?? false;
  return {
    allowed,
    reason: allowed
      ? `${profile.tier} 계층은 '${action}' 작업이 허용됩니다.`
      : `${profile.tier} 계층은 '${action}' 작업이 허용되지 않습니다.`,
  };
}
