/**
 * @module emergency-authority-charter
 * @description 비상 권한 헌장 — 비상 수준별 권한, 승인 요건, 시간 제한, 에스컬레이션 경로를 정의하고 관리합니다.
 */

/** 비상 수준 */
export type EmergencyLevel =
  | 'LEVEL_1_WATCH'
  | 'LEVEL_2_ALERT'
  | 'LEVEL_3_CRISIS'
  | 'LEVEL_4_CATASTROPHIC';

/** 비상 권한 */
export interface EmergencyAuthority {
  /** 비상 수준 */
  level: EmergencyLevel;
  /** 허가된 조치 목록 */
  authorizedActions: string[];
  /** 필요 승인 수 */
  requiredApprovals: number;
  /** 시간 제한 (분) */
  timeLimit: number;
  /** 에스컬레이션 경로 */
  escalationPath: string[];
}

/** 비상 선언 기록 */
export interface EmergencyDeclaration {
  /** 고유 식별자 */
  id: string;
  /** 현재 비상 수준 */
  level: EmergencyLevel;
  /** 선언 사유 */
  reason: string;
  /** 선언자 */
  declaredBy: string;
  /** 선언 일시 */
  declaredAt: Date;
  /** 해제 일시 */
  resolvedAt: Date | null;
  /** 수준 변경 이력 */
  levelHistory: Array<{ level: EmergencyLevel; changedAt: Date; changedBy: string }>;
}

/** 비상 수준별 기본 권한 정의 */
const defaultAuthorities: Record<EmergencyLevel, EmergencyAuthority> = {
  LEVEL_1_WATCH: {
    level: 'LEVEL_1_WATCH',
    authorizedActions: ['모니터링 강화', '팀 알림 발송', '상황 보고서 작성'],
    requiredApprovals: 0,
    timeLimit: 480,
    escalationPath: ['운영팀장', '기술이사'],
  },
  LEVEL_2_ALERT: {
    level: 'LEVEL_2_ALERT',
    authorizedActions: [
      '긴급 패치 배포',
      '트래픽 제한',
      '백업 시스템 활성화',
      '외부 통보',
    ],
    requiredApprovals: 1,
    timeLimit: 240,
    escalationPath: ['기술이사', 'CTO', 'CEO'],
  },
  LEVEL_3_CRISIS: {
    level: 'LEVEL_3_CRISIS',
    authorizedActions: [
      '서비스 중단',
      '데이터 격리',
      '긴급 예산 집행',
      '외부 전문가 투입',
      '고객 공지',
    ],
    requiredApprovals: 2,
    timeLimit: 120,
    escalationPath: ['CTO', 'CEO', '이사회'],
  },
  LEVEL_4_CATASTROPHIC: {
    level: 'LEVEL_4_CATASTROPHIC',
    authorizedActions: [
      '전면 서비스 중단',
      '재해 복구 절차 발동',
      '법적 대응 개시',
      '규제 기관 보고',
      '전사 비상 동원',
    ],
    requiredApprovals: 3,
    timeLimit: 60,
    escalationPath: ['CEO', '이사회', '법무팀', '규제 당국'],
  },
};

/** 인메모리 비상 선언 저장소 */
const declarationStore: EmergencyDeclaration[] = [];

const levelOrder: Record<EmergencyLevel, number> = {
  LEVEL_1_WATCH: 1,
  LEVEL_2_ALERT: 2,
  LEVEL_3_CRISIS: 3,
  LEVEL_4_CATASTROPHIC: 4,
};

/**
 * 비상 상황을 선언합니다.
 * @param level - 비상 수준
 * @param reason - 선언 사유
 * @param declaredBy - 선언자
 * @returns 비상 선언 기록
 */
export function declareEmergency(
  level: EmergencyLevel,
  reason: string,
  declaredBy: string
): EmergencyDeclaration {
  const declaration: EmergencyDeclaration = {
    id: `em-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    level,
    reason,
    declaredBy,
    declaredAt: new Date(),
    resolvedAt: null,
    levelHistory: [{ level, changedAt: new Date(), changedBy: declaredBy }],
  };
  declarationStore.push(declaration);
  return { ...declaration };
}

/**
 * 비상 수준에 해당하는 권한을 조회합니다.
 * @param level - 비상 수준
 * @returns 비상 권한
 */
export function getEmergencyAuthority(level: EmergencyLevel): EmergencyAuthority {
  return { ...defaultAuthorities[level] };
}

/**
 * 비상 수준을 상향 에스컬레이션합니다.
 * @param declarationId - 비상 선언 ID
 * @param newLevel - 새로운 비상 수준
 * @param changedBy - 변경자
 * @returns 업데이트된 선언 또는 null
 */
export function escalateLevel(
  declarationId: string,
  newLevel: EmergencyLevel,
  changedBy: string
): EmergencyDeclaration | null {
  const declaration = declarationStore.find(
    (d) => d.id === declarationId && d.resolvedAt === null
  );
  if (!declaration) return null;

  if (levelOrder[newLevel] <= levelOrder[declaration.level]) {
    return null; // 에스컬레이션은 상향만 가능
  }

  declaration.level = newLevel;
  declaration.levelHistory.push({
    level: newLevel,
    changedAt: new Date(),
    changedBy,
  });

  return { ...declaration };
}

/**
 * 비상 수준을 하향 디에스컬레이션하거나 해제합니다.
 * @param declarationId - 비상 선언 ID
 * @param newLevel - 새로운 비상 수준 (null이면 해제)
 * @param changedBy - 변경자
 * @returns 업데이트된 선언 또는 null
 */
export function deescalate(
  declarationId: string,
  newLevel: EmergencyLevel | null,
  changedBy: string
): EmergencyDeclaration | null {
  const declaration = declarationStore.find(
    (d) => d.id === declarationId && d.resolvedAt === null
  );
  if (!declaration) return null;

  if (newLevel === null) {
    declaration.resolvedAt = new Date();
    declaration.levelHistory.push({
      level: declaration.level,
      changedAt: new Date(),
      changedBy,
    });
  } else {
    if (levelOrder[newLevel] >= levelOrder[declaration.level]) {
      return null; // 디에스컬레이션은 하향만 가능
    }
    declaration.level = newLevel;
    declaration.levelHistory.push({
      level: newLevel,
      changedAt: new Date(),
      changedBy,
    });
  }

  return { ...declaration };
}

/**
 * 비상 선언 로그를 조회합니다.
 * @param activeOnly - 활성 비상만 조회할지 여부
 * @returns 비상 선언 목록
 */
export function getEmergencyLog(activeOnly: boolean = false): EmergencyDeclaration[] {
  return declarationStore
    .filter((d) => (activeOnly ? d.resolvedAt === null : true))
    .map((d) => ({
      ...d,
      levelHistory: [...d.levelHistory],
    }));
}
