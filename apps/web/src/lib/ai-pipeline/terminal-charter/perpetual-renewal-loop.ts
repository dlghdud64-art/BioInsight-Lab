/**
 * @module perpetual-renewal-loop
 * @description 영구 갱신 루프 — 신뢰 자산, 예외, 위임 등은 정기적으로 갱신해야 하며,
 * 갱신되지 않은 항목은 자동 강등(downgrade) 또는 일몰(sunset) 처리된다.
 * "무음 지속(Silent Continuation)" 원칙을 위반할 수 없다.
 */

/** 갱신 주기 */
export type RenewalFrequency =
  | "MONTHLY"
  | "QUARTERLY"
  | "SEMI_ANNUAL"
  | "ANNUAL";

/** 갱신 결과 */
export type RenewalOutcome = "RENEW_AS_IS" | "DOWNGRADE" | "SUNSET";

/** 갱신 항목 상태 */
export type RenewalStatus = "ACTIVE" | "DOWNGRADED" | "SUNSET" | "PENDING_REVIEW";

/** 갱신 항목 */
export interface RenewalItem {
  /** 항목 고유 ID */
  id: string;
  /** 항목 유형 */
  type: string;
  /** 설명 */
  description: string;
  /** 갱신 주기 */
  frequency: RenewalFrequency;
  /** 마지막 검토 일시 */
  lastReviewedAt: Date | null;
  /** 다음 만기 일시 */
  nextDueAt: Date;
  /** 현재 상태 */
  status: RenewalStatus;
}

/** 갱신 실행 기록 */
export interface RenewalExecution {
  /** 대상 항목 ID */
  itemId: string;
  /** 실행 일시 */
  executedAt: Date;
  /** 결과 */
  outcome: RenewalOutcome;
  /** 검토자 */
  reviewedBy: string;
  /** 사유 */
  reason: string;
}

/** 인메모리 갱신 항목 저장소 */
const renewalItems: Map<string, RenewalItem> = new Map();

/** 갱신 실행 이력 */
const executionLog: RenewalExecution[] = [];

/** 주기별 일수 매핑 */
const FREQUENCY_DAYS: Record<RenewalFrequency, number> = {
  MONTHLY: 30,
  QUARTERLY: 90,
  SEMI_ANNUAL: 180,
  ANNUAL: 365,
};

/**
 * 갱신 항목을 등록한다.
 * @param type - 항목 유형
 * @param description - 설명
 * @param frequency - 갱신 주기
 * @returns 등록된 갱신 항목
 */
export function scheduleRenewal(
  type: string,
  description: string,
  frequency: RenewalFrequency
): RenewalItem {
  const now = new Date();
  const item: RenewalItem = {
    id: `RENEW-${Date.now()}-${renewalItems.size}`,
    type,
    description,
    frequency,
    lastReviewedAt: null,
    nextDueAt: new Date(now.getTime() + FREQUENCY_DAYS[frequency] * 86400000),
    status: "PENDING_REVIEW",
  };

  renewalItems.set(item.id, item);
  return { ...item };
}

/**
 * 갱신을 실행한다.
 * @param itemId - 대상 항목 ID
 * @param outcome - 갱신 결과
 * @param reviewedBy - 검토자
 * @param reason - 사유
 * @returns 실행 성공 여부
 */
export function executeRenewal(
  itemId: string,
  outcome: RenewalOutcome,
  reviewedBy: string,
  reason: string
): boolean {
  const item = renewalItems.get(itemId);
  if (!item) return false;

  const now = new Date();

  switch (outcome) {
    case "RENEW_AS_IS":
      item.status = "ACTIVE";
      item.lastReviewedAt = now;
      item.nextDueAt = new Date(
        now.getTime() + FREQUENCY_DAYS[item.frequency] * 86400000
      );
      break;
    case "DOWNGRADE":
      item.status = "DOWNGRADED";
      item.lastReviewedAt = now;
      item.nextDueAt = new Date(
        now.getTime() + FREQUENCY_DAYS[item.frequency] * 86400000
      );
      break;
    case "SUNSET":
      item.status = "SUNSET";
      item.lastReviewedAt = now;
      break;
  }

  executionLog.push({
    itemId,
    executedAt: now,
    outcome,
    reviewedBy,
    reason,
  });

  return true;
}

/**
 * 만료된 항목을 자동 강등한다.
 * 무음 지속(Silent Continuation) 금지 — 만기 초과 항목은 자동 DOWNGRADE.
 * @returns 강등된 항목 수
 */
export function autoDowngradeExpired(): number {
  const now = new Date();
  let downgraded = 0;

  renewalItems.forEach((item) => {
    if (
      item.status === "ACTIVE" &&
      item.nextDueAt.getTime() < now.getTime()
    ) {
      item.status = "DOWNGRADED";
      executionLog.push({
        itemId: item.id,
        executedAt: now,
        outcome: "DOWNGRADE",
        reviewedBy: "SYSTEM_AUTO",
        reason: "갱신 만기 초과 — 무음 지속 금지 정책에 의한 자동 강등",
      });
      downgraded++;
    }
  });

  return downgraded;
}

/**
 * 일몰 후보 항목을 반환한다.
 * 이미 DOWNGRADED 상태이며 다음 만기도 초과한 항목들.
 * @returns 일몰 후보 배열
 */
export function getSunsetCandidates(): RenewalItem[] {
  const now = new Date();
  return Array.from(renewalItems.values()).filter(
    (item) =>
      item.status === "DOWNGRADED" &&
      item.nextDueAt.getTime() < now.getTime()
  );
}

/**
 * 갱신 대기열을 반환한다.
 * 만기 순으로 정렬된 활성 갱신 항목 목록.
 * @returns 갱신 대기 항목 배열
 */
export function getRenewalQueue(): RenewalItem[] {
  return Array.from(renewalItems.values())
    .filter((item) => item.status !== "SUNSET")
    .sort((a, b) => a.nextDueAt.getTime() - b.nextDueAt.getTime());
}

/**
 * 갱신 실행 이력을 반환한다.
 * @returns 실행 이력 배열
 */
export function getRenewalExecutionLog(): RenewalExecution[] {
  return [...executionLog];
}
