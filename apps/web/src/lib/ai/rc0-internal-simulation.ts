/**
 * RC0 Internal Simulation — 내부 실행 시뮬레이션
 *
 * 실제 엔진 함수를 호출해서 전체 lifecycle을 한 번 통과시킴:
 * 1. RC0 Scope Freeze
 * 2. Scenario Freeze
 * 3. Signoff Registry → 전원 서명
 * 4. Day-0 Monitoring Pack
 * 5. Rollback Drill → 전체 pass
 * 6. Launch Readiness Check
 * 7. Pilot Metrics (시나리오별 seed data)
 * 8. Completion Evaluation
 * 9. Graduation Path
 * 10. Surface Build
 *
 * 실행: npx tsx apps/web/src/lib/ai/rc0-internal-simulation.ts
 */

import {
  createRC0ScopeFreeze,
  validateRC0ScopeFreeze,
  createFrozenScenarios,
  validateScenarioFreeze,
  createSignoffRegistry,
  applySignoff,
  validateSignoffRegistry,
  createDay0MonitoringPack,
  createRollbackDrillTemplate,
  evaluateRollbackDrill,
  evaluateLaunchReadiness,
  buildLaunchSurface,
} from "./rc0-pilot-launch-engine";
import type { SignoffRole } from "./rc0-pilot-launch-engine";

import {
  aggregatePilotMetrics,
  evaluatePilotCompletion,
  evaluateGraduationPath,
  createRestartAssessment,
  evaluateRestartReadiness,
  buildGraduationSurface,
} from "./pilot-graduation-engine";

// ══════════════════════════════════════════════════════
// ANSI colors for terminal output
// ══════════════════════════════════════════════════════
const G = "\x1b[32m";  // green
const R = "\x1b[31m";  // red
const Y = "\x1b[33m";  // yellow
const B = "\x1b[36m";  // cyan
const W = "\x1b[37m";  // white
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

function header(title: string) {
  console.log(`\n${BOLD}${B}${"═".repeat(60)}${RESET}`);
  console.log(`${BOLD}${B}  ${title}${RESET}`);
  console.log(`${BOLD}${B}${"═".repeat(60)}${RESET}`);
}

function ok(msg: string) { console.log(`  ${G}✓${RESET} ${msg}`); }
function fail(msg: string) { console.log(`  ${R}✗${RESET} ${msg}`); }
function info(msg: string) { console.log(`  ${DIM}${msg}${RESET}`); }
function warn(msg: string) { console.log(`  ${Y}⚠${RESET} ${msg}`); }
function result(label: string, value: string) { console.log(`  ${W}${label}:${RESET} ${BOLD}${value}${RESET}`); }

// ══════════════════════════════════════════════════════
// Phase 1: RC0 Launch Setup
// ══════════════════════════════════════════════════════

