// @ts-nocheck — vitest/jest 미설치 환경에서 타입 체크 bypass
/**
 * RC0 Pilot Launch Engine — Batch 19 Tests
 *
 * 7 sections × 시나리오:
 *  1. RC0 Scope Freeze (RC-1~RC-6)
 *  2. Scenario Freeze (RC-7~RC-11)
 *  3. Signoff Registry (RC-12~RC-18)
 *  4. Day-0 Monitoring (RC-19~RC-22)
 *  5. Rollback Drill (RC-23~RC-28)
 *  6. Launch Readiness (RC-29~RC-36)
 *  7. Surface Builder (RC-37~RC-42)
 */

import { describe, it, expect } from "vitest";
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
} from "../rc0-pilot-launch-engine";
import type {
  RC0ScopeFreeze,
  FrozenScenario,
  SignoffRegistry,
  Day0MonitoringPack,
  RollbackDrillResult,
  RollbackDrillStep,
  SignoffRole,
} from "../rc0-pilot-launch-engine";

// ══════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════

function makeDefaultScope(): RC0ScopeFreeze {
  return createRC0ScopeFreeze("go", "gs_001", "pilot_limited", {
    includedStages: ["quote_review", "quote_shortlist", "quote_approval", "po_conversion", "po_approval"],
    activeDomains: ["quote_chain", "dispatch_prep"],
    poLimit: 10,
    durationDays: 14,
    startDate: new Date(Date.now() + 86400000).toISOString(), // tomorrow
    operatorRoles: ["operator"],
    reviewerRoles: ["reviewer"],
    maxConcurrentActors: 3,
  });
}

function makeDefaultSignoff(rc0Id: string): SignoffRegistry {
  return createSignoffRegistry(rc0Id, [
    { role: "approver", label: "승인자", assignee: "김승인", email: "approve@lab.co" },
    { role: "operator_owner", label: "운영 오너", assignee: "이운영", email: "ops@lab.co" },
    { role: "rollback_owner", label: "롤백 오너", assignee: "박롤백", email: "rollback@lab.co" },
    { role: "compliance_reviewer", label: "컴플라이언스 검토자", assignee: "최검토", email: "comp@lab.co" },
    { role: "escalation_contact", label: "에스컬레이션 연락처", assignee: "정긴급", email: "esc@lab.co" },
  ]);
}

function signAllRoles(registry: SignoffRegistry): SignoffRegistry {
  let r = registry;
  for (const entry of r.entries) {
    r = applySignoff(r, entry.role, "확인 완료");
  }
  return r;
}

function makeDrillAllPass(rc0Id: string): RollbackDrillResult {
  const steps = createRollbackDrillTemplate(rc0Id).map(s => ({
    ...s,
    executed: true,
    executedAt: new Date().toISOString(),
    executedBy: "tester",
    result: "pass" as const,
  }));
  return evaluateRollbackDrill(rc0Id, "tester", steps);
}

// ══════════════════════════════════════════════════════
// 1. RC0 Scope Freeze
// ══════════════════════════════════════════════════════

describe("1. RC0 Scope Freeze", () => {
  it("RC-1: 정상 scope freeze 생성", () => {
    const scope = makeDefaultScope();
    expect(scope.locked).toBe(true);
    expect(scope.rc0Id).toMatch(/^rc0_/);
    expect(scope.gateVerdict).toBe("go");
    expect(scope.activationScope).toBe("pilot_limited");
    expect(scope.includedStages).toHaveLength(5);
    expect(scope.activeDomains).toHaveLength(2);
  });

  it("RC-2: endDate = startDate + durationDays", () => {
    const scope = makeDefaultScope();
    const start = new Date(scope.startDate).getTime();
    const end = new Date(scope.endDate).getTime();
    expect(end - start).toBe(14 * 86400000);
  });

  it("RC-3: no_go verdict → validation fail", () => {
    const scope = createRC0ScopeFreeze("no_go", "gs_002", "hold", {
      includedStages: ["quote_review"],
      activeDomains: ["quote_chain"],
      poLimit: 5,
      durationDays: 7,
      startDate: new Date(Date.now() + 86400000).toISOString(),
      operatorRoles: ["op"],
      reviewerRoles: ["rev"],
      maxConcurrentActors: 2,
    });
    const v = validateRC0ScopeFreeze(scope);
    expect(v.valid).toBe(false);
    expect(v.issues.some(i => i.includes("no_go"))).toBe(true);
  });

  it("RC-4: 빈 stage → validation fail", () => {
    const scope = makeDefaultScope();
    (scope as any).includedStages = [];
    const v = validateRC0ScopeFreeze(scope);
    expect(v.valid).toBe(false);
    expect(v.issues.some(i => i.includes("stage"))).toBe(true);
  });

  it("RC-5: PO 제한 0 → validation fail", () => {
    const scope = makeDefaultScope();
    (scope as any).poLimit = 0;
    const v = validateRC0ScopeFreeze(scope);
    expect(v.valid).toBe(false);
    expect(v.issues.some(i => i.includes("PO"))).toBe(true);
  });

  it("RC-6: 유효 scope → validation pass", () => {
    const scope = makeDefaultScope();
    const v = validateRC0ScopeFreeze(scope);
    expect(v.valid).toBe(true);
    expect(v.issues).toHaveLength(0);
  });
});

