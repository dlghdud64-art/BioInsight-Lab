/**
 * Work Queue Scoring Engine
 *
 * 다차원 우선순위 스코어링: operational_impact_score + urgency_score + approval_boost
 * 대시보드가 '실제 운영 우선순위 큐'로 동작하도록 도메인별 영향도와 시간 민감도를 수치화합니다.
 *
 * 모든 함수는 순수 함수(pure function)로 DB 의존성 없음.
 */

import { COMPARE_SUBSTATUS_DEFS } from "./compare-queue-semantics";
import { OPS_SUBSTATUS_DEFS } from "./ops-queue-semantics";

// ── Types ──

export interface ScoredItem {
  type: string;
  substatus: string | null;
  approvalStatus: string;
  priority: string;
  metadata: Record<string, unknown>;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface ScoreResult {
  impactScore: number;
  urgencyScore: number;
  approvalBoost: number;
  totalScore: number;
  urgencyReason: string | null;
}

// ── A. Operational Impact Score (0~100) ──

/**
 * 도메인별 기본 운영 영향도 점수.
 *
 * substatus 기반 매핑 — type만으로 부족한 경우 substatus로 세분화.
 * 점수가 높을수록 운영 중단/손실 위험이 큽니다.
 */
const IMPACT_BASE_SCORE: Record<string, number> = {
  // ═══ 견적 (낮은 위험) ═══
  quote_draft_generated: 40,
  quote_draft_approved: 35,
  vendor_email_generated: 45,
  vendor_email_approved: 40,
  email_sent: 30,

  // ═══ 주문 (중간~높은 위험) ═══
  vendor_reply_received: 60,
  vendor_response_parsed: 60,
  followup_draft_generated: 65,
  followup_approved: 60,
  followup_sent: 50,
  status_change_proposed: 70,

  // ═══ 재고 (높은 위험) ═══
  restock_suggested: 75,
  restock_approved: 70,
  restock_ordered: 55,
  expiry_alert_created: 80,

  // ═══ 비교 도메인 ═══
  compare_decision_pending: 55,
  compare_inquiry_followup: 50,
  compare_quote_in_progress: 40,
  compare_decided: 25,
  compare_reopened: 60,

  // ═══ 공통 장애 ═══
  execution_failed: 80,
  budget_insufficient: 85,
  permission_denied: 85,

  // ═══ 구매 ═══
  purchase_request_created: 50,
};

/**
 * type 기반 fallback (substatus가 매핑되지 않을 때)
 */
const IMPACT_TYPE_FALLBACK: Record<string, number> = {
  QUOTE_DRAFT: 40,
  VENDOR_EMAIL_DRAFT: 45,
  VENDOR_RESPONSE_PARSED: 60,
  FOLLOWUP_DRAFT: 65,
  STATUS_CHANGE_SUGGEST: 70,
  REORDER_SUGGESTION: 75,
  EXPIRY_ALERT: 80,
  COMPARE_DECISION: 55,
};

/**
 * 운영 영향도 점수 계산
 *
 * Base Score + metadata 가감 규칙:
 * - estimatedDepletionDays <= 3 → +15
 * - estimatedDepletionDays <= 7 → +10
 * - urgency === "HIGH" → +5
 * - noAlternative === true → +10
 */
export function computeImpactScore(item: ScoredItem): number {
  // Base score
  let score = 50; // 기본 fallback
  if (item.substatus && IMPACT_BASE_SCORE[item.substatus] !== undefined) {
    score = IMPACT_BASE_SCORE[item.substatus];
  } else if (IMPACT_TYPE_FALLBACK[item.type] !== undefined) {
    score = IMPACT_TYPE_FALLBACK[item.type];
  }

  // Metadata 가감
  const meta = item.metadata || {};
  const depletionDays = typeof meta.estimatedDepletionDays === "number"
    ? meta.estimatedDepletionDays
    : null;

  if (depletionDays !== null) {
    if (depletionDays <= 3) {
      score += 15;
    } else if (depletionDays <= 7) {
      score += 10;
    }
  }

  if (meta.urgency === "HIGH") {
    score += 5;
  }

  if (meta.noAlternative === true) {
    score += 10;
  }

  return Math.min(score, 100);
}

// ── B. Urgency Score (0~50) ──

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * 시간 민감도 점수 계산
 *
 * - 소진 예상일: 30 - min(days, 30) (max 30)
 * - 벤더 회신 지연: days * 2 (max 20)
 * - 결재 대기 시간: days * 3 (max 15, PENDING만)
 * - 납기 임박: 7일 이내 → +10
 */
export function computeUrgencyScore(item: ScoredItem): number {
  const now = Date.now();
  const meta = item.metadata || {};
  let score = 0;

  // 소진 예상일
  const runoutDays = typeof meta.projectedRunoutDays === "number"
    ? meta.projectedRunoutDays
    : (typeof meta.estimatedDepletionDays === "number" ? meta.estimatedDepletionDays : null);

  if (runoutDays !== null && runoutDays >= 0) {
    score += 30 - Math.min(runoutDays, 30);
  }

  // 비교 판정 지연 — substatus별 SLA 에스컬레이션
  if (item.substatus) {
    const compareDef = COMPARE_SUBSTATUS_DEFS[item.substatus];
    if (compareDef && !compareDef.isTerminal) {
      const createdTime = new Date(item.createdAt).getTime();
      const ageDays = Math.floor((now - createdTime) / MS_PER_DAY);
      if (compareDef.slaWarningDays > 0 && ageDays >= compareDef.slaWarningDays) {
        score += compareDef.scoringBoostOnBreach;
      } else if (ageDays >= 3) {
        score += 10;
      }
    }
  }

  // 운영 SLA 에스컬레이션
  if (item.substatus) {
    const opsDef = OPS_SUBSTATUS_DEFS[item.substatus];
    if (opsDef && !opsDef.isTerminal) {
      const createdTime = new Date(item.createdAt).getTime();
      const ageDays = Math.floor((now - createdTime) / MS_PER_DAY);
      if (opsDef.slaWarningDays > 0 && ageDays >= opsDef.slaWarningDays) {
        score += opsDef.scoringBoostOnBreach;
      }
    }
  }

  // 벤더 회신 지연 (updatedAt 기준)
  const isWaitingResponse = item.substatus === "email_sent" ||
    item.substatus === "followup_sent" ||
    item.substatus === "restock_ordered";

  if (isWaitingResponse) {
    const updatedTime = new Date(item.updatedAt).getTime();
    const delayDays = Math.floor((now - updatedTime) / MS_PER_DAY);
    score += Math.min(delayDays * 2, 20);
  }

  // 결재 대기 시간
  if (item.approvalStatus === "PENDING") {
    const createdTime = new Date(item.createdAt).getTime();
    const pendingDays = Math.floor((now - createdTime) / MS_PER_DAY);
    score += Math.min(pendingDays * 3, 15);
  }

  // 납기 임박
  const deliveryDate = meta.deliveryDate || meta.suggestedDeliveryDate;
  if (typeof deliveryDate === "string") {
    const daysUntilDelivery = Math.floor(
      (new Date(deliveryDate).getTime() - now) / MS_PER_DAY
    );
    if (daysUntilDelivery >= 0 && daysUntilDelivery <= 7) {
      score += 10;
    }
  }

  // 유효기한 임박
  const expiryDate = meta.expiryDate || meta.nearestExpiry;
  if (typeof expiryDate === "string") {
    const daysUntilExpiry = Math.floor(
      (new Date(expiryDate).getTime() - now) / MS_PER_DAY
    );
    if (daysUntilExpiry >= 0 && daysUntilExpiry <= 30) {
      score += 30 - daysUntilExpiry;
    }
  }

  return Math.min(score, 50);
}

// ── C. Approval Boost (0~15) ──

/**
 * 승인 병목 = 운영 병목인 경우 우선순위 강제 상승
 *
 * - 외부 발송 직전(VENDOR_EMAIL_DRAFT, FOLLOWUP_DRAFT): +15
 * - 구매/재발주/상태변경(REORDER_SUGGESTION, STATUS_CHANGE_SUGGEST): +10
 * - 기타 PENDING: +5
 */
export function computeApprovalBoost(item: ScoredItem): number {
  if (item.approvalStatus !== "PENDING") return 0;

  const highBoostTypes = new Set(["VENDOR_EMAIL_DRAFT", "FOLLOWUP_DRAFT"]);
  const medBoostTypes = new Set(["REORDER_SUGGESTION", "STATUS_CHANGE_SUGGEST"]);

  if (highBoostTypes.has(item.type)) return 15;
  if (medBoostTypes.has(item.type)) return 10;
  return 5;
}

// ── D. Total Score ──

/**
 * 종합 스코어 계산
 */
export function computeTotalScore(item: ScoredItem): ScoreResult {
  const impactScore = computeImpactScore(item);
  const urgencyScore = computeUrgencyScore(item);
  const approvalBoost = computeApprovalBoost(item);
  const totalScore = impactScore + urgencyScore + approvalBoost;
  const urgencyReason = getUrgencyReason(item);

  return { impactScore, urgencyScore, approvalBoost, totalScore, urgencyReason };
}

// ── E. Urgency Reason (카드 마이크로카피) ──

/**
 * "왜 지금 먼저 봐야 하는지" 1줄 문구 생성
 *
 * 우선순위별로 가장 임팩트가 큰 이유 하나만 반환.
 */
export function getUrgencyReason(item: ScoredItem): string | null {
  const now = Date.now();
  const meta = item.metadata || {};

  // 1. 재고 소진 예상
  const runoutDays = typeof meta.projectedRunoutDays === "number"
    ? meta.projectedRunoutDays
    : (typeof meta.estimatedDepletionDays === "number" ? meta.estimatedDepletionDays : null);

  if (runoutDays !== null && runoutDays <= 14) {
    return `소진 예상 ${runoutDays}일`;
  }

  // 2. 유효기한 임박
  const expiryDate = meta.expiryDate || meta.nearestExpiry;
  if (typeof expiryDate === "string") {
    const daysUntilExpiry = Math.floor(
      (new Date(expiryDate).getTime() - now) / MS_PER_DAY
    );
    if (daysUntilExpiry >= 0 && daysUntilExpiry <= 30) {
      return `유효기한 D-${daysUntilExpiry}`;
    }
  }

  // 3. 예산 부족
  if (item.substatus === "budget_insufficient") {
    return "예산 초과";
  }

  // 4. 권한 부족
  if (item.substatus === "permission_denied") {
    return "권한 부족";
  }

  // 5. 실행 실패
  if (item.substatus === "execution_failed") {
    return "실행 실패";
  }

  // 6. 납기 임박
  const deliveryDate = meta.deliveryDate || meta.suggestedDeliveryDate;
  if (typeof deliveryDate === "string") {
    const daysUntilDelivery = Math.floor(
      (new Date(deliveryDate).getTime() - now) / MS_PER_DAY
    );
    if (daysUntilDelivery >= 0 && daysUntilDelivery <= 7) {
      return `납기 D-${daysUntilDelivery}`;
    }
  }

  // 7. 벤더 회신 지연
  const isWaiting = item.substatus === "email_sent" ||
    item.substatus === "followup_sent" ||
    item.substatus === "restock_ordered";

  if (isWaiting) {
    const updatedTime = new Date(item.updatedAt).getTime();
    const delayDays = Math.floor((now - updatedTime) / MS_PER_DAY);
    if (delayDays >= 2) {
      return `벤더 회신 ${delayDays}일 지연`;
    }
  }

  // 8. 비교 판정 지연 — SLA 에스컬레이션 메시지
  if (item.substatus) {
    const compareDef = COMPARE_SUBSTATUS_DEFS[item.substatus];
    if (compareDef && !compareDef.isTerminal) {
      const createdTime = new Date(item.createdAt).getTime();
      const ageDays = Math.floor((now - createdTime) / MS_PER_DAY);
      if (compareDef.staleDays > 0 && ageDays >= compareDef.staleDays) {
        return `비교 ${ageDays}일 경과 — 장기 미처리`;
      }
      if (compareDef.slaWarningDays > 0 && ageDays >= compareDef.slaWarningDays) {
        return compareDef.escalationMeaning;
      }
      if (ageDays >= 3) {
        return `비교 판정 ${ageDays}일 대기`;
      }
    }
  }

  // 9. 운영 SLA 에스컬레이션 메시지
  if (item.substatus) {
    const opsDef = OPS_SUBSTATUS_DEFS[item.substatus];
    if (opsDef && !opsDef.isTerminal) {
      const createdTime = new Date(item.createdAt).getTime();
      const ageDays = Math.floor((now - createdTime) / MS_PER_DAY);
      if (opsDef.staleDays > 0 && ageDays >= opsDef.staleDays) {
        return `${opsDef.label} ${ageDays}일 경과 — 장기 미처리`;
      }
      if (opsDef.slaWarningDays > 0 && ageDays >= opsDef.slaWarningDays) {
        return opsDef.escalationMeaning;
      }
    }
  }

  // 10. 승인 대기 지연
  if (item.approvalStatus === "PENDING") {
    const createdTime = new Date(item.createdAt).getTime();
    const pendingDays = Math.floor((now - createdTime) / MS_PER_DAY);
    if (pendingDays >= 2) {
      return `승인 대기 ${pendingDays}일`;
    }
  }

  return null;
}
