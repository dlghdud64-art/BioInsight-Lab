/**
 * Institutional Stewardship (Phase U) — 일몰/재창설 관리
 * 시스템/프로세스의 생애주기 종료(Sunset) 및 재창설(Refoundation)을 체계적으로 관리한다.
 * 순수 함수 — 제공된 데이터 기반 동작.
 */

export type LifecyclePhase =
  | "ACTIVE"
  | "REVIEW"
  | "SUNSET_PROPOSED"
  | "SUNSET_APPROVED"
  | "WINDING_DOWN"
  | "ARCHIVED"
  | "REFOUNDED";

export type DataDisposition = "ARCHIVE" | "MIGRATE" | "DELETE" | "RETAIN_READ_ONLY";

export interface WindDownStep {
  order: number;
  action: string;
  responsible: string;
  completedAt: Date | null;
}

export interface SunsetPlan {
  systemId: string;
  systemName: string;
  phase: LifecyclePhase;
  proposedAt: Date | null;
  proposedBy: string | null;
  approvedAt: Date | null;
  approvedBy: string | null;
  windDownSteps: WindDownStep[];
  dataDisposition: DataDisposition;
  stakeholderNotified: boolean;
  refoundationNotes: string | null;
}

const sunsetPlans: SunsetPlan[] = [];

export function proposeSunset(params: {
  systemId: string;
  systemName: string;
  proposedBy: string;
  dataDisposition: DataDisposition;
  windDownSteps: Omit<WindDownStep, "completedAt">[];
}): SunsetPlan {
  const plan: SunsetPlan = {
    systemId: params.systemId,
    systemName: params.systemName,
    phase: "SUNSET_PROPOSED",
    proposedAt: new Date(),
    proposedBy: params.proposedBy,
    approvedAt: null,
    approvedBy: null,
    windDownSteps: params.windDownSteps.map((s) => ({ ...s, completedAt: null })),
    dataDisposition: params.dataDisposition,
    stakeholderNotified: false,
    refoundationNotes: null,
  };
  sunsetPlans.push(plan);
  return plan;
}

export function approveSunset(systemId: string, approvedBy: string): boolean {
  const plan = sunsetPlans.find((p) => p.systemId === systemId);
  if (!plan || plan.phase !== "SUNSET_PROPOSED") return false;
  plan.phase = "SUNSET_APPROVED";
  plan.approvedAt = new Date();
  plan.approvedBy = approvedBy;
  return true;
}

export function executeWindDown(systemId: string, stepOrder: number): boolean {
  const plan = sunsetPlans.find((p) => p.systemId === systemId);
  if (!plan || (plan.phase !== "SUNSET_APPROVED" && plan.phase !== "WINDING_DOWN")) return false;
  const step = plan.windDownSteps.find((s) => s.order === stepOrder);
  if (!step || step.completedAt) return false;
  step.completedAt = new Date();
  plan.phase = "WINDING_DOWN";
  if (plan.windDownSteps.every((s) => s.completedAt)) plan.phase = "ARCHIVED";
  return true;
}

export function archiveSystem(systemId: string): boolean {
  const plan = sunsetPlans.find((p) => p.systemId === systemId);
  if (!plan) return false;
  plan.phase = "ARCHIVED";
  return true;
}

export function proposeRefoundation(systemId: string, notes: string): boolean {
  const plan = sunsetPlans.find((p) => p.systemId === systemId);
  if (!plan || plan.phase !== "ARCHIVED") return false;
  plan.phase = "REFOUNDED";
  plan.refoundationNotes = notes;
  return true;
}

export function getSunsetPlan(systemId: string): SunsetPlan | undefined {
  return sunsetPlans.find((p) => p.systemId === systemId);
}

export function getAllSunsetPlans(phase?: LifecyclePhase): SunsetPlan[] {
  if (phase) return sunsetPlans.filter((p) => p.phase === phase);
  return [...sunsetPlans];
}