// ══════════════════════════════════════════════════════
// 2. Scenario Freeze
// ══════════════════════════════════════════════════════

describe("2. Scenario Freeze", () => {
  it("RC-7: 6개 필수 시나리오 포함", () => {
    const scenarios = createFrozenScenarios();
    expect(scenarios).toHaveLength(6);
    const ids = scenarios.map(s => s.scenarioId);
    expect(ids).toContain("normal_closed_loop");
    expect(ids).toContain("supplier_change_reopen");
    expect(ids).toContain("receiving_discrepancy_partial");
    expect(ids).toContain("stale_reconnect");
    expect(ids).toContain("multi_actor_contention");
    expect(ids).toContain("rollback_execution");
  });

  it("RC-8: 전체 시나리오 acceptanceVerified", () => {
    const scenarios = createFrozenScenarios();
    expect(scenarios.every(s => s.acceptanceVerified)).toBe(true);
  });

  it("RC-9: PO range 중복 없음", () => {
    const scenarios = createFrozenScenarios();
    const v = validateScenarioFreeze(scenarios);
    expect(v.valid).toBe(true);
    expect(v.issues.filter(i => i.includes("중복"))).toHaveLength(0);
  });

  it("RC-10: 시나리오 누락 → validation fail", () => {
    const scenarios = createFrozenScenarios().slice(0, 3); // 3개만
    const v = validateScenarioFreeze(scenarios);
    expect(v.valid).toBe(false);
    expect(v.issues.some(i => i.includes("누락"))).toBe(true);
  });

  it("RC-11: 미검증 시나리오 → validation fail", () => {
    const scenarios = createFrozenScenarios();
    scenarios[0].acceptanceVerified = false;
    const v = validateScenarioFreeze(scenarios);
    expect(v.valid).toBe(false);
    expect(v.issues.some(i => i.includes("미검증"))).toBe(true);
  });
});

// ══════════════════════════════════════════════════════
// 3. Signoff Registry
// ══════════════════════════════════════════════════════

