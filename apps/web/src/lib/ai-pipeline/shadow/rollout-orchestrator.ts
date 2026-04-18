/**
 * Rollout Orchestrator — 단일 진입점 orchestration layer
 *
 * 각 phase 파일을 직접 호출하지 않고 orchestrator를 통해 실행:
 *  1. 현재 documentType 상태 조회
 *  2. 필요한 evaluator 실행
 *  3. decision 수집
 *  4. preflight 검증
 *  5. approval 필요 여부 판단
 *  6. stage transition 실행
 *  7. restricted auto-verify policy 반영
 *  8. audit/event 기록
 *  9. alert 발행
 * 10. 후속 report 생성
 */

import type { LifecycleState } from "./rollout-state-machine";
import { STATE_ORDER } from "./rollout-state-machine";
import { getRegistryEntry, updateRegistryEntry, getFirstDocTypeState } from "./doctype-registry";
import { evaluatePromotionGate } from "./promotion-gate";
import { evaluateFinalPromotion } from "./final-promotion";
import { evaluateAutoVerifyEligibility, detectFalseSafePatterns } from "./auto-verify-policy";
import { getStabilizationDashboard } from "./stabilization";
import { evaluateSecondPromotion, checkParallelOpsReadiness } from "./second-doctype-rollout";
import { runCertification } from "./certification-runner";
import { requestPromotion, rollbackToStage, disableAutoVerify, forceHold } from "./ops-control-plane";
import { emitAlert } from "./alerting-service";
import {
  generateStageHealthReport,
  generatePromotionReadinessReport,
  generateAutoVerifySafetyReport,
  generateStabilizationReport,
} from "./rollout-reporting";
import type { OpsActionResult } from "./ops-control-plane";
import type { ReportEnvelope } from "./rollout-reporting";

// ── Orchestration Result ──

export interface OrchestrationResult {
  documentType: string;
  currentState: LifecycleState;
  evaluationSummary: {
    promotionDecision: string | null;
    autoVerifyEligibility: string | null;
    falseSafeCount: number;
    stabilizationTrend: string | null;
  };
  recommendedAction: string;
  actionResult: OpsActionResult | null;
  reports: ReportEnvelope[];
}

/**
 * Full orchestration cycle — documentType의 현재 상태를 평가하고
 * 권장 액션을 도출하는 단일 진입점.
 *
 * autoExecute=true: rollback 계열은 자동 집행, GO 계열은 approval 요청만.
 */
