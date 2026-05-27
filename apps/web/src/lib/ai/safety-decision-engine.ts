// ══════════════════════════════════════════════════════════════════════════════
// Safety Decision Engine
// ──────────────────────────────────────────────────────────────────────────────
// AI-guided operational judgment for safety management.
// Produces: mission brief, tri-option recommendations, prioritized queue,
//           per-item rationale + action handoff.
// NOT a chatbot. This is a structured recommendation layer.
// ══════════════════════════════════════════════════════════════════════════════

// ── Types ────────────────────────────────────────────────────────────────────

export type SafetyLevel = "HIGH" | "MEDIUM" | "LOW";
export type ActionStatus = "normal" | "caution" | "action_required";

/** AI-assigned operational classification per item */
export type OperationalClassification =
  | "immediate_action"
  | "document_remediation"
  | "review_required"
  | "monitor_only"
  | "compliant";

export interface SafetyItemInput {
  id: number;
  name: string;
  cas: string;
  isHighRisk: boolean;
  level: SafetyLevel;
  actionStatus: ActionStatus;
  hasMsds: boolean;
  msdsUpdatedAt: string | null;
  registeredAt: string;
  lastInspection: string | null;
  storageCondition: string;
  loc: string;
  icons: readonly string[];
  ppe: { type: string; required: boolean }[];
}

export interface ClassifiedSafetyItem extends SafetyItemInput {
  classification: OperationalClassification;
  classificationLabel: string;
  priorityRank: number;
  nextAction: string;
  nextActionType: "disposal" | "msds_register" | "inspection" | "review" | "monitor";
  priorityReason: string;
  holdRisk: string;
  blockers: string[];
  documentStatus: "complete" | "partial" | "missing";
  confidenceLevel: "high" | "medium" | "low";
}

export type StrategyFrame = "risk_minimize" | "compliance_first" | "balanced_ops";

export interface StrategyOption {
  frame: StrategyFrame;
  title: string;
  subtitle: string;
  sequence: ClassifiedSafetyItem[];
  advantage: string;
  risk: string;
  firstTarget: string;
  actionable: boolean;
  immediateCount: number;
  remediationCount: number;
  monitorCount: number;
}

export interface MissionBrief {
  immediateActionCount: number;
  documentRemediationCount: number;
  reviewRequiredCount: number;
  monitorOnlyCount: number;
  compliantCount: number;
  topPriority: string[];
  briefingSummary: string;
}

export interface SafetyDecisionResult {
  brief: MissionBrief;
  options: StrategyOption[];
  queue: ClassifiedSafetyItem[];
  allClassified: ClassifiedSafetyItem[];
}

// ── Classification Logic ─────────────────────────────────────────────────────