describe("3. Signoff Registry", () => {
  it("RC-12: registry 생성 시 전체 미서명", () => {
    const r = makeDefaultSignoff("rc0_test");
    expect(r.allSignedOff).toBe(false);
    expect(r.entries.every(e => !e.signedOff)).toBe(true);
  });

  it("RC-13: applySignoff로 역할별 서명", () => {
    let r = makeDefaultSignoff("rc0_test");
    r = applySignoff(r, "approver", "LGTM");
    const approver = r.entries.find(e => e.role === "approver");
    expect(approver?.signedOff).toBe(true);
    expect(approver?.comment).toBe("LGTM");
    expect(r.allSignedOff).toBe(false);
  });

  it("RC-14: 전체 서명 → allSignedOff true", () => {
    const r = signAllRoles(makeDefaultSignoff("rc0_test"));
    expect(r.allSignedOff).toBe(true);
  });

  it("RC-15: 필수 역할 미지정 → validation fail", () => {
    const r = createSignoffRegistry("rc0_test", [
      { role: "approver", label: "승인자", assignee: "김승인", email: "a@b.co" },
      // operator_owner, rollback_owner, compliance_reviewer 없음
    ]);
    const v = validateSignoffRegistry(r);
    expect(v.valid).toBe(false);
    expect(v.issues.length).toBeGreaterThanOrEqual(3);
  });

  it("RC-16: assignee 비어있으면 validation fail", () => {
    const r = createSignoffRegistry("rc0_test", [
      { role: "approver", label: "승인자", assignee: "", email: "a@b.co" },
      { role: "operator_owner", label: "운영 오너", assignee: "이운영", email: "b@b.co" },
      { role: "rollback_owner", label: "롤백 오너", assignee: "박롤백", email: "c@b.co" },
      { role: "compliance_reviewer", label: "컴플라이언스", assignee: "최검토", email: "d@b.co" },
    ]);
    const v = validateSignoffRegistry(r);
    expect(v.valid).toBe(false);
    expect(v.issues.some(i => i.includes("담당자"))).toBe(true);
  });

  it("RC-17: escalation_contact는 필수가 아님", () => {
    const r = createSignoffRegistry("rc0_test", [
      { role: "approver", label: "승인자", assignee: "김승인", email: "a@b.co" },
      { role: "operator_owner", label: "운영 오너", assignee: "이운영", email: "b@b.co" },
      { role: "rollback_owner", label: "롤백 오너", assignee: "박롤백", email: "c@b.co" },
      { role: "compliance_reviewer", label: "컴플라이언스", assignee: "최검토", email: "d@b.co" },
    ]);
    const v = validateSignoffRegistry(r);
    expect(v.valid).toBe(true);
  });

  it("RC-18: 동일 역할 중복 서명 → 마지막 값 유지", () => {
    let r = makeDefaultSignoff("rc0_test");
    r = applySignoff(r, "approver", "첫 번째");
    r = applySignoff(r, "approver", "두 번째");
    const approver = r.entries.find(e => e.role === "approver");
    expect(approver?.comment).toBe("두 번째");
    expect(approver?.signedOff).toBe(true);
  });
});

// ══════════════════════════════════════════════════════
// 4. Day-0 Monitoring
// ══════════════════════════════════════════════════════

describe("4. Day-0 Monitoring", () => {
  it("RC-19: 13개 모니터링 포인트 생성", () => {
    const pack = createDay0MonitoringPack("rc0_test");
    expect(pack.points).toHaveLength(13);
    expect(pack.rc0Id).toBe("rc0_test");
  });

  it("RC-20: 6개 카테고리 커버리지", () => {
    const pack = createDay0MonitoringPack("rc0_test");
    const categories = new Set(pack.points.map(p => p.category));
    expect(categories.size).toBe(6);
    expect(categories).toContain("runtime_signal");
    expect(categories).toContain("chain_health");
    expect(categories).toContain("stale");
    expect(categories).toContain("irreversible");
    expect(categories).toContain("rollback");
    expect(categories).toContain("compliance");
  });

  it("RC-21: runtime_signal 5개 포인트", () => {
    const pack = createDay0MonitoringPack("rc0_test");
    const rs = pack.points.filter(p => p.category === "runtime_signal");
    expect(rs).toHaveLength(5);
    expect(rs.every(p => p.checkIntervalMin === 5)).toBe(true);
  });

  it("RC-22: alert channel 기본값 slack", () => {
    const pack = createDay0MonitoringPack("rc0_test");
    expect(pack.alertChannels).toContain("slack");
  });
});

// ══════════════════════════════════════════════════════
// 5. Rollback Drill
// ══════════════════════════════════════════════════════

