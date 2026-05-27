/**
 * Incident Drill Framework — 4가지 인시던트 시나리오 드릴
 *
 * Detection/Rollback 타이밍 측정 및 대응 역량 검증
 */

import type { SeverityLevel } from "./slo-alert-routing";
import type { LifecycleState } from "./rollout-state-machine";

// ── Drill Types ──

export type DrillScenario =
  | "FALSE_SAFE_BURST"
  | "MISMATCH_SPIKE"
  | "PROVIDER_OUTAGE"
  | "DATA_CORRUPTION";

export type DrillStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";

export interface DrillDefinition {
  scenario: DrillScenario;
  severity: SeverityLevel;
  name: string;
  description: string;
  expectedDetectionMinutes: number;
  expectedRollbackMinutes: number;
  setupSteps: string[];
  verificationSteps: string[];
  successCriteria: string[];
}

export interface DrillExecution {
  id: string;
  scenario: DrillScenario;
  status: DrillStatus;
  documentType: string;
  startedAt: Date;
  detectedAt: Date | null;
  rolledBackAt: Date | null;
  completedAt: Date | null;
  executedBy: string;
  detectionLatencyMs: number | null;
  rollbackLatencyMs: number | null;
  passed: boolean | null;
  notes: string;
  findings: string[];
}

// ── 4 Standard Drill Scenarios ──

export const DRILL_DEFINITIONS: DrillDefinition[] = [
  {
    scenario: "FALSE_SAFE_BURST",
    severity: "SEV1",
    name: "False-Safe 대량 발생 드릴",
    description: "Auto-verify가 잘못된 승인을 대량으로 생성하는 상황 시뮬레이션",
    expectedDetectionMinutes: 15,
    expectedRollbackMinutes: 30,
    setupSteps: [
      "테스트 DocType에 auto-verify 활성화",
      "Known false-safe 패턴 5건 주입",
      "Detection 타이머 시작",
    ],
    verificationSteps: [
      "False-safe 감지 알림 발행 확인",
      "Auto-verify 자동 비활성화 확인",
      "리뷰 큐에 P0 항목 생성 확인",
      "Safety report 자동 생성 확인",
    ],
    successCriteria: [
      "Detection ≤ 15분",
      "Auto-verify 비활성화 ≤ 5분 (감지 후)",
      "리뷰 큐 P0 생성 완료",
      "SEV1 alert 발행 완료",
    ],
  },
  {
    scenario: "MISMATCH_SPIKE",
    severity: "SEV2",
    name: "Mismatch Rate 급등 드릴",
    description: "특정 DocType의 mismatch rate가 임계치를 초과하는 상황",
    expectedDetectionMinutes: 60,
    expectedRollbackMinutes: 120,
    setupSteps: [
      "테스트 DocType을 ACTIVE_25로 설정",
      "Mismatch rate 10% 이상 시뮬레이션",
      "Promotion gate 평가 트리거",
    ],
    verificationSteps: [
      "Promotion gate ROLLBACK 판정 확인",
      "자동 rollback 실행 확인",
      "Rollback incident report 생성 확인",
      "SEV2 alert 발행 확인",
    ],
    successCriteria: [
      "Promotion gate가 ROLLBACK 판정",
      "autoExecute=true 시 자동 롤백 실행",
      "SHADOW_ONLY로 정상 전환",
      "인시던트 리포트 생성 완료",
    ],
  },
  {
    scenario: "PROVIDER_OUTAGE",
    severity: "SEV1",
    name: "AI Provider 장애 드릴",
    description: "AI provider가 응답 불능 상태가 되어 fallback이 폭증하는 상황",
    expectedDetectionMinutes: 5,
    expectedRollbackMinutes: 15,
    setupSteps: [
      "Provider endpoint를 비활성화 (mock)",
      "Fallback rate 100% 상태 진입",
      "Circuit breaker 트리거 대기",
    ],
    verificationSteps: [
      "Circuit breaker 발동 확인",
      "전체 트래픽 Rules Path 전환 확인",
      "SEV1 alert 발행 확인",
      "Provider 복구 후 자동 재활성화 확인",
    ],
    successCriteria: [
      "Circuit breaker ≤ 5분 내 발동",
      "사용자 영향 없이 Rules Path fallback",
      "Provider 복구 시 자동 재개",
    ],
  },
  {
    scenario: "DATA_CORRUPTION",
    severity: "SEV0",
    name: "데이터 손상 감지 드릴",
    description: "AI 결과가 잘못된 데이터를 프로덕션에 기록하는 상황",
    expectedDetectionMinutes: 5,
    expectedRollbackMinutes: 30,
    setupSteps: [
      "Invariant violation 시뮬레이션 (잘못된 document type 기록)",
      "Emergency OFF 트리거 대기",
    ],
    verificationSteps: [
      "Invariant violation 감지 확인",
      "Emergency OFF 자동 실행 확인",
      "SEV0 alert + PagerDuty 에스컬레이션 확인",
      "영향 범위 파악 쿼리 실행 확인",
      "모든 pending approval 만료 확인",
    ],
    successCriteria: [
      "Detection ≤ 5분",
      "Emergency OFF ≤ 1분 (감지 후)",
      "전체 에스컬레이션 체인 동작",
      "포스트모템 템플릿 자동 생성",
    ],
  },
];

