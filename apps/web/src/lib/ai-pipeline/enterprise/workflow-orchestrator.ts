/**
 * Workflow Orchestrator — 느슨하게 결합된 엔터프라이즈 워크플로우
 *
 * 문서 검증 완료 → 구매 매핑 호출, 실패 → 티켓팅 라우팅 등
 * 각 Bridge와 Event Bus를 통해 오케스트레이션합니다.
 */

import { createEvent, publish } from "./event-bus-contracts";
import type { EnterpriseEvent } from "./event-bus-contracts";

// ── Workflow Definition ──

export type WorkflowStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "TIMED_OUT" | "CANCELLED";

export interface WorkflowStep {
  id: string;
  name: string;
  targetSystem: string;
  eventAction: string;
  status: WorkflowStatus;
  startedAt: Date | null;
  completedAt: Date | null;
  error: string | null;
  timeoutMs: number;
  retryable: boolean;
  fallbackAction: string | null;
}

export interface WorkflowInstance {
  id: string;
  name: string;
  tenantId: string;
  correlationId: string;
  triggerEvent: string;
  status: WorkflowStatus;
  steps: WorkflowStep[];
  currentStepIndex: number;
  createdAt: Date;
  completedAt: Date | null;
  metadata: Record<string, unknown>;
}

// In-memory store
const workflows: WorkflowInstance[] = [];

/**
 * 문서 검증 완료 후 워크플로우 시작
 */
export function startDocumentVerifiedWorkflow(params: {
  tenantId: string;
  documentId: string;
  documentType: string;
  verificationResult: string;
  correlationId: string;
}): WorkflowInstance {
  const workflow: WorkflowInstance = {
    id: `WF-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: "document-verified-flow",
    tenantId: params.tenantId,
    correlationId: params.correlationId,
    triggerEvent: "document.verified",
    status: "PENDING",
    currentStepIndex: 0,
    createdAt: new Date(),
    completedAt: null,
    metadata: {
      documentId: params.documentId,
      documentType: params.documentType,
      verificationResult: params.verificationResult,
    },
    steps: [
      {
        id: "step-1",
        name: "Procurement Mapping",
        targetSystem: "PROCUREMENT_BRIDGE",
        eventAction: "procurement.order_matched",
        status: "PENDING",
        startedAt: null,
        completedAt: null,
        error: null,
        timeoutMs: 30_000,
        retryable: true,
        fallbackAction: "CREATE_TICKET",
      },
      {
        id: "step-2",
        name: "Inventory Reconciliation",
        targetSystem: "INVENTORY_BRIDGE",
        eventAction: "inventory.discrepancy_detected",
        status: "PENDING",
        startedAt: null,
        completedAt: null,
        error: null,
        timeoutMs: 30_000,
        retryable: true,
        fallbackAction: "CREATE_TICKET",
      },
      {
        id: "step-3",
        name: "Budget Check",
        targetSystem: "FINANCE_BRIDGE",
        eventAction: "budget.approved",
        status: "PENDING",
        startedAt: null,
        completedAt: null,
        error: null,
        timeoutMs: 15_000,
        retryable: false,
        fallbackAction: "NOTIFY_FINANCE",
      },
    ],
  };

  workflows.push(workflow);
  return workflow;
}

/**
 * 워크플로우 스텝 실행
 */
export async function executeNextStep(workflowId: string): Promise<{
  stepped: boolean;
  stepName: string | null;
  workflowCompleted: boolean;
}> {
  const wf = workflows.find((w) => w.id === workflowId);
  if (!wf || wf.status === "COMPLETED" || wf.status === "FAILED") {
    return { stepped: false, stepName: null, workflowCompleted: false };
  }

  if (wf.currentStepIndex >= wf.steps.length) {
    wf.status = "COMPLETED";
    wf.completedAt = new Date();
    return { stepped: false, stepName: null, workflowCompleted: true };
  }

  const step = wf.steps[wf.currentStepIndex];
  step.status = "IN_PROGRESS";
  step.startedAt = new Date();
  wf.status = "IN_PROGRESS";

  try {
    // Publish event for this step
    const event = createEvent({
      action: "workflow.step_completed" as any,
      domain: "WORKFLOW",
      tenantId: wf.tenantId,
      correlationId: wf.correlationId,
      source: "WORKFLOW_ORCHESTRATOR",
      payload: {
        workflowId: wf.id,
        stepId: step.id,
        stepName: step.name,
        targetSystem: step.targetSystem,
      },
    });
    await publish(event);

    step.status = "COMPLETED";
    step.completedAt = new Date();
    wf.currentStepIndex++;

    if (wf.currentStepIndex >= wf.steps.length) {
      wf.status = "COMPLETED";
      wf.completedAt = new Date();
    }

    return { stepped: true, stepName: step.name, workflowCompleted: wf.status === "COMPLETED" };
  } catch (err) {
    step.status = "FAILED";
    step.error = err instanceof Error ? err.message : String(err);

    // Fallback: route to ticketing
    if (step.fallbackAction === "CREATE_TICKET") {
      const ticketEvent = createEvent({
        action: "incident.opened",
        domain: "INCIDENT",
        tenantId: wf.tenantId,
        correlationId: wf.correlationId,
        source: "WORKFLOW_ORCHESTRATOR",
        payload: {
          workflowId: wf.id,
          failedStep: step.name,
          error: step.error,
          targetSystem: step.targetSystem,
        },
      });
      await publish(ticketEvent);
    }

    // Continue to next step (non-blocking)
    wf.currentStepIndex++;
    return { stepped: true, stepName: step.name, workflowCompleted: false };
  }
}

/**
 * 검증 실패 → 티켓 라우팅 워크플로우
 */
export function startVerificationFailedWorkflow(params: {
  tenantId: string;
  documentId: string;
  failureReason: string;
  correlationId: string;
}): WorkflowInstance {
  const workflow: WorkflowInstance = {
    id: `WF-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: "verification-failed-flow",
    tenantId: params.tenantId,
    correlationId: params.correlationId,
    triggerEvent: "document.verification_failed",
    status: "PENDING",
    currentStepIndex: 0,
    createdAt: new Date(),
    completedAt: null,
    metadata: { documentId: params.documentId, failureReason: params.failureReason },
    steps: [
      {
        id: "step-1",
        name: "Create Incident Ticket",
        targetSystem: "TICKETING_BRIDGE",
        eventAction: "incident.opened",
        status: "PENDING",
        startedAt: null,
        completedAt: null,
        error: null,
        timeoutMs: 15_000,
        retryable: true,
        fallbackAction: null,
      },
    ],
  };

  workflows.push(workflow);
  return workflow;
}

export function getWorkflow(id: string): WorkflowInstance | undefined {
  return workflows.find((w) => w.id === id);
}

export function getWorkflowsByTenant(tenantId: string): WorkflowInstance[] {
  return workflows.filter((w) => w.tenantId === tenantId);
}

export function getActiveWorkflows(): WorkflowInstance[] {
  return workflows.filter((w) => w.status === "PENDING" || w.status === "IN_PROGRESS");
}
