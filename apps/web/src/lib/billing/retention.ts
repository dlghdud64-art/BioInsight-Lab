/**
 * §pricing-refresh P3 — 데이터 보존 만료 판정(아카이브 트리거) + 조회 필터
 *
 * 무료 플랜은 데이터 createdAt + 3개월(rolling) 까지만 보존. 그 이전 데이터는 아카이브(soft).
 *   - 트리거(A): 데이터 단위 createdAt < now − 3개월.
 *   - grandfather(C): PRICING_ENFORCE_CUTOFF 이후 가입자만. 미설정/무효 = 아카이브 0(현행 무해, P2 정합).
 *   - 유료(B는 soft archivedAt) = 무제한 보존(판정 false).
 *   - hard delete 0 — 본 모듈은 판정·필터만. 실제 archivedAt 세팅은 P4 cron(soft), 복구는 archivedAt=null.
 */

import { SubscriptionPlan } from "@/lib/plans";

export const RETENTION_MONTHS = 3;

/** 조회 기본 필터 — 아카이브분 숨김(archivedAt null = 노출). P4 list 라우트에서 사용. */
export const NOT_ARCHIVED = { archivedAt: null } as const;

/**
 * 데이터 보존 만료(아카이브 대상) 판정.
 * true = 아카이브 대상. false = 보존(유료·grandfather·env미설정·3개월 이내).
 */
export function isRetentionExpired(params: {
  plan: SubscriptionPlan;
  userCreatedAt: Date; // grandfather 판정(가입일)
  dataCreatedAt: Date; // rolling 3개월(데이터 생성일)
  now?: Date;
}): boolean {
  // env 미설정/무효 = 아카이브 0(현행 무해, §inbound-rfq P5 / P2 패턴 정합).
  const cutoffRaw = process.env.PRICING_ENFORCE_CUTOFF;
  if (!cutoffRaw) return false;
  const cutoff = new Date(cutoffRaw);
  if (Number.isNaN(cutoff.getTime())) return false;

  // grandfather — 시행일 이전 가입자 보존(기존 무료 충격 0).
  if (params.userCreatedAt < cutoff) return false;

  // 유료 = 무제한 보존.
  if (params.plan !== SubscriptionPlan.FREE) return false;

  // rolling 3개월 — 데이터 생성일이 now−3개월보다 오래면 아카이브 대상.
  const now = params.now ?? new Date();
  const threshold = new Date(now);
  threshold.setMonth(threshold.getMonth() - RETENTION_MONTHS);
  return params.dataCreatedAt < threshold;
}
