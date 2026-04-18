/**
 * E2E Scenarios — 10가지 종단 간 시나리오 정의
 *
 * 각 시나리오는 실제 운영에서 발생할 수 있는 상황을 모사하며,
 * rollout-orchestrator, ops-control-plane, certification-runner 등의
 * 통합 동작을 검증하기 위한 참조 시나리오입니다.
 */

import type { LifecycleState } from "./rollout-state-machine";
import type { TransitionType } from "./rollout-state-machine";
import type { CertificationMode, CertificationResult } from "./certification-runner";

// ── Scenario Definition ──

export interface E2EStep {
  description: string;
  action: string;
  expectedState?: LifecycleState;
  expectedOutcome?: string;
}

export interface E2EScenario {
  id: string;
  name: string;
  description: string;
  category: "HAPPY_PATH" | "ROLLBACK" | "EDGE_CASE" | "MULTI_DOCTYPE" | "CERTIFICATION";
  steps: E2EStep[];
}

// ── 10 Scenarios ──

export const E2E_SCENARIOS: E2EScenario[] = [
  // ── 1. Happy Path: Shadow → Full Stable ──
  {
    id: "E2E_001",
    name: "Happy Path — Full Lifecycle",
    description: "Shadow 등록부터 FULL_ACTIVE_STABLE까지 정상 승격 시나리오",
    category: "HAPPY_PATH",
    steps: [
      { description: "DocType 등록", action: "REGISTER", expectedState: "SHADOW_ONLY" },
      { description: "SHADOW 기간 충족 후 ACTIVE_5 승격 요청", action: "REQUEST_PROMOTION", expectedState: "SHADOW_ONLY" },
      { description: "Approval 승인", action: "APPROVE_PROMOTION", expectedState: "ACTIVE_5" },
      { description: "ACTIVE_5 게이트 통과 후 ACTIVE_25 승격", action: "APPROVE_PROMOTION", expectedState: "ACTIVE_25" },
      { description: "ACTIVE_25 게이트 통과 후 ACTIVE_50 승격", action: "APPROVE_PROMOTION", expectedState: "ACTIVE_50" },
      { description: "Final promotion 평가 → GO_ACTIVE_100_RESTRICTED", action: "APPROVE_PROMOTION", expectedState: "ACTIVE_100" },
      { description: "Stabilization 안정 → FULL_ACTIVE_WITH_RESTRICTIONS", action: "STABILIZE", expectedState: "FULL_ACTIVE_WITH_RESTRICTIONS" },
      { description: "제한 해제 → FULL_ACTIVE_STABLE", action: "MARK_STABLE", expectedState: "FULL_ACTIVE_STABLE" },
    ],
  },

  // ── 2. Rollback at ACTIVE_5 ──
  {
    id: "E2E_002",
    name: "Rollback at ACTIVE_5 — High Mismatch",
    description: "ACTIVE_5에서 mismatch rate 초과로 SHADOW_ONLY 롤백",
    category: "ROLLBACK",
    steps: [
      { description: "ACTIVE_5 상태에서 운영 중", action: "MONITOR", expectedState: "ACTIVE_5" },
      { description: "Mismatch rate 8% 감지 (임계값 5%)", action: "EVALUATE_GATE", expectedOutcome: "ROLLBACK" },
      { description: "자동 롤백 실행", action: "ROLLBACK", expectedState: "SHADOW_ONLY" },
      { description: "롤백 인시던트 리포트 생성", action: "GENERATE_REPORT", expectedOutcome: "ROLLBACK_INCIDENT" },
      { description: "Alert 발행 (SEV2)", action: "EMIT_ALERT", expectedOutcome: "ROLLBACK_EXECUTED" },
    ],
  },

  // ── 3. Auto-Verify False-Safe Kill ──
  {
    id: "E2E_003",
    name: "Auto-Verify False-Safe Detection & Kill",
    description: "ACTIVE_50에서 false-safe 패턴 감지 후 auto-verify 비활성화",
    category: "EDGE_CASE",
    steps: [
      { description: "ACTIVE_50 + restricted auto-verify 활성 상태", action: "MONITOR", expectedState: "ACTIVE_50" },
      { description: "False-safe 패턴 3건 감지", action: "DETECT_FALSE_SAFE", expectedOutcome: "3_PATTERNS" },
      { description: "Auto-verify 비활성화", action: "DISABLE_AUTO_VERIFY", expectedOutcome: "AUTO_VERIFY_OFF" },
      { description: "Alert 발행 (SEV2)", action: "EMIT_ALERT", expectedOutcome: "FALSE_SAFE_DETECTED" },
      { description: "Safety report 생성", action: "GENERATE_REPORT", expectedOutcome: "AUTO_VERIFY_SAFETY" },
    ],
  },

  // ── 4. Final Promotion with Rollback to ACTIVE_25 ──
  {
    id: "E2E_004",
    name: "Final Promotion Rollback to ACTIVE_25",
    description: "ACTIVE_50에서 final promotion 평가 실패 → ACTIVE_25 롤백",
    category: "ROLLBACK",
    steps: [
      { description: "ACTIVE_50에서 final promotion 평가", action: "EVALUATE_FINAL", expectedOutcome: "ROLLBACK_TO_25" },
      { description: "롤백 실행 (approval 불필요)", action: "ROLLBACK", expectedState: "ACTIVE_25" },
      { description: "Stabilization 대시보드 리셋", action: "RESET_DASHBOARD" },
      { description: "인시던트 리포트 + alert", action: "GENERATE_REPORT", expectedOutcome: "ROLLBACK_INCIDENT" },
    ],
  },

  // ── 5. Emergency OFF ──
  {
    id: "E2E_005",
    name: "Emergency OFF — Critical Incident",
    description: "운영 중 심각한 장애 발생 시 즉시 OFF 전환",
    category: "EDGE_CASE",
    steps: [
      { description: "ACTIVE_100 상태에서 운영 중", action: "MONITOR", expectedState: "ACTIVE_100" },
      { description: "Critical invariant violation 감지", action: "DETECT_INVARIANT", expectedOutcome: "CRITICAL" },
      { description: "Emergency OFF 실행", action: "EMERGENCY_OFF", expectedState: "OFF" },
      { description: "SEV0 alert 발행", action: "EMIT_ALERT", expectedOutcome: "EMERGENCY_OFF" },
      { description: "모든 pending approval 만료 처리", action: "EXPIRE_APPROVALS" },
    ],
  },

  // ── 6. Second DocType Parallel Launch ──
  {
    id: "E2E_006",
    name: "Second DocType — Parallel Ops Discipline",
    description: "First DocType stable 상태에서 Second DocType 병렬 런칭",
    category: "MULTI_DOCTYPE",
    steps: [
      { description: "First DocType = FULL_ACTIVE_STABLE 확인", action: "CHECK_FIRST", expectedState: "FULL_ACTIVE_STABLE" },
      { description: "Second candidate 선정", action: "SELECT_CANDIDATE", expectedOutcome: "CANDIDATE_SELECTED" },
      { description: "Tightened config 생성", action: "GENERATE_CONFIG", expectedOutcome: "TIGHTENED" },
      { description: "Second DocType SHADOW_ONLY 등록", action: "REGISTER", expectedState: "SHADOW_ONLY" },
      { description: "Parallel ops readiness 체크 통과", action: "CHECK_PARALLEL", expectedOutcome: "CAN_PROCEED" },
      { description: "ACTIVE_5 승격 승인", action: "APPROVE_PROMOTION", expectedState: "ACTIVE_5" },
      { description: "First DocType 불안정 시 Second 승격 블록", action: "CHECK_PARALLEL", expectedOutcome: "BLOCKED" },
    ],
  },

  // ── 7. Certification — REPLAY Mode ──
  {
    id: "E2E_007",
    name: "Certification REPLAY — Sample Consistency",
    description: "승격 전 REPLAY 모드 certification으로 샘플 일관성 검증",
    category: "CERTIFICATION",
    steps: [
      { description: "ACTIVE_25 상태에서 승격 전 certification 요청", action: "REQUEST_CERT", expectedState: "ACTIVE_25" },
      { description: "REPLAY 모드 실행 (100 샘플)", action: "RUN_CERT", expectedOutcome: "REPLAY" },
      { description: "불일치율 2% → PASS", action: "CHECK_RESULT", expectedOutcome: "PASS" },
      { description: "Certification report 생성", action: "GENERATE_REPORT", expectedOutcome: "CERTIFICATION" },
      { description: "승격 요청 진행", action: "REQUEST_PROMOTION" },
    ],
  },

  // ── 8. Certification Failure — HOLD_REQUIRED ──
  {
    id: "E2E_008",
    name: "Certification Failure — Hold Required",
    description: "Certification 실패로 승격 보류",
    category: "CERTIFICATION",
    steps: [
      { description: "LAUNCH 모드 certification 실행", action: "RUN_CERT", expectedOutcome: "LAUNCH" },
      { description: "Guard check 실패 (halt count 초과)", action: "CHECK_RESULT", expectedOutcome: "HOLD_REQUIRED" },
      { description: "승격 요청 거부", action: "BLOCK_PROMOTION", expectedOutcome: "HOLD" },
      { description: "Force hold 적용", action: "FORCE_HOLD", expectedOutcome: "HELD" },
      { description: "Ops team 검토 대기", action: "AWAIT_REVIEW" },
    ],
  },

  // ── 9. Stabilization Degradation → Policy Tightening ──
  {
    id: "E2E_009",
    name: "Stabilization Degradation — Policy Tightening",
    description: "FULL_ACTIVE 상태에서 품질 악화 감지 → 정책 강화",
    category: "EDGE_CASE",
    steps: [
      { description: "FULL_ACTIVE_WITH_RESTRICTIONS 상태", action: "MONITOR", expectedState: "FULL_ACTIVE_WITH_RESTRICTIONS" },
      { description: "7일 트렌드 DEGRADING 감지", action: "CHECK_STABILIZATION", expectedOutcome: "DEGRADING" },
      { description: "Policy tightening 권고", action: "EVALUATE_POLICY", expectedOutcome: "TIGHTEN" },
      { description: "Alert 발행 (MEDIUM)", action: "EMIT_ALERT", expectedOutcome: "STABILIZATION_DEGRADING" },
      { description: "Auto-verify 임계값 상향 조정", action: "ADJUST_POLICY", expectedOutcome: "TIGHTENED" },
      { description: "Long-tail backlog 생성", action: "BUILD_BACKLOG", expectedOutcome: "BACKLOG_CREATED" },
    ],
  },

  // ── 10. Approval Expiry & Re-request ──
  {
    id: "E2E_010",
    name: "Approval Expiry — Stale Approval Handling",
    description: "승인 요청이 만료되고 재요청하는 시나리오",
    category: "EDGE_CASE",
    steps: [
      { description: "승격 요청 생성 (PENDING)", action: "REQUEST_PROMOTION", expectedOutcome: "PENDING" },
      { description: "48시간 경과 — 만료 처리", action: "EXPIRE_APPROVALS", expectedOutcome: "EXPIRED" },
      { description: "Alert 발행 (LOW)", action: "EMIT_ALERT", expectedOutcome: "APPROVAL_EXPIRED" },
      { description: "재평가 후 새 승격 요청", action: "REQUEST_PROMOTION", expectedOutcome: "NEW_PENDING" },
      { description: "즉시 승인", action: "APPROVE_PROMOTION", expectedOutcome: "APPROVED" },
      { description: "Transition 실행", action: "EXECUTE_TRANSITION" },
    ],
  },
];

/**
 * 시나리오 조회 헬퍼
 */
export function getScenarioById(id: string): E2EScenario | undefined {
  return E2E_SCENARIOS.find((s) => s.id === id);
}

export function getScenariosByCategory(category: E2EScenario["category"]): E2EScenario[] {
  return E2E_SCENARIOS.filter((s) => s.category === category);
}

export function listScenarioSummaries(): { id: string; name: string; category: string; stepCount: number }[] {
  return E2E_SCENARIOS.map((s) => ({
    id: s.id,
    name: s.name,
    category: s.category,
    stepCount: s.steps.length,
  }));
}