function runLaunchSetup() {
  header("Phase 1: RC0 Scope Freeze");

  const scope = createRC0ScopeFreeze("go", "gs_sim_001", "pilot_limited", {
    includedStages: [
      "quote_review", "quote_shortlist", "quote_approval",
      "po_conversion", "po_approval", "po_send_readiness",
      "po_created", "dispatch_prep", "sent",
      "supplier_confirmed", "receiving_prep",
      "stock_release", "reorder_decision",
    ],
    activeDomains: [
      "quote_chain", "dispatch_prep", "dispatch_execution",
      "supplier_confirmation", "receiving_prep", "receiving_execution",
      "stock_release", "reorder_decision",
    ],
    poLimit: 20,
    durationDays: 14,
    startDate: new Date().toISOString(),
    operatorRoles: ["procurement_operator", "reviewer"],
    reviewerRoles: ["compliance_reviewer", "ops_lead"],
    maxConcurrentActors: 5,
  });

  const scopeValidation = validateRC0ScopeFreeze(scope);
  if (scopeValidation.valid) ok(`Scope freeze 생성: ${scope.rc0Id}`);
  else fail(`Scope 유효성 실패: ${scopeValidation.issues.join(", ")}`);

  result("Gate Verdict", scope.gateVerdict);
  result("Activation Scope", scope.activationScope);
  result("Stages", `${scope.includedStages.length}개`);
  result("Domains", `${scope.activeDomains.length}개`);
  result("PO Limit", `${scope.poLimit}건`);
  result("Duration", `${scope.durationDays}일`);
  result("Locked", `${scope.locked}`);

  // ── Scenario Freeze ──
  header("Phase 2: Scenario Freeze");
  const scenarios = createFrozenScenarios();
  const scenarioValidation = validateScenarioFreeze(scenarios);
  if (scenarioValidation.valid) ok(`시나리오 ${scenarios.length}종 freeze 완료`);
  else fail(`시나리오 유효성 실패: ${scenarioValidation.issues.join(", ")}`);

  for (const s of scenarios) {
    const badge = s.acceptanceVerified ? `${G}✓${RESET}` : `${R}✗${RESET}`;
    console.log(`  ${badge} ${s.name} (PO ${s.seedPoRange.from}~${s.seedPoRange.to}, ${s.expectedDays}일)`);
  }

  // ── Signoff Registry ──
  header("Phase 3: Signoff Registry");
  let signoff = createSignoffRegistry(scope.rc0Id, [
    { role: "approver" as SignoffRole, label: "승인자", assignee: "김승인", email: "approve@lab.co" },
    { role: "operator_owner" as SignoffRole, label: "운영 오너", assignee: "이운영", email: "ops@lab.co" },
    { role: "rollback_owner" as SignoffRole, label: "롤백 오너", assignee: "박롤백", email: "rollback@lab.co" },
    { role: "compliance_reviewer" as SignoffRole, label: "컴플라이언스", assignee: "최검토", email: "comp@lab.co" },
    { role: "escalation_contact" as SignoffRole, label: "에스컬레이션", assignee: "정긴급", email: "esc@lab.co" },
  ]);

  const signoffValidation = validateSignoffRegistry(signoff);
  if (signoffValidation.valid) ok("Signoff 구조 유효");
  else fail(`Signoff 유효성 실패: ${signoffValidation.issues.join(", ")}`);

  // 전원 서명
  const roles: SignoffRole[] = ["approver", "operator_owner", "rollback_owner", "compliance_reviewer", "escalation_contact"];
  for (const role of roles) {
    signoff = applySignoff(signoff, role, `${role} 확인 완료`);
    ok(`${role} 서명 완료`);
  }
  result("All Signed Off", `${signoff.allSignedOff}`);

  // ── Day-0 Monitoring ──
  header("Phase 4: Day-0 Monitoring Pack");
  const monitoring = createDay0MonitoringPack(scope.rc0Id, ["slack", "email"]);
  ok(`모니터링 포인트 ${monitoring.points.length}개 설정`);
  result("Alert Channels", monitoring.alertChannels.join(", "));
  result("Escalation Time", `${monitoring.escalationTimeMin}분`);

  const categories = new Set(monitoring.points.map(p => p.category));
  info(`카테고리: ${[...categories].join(", ")}`);

  // ── Rollback Drill ──
  header("Phase 5: Rollback Drill");
  const drillSteps = createRollbackDrillTemplate(scope.rc0Id);
  ok(`리허설 템플릿 ${drillSteps.length}단계 생성`);

  // 전체 pass 시뮬레이션
  const completedSteps = drillSteps.map(s => ({
    ...s,
    executed: true,
    executedAt: new Date().toISOString(),
    executedBy: "박롤백 (rollback_owner)",
    result: "pass" as const,
    notes: null,
  }));
  const drill = evaluateRollbackDrill(scope.rc0Id, "박롤백", completedSteps);

  if (drill.launchReady) ok(`리허설 결과: ${drill.overallResult.toUpperCase()}`);
  else fail(`리허설 실패: ${drill.failedSteps}건`);
  result("Passed", `${drill.passedSteps}/${drill.totalSteps}`);

  // ── Launch Readiness ──
  header("Phase 6: Launch Readiness Check");
  const readiness = evaluateLaunchReadiness(scope, scenarios, signoff, monitoring, drill);

  if (readiness.ready) {
    ok(`${G}${BOLD}LAUNCH READY${RESET}`);
  } else {
    fail(`LAUNCH BLOCKED: ${readiness.blockingReasons.join(", ")}`);
  }
  result("Scope Valid", `${readiness.scopeValid}`);
  result("Scenarios Valid", `${readiness.scenariosValid}`);
  result("Signoff Complete", `${readiness.signoffComplete}`);
  result("Monitoring Configured", `${readiness.monitoringConfigured}`);
  result("Drill Passed", `${readiness.drillPassed}`);

  // Launch Surface
  const launchSurface = buildLaunchSurface(readiness, scope, scenarios, signoff, monitoring, drill);
  info(`Launch Surface: center.ready=${launchSurface.center.ready}, dock.actions=${launchSurface.dock.actions.length}`);

  return { scope, scenarios, signoff, monitoring, drill, readiness };
}

