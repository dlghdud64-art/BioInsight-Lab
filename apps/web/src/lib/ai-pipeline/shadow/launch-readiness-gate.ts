/**
 * Launch Readiness Gate & Freeze Window Validator
 *
 * 런칭 전 필수 조건 검증 및 배포 동결 기간 관리
 */

import type { LifecycleState } from "./rollout-state-machine";

// ── Launch Readiness ──

export interface ReadinessCheckItem {
  id: string;
  category: "OPERATIONAL" | "TECHNICAL" | "PROCESS";
  name: string;
  description: string;
  passed: boolean;
  blockerIfFailed: boolean;
  details?: string;
}

export interface LaunchReadinessResult {
  documentType: string;
  targetStage: LifecycleState;
  checkedAt: string;
  overallReady: boolean;
  checks: ReadinessCheckItem[];
  blockers: string[];
  warnings: string[];
}

/**
 * 런칭 준비 상태 검증 — 승격 전 필수 게이트
 */
export function evaluateLaunchReadiness(params: {
  documentType: string;
  targetStage: LifecycleState;
  hasRunbook: boolean;
  hasOpsOwner: boolean;
  reviewQueueCapacity: number; // 0~100%
  reviewQueueBacklog: number;
  rollbackDrillCompleted: boolean;
  lastRollbackDrillDate: Date | null;
  oncallAssigned: boolean;
  certificationPassed: boolean;
  monitoringDashboardReady: boolean;
  alertRoutingConfigured: boolean;
}): LaunchReadinessResult {
  const checks: ReadinessCheckItem[] = [];
  const now = new Date();

  // ── Operational Checks ──
  checks.push({
    id: "LR_001",
    category: "OPERATIONAL",
    name: "Ops Owner 지정",
    description: "해당 DocType의 운영 책임자가 지정되어 있어야 합니다",
    passed: params.hasOpsOwner,
    blockerIfFailed: true,
  });

  checks.push({
    id: "LR_002",
    category: "OPERATIONAL",
    name: "On-call 배정",
    description: "On-call 엔지니어가 배정되어 있어야 합니다",
    passed: params.oncallAssigned,
    blockerIfFailed: true,
  });

  checks.push({
    id: "LR_003",
    category: "OPERATIONAL",
    name: "런북 준비",
    description: "해당 DocType의 운영 런북이 작성되어 있어야 합니다",
    passed: params.hasRunbook,
    blockerIfFailed: true,
  });

  // ── Technical Checks ──
  checks.push({
    id: "LR_004",
    category: "TECHNICAL",
    name: "Certification 통과",
    description: "승격 전 certification이 PASS 또는 PASS_WITH_WARNINGS여야 합니다",
    passed: params.certificationPassed,
    blockerIfFailed: true,
  });

  checks.push({
    id: "LR_005",
    category: "TECHNICAL",
    name: "모니터링 대시보드",
    description: "실시간 모니터링 대시보드가 구성되어 있어야 합니다",
    passed: params.monitoringDashboardReady,
    blockerIfFailed: true,
  });

  checks.push({
    id: "LR_006",
    category: "TECHNICAL",
    name: "Alert Routing 구성",
    description: "알림 라우팅이 SEV0~SEV3 모두 구성되어 있어야 합니다",
    passed: params.alertRoutingConfigured,
    blockerIfFailed: true,
  });

  // ── Process Checks ──
  checks.push({
    id: "LR_007",
    category: "PROCESS",
    name: "Review Queue 용량",
    description: "리뷰 큐 용량이 70% 이하여야 합니다",
    passed: params.reviewQueueCapacity <= 70,
    blockerIfFailed: params.targetStage !== "ACTIVE_5", // ACTIVE_5는 볼륨 작으므로 warning만
    details: `현재 ${params.reviewQueueCapacity}% 사용 중`,
  });

  checks.push({
    id: "LR_008",
    category: "PROCESS",
    name: "Review Backlog",
    description: "미처리 리뷰 백로그가 50건 이하여야 합니다",
    passed: params.reviewQueueBacklog <= 50,
    blockerIfFailed: false,
    details: `현재 ${params.reviewQueueBacklog}건 대기`,
  });

  checks.push({
    id: "LR_009",
    category: "PROCESS",
    name: "Rollback Drill 완료",
    description: "최근 30일 이내 롤백 드릴이 완료되어야 합니다",
    passed: params.rollbackDrillCompleted && params.lastRollbackDrillDate
      ? (now.getTime() - params.lastRollbackDrillDate.getTime()) <= 30 * 24 * 3600_000
      : false,
    blockerIfFailed: params.targetStage === "ACTIVE_50" || params.targetStage === "ACTIVE_100",
    details: params.lastRollbackDrillDate
      ? `최근 드릴: ${params.lastRollbackDrillDate.toISOString().slice(0, 10)}`
      : "드릴 미실시",
  });

  const blockers = checks.filter((c) => !c.passed && c.blockerIfFailed).map((c) => c.name);
  const warnings = checks.filter((c) => !c.passed && !c.blockerIfFailed).map((c) => c.name);

  return {
    documentType: params.documentType,
    targetStage: params.targetStage,
    checkedAt: now.toISOString(),
    overallReady: blockers.length === 0,
    checks,
    blockers,
    warnings,
  };
}

