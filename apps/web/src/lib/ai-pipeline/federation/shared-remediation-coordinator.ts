/**
 * @module shared-remediation-coordinator
 * @description 공동 복구 프로그램 조율
 *
 * 단일 기관, 복수 기관, 연합 전체 범위의 복구 프로그램을
 * 생성·추적·검증하는 조율 모듈.
 */

/** 복구 범위 */
export type RemediationScope =
  | 'SINGLE_INSTITUTION'
  | 'MULTI_INSTITUTION'
  | 'FEDERATION_WIDE';

/** 복구 상태 */
export type RemediationStatus =
  | 'PROPOSED'
  | 'APPROVED'
  | 'IN_PROGRESS'
  | 'VERIFICATION'
  | 'COMPLETED'
  | 'FAILED';

/** 복구 단계 */
export interface RemediationStep {
  /** 단계 번호 */
  stepNumber: number;
  /** 단계 설명 */
  description: string;
  /** 담당 기관 ID */
  assignedTo: string;
  /** 완료 여부 */
  completed: boolean;
  /** 완료 일시 */
  completedAt: Date | null;
}

/** 복구 프로그램 */
export interface RemediationProgram {
  /** 프로그램 고유 ID */
  id: string;
  /** 이상 징후 패밀리 (관련 이상 징후 그룹) */
  anomalyFamily: string;
  /** 복구 범위 */
  scope: RemediationScope;
  /** 영향받는 기관 ID 목록 */
  affectedInstitutions: string[];
  /** 복구 단계 */
  steps: RemediationStep[];
  /** 현재 상태 */
  status: RemediationStatus;
  /** 조율자 기관 ID */
  coordinatorId: string;
  /** 시작 일시 */
  startedAt: Date;
  /** 완료 일시 (미완료 시 null) */
  completedAt: Date | null;
}

/** 대시보드 요약 */
export interface ProgramDashboard {
  /** 전체 프로그램 수 */
  totalPrograms: number;
  /** 상태별 건수 */
  byStatus: Record<RemediationStatus, number>;
  /** 범위별 건수 */
  byScope: Record<RemediationScope, number>;
  /** 활성 프로그램 목록 */
  activePrograms: RemediationProgram[];
}

// ── 인메모리 저장소 ──
const programs: RemediationProgram[] = [];

/**
 * 복구 프로그램을 생성한다.
 *
 * @param params 프로그램 생성 파라미터
 * @returns 생성된 프로그램
 */
export function createProgram(params: {
  id: string;
  anomalyFamily: string;
  scope: RemediationScope;
  affectedInstitutions: string[];
  coordinatorId: string;
  steps: Omit<RemediationStep, 'completed' | 'completedAt'>[];
}): RemediationProgram {
  const existing = programs.find((p) => p.id === params.id);
  if (existing) {
    throw new Error(`이미 존재하는 프로그램 ID: ${params.id}`);
  }

  const program: RemediationProgram = {
    id: params.id,
    anomalyFamily: params.anomalyFamily,
    scope: params.scope,
    affectedInstitutions: [...params.affectedInstitutions],
    steps: params.steps.map((s) => ({
      ...s,
      completed: false,
      completedAt: null,
    })),
    status: 'PROPOSED',
    coordinatorId: params.coordinatorId,
    startedAt: new Date(),
    completedAt: null,
  };

  programs.push(program);
  return cloneProgram(program);
}

/**
 * 프로그램에 기관을 배정한다.
 *
 * @param programId 프로그램 ID
 * @param institutionIds 배정할 기관 ID 목록
 */
export function assignInstitutions(
  programId: string,
  institutionIds: string[],
): RemediationProgram {
  const program = programs.find((p) => p.id === programId);
  if (!program) {
    throw new Error(`존재하지 않는 프로그램: ${programId}`);
  }

  for (const id of institutionIds) {
    if (!program.affectedInstitutions.includes(id)) {
      program.affectedInstitutions.push(id);
    }
  }

  return cloneProgram(program);
}

/**
 * 프로그램 진행 상황을 갱신한다.
 *
 * @param programId 프로그램 ID
 * @param stepNumber 완료된 단계 번호
 * @returns 갱신된 프로그램
 */
export function trackProgress(
  programId: string,
  stepNumber: number,
): RemediationProgram {
  const program = programs.find((p) => p.id === programId);
  if (!program) {
    throw new Error(`존재하지 않는 프로그램: ${programId}`);
  }

  const step = program.steps.find((s) => s.stepNumber === stepNumber);
  if (!step) {
    throw new Error(`존재하지 않는 단계: ${stepNumber}`);
  }

  step.completed = true;
  step.completedAt = new Date();

  // 모든 단계 완료 시 VERIFICATION으로 전환
  const allCompleted = program.steps.every((s) => s.completed);
  if (allCompleted && program.status === 'IN_PROGRESS') {
    program.status = 'VERIFICATION';
  }

  return cloneProgram(program);
}

/**
 * 복구 프로그램을 검증하고 완료 또는 실패로 전환한다.
 *
 * @param programId 프로그램 ID
 * @param verified 검증 통과 여부
 * @returns 갱신된 프로그램
 */
export function verifyRemediation(
  programId: string,
  verified: boolean,
): RemediationProgram {
  const program = programs.find((p) => p.id === programId);
  if (!program) {
    throw new Error(`존재하지 않는 프로그램: ${programId}`);
  }

  if (verified) {
    program.status = 'COMPLETED';
    program.completedAt = new Date();
  } else {
    program.status = 'FAILED';
  }

  return cloneProgram(program);
}

/**
 * 프로그램 상태를 갱신한다.
 *
 * @param programId 프로그램 ID
 * @param status 새 상태
 */
export function updateProgramStatus(
  programId: string,
  status: RemediationStatus,
): RemediationProgram {
  const program = programs.find((p) => p.id === programId);
  if (!program) {
    throw new Error(`존재하지 않는 프로그램: ${programId}`);
  }

  program.status = status;
  if (status === 'COMPLETED') {
    program.completedAt = new Date();
  }

  return cloneProgram(program);
}

/**
 * 프로그램 대시보드를 반환한다.
 */
export function getProgramDashboard(): ProgramDashboard {
  const byStatus: Record<RemediationStatus, number> = {
    PROPOSED: 0,
    APPROVED: 0,
    IN_PROGRESS: 0,
    VERIFICATION: 0,
    COMPLETED: 0,
    FAILED: 0,
  };
  const byScope: Record<RemediationScope, number> = {
    SINGLE_INSTITUTION: 0,
    MULTI_INSTITUTION: 0,
    FEDERATION_WIDE: 0,
  };

  for (const p of programs) {
    byStatus[p.status]++;
    byScope[p.scope]++;
  }

  const activePrograms = programs
    .filter((p) => p.status !== 'COMPLETED' && p.status !== 'FAILED')
    .map(cloneProgram);

  return {
    totalPrograms: programs.length,
    byStatus,
    byScope,
    activePrograms,
  };
}

/** 프로그램 깊은 복사 */
function cloneProgram(p: RemediationProgram): RemediationProgram {
  return {
    ...p,
    affectedInstitutions: [...p.affectedInstitutions],
    steps: p.steps.map((s) => ({ ...s })),
  };
}