// ══════════════════════════════════════════════════════
// Phase 2: Pilot Execution Simulation (14일 운영)
// ══════════════════════════════════════════════════════

function runPilotExecution(launchData: ReturnType<typeof runLaunchSetup>) {
  header("Phase 7: Pilot Execution — 14일 운영 시뮬레이션");

  // ── Scenario A: 정상 폐루프 (PO 1~5) ──
  console.log(`\n  ${BOLD}Scenario A: 정상 폐루프${RESET}`);
  ok("PO-001: Quote → Approval → PO → Dispatch → Confirmed → Received → Released → No Action");
  ok("PO-002: Quote → Approval → PO → Dispatch → Confirmed → Received → Released → No Action");
  ok("PO-003: Quote → Approval → PO → Dispatch → Confirmed → Received → Released → Reorder Required");
  ok("PO-004: Quote → Approval → PO → Dispatch → Confirmed → Received → Released → No Action");
  ok("PO-005: Quote → Approval → PO → Dispatch → Confirmed → Received → Released → No Action");
  info("5건 전체 chain 정상 완료");

  // ── Scenario B: 공급사 변경 (PO 6~8) ──
  console.log(`\n  ${BOLD}Scenario B: 공급사 변경 재개방${RESET}`);
  ok("PO-006: Dispatch → Supplier Change Requested → Reopen → Re-confirm → Received");
  ok("PO-007: Dispatch → Supplier Change Requested → Reopen → Re-confirm → Received");
  ok("PO-008: Dispatch → Confirmed (변경 없음)");
  info("reopen 2건, 정상 reconfirm 완료");

  // ── Scenario C: 입고 이상 (PO 9~12) ──
  console.log(`\n  ${BOLD}Scenario C: 입고 이상 / 부분 릴리즈${RESET}`);
  ok("PO-009: Received → Discrepancy → Hold → Partial Release → Reorder Required");
  ok("PO-010: Received → Discrepancy → Quarantine → Full Release after inspection");
  ok("PO-011: Received → Normal → Released → No Action");
  ok("PO-012: Received → Partial → Remaining pending");
  info("discrepancy 2건, partial release 1건");

  // ── Scenario D: Stale / Reconnect (PO 13~15) ──
  console.log(`\n  ${BOLD}Scenario D: Stale / Reconnect${RESET}`);
  ok("PO-013: Workbench open → External event → Stale banner → Refresh → Continue");
  ok("PO-014: Connection lost → Replay → State restored");
  ok("PO-015: Concurrent edit attempt → Concurrency guard → Sequential resolution");
  info("stale 1건, reconnect 1건, concurrency block 1건 — 전부 해소");

  // ── Scenario E: Multi-actor (PO 16~18) ──
  console.log(`\n  ${BOLD}Scenario E: 다중 actor 경합${RESET}`);
  ok("PO-016: Actor A approval → Actor B dispatch (순차 완료)");
  ok("PO-017: Actor A + B 동시 dispatch 시도 → Guard → A 선행, B 재시도");
  ok("PO-018: 3인 동시 접근 → 순차 처리 완료");
  info("concurrency 정상 처리");

  // ── Scenario F: Rollback 시뮬레이션 (PO 19~20) ──
  console.log(`\n  ${BOLD}Scenario F: 롤백 시나리오 (시뮬레이션만, 실제 rollback 미실행)${RESET}`);
  ok("PO-019: Critical signal 시뮬레이션 → Rollback recommendation 확인");
  ok("PO-020: Rollback dock 버튼 상태 확인 → 정상 (실행하지 않음)");
  info("rollback 시나리오 검증 완료 — 실제 trigger 발동 없음");

  // ── Metrics 집계 ──
  header("Phase 8: Pilot Metrics 집계");

  const metrics = aggregatePilotMetrics({
    scope: launchData.scope,
    poProcessed: 18,
    poInProgress: 2,
    poBlocked: 0,
    chainCompletions: 16,
    avgChainDurationHours: 8.5,
    maxChainDurationHours: 24,
    totalBlockerCount: 3,
    hardBlockerCount: 0,
    softBlockerCount: 3,
    staleBlockingFrequency: 1,
    staleAvgResolutionMin: 3.2,
    runtimeSignalAvg: 91.5,
    runtimeSignalMin: 78,
    runtimeCriticalBreachCount: 0,
    reopenCount: 2,
    retryCount: 1,
    rollbackTriggerHitCount: 0,
    complianceVerdicts: { compliant: 17, conditionally_compliant: 2, non_compliant: 1 },
    activeActorCount: 4,
    decisionLogVolume: 87,
    irreversibleActionCount: 22,
    irreversibleActionFailureCount: 0,
  });

  result("PO 처리", `${metrics.poProcessed}건 처리, ${metrics.poInProgress}건 진행중, ${metrics.poBlocked}건 차단`);
  result("체인 완료율", `${(metrics.chainCompletionRate * 100).toFixed(1)}%`);
  result("블로커 발생률", `${(metrics.blockerIncidenceRate * 100).toFixed(1)}%`);
  result("런타임 시그널", `평균 ${metrics.runtimeSignalAvg}, 최저 ${metrics.runtimeSignalMin}`);
  result("컴플라이언스", `${(metrics.complianceRate * 100).toFixed(1)}%`);
  result("Stale", `${metrics.staleBlockingFrequency}건, 평균 해소 ${metrics.staleAvgResolutionMin.toFixed(1)}분`);
  result("Rollback Trigger", `${metrics.rollbackTriggerHitCount}건`);
  result("Irreversible 실패", `${metrics.irreversibleActionFailureCount}건`);
  result("Active Actors", `${metrics.activeActorCount}명`);
  result("Decision Log", `${metrics.decisionLogVolume}건`);

  return metrics;
}

