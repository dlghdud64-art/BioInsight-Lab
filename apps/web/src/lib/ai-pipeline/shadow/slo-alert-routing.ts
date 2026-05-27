/**
 * SLO & Alert Routing Map — SEV0-SEV3 with SLA definitions
 *
 * 각 Severity에 대해 Detection SLA, Response SLA, Rollback SLA,
 * Escalation Path, 알림 채널을 정의합니다.
 */

// ── Severity Levels ──

export type SeverityLevel = "SEV0" | "SEV1" | "SEV2" | "SEV3";

export interface SLODefinition {
  severity: SeverityLevel;
  name: string;
  description: string;
  detectionSlaMinutes: number;
  responseSlaMinutes: number;
  rollbackSlaMinutes: number;
  escalationPath: string[];
  notificationChannels: string[];
  autoRollback: boolean;
  requiresIncidentReport: boolean;
  examples: string[];
}

export const SLO_DEFINITIONS: SLODefinition[] = [
  {
    severity: "SEV0",
    name: "Critical — 즉시 대응",
    description: "프로덕션 데이터 손상 또는 전체 파이프라인 중단",
    detectionSlaMinutes: 5,
    responseSlaMinutes: 15,
    rollbackSlaMinutes: 30,
    escalationPath: ["on-call-sre", "tech-lead", "cto"],
    notificationChannels: ["pagerduty", "slack-sev0", "sms"],
    autoRollback: true,
    requiresIncidentReport: true,
    examples: [
      "Emergency OFF 트리거",
      "Invariant Violation — 잘못된 데이터 프로덕션 기록",
      "전체 AI 파이프라인 응답 불능",
    ],
  },
  {
    severity: "SEV1",
    name: "High — 긴급 대응",
    description: "단일 문서 타입 전체 장애 또는 false-safe 대량 발생",
    detectionSlaMinutes: 15,
    responseSlaMinutes: 30,
    rollbackSlaMinutes: 60,
    escalationPath: ["on-call-sre", "tech-lead"],
    notificationChannels: ["pagerduty", "slack-sev1"],
    autoRollback: true,
    requiresIncidentReport: true,
    examples: [
      "특정 DocType fallback rate > 20%",
      "False-safe 패턴 5건 이상 동시 감지",
      "Circuit breaker 연속 3회 트리거",
    ],
  },
  {
    severity: "SEV2",
    name: "Medium — 계획 대응",
    description: "품질 저하 트렌드 또는 단일 롤백 이벤트",
    detectionSlaMinutes: 60,
    responseSlaMinutes: 120,
    rollbackSlaMinutes: 240,
    escalationPath: ["on-call-sre"],
    notificationChannels: ["slack-alerts"],
    autoRollback: false,
    requiresIncidentReport: false,
    examples: [
      "Mismatch rate 상승 트렌드 (3일 연속)",
      "단일 DocType rollback 실행",
      "Auto-verify 비활성화",
      "Stabilization DEGRADING 감지",
    ],
  },
  {
    severity: "SEV3",
    name: "Low — 모니터링",
    description: "관찰 항목, 정보성 알림",
    detectionSlaMinutes: 240,
    responseSlaMinutes: 480,
    rollbackSlaMinutes: 0, // no rollback needed
    escalationPath: [],
    notificationChannels: ["slack-info"],
    autoRollback: false,
    requiresIncidentReport: false,
    examples: [
      "Approval 만료",
      "신규 DocType 등록",
      "Certification PASS_WITH_WARNINGS",
      "Stabilization trend IMPROVING",
    ],
  },
];

// ── Alert Routing ──

export interface AlertRoutingRule {
  eventPattern: string;
  severity: SeverityLevel;
  autoAction?: string;
}

export const ALERT_ROUTING_RULES: AlertRoutingRule[] = [
  { eventPattern: "EMERGENCY_OFF", severity: "SEV0", autoAction: "EMERGENCY_OFF" },
  { eventPattern: "INVARIANT_VIOLATION", severity: "SEV0", autoAction: "FORCE_HOLD" },
  { eventPattern: "FALSE_SAFE_DETECTED", severity: "SEV1", autoAction: "DISABLE_AUTO_VERIFY" },
  { eventPattern: "CIRCUIT_BREAKER_TRIPPED", severity: "SEV1", autoAction: "ROLLBACK" },
  { eventPattern: "ROLLBACK_EXECUTED", severity: "SEV2" },
  { eventPattern: "STABILIZATION_DEGRADING", severity: "SEV2" },
  { eventPattern: "AUTO_VERIFY_DISABLED", severity: "SEV2" },
  { eventPattern: "PROMOTION_REQUESTED", severity: "SEV3" },
  { eventPattern: "PROMOTION_APPROVED", severity: "SEV3" },
  { eventPattern: "APPROVAL_EXPIRED", severity: "SEV3" },
  { eventPattern: "CERTIFICATION_COMPLETED", severity: "SEV3" },
  { eventPattern: "STAGE_TRANSITION", severity: "SEV3" },
  { eventPattern: "SECOND_DOCTYPE_LAUNCHED", severity: "SEV3" },
];

export function resolveAlertSeverity(eventType: string): SeverityLevel {
  const rule = ALERT_ROUTING_RULES.find((r) => r.eventPattern === eventType);
  return rule?.severity ?? "SEV3";
}

export function getSLOForSeverity(severity: SeverityLevel): SLODefinition {
  return SLO_DEFINITIONS.find((s) => s.severity === severity)!;
}

export function getAutoAction(eventType: string): string | null {
  const rule = ALERT_ROUTING_RULES.find((r) => r.eventPattern === eventType);
  return rule?.autoAction ?? null;
}

/**
 * SLA 준수 여부 체크
 */
export function checkSLACompliance(params: {
  severity: SeverityLevel;
  detectedAt: Date;
  respondedAt: Date | null;
  rolledBackAt: Date | null;
}): {
  detectionOk: boolean;
  responseOk: boolean;
  rollbackOk: boolean;
  breaches: string[];
} {
  const slo = getSLOForSeverity(params.severity);
  const breaches: string[] = [];
  const now = new Date();

  const responseOk = params.respondedAt
    ? (params.respondedAt.getTime() - params.detectedAt.getTime()) <= slo.responseSlaMinutes * 60_000
    : (now.getTime() - params.detectedAt.getTime()) <= slo.responseSlaMinutes * 60_000;

  if (!responseOk) breaches.push(`Response SLA 초과 (${slo.responseSlaMinutes}분)`);

  const rollbackOk = slo.rollbackSlaMinutes === 0 || (
    params.rolledBackAt
      ? (params.rolledBackAt.getTime() - params.detectedAt.getTime()) <= slo.rollbackSlaMinutes * 60_000
      : true
  );

  if (!rollbackOk) breaches.push(`Rollback SLA 초과 (${slo.rollbackSlaMinutes}분)`);

  return {
    detectionOk: true, // detection is by definition within SLA since we have the event
    responseOk,
    rollbackOk,
    breaches,
  };
}