export async function runOrchestrationCycle(params: {
  documentType: string;
  executedBy: string;
  autoExecute?: boolean;
}): Promise<OrchestrationResult> {
  const entry = getRegistryEntry(params.documentType);
  if (!entry) {
    return {
      documentType: params.documentType,
      currentState: "OFF",
      evaluationSummary: {
        promotionDecision: null,
        autoVerifyEligibility: null,
        falseSafeCount: 0,
        stabilizationTrend: null,
      },
      recommendedAction: "REGISTER_DOCTYPE",
      actionResult: null,
      reports: [],
    };
  }

  const currentState = entry.lifecycleState;
  const reports: ReportEnvelope[] = [];
  let promotionDecision: string | null = null;
  let autoVerifyEligibility: string | null = null;
  let falseSafeCount = 0;
  let stabilizationTrend: string | null = null;
  let recommendedAction = "MONITOR";
  let actionResult: OpsActionResult | null = null;

  // ── Phase별 evaluator 선택 ──

  if (["ACTIVE_5", "ACTIVE_25"].includes(currentState)) {
    // Promotion gate 평가
    const gate = await evaluatePromotionGate({ documentType: params.documentType });
    promotionDecision = gate.decision;
    reports.push(await generateStageHealthReport(params.documentType));

    if (gate.decision === "PROMOTE") {
      // Second docType인 경우 parallel ops check
      if (!entry.isFirstDocType) {
        const firstEntry = getFirstDocTypeState();
        if (firstEntry) {
          const parallel = await checkParallelOpsReadiness(
            firstEntry.documentType, params.documentType,
          );
          if (!parallel.canProceed) {
            recommendedAction = "HOLD_PARALLEL_CONSTRAINT";
            return buildResult(params.documentType, currentState, { promotionDecision, autoVerifyEligibility, falseSafeCount, stabilizationTrend }, recommendedAction, null, reports);
          }
        }
      }

      recommendedAction = "REQUEST_PROMOTION";
      if (params.autoExecute) {
        actionResult = await requestPromotion({
          documentType: params.documentType,
          requestedBy: params.executedBy,
          notes: `자동 평가 — ${gate.decisionReasons.join(", ")}`,
          basisReportIds: [],
        });
      }
    } else if (gate.decision === "ROLLBACK") {
      recommendedAction = "ROLLBACK";
      if (params.autoExecute) {
        actionResult = await rollbackToStage({
          documentType: params.documentType,
          targetStage: "SHADOW_ONLY",
          executedBy: params.executedBy,
          reason: gate.decisionReasons.join(", "),
        });
      }
    } else {
      recommendedAction = "HOLD";
    }
  }

  if (currentState === "ACTIVE_50") {
    // Final promotion + auto-verify eligibility
    const finalPromo = await evaluateFinalPromotion({ documentType: params.documentType });
    promotionDecision = finalPromo.decision;
    reports.push(await generatePromotionReadinessReport(params.documentType));

    const eligibility = await evaluateAutoVerifyEligibility({ documentType: params.documentType });
    autoVerifyEligibility = eligibility.decision;

    const falseSafe = await detectFalseSafePatterns(params.documentType);
    falseSafeCount = falseSafe.reduce((s, p) => s + p.count, 0);
    reports.push(await generateAutoVerifySafetyReport(params.documentType));

    if (falseSafeCount > 0 && entry.restrictedAutoVerifyEnabled) {
      recommendedAction = "DISABLE_AUTO_VERIFY";
      if (params.autoExecute) {
        actionResult = disableAutoVerify({
          documentType: params.documentType,
          executedBy: params.executedBy,
          reason: `False-safe ${falseSafeCount}건 감지`,
        });
      }
    } else if (finalPromo.decision === "ROLLBACK_TO_25" || finalPromo.decision === "ROLLBACK_TO_SHADOW") {
      recommendedAction = "ROLLBACK";
      if (params.autoExecute) {
        const target = finalPromo.decision === "ROLLBACK_TO_SHADOW" ? "SHADOW_ONLY" : "ACTIVE_25";
        actionResult = await rollbackToStage({
          documentType: params.documentType,
          targetStage: target as LifecycleState,
          executedBy: params.executedBy,
          reason: finalPromo.decisionReasons.join(", "),
        });
      }
    } else if (finalPromo.decision.startsWith("GO_")) {
      recommendedAction = "REQUEST_PROMOTION";
      if (params.autoExecute) {
        actionResult = await requestPromotion({
          documentType: params.documentType,
          requestedBy: params.executedBy,
          notes: finalPromo.decisionReasons.join(", "),
          basisReportIds: [],
        });
      }
    } else {
      recommendedAction = "HOLD";
    }
  }

  if (currentState === "ACTIVE_100" || currentState === "FULL_ACTIVE_WITH_RESTRICTIONS") {
    // Stabilization 평가
    const dashboard = await getStabilizationDashboard(params.documentType, 7);
    stabilizationTrend = dashboard.summary.trendDirection;
    reports.push(await generateStabilizationReport(params.documentType));

    if (dashboard.summary.trendDirection === "DEGRADING") {
      recommendedAction = "INVESTIGATE_DEGRADATION";
      emitAlert({
        severity: "MEDIUM",
        documentType: params.documentType,
        stage: currentState,
        eventType: "STABILIZATION_DEGRADING",
        impact: "품질 트렌드 악화",
        recommendedAction: "REVIEW_AND_TIGHTEN_POLICY",
      });
    } else if (
      dashboard.operatingState === "FULL_ACTIVE_STABLE" &&
      currentState === "FULL_ACTIVE_WITH_RESTRICTIONS"
    ) {
      recommendedAction = "MARK_STABLE";
    } else {
      recommendedAction = "MONITOR";
    }
  }

  if (currentState === "FULL_ACTIVE_STABLE") {
    reports.push(await generateStabilizationReport(params.documentType));
    recommendedAction = "MONITOR";
  }

  return buildResult(
    params.documentType, currentState,
    { promotionDecision, autoVerifyEligibility, falseSafeCount, stabilizationTrend },
    recommendedAction, actionResult, reports,
  );
}

function buildResult(
  documentType: string,
  currentState: LifecycleState,
  summary: { promotionDecision: string | null; autoVerifyEligibility: string | null; falseSafeCount: number; stabilizationTrend: string | null },
  recommendedAction: string,
  actionResult: OpsActionResult | null,
  reports: ReportEnvelope[],
): OrchestrationResult {
  return {
    documentType,
    currentState,
    evaluationSummary: summary,
    recommendedAction,
    actionResult,
    reports,
  };
}

/**
 * 전체 포트폴리오 orchestration — 등록된 모든 documentType에 대해 cycle 실행
 */
export async function runPortfolioOrchestration(executedBy: string): Promise<OrchestrationResult[]> {
  const { getAllRegistryEntries } = await import("./doctype-registry");
  const entries = getAllRegistryEntries();
  const results: OrchestrationResult[] = [];

  for (const entry of entries) {
    if (entry.lifecycleState === "OFF") continue;
    const result = await runOrchestrationCycle({
      documentType: entry.documentType,
      executedBy,
      autoExecute: false,
    });
    results.push(result);
  }

  return results;
}
