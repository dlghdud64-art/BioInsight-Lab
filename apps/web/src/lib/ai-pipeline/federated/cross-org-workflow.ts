/**
 * @module cross-org-workflow
 * @description 조직 간 워크플로우 오케스트레이션
 *
 * 공동 감사, 증거 검토, 정책 정렬, 사고 대응, 벤치마킹 등
 * 여러 조직이 참여하는 워크플로우를 관리한다.
 */

/** 워크플로우 유형 */
export type WorkflowType =
  | "JOINT_AUDIT"
  | "EVIDENCE_REVIEW"
  | "POLICY_ALIGNMENT"
  | "INCIDENT_RESPONSE"
  | "BENCHMARKING_ROUND";

/** 워크플로우 상태 */
export type WorkflowStatus =
  | "INITIATED"
  | "IN_PROGRESS"
  | "AWAITING_PARTICIPANTS"
  | "COMPLETED"
  | "CANCELLED";

/** 워크플로우 단계 */
export interface WorkflowStep {
  stepId: string;
  name: string;
  assignee: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED";
  completedAt: Date | null;
}

/** 조직 간 워크플로우 */
export interface CrossOrgWorkflow {
  id: string;
  type: WorkflowType;
  participants: string[];
  steps: WorkflowStep[];
  status: WorkflowStatus;
  initiatedBy: string;
  startedAt: Date;
  completedAt: Date | null;
}

/** 워크플로우 시작 요청 */
export interface InitiateWorkflowInput {
  type: WorkflowType;
  participants: string[];
  steps: Array<{
    stepId: string;
    name: string;
    assignee: string;
  }>;
  initiatedBy: string;
}

/** 인메모리 워크플로우 저장소 */
const workflowStore: CrossOrgWorkflow[] = [];

/** 고유 ID 생성 */
let workflowSeq = 0;
function nextWorkflowId(): string {
  workflowSeq += 1;
  return `workflow-${workflowSeq}`;
}

/**
 * 조직 간 워크플로우를 시작한다.
 * @param input 워크플로우 시작 정보
 * @returns 생성된 워크플로우
 */
export function initiateWorkflow(
  input: InitiateWorkflowInput,
): CrossOrgWorkflow {
  if (input.participants.length < 2) {
    throw new Error(
      "조직 간 워크플로우에는 최소 2개 이상의 참여 조직이 필요합니다.",
    );
  }
  if (input.steps.length === 0) {
    throw new Error("워크플로우에는 최소 1개 이상의 단계가 필요합니다.");
  }

  const workflow: CrossOrgWorkflow = {
    id: nextWorkflowId(),
    type: input.type,
    participants: [...input.participants],
    steps: input.steps.map((s) => ({
      stepId: s.stepId,
      name: s.name,
      assignee: s.assignee,
      status: "PENDING" as const,
      completedAt: null,
    })),
    status: "INITIATED",
    initiatedBy: input.initiatedBy,
    startedAt: new Date(),
    completedAt: null,
  };

  workflowStore.push(workflow);
  return workflow;
}

/**
 * 워크플로우의 다음 단계를 진행한다.
 * 현재 진행 중인 단계를 완료하고 다음 대기 단계를 시작한다.
 * @param workflowId 워크플로우 ID
 * @returns 갱신된 워크플로우
 * @throws 워크플로우를 찾을 수 없거나 진행 불가한 경우
 */
export function advanceStep(workflowId: string): CrossOrgWorkflow {
  const workflow = workflowStore.find((w) => w.id === workflowId);
  if (!workflow) {
    throw new Error(`워크플로우 '${workflowId}'을(를) 찾을 수 없습니다.`);
  }
  if (workflow.status === "COMPLETED" || workflow.status === "CANCELLED") {
    throw new Error(
      `워크플로우 상태가 '${workflow.status}'이므로 진행할 수 없습니다.`,
    );
  }

  // 현재 진행 중인 단계를 완료 처리
  const inProgressStep = workflow.steps.find(
    (s) => s.status === "IN_PROGRESS",
  );
  if (inProgressStep) {
    inProgressStep.status = "COMPLETED";
    inProgressStep.completedAt = new Date();
  }

  // 다음 대기 단계를 시작
  const nextPending = workflow.steps.find((s) => s.status === "PENDING");
  if (nextPending) {
    nextPending.status = "IN_PROGRESS";
    workflow.status = "IN_PROGRESS";
  } else {
    // 모든 단계 완료
    workflow.status = "COMPLETED";
    workflow.completedAt = new Date();
  }

  return workflow;
}

/**
 * 워크플로우를 강제 완료한다.
 * @param workflowId 완료할 워크플로우 ID
 * @returns 완료된 워크플로우
 */
export function completeWorkflow(workflowId: string): CrossOrgWorkflow {
  const workflow = workflowStore.find((w) => w.id === workflowId);
  if (!workflow) {
    throw new Error(`워크플로우 '${workflowId}'을(를) 찾을 수 없습니다.`);
  }

  workflow.status = "COMPLETED";
  workflow.completedAt = new Date();

  // 미완료 단계를 SKIPPED 처리
  for (const step of workflow.steps) {
    if (step.status === "PENDING" || step.status === "IN_PROGRESS") {
      step.status = "SKIPPED";
    }
  }

  return workflow;
}

/**
 * 활성 워크플로우 목록을 반환한다.
 * @param participantId 참여 조직 ID (선택)
 * @returns 활성 워크플로우 배열
 */
export function getActiveWorkflows(
  participantId?: string,
): CrossOrgWorkflow[] {
  return workflowStore.filter((w) => {
    if (w.status === "COMPLETED" || w.status === "CANCELLED") return false;
    if (participantId) return w.participants.includes(participantId);
    return true;
  });
}