function classifySafetyItem(item: SafetyItemInput): ClassifiedSafetyItem {
  const blockers: string[] = [];
  if (!item.hasMsds) blockers.push("MSDS 미등록");
  if (!item.lastInspection) blockers.push("점검 이력 없음");
  if (item.actionStatus === "action_required") blockers.push("조치 필요 상태");

  const documentStatus: "complete" | "partial" | "missing" =
    item.hasMsds && item.lastInspection ? "complete" :
    item.hasMsds || item.lastInspection ? "partial" : "missing";

  // Determine operational classification
  let classification: OperationalClassification;
  let classificationLabel: string;
  let priorityRank: number;
  let nextAction: string;
  let nextActionType: ClassifiedSafetyItem["nextActionType"];
  let priorityReason: string;
  let holdRisk: string;
  let confidenceLevel: "high" | "medium" | "low";

  if (item.isHighRisk && (item.actionStatus === "action_required" || item.actionStatus === "caution")) {
    // HIGH risk + action needed → immediate
    classification = "immediate_action";
    classificationLabel = "즉시 조치";
    priorityRank = 1;
    nextAction = item.level === "HIGH" && item.actionStatus === "action_required"
      ? "폐기 또는 격리 처리" : "위험 요인 점검 및 조치";
    nextActionType = item.level === "HIGH" ? "disposal" : "review";
    priorityReason = `고위험(${item.level}) 물질이며 ${item.actionStatus === "action_required" ? "즉각 조치가 필요한" : "주의가 필요한"} 상태입니다.`;
    holdRisk = "방치 시 안전 사고 발생 가능성이 높습니다.";
    confidenceLevel = "high";
  } else if (!item.hasMsds && !item.lastInspection) {
    // Missing both docs → document remediation (high urgency)
    classification = "document_remediation";
    classificationLabel = "문서 보완";
    priorityRank = item.isHighRisk ? 2 : 3;
    nextAction = "MSDS 등록 후 점검 기록 생성";
    nextActionType = "msds_register";
    priorityReason = "안전보건자료(MSDS)와 점검 이력이 모두 누락되어 규정 준수 불가 상태입니다.";
    holdRisk = "감사 시 부적합 판정 및 관리 의무 위반 가능성이 있습니다.";
    confidenceLevel = "high";
  } else if (!item.hasMsds) {
    // MSDS missing only
    classification = "document_remediation";
    classificationLabel = "문서 보완";
    priorityRank = item.isHighRisk ? 2 : 4;
    nextAction = "MSDS 등록";
    nextActionType = "msds_register";
    priorityReason = "안전보건자료(MSDS)가 누락되어 규정 대응이 불완전합니다.";
    holdRisk = "MSDS 미비 시 KOSHA 규정 위반에 해당합니다.";
    confidenceLevel = "high";
  } else if (!item.lastInspection) {
    // Inspection missing only
    classification = "review_required";
    classificationLabel = "검토 필요";
    priorityRank = item.isHighRisk ? 3 : 5;
    nextAction = "점검 기록 생성";
    nextActionType = "inspection";
    priorityReason = "점검 이력이 없어 현재 보관 상태를 확인할 수 없습니다.";
    holdRisk = "보관 이상 발견이 지연될 수 있습니다.";
    confidenceLevel = "medium";
  } else if (item.actionStatus === "caution") {
    // Has docs but cautionary status
    classification = "monitor_only";
    classificationLabel = "모니터링";
    priorityRank = 6;
    nextAction = "상태 모니터링 유지";
    nextActionType = "monitor";
    priorityReason = "문서는 정비되었으나 주의 상태가 지속되고 있습니다.";
    holdRisk = "상태 악화 시 즉시 조치 단계로 격상됩니다.";
    confidenceLevel = "medium";
  } else {
    // All good
    classification = "compliant";
    classificationLabel = "정상";
    priorityRank = 10;
    nextAction = "정기 모니터링";
    nextActionType = "monitor";
    priorityReason = "MSDS 등록, 점검 완료, 정상 운영 상태입니다.";
    holdRisk = "현재 리스크 없음";
    confidenceLevel = "high";
  }

  return {
    ...item,
    classification,
    classificationLabel,
    priorityRank,
    nextAction,
    nextActionType,
    priorityReason,
    holdRisk,
    blockers,
    documentStatus,
    confidenceLevel,
  };
}

// ── Mission Brief ────────────────────────────────────────────────────────────

function buildMissionBrief(classified: ClassifiedSafetyItem[]): MissionBrief {
  const counts = {
    immediate_action: 0,
    document_remediation: 0,
    review_required: 0,
    monitor_only: 0,
    compliant: 0,
  };
  for (const item of classified) {
    counts[item.classification]++;
  }

  const sorted = [...classified].sort((a, b) => a.priorityRank - b.priorityRank);
  const topPriority = sorted.slice(0, 3).map((i) => i.name);

  const parts: string[] = [];
  if (counts.immediate_action > 0) parts.push(`즉시 조치 ${counts.immediate_action}건`);
  if (counts.document_remediation > 0) parts.push(`문서 보완 ${counts.document_remediation}건`);
  if (counts.review_required > 0) parts.push(`검토 필요 ${counts.review_required}건`);
  if (counts.monitor_only > 0) parts.push(`모니터링 ${counts.monitor_only}건`);
  if (counts.compliant > 0) parts.push(`정상 ${counts.compliant}건`);

  return {
    immediateActionCount: counts.immediate_action,
    documentRemediationCount: counts.document_remediation,
    reviewRequiredCount: counts.review_required,
    monitorOnlyCount: counts.monitor_only,
    compliantCount: counts.compliant,
    topPriority,
    briefingSummary: parts.join(" / "),
  };
}

// ── Tri-Option Strategy ──────────────────────────────────────────────────────