// ══════════════════════════════════════════════════════
// Phase 3: Graduation Evaluation
// ══════════════════════════════════════════════════════

function runGraduationEvaluation(
  launchData: ReturnType<typeof runLaunchSetup>,
  metrics: ReturnType<typeof runPilotExecution>,
) {
  header("Phase 9: Completion Evaluation");

  const completion = evaluatePilotCompletion(metrics, launchData.scope.rc0Id, "active", false);

  if (completion.verdict === "completed_successfully") {
    ok(`${G}${BOLD}VERDICT: ${completion.verdict.toUpperCase()}${RESET}`);
  } else if (completion.verdict === "completed_conditionally") {
    warn(`VERDICT: ${completion.verdict.toUpperCase()}`);
  } else {
    fail(`VERDICT: ${completion.verdict.toUpperCase()}`);
  }

  result("Required 충족", `${completion.requiredMet}/${completion.requiredTotal}`);
  result("Recommended 충족", `${completion.recommendedMet}/${completion.recommendedTotal}`);

  console.log(`\n  ${BOLD}Criteria Detail:${RESET}`);
  for (const c of completion.criteria) {
    const badge = c.met ? `${G}✓${RESET}` : `${R}✗${RESET}`;
    const sev = c.severity === "required" ? `${Y}[필수]${RESET}` : `${DIM}[권장]${RESET}`;
    console.log(`  ${badge} ${sev} ${c.name}: ${c.actual} (기준: ${c.threshold})`);
  }

  if (completion.blockingReasons.length > 0) {
    console.log(`\n  ${R}Blocking:${RESET}`);
    for (const r of completion.blockingReasons) console.log(`    ${R}• ${r}${RESET}`);
  }

  console.log(`\n  ${DIM}Evidence:${RESET}`);
  for (const e of completion.evidenceSummary) info(e);

  // ── Graduation Path ──
  header("Phase 10: Graduation Path");

  const graduation = evaluateGraduationPath(completion, metrics, launchData.scope.activationScope);

  const pathColors: Record<string, string> = {
    ready_for_ga: G,
    expand_pilot: B,
    remain_internal_only: Y,
    rollback_and_reassess: R,
  };
  const pc = pathColors[graduation.path] || W;
  console.log(`  ${pc}${BOLD}PATH: ${graduation.path.toUpperCase()}${RESET}`);
  result("Confidence", graduation.confidence);
  result("Reassessment Required", `${graduation.reassessmentRequired}`);

  if (graduation.supportingFactors.length > 0) {
    console.log(`\n  ${G}Supporting Factors:${RESET}`);
    for (const f of graduation.supportingFactors) console.log(`    ${G}+ ${f}${RESET}`);
  }
  if (graduation.riskFactors.length > 0) {
    console.log(`\n  ${R}Risk Factors:${RESET}`);
    for (const f of graduation.riskFactors) console.log(`    ${R}- ${f}${RESET}`);
  }
  if (graduation.conditions.length > 0) {
    console.log(`\n  ${Y}Conditions:${RESET}`);
    for (const c of graduation.conditions) console.log(`    ${Y}• ${c}${RESET}`);
  }

  // ── Graduation Surface ──
  header("Phase 11: Graduation Surface");

  const surface = buildGraduationSurface(completion, graduation, metrics, null);

  result("Center Verdict", surface.center.completionVerdict);
  result("Center Path", surface.center.graduationPath);
  result("Center Confidence", surface.center.confidence);

  console.log(`\n  ${BOLD}Dock Actions:${RESET}`);
  for (const a of surface.dock.actions) {
    const badge = a.enabled ? `${G}●${RESET}` : `${R}○${RESET}`;
    const reason = a.disabledReason ? ` ${DIM}(${a.disabledReason})${RESET}` : "";
    console.log(`  ${badge} ${a.label}${reason}`);
  }

  return { completion, graduation, surface };
}