describe("5. Rollback Drill", () => {
  it("RC-23: 10-step 템플릿 생성", () => {
    const steps = createRollbackDrillTemplate("rc0_test");
    expect(steps).toHaveLength(10);
    expect(steps.every(s => s.result === "not_executed")).toBe(true);
    expect(steps[0].stepId).toBe("RD-1");
    expect(steps[9].stepId).toBe("RD-10");
  });

  it("RC-24: 전체 pass → overallResult pass + launchReady", () => {
    const drill = makeDrillAllPass("rc0_test");
    expect(drill.overallResult).toBe("pass");
    expect(drill.launchReady).toBe(true);
    expect(drill.passedSteps).toBe(10);
    expect(drill.failedSteps).toBe(0);
  });

  it("RC-25: 1건 fail → overallResult fail + launchReady false", () => {
    const steps = createRollbackDrillTemplate("rc0_test").map((s, i) => ({
      ...s,
      executed: true,
      executedAt: new Date().toISOString(),
      executedBy: "tester",
      result: (i === 4 ? "fail" : "pass") as any,
      notes: i === 4 ? "Dashboard 반영 지연" : null,
    }));
    const drill = evaluateRollbackDrill("rc0_test", "tester", steps);
    expect(drill.overallResult).toBe("fail");
    expect(drill.launchReady).toBe(false);
    expect(drill.failedSteps).toBe(1);
  });

  it("RC-26: partial (일부 미실행) → launchReady false", () => {
    const steps = createRollbackDrillTemplate("rc0_test").map((s, i) => ({
      ...s,
      executed: i < 7,
      executedAt: i < 7 ? new Date().toISOString() : null,
      executedBy: i < 7 ? "tester" : null,
      result: (i < 7 ? "pass" : "not_executed") as any,
    }));
    const drill = evaluateRollbackDrill("rc0_test", "tester", steps);
    expect(drill.overallResult).toBe("partial");
    expect(drill.launchReady).toBe(false);
    expect(drill.passedSteps).toBe(7);
  });

  it("RC-27: fail step의 notes → discoveredIssues에 포함", () => {
    const steps = createRollbackDrillTemplate("rc0_test").map((s, i) => ({
      ...s,
      executed: true,
      executedAt: new Date().toISOString(),
      executedBy: "tester",
      result: (i === 2 ? "fail" : "pass") as any,
      notes: i === 2 ? "감사 스냅샷 캡처 지연" : null,
    }));
    const drill = evaluateRollbackDrill("rc0_test", "tester", steps);
    expect(drill.discoveredIssues).toHaveLength(1);
    expect(drill.discoveredIssues[0]).toContain("RD-3");
    expect(drill.discoveredIssues[0]).toContain("감사 스냅샷");
  });

  it("RC-28: step 순서 보존", () => {
    const steps = createRollbackDrillTemplate("rc0_test");
    for (let i = 0; i < steps.length; i++) {
      expect(steps[i].order).toBe(i + 1);
    }
  });
});

// ══════════════════════════════════════════════════════
// 6. Launch Readiness
// ══════════════════════════════════════════════════════

