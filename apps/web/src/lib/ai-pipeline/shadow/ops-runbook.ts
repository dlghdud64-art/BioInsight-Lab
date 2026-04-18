/**
 * Ops Runbook & Incident Playbook — 운영 절차서 및 인시던트 대응 플레이북
 *
 * 각 SEV 레벨별 대응 절차, 포스트모템 템플릿, 런북 생성기
 */

import type { SeverityLevel } from "./slo-alert-routing";
import type { LifecycleState } from "./rollout-state-machine";

// ── Runbook Entry ──

export interface RunbookStep {
  order: number;
  action: string;
  detail: string;
  automated: boolean;
  toolCommand?: string;
}

export interface RunbookEntry {
  id: string;
  title: string;
  trigger: string;
  severity: SeverityLevel;
  steps: RunbookStep[];
  rollbackProcedure: string[];
  verificationChecks: string[];
}

// ── Postmortem Template ──

export interface PostmortemTemplate {
  incidentId: string;
  severity: SeverityLevel;
  documentType: string;
  detectedAt: string;
  resolvedAt: string | null;
  timeline: { time: string; event: string }[];
  rootCause: string;
  impact: string;
  actionItems: { owner: string; task: string; dueDate: string }[];
  lessonsLearned: string[];
}

// ── Standard Runbooks ──

export const STANDARD_RUNBOOKS: RunbookEntry[] = [
  {
    id: "RB_001",
    title: "Emergency OFF 실행",
    trigger: "SEV0 — Invariant Violation 또는 데이터 손상 감지",
    severity: "SEV0",
    steps: [
      { order: 1, action: "Emergency OFF 실행", detail: "ops-control-plane.emergencyOff() 호출", automated: true, toolCommand: "emergencyOff" },
      { order: 2, action: "영향 범위 확인", detail: "해당 DocType의 최근 1시간 처리 건수 및 영향 고객 파악", automated: false },
      { order: 3, action: "PagerDuty 에스컬레이션", detail: "Tech Lead + CTO에게 즉시 알림", automated: true },
      { order: 4, action: "데이터 무결성 검증", detail: "잘못 기록된 데이터 식별 및 격리", automated: false },
      { order: 5, action: "고객 커뮤니케이션", detail: "영향받은 조직에 상태 알림", automated: false },
    ],
    rollbackProcedure: [
      "해당 DocType OFF 상태 유지",
      "원인 분석 완료 후 SHADOW_ONLY부터 재시작",
      "최소 72시간 shadow 관찰 후 재승격 검토",
    ],
    verificationChecks: [
      "해당 DocType의 모든 처리가 Rules Path로 전환되었는지 확인",
      "pending approval이 모두 만료/취소되었는지 확인",
      "영향받은 데이터에 대한 수동 검증 완료",
    ],
  },
  {
    id: "RB_002",
    title: "False-Safe 대량 감지 대응",
    trigger: "SEV1 — False-safe 패턴 3건 이상 동시 감지",
    severity: "SEV1",
    steps: [
      { order: 1, action: "Auto-verify 비활성화", detail: "disableAutoVerify() 즉시 실행", automated: true, toolCommand: "disableAutoVerify" },
      { order: 2, action: "False-safe 샘플 추출", detail: "최근 24시간 false-safe 후보 전량 추출", automated: true },
      { order: 3, action: "수동 리뷰 배정", detail: "리뷰 큐에 긴급 우선순위로 배정", automated: false },
      { order: 4, action: "패턴 분석", detail: "공통 Vendor/Template/Confidence Band 식별", automated: false },
      { order: 5, action: "Exclusion 등록", detail: "확인된 위험 패턴을 exclusion registry에 추가", automated: false },
    ],
    rollbackProcedure: [
      "Auto-verify 비활성 상태 유지",
      "모든 false-safe 케이스 수동 검증 완료 필요",
      "Exclusion 반영 후 재활성화 검토",
    ],
    verificationChecks: [
      "false-safe rate이 0으로 감소했는지 확인",
      "영향받은 건의 수동 검증 완료",
      "동일 패턴의 재발 방지 조치 적용",
    ],
  },
  {
    id: "RB_003",
    title: "Stage Rollback 실행",
    trigger: "SEV2 — Promotion gate 실패 또는 품질 임계치 초과",
    severity: "SEV2",
    steps: [
      { order: 1, action: "Rollback 실행", detail: "rollbackToStage() 호출", automated: true, toolCommand: "rollbackToStage" },
      { order: 2, action: "Rollback Incident Report 생성", detail: "자동 리포트 생성", automated: true },
      { order: 3, action: "원인 분석", detail: "mismatch/fallback 분포 확인", automated: false },
      { order: 4, action: "수정 조치 계획", detail: "프롬프트 개선, 모델 교체 등 계획 수립", automated: false },
    ],
    rollbackProcedure: [
      "타겟 stage에서 최소 48시간 관찰",
      "게이트 조건 재충족 시 재승격 요청",
    ],
    verificationChecks: [
      "롤백 후 해당 stage에서 안정적으로 동작하는지 확인",
      "mismatch rate이 임계치 이하로 안정화",
    ],
  },
  {
    id: "RB_004",
    title: "Stabilization 품질 악화 대응",
    trigger: "SEV2 — Stabilization trend DEGRADING",
    severity: "SEV2",
    steps: [
      { order: 1, action: "대시보드 확인", detail: "7일 트렌드 및 일별 지표 분석", automated: true },
      { order: 2, action: "Long-tail backlog 생성", detail: "이상 패턴 분류 및 백로그 등록", automated: true },
      { order: 3, action: "Policy 강화 검토", detail: "confidence 임계치 상향, exclusion 추가", automated: false },
      { order: 4, action: "원인 조사", detail: "신규 벤더/양식 유입 여부 확인", automated: false },
    ],
    rollbackProcedure: [
      "ACTIVE_100 → ACTIVE_50 롤백 검토",
      "auto-verify 비활성화 검토",
    ],
    verificationChecks: [
      "트렌드가 STABLE 또는 IMPROVING으로 전환",
      "long-tail backlog 처리율 확인",
    ],
  },
];

export function getRunbookById(id: string): RunbookEntry | undefined {
  return STANDARD_RUNBOOKS.find((r) => r.id === id);
}

export function getRunbooksBySeverity(severity: SeverityLevel): RunbookEntry[] {
  return STANDARD_RUNBOOKS.filter((r) => r.severity === severity);
}

/**
 * 포스트모템 템플릿 생성
 */
export function createPostmortemTemplate(params: {
  severity: SeverityLevel;
  documentType: string;
  detectedAt: Date;
}): PostmortemTemplate {
  return {
    incidentId: `INC-${Date.now()}`,
    severity: params.severity,
    documentType: params.documentType,
    detectedAt: params.detectedAt.toISOString(),
    resolvedAt: null,
    timeline: [
      { time: params.detectedAt.toISOString(), event: "인시던트 감지" },
    ],
    rootCause: "",
    impact: "",
    actionItems: [],
    lessonsLearned: [],
  };
}