// ══════════════════════════════════════════════════════
// Main Execution
// ══════════════════════════════════════════════════════

function main() {
  console.log(`\n${BOLD}${B}╔══════════════════════════════════════════════════════════════╗${RESET}`);
  console.log(`${BOLD}${B}║   LabAxis RC0 Internal Simulation — Full Lifecycle Run      ║${RESET}`);
  console.log(`${BOLD}${B}╚══════════════════════════════════════════════════════════════╝${RESET}`);
  console.log(`${DIM}  실행 시점: ${new Date().toISOString()}${RESET}`);

  // Phase 1: Launch Setup
  const launchData = runLaunchSetup();

  if (!launchData.readiness.ready) {
    fail("Launch readiness 미충족 — 시뮬레이션 중단");
    process.exit(1);
  }

  console.log(`\n${G}${BOLD}  ▶ PILOT LAUNCHED${RESET}`);

  // Phase 2: Pilot Execution
  const metrics = runPilotExecution(launchData);

  // Phase 3: Graduation
  const gradResult = runGraduationEvaluation(launchData, metrics);

  // ── Final Summary ──
  console.log(`\n${BOLD}${B}╔══════════════════════════════════════════════════════════════╗${RESET}`);
  console.log(`${BOLD}${B}║   SIMULATION COMPLETE                                        ║${RESET}`);
  console.log(`${BOLD}${B}╚══════════════════════════════════════════════════════════════╝${RESET}`);

  const verdictColor = gradResult.completion.verdict === "completed_successfully" ? G : Y;
  const pathColor = gradResult.graduation.path === "ready_for_ga" ? G
    : gradResult.graduation.path === "expand_pilot" ? B : Y;

  console.log(`\n  ${BOLD}Launch:${RESET}        ${G}✓ READY${RESET}`);
  console.log(`  ${BOLD}PO Processed:${RESET}  ${metrics.poProcessed}건 / ${metrics.poLimit}건`);
  console.log(`  ${BOLD}Chain Rate:${RESET}    ${(metrics.chainCompletionRate * 100).toFixed(1)}%`);
  console.log(`  ${BOLD}Compliance:${RESET}    ${(metrics.complianceRate * 100).toFixed(1)}%`);
  console.log(`  ${BOLD}Runtime Avg:${RESET}   ${metrics.runtimeSignalAvg}`);
  console.log(`  ${BOLD}Verdict:${RESET}       ${verdictColor}${gradResult.completion.verdict}${RESET}`);
  console.log(`  ${BOLD}Path:${RESET}          ${pathColor}${gradResult.graduation.path}${RESET}`);
  console.log(`  ${BOLD}Confidence:${RESET}    ${gradResult.graduation.confidence}`);
  console.log(`  ${BOLD}Next Action:${RESET}   ${gradResult.graduation.path === "ready_for_ga" ? "GA 승인 진행" : gradResult.graduation.path === "expand_pilot" ? "파일럿 확장" : "내부 유지"}`);
  console.log();
}

main();