function buildStrategyOptions(classified: ClassifiedSafetyItem[]): StrategyOption[] {
  const sorted = [...classified].sort((a, b) => a.priorityRank - b.priorityRank);

  // Option A: Risk Minimize — prioritize high-risk immediate action first
  const riskFirst = [...sorted].sort((a, b) => {
    const aScore = a.classification === "immediate_action" ? 0 : a.classification === "review_required" ? 1 : 2;
    const bScore = b.classification === "immediate_action" ? 0 : b.classification === "review_required" ? 1 : 2;
    if (aScore !== bScore) return aScore - bScore;
    return (a.isHighRisk ? 0 : 1) - (b.isHighRisk ? 0 : 1);
  });

  // Option B: Compliance First — prioritize document remediation
  const complianceFirst = [...sorted].sort((a, b) => {
    const aScore = a.classification === "document_remediation" ? 0 : a.classification === "review_required" ? 1 : 2;
    const bScore = b.classification === "document_remediation" ? 0 : b.classification === "review_required" ? 1 : 2;
    if (aScore !== bScore) return aScore - bScore;
    return a.priorityRank - b.priorityRank;
  });

  // Option C: Balanced — interleave immediate + remediation
  const balanced = [...sorted].sort((a, b) => {
    // Composite: immediate first, then docs, then rest
    const aWeight = a.classification === "immediate_action" ? 0
      : a.classification === "document_remediation" ? 1
      : a.classification === "review_required" ? 2 : 3;
    const bWeight = b.classification === "immediate_action" ? 0
      : b.classification === "document_remediation" ? 1
      : b.classification === "review_required" ? 2 : 3;
    if (aWeight !== bWeight) return aWeight - bWeight;
    return a.priorityRank - b.priorityRank;
  });

  const countByType = (items: ClassifiedSafetyItem[]) => ({
    immediate: items.filter((i) => i.classification === "immediate_action").length,
    remediation: items.filter((i) => i.classification === "document_remediation" || i.classification === "review_required").length,
    monitor: items.filter((i) => i.classification === "monitor_only" || i.classification === "compliant").length,
  });

  const riskCounts = countByType(riskFirst);
  const compCounts = countByType(complianceFirst);
  const balCounts = countByType(balanced);

  return [
    {
      frame: "risk_minimize",
      title: "위험 최소화 우선",
      subtitle: "고위험 물질 즉시 격리/폐기 처리 중심으로 진행합니다.",
      sequence: riskFirst,
      advantage: "즉시 위험 노출이 감소합니다.",
      risk: "문서 보완 작업이 뒤로 밀립니다.",
      firstTarget: riskFirst[0]?.name ?? "—",
      actionable: riskCounts.immediate > 0,
      immediateCount: riskCounts.immediate,
      remediationCount: riskCounts.remediation,
      monitorCount: riskCounts.monitor,
    },
    {
      frame: "compliance_first",
      title: "규정 준수 우선",
      subtitle: "MSDS 누락 및 점검 미비를 먼저 정리합니다.",
      sequence: complianceFirst,
      advantage: "감사/컴플라이언스 리스크가 감소합니다.",
      risk: "실물 위험 조치가 늦어질 수 있습니다.",
      firstTarget: complianceFirst[0]?.name ?? "—",
      actionable: compCounts.remediation > 0,
      immediateCount: compCounts.immediate,
      remediationCount: compCounts.remediation,
      monitorCount: compCounts.monitor,
    },
    {
      frame: "balanced_ops",
      title: "운영 균형 우선",
      subtitle: "고위험 즉시 처리 + 문서 누락 병행 진행합니다.",
      sequence: balanced,
      advantage: "작업 분산이 좋고 양면 리스크를 동시에 줄입니다.",
      risk: "가장 빠른 단일 리스크 제거는 아닙니다.",
      firstTarget: balanced[0]?.name ?? "—",
      actionable: balCounts.immediate > 0 || balCounts.remediation > 0,
      immediateCount: balCounts.immediate,
      remediationCount: balCounts.remediation,
      monitorCount: balCounts.monitor,
    },
  ];
}

// ── Public Entry ──────────────────────────────────────────────────────────────

export function buildSafetyDecision(items: SafetyItemInput[]): SafetyDecisionResult {
  const classified = items.map(classifySafetyItem);
  const brief = buildMissionBrief(classified);
  const options = buildStrategyOptions(classified);
  const queue = [...classified]
    .filter((i) => i.classification !== "compliant")
    .sort((a, b) => a.priorityRank - b.priorityRank)
    .slice(0, 5);

  return { brief, options, queue, allClassified: classified };
}