// ── Freeze Window ──

export interface FreezeWindow {
  id: string;
  reason: string;
  startAt: Date;
  endAt: Date;
  createdBy: string;
  scope: "ALL" | "PROMOTIONS_ONLY" | "AUTO_VERIFY_ONLY";
  active: boolean;
}

// In-memory store (production: DB-backed)
const freezeWindows: FreezeWindow[] = [];

export function createFreezeWindow(params: {
  reason: string;
  startAt: Date;
  endAt: Date;
  createdBy: string;
  scope?: FreezeWindow["scope"];
}): FreezeWindow {
  const fw: FreezeWindow = {
    id: `FW-${Date.now()}`,
    reason: params.reason,
    startAt: params.startAt,
    endAt: params.endAt,
    createdBy: params.createdBy,
    scope: params.scope ?? "ALL",
    active: true,
  };
  freezeWindows.push(fw);
  return fw;
}

export function cancelFreezeWindow(id: string): boolean {
  const fw = freezeWindows.find((f) => f.id === id);
  if (!fw) return false;
  fw.active = false;
  return true;
}

export function getActiveFreezeWindows(): FreezeWindow[] {
  const now = new Date();
  return freezeWindows.filter(
    (f) => f.active && f.startAt <= now && f.endAt >= now,
  );
}

export function isInFreezeWindow(scope?: FreezeWindow["scope"]): boolean {
  const active = getActiveFreezeWindows();
  if (scope) {
    return active.some((f) => f.scope === "ALL" || f.scope === scope);
  }
  return active.some((f) => f.scope === "ALL");
}

/**
 * Freeze window 기간 중 승격 요청 시 차단 메시지 반환
 */
export function checkFreezeBlock(action: "PROMOTION" | "AUTO_VERIFY_ENABLE" | "ANY"): {
  blocked: boolean;
  reason: string | null;
  freezeWindowId: string | null;
} {
  const active = getActiveFreezeWindows();
  for (const fw of active) {
    if (fw.scope === "ALL") {
      return { blocked: true, reason: `Freeze: ${fw.reason}`, freezeWindowId: fw.id };
    }
    if (action === "PROMOTION" && fw.scope === "PROMOTIONS_ONLY") {
      return { blocked: true, reason: `Promotion Freeze: ${fw.reason}`, freezeWindowId: fw.id };
    }
    if (action === "AUTO_VERIFY_ENABLE" && fw.scope === "AUTO_VERIFY_ONLY") {
      return { blocked: true, reason: `Auto-Verify Freeze: ${fw.reason}`, freezeWindowId: fw.id };
    }
  }
  return { blocked: false, reason: null, freezeWindowId: null };
}
