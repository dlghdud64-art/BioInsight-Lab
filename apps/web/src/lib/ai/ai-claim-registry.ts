/**
 * AI Claim-Evidence Registry — 각 퍼블릭 문구가 어떤 구현 capability를 근거로 하는지 매핑
 *
 * 규칙:
 * - unsupported claim은 release 전 제거/수정
 * - supported_but_broad는 가능하면 stage-specific으로 구체화
 * - needs_reword는 operator boundary를 드러내는 방향으로 수정
 * - 구현 근거 없는 문장은 남기지 않는다
 */

// ══════════════════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════════════════

export type AiClaimSurface =
  | "landing_hero"
  | "landing_intro"
  | "landing_ops"
  | "pricing"
  | "faq"
  | "support"
  | "inquiry"
  | "sales"
  | "canonical_bank";

export type AiCapabilitySource =
  | "sourcing_tri_option"
  | "compare_tri_option"
  | "request_tri_option"
  | "compare_seed_draft"
  | "operator_boundary"
  | "automation_boundary"
  | "enterprise_scope_limit";

export type AiClaimEvidenceStatus =
  | "supported"
  | "supported_but_broad"
  | "unsupported"
  | "needs_reword";

export interface AiClaimRegistryEntry {
  id: string;
  surface: AiClaimSurface;
  claimText: string;
  mappedCapabilities: AiCapabilitySource[];
  evidenceStatus: AiClaimEvidenceStatus;
  why: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// Registry — 현재 퍼블릭 AI claim 전수 매핑
// ══════════════════════════════════════════════════════════════════════════════

export const AI_CLAIM_REGISTRY: AiClaimRegistryEntry[] = [
  // ── Landing Hero ──
  {
    id: "hero-1",
    surface: "landing_hero",
    claimText: "AI는 각 단계에서 필요한 후보 정리와 다음 작업 준비를 돕습니다.",
    mappedCapabilities: ["sourcing_tri_option", "compare_tri_option", "request_tri_option"],
    evidenceStatus: "supported",
    why: "sourcing/compare/request 3-stage tri-option이 각 단계에서 전략안을 제안",
  },
  {
    id: "hero-2",
    surface: "landing_hero",
    claimText: "LabAxis는 검색 결과 정리, 비교 판단, 요청 초안 준비를 돕는 AI 보조 기능을 제공합니다.",
    mappedCapabilities: ["sourcing_tri_option", "compare_tri_option", "request_tri_option"],
    evidenceStatus: "supported",
    why: "sourcing=검색 정리, compare=비교 판단, request=요청 초안 — 3-stage 정확 매핑",
  },
  {
    id: "hero-3",
    surface: "landing_hero",
    claimText: "AI로 검색 결과와 비교 후보를 정리하고, 요청 준비까지 이어서 연구 구매 흐름을 더 빠르게 만듭니다.",
    mappedCapabilities: ["operator_boundary"],
    evidenceStatus: "supported",
    why: "operator commit boundary — 팀이 시작/선택/반영/전송을 직접 결정",
  },

  // ── Landing Ops Section ──
  {
    id: "ops-1",
    surface: "landing_ops",
    claimText: "AI는 반영할 항목과 다음 검토 대상을 제안합니다.",
    mappedCapabilities: ["sourcing_tri_option", "compare_tri_option"],
    evidenceStatus: "supported",
    why: "sourcing strategy가 후보 묶음 제안, compare decision이 판단안 제안",
  },
  {
    id: "ops-2",
    surface: "landing_ops",
    claimText: "검토 후 적용하거나 수정할 수 있습니다.",
    mappedCapabilities: ["operator_boundary"],
    evidenceStatus: "supported",
    why: "모든 stage에서 explicit operator action 필수",
  },

  // ── Pricing ──
  {
    id: "pricing-1",
    surface: "pricing",
    claimText: "기본 보조 기능 (Starter)",
    mappedCapabilities: ["sourcing_tri_option"],
    evidenceStatus: "supported",
    why: "Starter에서도 기본 검색/비교 보조 가능",
  },
  {
    id: "pricing-2",
    surface: "pricing",
    claimText: "결과 정리 / 후보 제안 (Team)",
    mappedCapabilities: ["sourcing_tri_option", "compare_tri_option"],
    evidenceStatus: "supported",
    why: "sourcing 결과 정리 + compare 후보 제안",
  },
  {
    id: "pricing-3",
    surface: "pricing",
    claimText: "판단 제안 / 초안 생성 / 누락 점검 (Business)",
    mappedCapabilities: ["compare_tri_option", "request_tri_option"],
    evidenceStatus: "supported",
    why: "compare 판단안 + request 초안 생성 + 누락 점검",
  },
  {
    id: "pricing-4",
    surface: "pricing",
    claimText: "확장형 자동화 협의 (Enterprise)",
    mappedCapabilities: ["enterprise_scope_limit"],
    evidenceStatus: "supported",
    why: "'협의'로 명시 — 현재 제공이 아닌 향후 논의 범위",
  },

  // ── FAQ ──
  {
    id: "faq-1",
    surface: "faq",
    claimText: "AI는 요청서에 반영할 항목을 정리하고 초안을 준비하는 단계까지 지원합니다.",
    mappedCapabilities: ["request_tri_option", "operator_boundary"],
    evidenceStatus: "supported",
    why: "request tri-option + explicit apply boundary",
  },
  {
    id: "faq-2",
    surface: "faq",
    claimText: "현재는 공급사 요청서를 검토 없이 자동 확정하거나 자동 전송하지 않습니다.",
    mappedCapabilities: ["automation_boundary"],
    evidenceStatus: "supported",
    why: "automation boundary 명시 — 부정형으로 정확히 경계 설정",
  },

  // ── Canonical Bank ──
  {
    id: "bank-1",
    surface: "canonical_bank",
    claimText: "검색 결과를 정리하고 비교가 필요한 후보를 제안합니다.",
    mappedCapabilities: ["sourcing_tri_option"],
    evidenceStatus: "supported",
    why: "sourcing tri-option이 candidate grouping + compare seed 제안",
  },
  {
    id: "bank-2",
    surface: "canonical_bank",
    claimText: "비교 기준에 따라 현재 추천 선택안과 다음 단계를 제안합니다.",
    mappedCapabilities: ["compare_tri_option"],
    evidenceStatus: "supported",
    why: "compare tri-option이 3개 decision frame 제공",
  },
  {
    id: "bank-3",
    surface: "canonical_bank",
    claimText: "공급사별 요청 메시지 초안을 준비하고 누락 항목을 점검합니다.",
    mappedCapabilities: ["request_tri_option"],
    evidenceStatus: "supported",
    why: "request tri-option이 3개 요청 전략안 + 누락 점검",
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// Registry Summary
// ══════════════════════════════════════════════════════════════════════════════

export function summarizeClaimRegistry(entries: AiClaimRegistryEntry[]) {
  return {
    total: entries.length,
    supported: entries.filter(e => e.evidenceStatus === "supported").length,
    supportedButBroad: entries.filter(e => e.evidenceStatus === "supported_but_broad").length,
    unsupported: entries.filter(e => e.evidenceStatus === "unsupported").length,
    needsReword: entries.filter(e => e.evidenceStatus === "needs_reword").length,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Release Gate
// ══════════════════════════════════════════════════════════════════════════════

export interface AiMessagingReleaseGate {
  allClaimsMappedToCapabilities: boolean;
  noUnsupportedClaimsRemain: boolean;
  noAutonomousImplicationRemain: boolean;
  operatorBoundaryExplicitOnCriticalSurfaces: boolean;
  salesDoesNotExceedPublicTruth: boolean;
  enterpriseStaysWithinScope: boolean;
  canonicalBankAligned: boolean;
}

export interface AiMessagingReleaseGateResult {
  releasable: boolean;
  failedChecks: string[];
}

export function evaluateAiMessagingReleaseGate(
  input: AiMessagingReleaseGate
): AiMessagingReleaseGateResult {
  const failedChecks: string[] = [];
  const entries = Object.entries(input) as [keyof AiMessagingReleaseGate, boolean][];
  for (const [key, value] of entries) {
    if (!value) failedChecks.push(key);
  }
  return { releasable: failedChecks.length === 0, failedChecks };
}

// ══════════════════════════════════════════════════════════════════════════════
// Current Release Gate Evaluation
// ══════════════════════════════════════════════════════════════════════════════

export const CURRENT_RELEASE_GATE_EVALUATION: AiMessagingReleaseGate = {
  allClaimsMappedToCapabilities: true,     // registry 전수 매핑 완료
  noUnsupportedClaimsRemain: true,         // unsupported 0건
  noAutonomousImplicationRemain: true,     // forbidden sweep 0건
  operatorBoundaryExplicitOnCriticalSurfaces: true, // hero/pricing/faq/support에 boundary 명시
  salesDoesNotExceedPublicTruth: true,     // sales answer bank = public truth 이내
  enterpriseStaysWithinScope: true,        // "협의" 수준 유지
  canonicalBankAligned: true,              // sentence bank = implementation truth 매핑
};

// ══════════════════════════════════════════════════════════════════════════════
// Critical Surfaces (operator boundary 반드시 명시)
// ══════════════════════════════════════════════════════════════════════════════

export const CRITICAL_SURFACES: AiClaimSurface[] = [
  "landing_hero",
  "pricing",
  "faq",
  "support",
  "sales",
];