// ── Drill Execution Store (in-memory, production: DB-backed) ──

const drillHistory: DrillExecution[] = [];

export function startDrill(params: {
  scenario: DrillScenario;
  documentType: string;
  executedBy: string;
}): DrillExecution {
  const drill: DrillExecution = {
    id: `DRILL-${Date.now()}`,
    scenario: params.scenario,
    status: "IN_PROGRESS",
    documentType: params.documentType,
    startedAt: new Date(),
    detectedAt: null,
    rolledBackAt: null,
    completedAt: null,
    executedBy: params.executedBy,
    detectionLatencyMs: null,
    rollbackLatencyMs: null,
    passed: null,
    notes: "",
    findings: [],
  };
  drillHistory.push(drill);
  return drill;
}

export function markDrillDetected(drillId: string): boolean {
  const drill = drillHistory.find((d) => d.id === drillId);
  if (!drill || drill.status !== "IN_PROGRESS") return false;
  drill.detectedAt = new Date();
  drill.detectionLatencyMs = drill.detectedAt.getTime() - drill.startedAt.getTime();
  return true;
}

export function markDrillRolledBack(drillId: string): boolean {
  const drill = drillHistory.find((d) => d.id === drillId);
  if (!drill || !drill.detectedAt) return false;
  drill.rolledBackAt = new Date();
  drill.rollbackLatencyMs = drill.rolledBackAt.getTime() - drill.detectedAt.getTime();
  return true;
}

export function completeDrill(drillId: string, result: {
  passed: boolean;
  notes: string;
  findings: string[];
}): boolean {
  const drill = drillHistory.find((d) => d.id === drillId);
  if (!drill) return false;
  drill.status = result.passed ? "COMPLETED" : "FAILED";
  drill.completedAt = new Date();
  drill.passed = result.passed;
  drill.notes = result.notes;
  drill.findings = result.findings;
  return true;
}

export function getDrillHistory(documentType?: string): DrillExecution[] {
  if (documentType) return drillHistory.filter((d) => d.documentType === documentType);
  return [...drillHistory];
}

export function getDrillDefinition(scenario: DrillScenario): DrillDefinition {
  return DRILL_DEFINITIONS.find((d) => d.scenario === scenario)!;
}

/**
 * 드릴 결과 요약 — SLA 준수 여부 포함
 */
export function summarizeDrillResult(drillId: string): {
  scenario: DrillScenario;
  passed: boolean | null;
  detectionWithinSLA: boolean;
  rollbackWithinSLA: boolean;
  detectionMinutes: number | null;
  rollbackMinutes: number | null;
  findings: string[];
} | null {
  const drill = drillHistory.find((d) => d.id === drillId);
  if (!drill) return null;

  const def = getDrillDefinition(drill.scenario);
  const detectionMinutes = drill.detectionLatencyMs ? drill.detectionLatencyMs / 60_000 : null;
  const rollbackMinutes = drill.rollbackLatencyMs ? drill.rollbackLatencyMs / 60_000 : null;

  return {
    scenario: drill.scenario,
    passed: drill.passed,
    detectionWithinSLA: detectionMinutes !== null && detectionMinutes <= def.expectedDetectionMinutes,
    rollbackWithinSLA: rollbackMinutes !== null && rollbackMinutes <= def.expectedRollbackMinutes,
    detectionMinutes: detectionMinutes ? Math.round(detectionMinutes * 10) / 10 : null,
    rollbackMinutes: rollbackMinutes ? Math.round(rollbackMinutes * 10) / 10 : null,
    findings: drill.findings,
  };
}