describe("6. Launch Readiness", () => {
  it("RC-29: 전체 조건 충족 → ready true", () => {
    const scope = makeDefaultScope();
    const scenarios = createFrozenScenarios();
    const signoff = signAllRoles(makeDefaultSignoff(scope.rc0Id));
    const monitoring = createDay0MonitoringPack(scope.rc0Id);
    const drill = makeDrillAllPass(scope.rc0Id);

    const check = evaluateLaunchReadiness(scope, scenarios, signoff, monitoring, drill);
    expect(check.ready).toBe(true);
    expect(check.blockingReasons).toHaveLength(0);
    expect(check.scopeValid).toBe(true);
    expect(check.scenariosValid).toBe(true);
    expect(check.signoffComplete).toBe(true);
    expect(check.monitoringConfigured).toBe(true);
    expect(check.drillPassed).toBe(true);
  });

  it("RC-30: scope invalid → ready false", () => {
    const scope = makeDefaultScope();
    (scope as any).includedStages = [];
    const scenarios = createFrozenScenarios();
    const signoff = signAllRoles(makeDefaultSignoff(scope.rc0Id));
    const monitoring = createDay0MonitoringPack(scope.rc0Id);
    const drill = makeDrillAllPass(scope.rc0Id);

    const check = evaluateLaunchReadiness(scope, scenarios, signoff, monitoring, drill);
    expect(check.ready).toBe(false);
    expect(check.scopeValid).toBe(false);
  });

  it("RC-31: 시나리오 미검증 → ready false", () => {
    const scope = makeDefaultScope();
    const scenarios = createFrozenScenarios();
    scenarios[0].acceptanceVerified = false;
    const signoff = signAllRoles(makeDefaultSignoff(scope.rc0Id));
    const monitoring = createDay0MonitoringPack(scope.rc0Id);
    const drill = makeDrillAllPass(scope.rc0Id);

    const check = evaluateLaunchReadiness(scope, scenarios, signoff, monitoring, drill);
    expect(check.ready).toBe(false);
    expect(check.scenariosValid).toBe(false);
  });

  it("RC-32: signoff 미완료 → ready false", () => {
    const scope = makeDefaultScope();
    const scenarios = createFrozenScenarios();
    const signoff = makeDefaultSignoff(scope.rc0Id); // 전부 미서명
    const monitoring = createDay0MonitoringPack(scope.rc0Id);
    const drill = makeDrillAllPass(scope.rc0Id);

    const check = evaluateLaunchReadiness(scope, scenarios, signoff, monitoring, drill);
    expect(check.ready).toBe(false);
    expect(check.signoffComplete).toBe(false);
    expect(check.blockingReasons.some(r => r.includes("미서명"))).toBe(true);
  });

  it("RC-33: drill null → ready false + 미실시 reason", () => {
    const scope = makeDefaultScope();
    const scenarios = createFrozenScenarios();
    const signoff = signAllRoles(makeDefaultSignoff(scope.rc0Id));
    const monitoring = createDay0MonitoringPack(scope.rc0Id);

    const check = evaluateLaunchReadiness(scope, scenarios, signoff, monitoring, null);
    expect(check.ready).toBe(false);
    expect(check.drillPassed).toBe(false);
    expect(check.blockingReasons.some(r => r.includes("미실시"))).toBe(true);
  });

  it("RC-34: drill fail → ready false", () => {
    const scope = makeDefaultScope();
    const scenarios = createFrozenScenarios();
    const signoff = signAllRoles(makeDefaultSignoff(scope.rc0Id));
    const monitoring = createDay0MonitoringPack(scope.rc0Id);
    const steps = createRollbackDrillTemplate(scope.rc0Id).map((s, i) => ({
      ...s,
      executed: true,
      executedAt: new Date().toISOString(),
      executedBy: "tester",
      result: (i === 0 ? "fail" : "pass") as any,
    }));
    const drill = evaluateRollbackDrill(scope.rc0Id, "tester", steps);

    const check = evaluateLaunchReadiness(scope, scenarios, signoff, monitoring, drill);
    expect(check.ready).toBe(false);
    expect(check.drillPassed).toBe(false);
    expect(check.blockingReasons.some(r => r.includes("drill 실패"))).toBe(true);
  });

  it("RC-35: 모니터링 포인트 0개 → ready false", () => {
    const scope = makeDefaultScope();
    const scenarios = createFrozenScenarios();
    const signoff = signAllRoles(makeDefaultSignoff(scope.rc0Id));
    const monitoring: Day0MonitoringPack = {
      packId: "empty",
      rc0Id: scope.rc0Id,
      points: [],
      alertChannels: [],
      escalationTimeMin: 15,
      createdAt: new Date().toISOString(),
    };
    const drill = makeDrillAllPass(scope.rc0Id);

    const check = evaluateLaunchReadiness(scope, scenarios, signoff, monitoring, drill);
    expect(check.ready).toBe(false);
    expect(check.monitoringConfigured).toBe(false);
  });

  it("RC-36: 복수 blocking reason 누적", () => {
    const scope = makeDefaultScope();
    (scope as any).includedStages = [];
    const scenarios = createFrozenScenarios();
    scenarios[0].acceptanceVerified = false;
    const signoff = makeDefaultSignoff(scope.rc0Id); // 미서명
    const monitoring: Day0MonitoringPack = {
      packId: "empty",
      rc0Id: scope.rc0Id,
      points: [],
      alertChannels: [],
      escalationTimeMin: 15,
      createdAt: new Date().toISOString(),
    };

    const check = evaluateLaunchReadiness(scope, scenarios, signoff, monitoring, null);
    expect(check.ready).toBe(false);
    // scope issue + scenario issue + signoff incomplete + monitoring empty + drill null
    expect(check.blockingReasons.length).toBeGreaterThanOrEqual(5);
  });
});

// ══════════════════════════════════════════════════════
// 7. Surface Builder
// ══════════════════════════════════════════════════════

