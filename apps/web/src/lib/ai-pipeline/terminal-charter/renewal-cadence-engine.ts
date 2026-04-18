/**
 * @module renewal-cadence-engine
 * @description 갱신 주기 엔진 — 각 항목 유형별 기본 주기, 최소 주기, 실패 시 에스컬레이션 규칙을 관리한다.
 * 만기 초과 항목을 식별하고 에스컬레이션 처리를 수행한다.
 */

import type { RenewalFrequency } from "./perpetual-renewal-loop";

/** 주기 규칙 */
export interface CadenceRule {
  /** 항목 유형 */
  itemType: string;
  /** 기본 갱신 주기 */
  defaultFrequency: RenewalFrequency;
  /** 최소 갱신 주기 (이보다 느리게 설정 불가) */
  minimumFrequency: RenewalFrequency;
  /** 실패 시 에스컬레이션 주기 */
  escalationOnFailure: RenewalFrequency;
}

/** 주기 스케줄 */
export interface CadenceSchedule {
  /** 항목 ID */
  itemId: string;
  /** 다음 만기 일시 */
  nextDue: Date;
  /** 만기 초과 여부 */
  overdue: boolean;
  /** 만기 초과 일수 */
  overdueByDays: number;
}

/** 주기 통계 */
export interface CadenceStats {
  /** 전체 규칙 수 */
  totalRules: number;
  /** 전체 스케줄 수 */
  totalSchedules: number;
  /** 만기 초과 항목 수 */
  overdueCount: number;
  /** 에스컬레이션 대상 수 */
  escalatedCount: number;
}

/** 주기별 우선순위 (작을수록 빈번) */
const FREQUENCY_PRIORITY: Record<RenewalFrequency, number> = {
  MONTHLY: 1,
  QUARTERLY: 2,
  SEMI_ANNUAL: 3,
  ANNUAL: 4,
};

/** 주기별 일수 */
const FREQUENCY_DAYS: Record<RenewalFrequency, number> = {
  MONTHLY: 30,
  QUARTERLY: 90,
  SEMI_ANNUAL: 180,
  ANNUAL: 365,
};

/** 인메모리 규칙 저장소 */
const cadenceRules: Map<string, CadenceRule> = new Map();

/** 인메모리 스케줄 저장소 */
const cadenceSchedules: Map<string, CadenceSchedule> = new Map();

/** 에스컬레이션 기록 */
const escalationLog: Array<{
  itemId: string;
  escalatedAt: Date;
  fromFrequency: RenewalFrequency;
  toFrequency: RenewalFrequency;
}> = [];

/**
 * 항목의 갱신 주기를 계산하고 스케줄에 등록한다.
 * @param itemId - 항목 ID
 * @param itemType - 항목 유형 (규칙 조회용)
 * @param lastReviewedAt - 마지막 검토 일시 (없으면 현재 시각 사용)
 * @returns 계산된 스케줄
 */
export function computeCadence(
  itemId: string,
  itemType: string,
  lastReviewedAt: Date | null
): CadenceSchedule {
  const rule = cadenceRules.get(itemType);
  const frequency = rule ? rule.defaultFrequency : "QUARTERLY";
  const days = FREQUENCY_DAYS[frequency];
  const baseDate = lastReviewedAt ?? new Date();
  const nextDue = new Date(baseDate.getTime() + days * 86400000);
  const now = new Date();
  const overdueMs = now.getTime() - nextDue.getTime();

  const schedule: CadenceSchedule = {
    itemId,
    nextDue,
    overdue: overdueMs > 0,
    overdueByDays: overdueMs > 0 ? Math.floor(overdueMs / 86400000) : 0,
  };

  cadenceSchedules.set(itemId, schedule);
  return schedule;
}

/**
 * 만기 초과 항목을 반환한다.
 * @returns 만기 초과 스케줄 배열
 */
export function getOverdueItems(): CadenceSchedule[] {
  return Array.from(cadenceSchedules.values()).filter((s) => s.overdue);
}

/**
 * 만기 초과 항목을 에스컬레이션한다.
 * 해당 항목 유형의 주기를 escalationOnFailure로 변경한다.
 * @param itemId - 항목 ID
 * @param itemType - 항목 유형
 * @returns 에스컬레이션 성공 여부
 */
export function escalateOverdue(itemId: string, itemType: string): boolean {
  const rule = cadenceRules.get(itemType);
  if (!rule) return false;

  const schedule = cadenceSchedules.get(itemId);
  if (!schedule || !schedule.overdue) return false;

  const newDays = FREQUENCY_DAYS[rule.escalationOnFailure];
  const now = new Date();
  schedule.nextDue = new Date(now.getTime() + newDays * 86400000);
  schedule.overdue = false;
  schedule.overdueByDays = 0;

  escalationLog.push({
    itemId,
    escalatedAt: now,
    fromFrequency: rule.defaultFrequency,
    toFrequency: rule.escalationOnFailure,
  });

  return true;
}

/**
 * 주기 통계를 반환한다.
 * @returns 주기 통계 객체
 */
export function getCadenceStats(): CadenceStats {
  const schedules = Array.from(cadenceSchedules.values());
  return {
    totalRules: cadenceRules.size,
    totalSchedules: schedules.length,
    overdueCount: schedules.filter((s) => s.overdue).length,
    escalatedCount: escalationLog.length,
  };
}

/**
 * 주기 규칙을 등록한다.
 * @param rule - 주기 규칙
 * @returns 등록된 규칙
 */
export function registerCadenceRule(rule: CadenceRule): CadenceRule {
  // 최소 주기 검증: defaultFrequency가 minimumFrequency보다 느려선 안 됨
  if (
    FREQUENCY_PRIORITY[rule.defaultFrequency] >
    FREQUENCY_PRIORITY[rule.minimumFrequency]
  ) {
    rule.defaultFrequency = rule.minimumFrequency;
  }

  cadenceRules.set(rule.itemType, rule);
  return rule;
}