describe("7. Surface Builder", () => {
  it("RC-37: ready surface — center/rail/dock 구조", () => {
    const scope = makeDefaultScope();
    const scenarios = createFrozenScenarios();
    const signoff = signAllRoles(makeDefaultSignoff(scope.rc0Id));
    const monitoring = createDay0MonitoringPack(scope.rc0Id);
    const drill = makeDrillAllPass(scope.rc0Id);
    const readiness = evaluateLaunchReadiness(scope, scenarios, signoff, monitoring, drill);

    const surface = buildLaunchSurface(readiness, scope, scenarios, signoff, monitoring, drill);

    expect(surface.center.ready).toBe(true);
    expect(surface.center.blockingReasons).toHaveLength(0);
    expect(surface.center.scopeSummary.stages).toBe(5);
    expect(surface.center.scopeSummary.domains).toBe(2);
    expect(surface.center.scenarioSummary.total).toBe(6);
    expect(surface.center.scenarioSummary.verified).toBe(6);
    expect(surface.center.signoffSummary.completed).toBe(5);
    expect(surface.center.signoffSummary.pending).toHaveLength(0);
    expect(surface.center.drillSummary.conducted).toBe(true);
    expect(surface.center.drillSummary.result).toBe("pass");
    expect(surface.center.monitoringSummary.points).toBe(13);
  });

  it("RC-38: not ready → launch_pilot disabled + reason", () => {
    const scope = makeDefaultScope();
    const scenarios = createFrozenScenarios();
    const signoff = makeDefaultSignoff(scope.rc0Id); // 미서명
    const monitoring = createDay0MonitoringPack(scope.rc0Id);
    const readiness = evaluateLaunchReadiness(scope, scenarios, signoff, monitoring, null);

    const surface = buildLaunchSurface(readiness, scope, scenarios, signoff, monitoring, null);

    expect(surface.center.ready).toBe(false);
    const launchAction = surface.dock.actions.find(a => a.actionKey === "launch_pilot");
    expect(launchAction?.enabled).toBe(false);
    expect(launchAction?.disabledReason).toBeTruthy();
  });

  it("RC-39: rail — scenarios 매핑", () => {
    const scope = makeDefaultScope();
    const scenarios = createFrozenScenarios();
    const signoff = signAllRoles(makeDefaultSignoff(scope.rc0Id));
    const monitoring = createDay0MonitoringPack(scope.rc0Id);
    const drill = makeDrillAllPass(scope.rc0Id);
    const readiness = evaluateLaunchReadiness(scope, scenarios, signoff, monitoring, drill);

    const surface = buildLaunchSurface(readiness, scope, scenarios, signoff, monitoring, drill);

    expect(surface.rail.scenarios).toHaveLength(6);
    expect(surface.rail.scenarios[0].name).toBe("정상 폐루프");
    expect(surface.rail.scenarios[0].seedRange).toContain("PO");
  });

  it("RC-40: rail — monitoring 13개 포인트", () => {
    const scope = makeDefaultScope();
    const scenarios = createFrozenScenarios();
    const signoff = signAllRoles(makeDefaultSignoff(scope.rc0Id));
    const monitoring = createDay0MonitoringPack(scope.rc0Id);
    const drill = makeDrillAllPass(scope.rc0Id);
    const readiness = evaluateLaunchReadiness(scope, scenarios, signoff, monitoring, drill);

    const surface = buildLaunchSurface(readiness, scope, scenarios, signoff, monitoring, drill);

    expect(surface.rail.monitoringPoints).toHaveLength(13);
    expect(surface.rail.monitoringPoints.every(p => p.critical)).toBeTruthy();
  });

  it("RC-41: dock — 5 actions", () => {
    const scope = makeDefaultScope();
    const scenarios = createFrozenScenarios();
    const signoff = signAllRoles(makeDefaultSignoff(scope.rc0Id));
    const monitoring = createDay0MonitoringPack(scope.rc0Id);
    const drill = makeDrillAllPass(scope.rc0Id);
    const readiness = evaluateLaunchReadiness(scope, scenarios, signoff, monitoring, drill);

    const surface = buildLaunchSurface(readiness, scope, scenarios, signoff, monitoring, drill);

    expect(surface.dock.actions).toHaveLength(5);
    const keys = surface.dock.actions.map(a => a.actionKey);
    expect(keys).toContain("launch_pilot");
    expect(keys).toContain("conduct_drill");
    expect(keys).toContain("modify_scope");
    expect(keys).toContain("export_launch_pack");
    expect(keys).toContain("cancel_rc0");
  });

  it("RC-42: drill pass 후 conduct_drill disabled", () => {
    const scope = makeDefaultScope();
    const scenarios = createFrozenScenarios();
    const signoff = signAllRoles(makeDefaultSignoff(scope.rc0Id));
    const monitoring = createDay0MonitoringPack(scope.rc0Id);
    const drill = makeDrillAllPass(scope.rc0Id);
    const readiness = evaluateLaunchReadiness(scope, scenarios, signoff, monitoring, drill);

    const surface = buildLaunchSurface(readiness, scope, scenarios, signoff, monitoring, drill);

    const drillAction = surface.dock.actions.find(a => a.actionKey === "conduct_drill");
    expect(drillAction?.enabled).toBe(false);
    expect(drillAction?.disabledReason).toContain("이미 통과");
  });
});
