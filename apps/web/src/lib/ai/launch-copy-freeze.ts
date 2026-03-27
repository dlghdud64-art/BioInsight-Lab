/**
 * Launch Copy Freeze — public narrative release candidate 확정 + post-freeze edit policy
 *
 * 이 파일은 LabAxis 퍼블릭 전체 narrative를 launch 가능한 release candidate로 고정하고,
 * 이후 변경을 meaning-preserving only로 통제한다.
 */

// ══════════════════════════════════════════════════════════════════════════════
// Launch Copy Freeze
// ══════════════════════════════════════════════════════════════════════════════

export const LAUNCH_COPY_FREEZE = {
  status: "launch_frozen" as const,

  frozenNarrativeBackbone: [
    "LabAxis는 시약·장비 검색, 비교, 요청, 구매 운영을 연결하는 연구 구매 운영 OS다",
    "문제는 검색 자체보다, 무엇을 먼저 검토하고 어떻게 비교하고 언제 요청으로 넘길지 흐름이 끊기는 데 있다",
    "LabAxis는 검색 결과를 작업 가능한 후보로 정리하고 compare와 request 준비를 같은 workbench 흐름으로 연결한다",
    "AI는 이 흐름 안에서 3개의 전략안/판단안을 제안하지만, 시작·선택·반영·전송은 운영자가 직접 결정한다",
  ],

  frozenCapabilityClaims: [
    "sourcing = compare preparation (3-option strategy)",
    "compare = decision framing (3-option decision)",
    "request = strategy framing + explicit apply (3-option strategy)",
    "send = readiness + operator decision",
    "AI = human-in-the-loop operating layer",
  ],

  frozenBoundaryClaims: [
    "no auto-select between options",
    "no auto-apply to draft",
    "no auto-send",
    "no autonomous procurement",
    "no AI system-of-record claim",
    "operator explicitly starts / selects / applies / sends",
  ],

  frozenPricingScopePhrases: [
    "pricing = operational scope ladder (not automation ladder)",
    "Starter = 개인 검토와 초기 탐색",
    "Team = 팀 협업과 요청 운영 시작",
    "Business = 승인·감사·재고까지 조직 운영 + AI 보조",
    "Enterprise = 현재 범위 기반 확장 검토 (autonomous tier 아님)",
  ],

  frozenCriticalCtas: [
    "무료로 시작하기",
    "Team으로 시작하기",
    "Business 도입하기",
    "도입 문의하기",
    "요금 및 도입 상담하기",
    "지원 문의하기",
    "로그인",
  ],

  editableAfterFreeze: [
    "오탈자 수정",
    "문장 길이 소폭 압축",
    "한국어 문장 리듬 정리",
    "중복 support line 축약",
    "semantic meaning 유지한 표현 다듬기",
    "접근성/가독성 향상을 위한 label 정리",
  ],

  forbiddenAfterFreeze: [
    "product definition 변경",
    "workflow story 변경",
    "AI capability claim 확장",
    "autonomous implication 추가",
    "CTA taxonomy 변경",
    "pricing scope 재해석",
    "sales/support 예외 문장 추가",
    "canonical bank 밖 ad-hoc capability 문장 생성",
  ],
} as const;

// ══════════════════════════════════════════════════════════════════════════════
// Launch Blockers
// ══════════════════════════════════════════════════════════════════════════════

export const PUBLIC_LAUNCH_BLOCKERS = [
  "unsupported capability claim remains",
  "autonomous implication remains",
  "sales exceeds public truth",
  "support/FAQ exceeds public truth",
  "pricing reads as automation ladder",
  "operator boundary missing on critical surface",
  "product definition drift across pages",
  "critical CTA drift remains",
  "canonical sentence banks not aligned",
] as const;

// ══════════════════════════════════════════════════════════════════════════════
// Release Checklist
// ══════════════════════════════════════════════════════════════════════════════

export interface PublicLaunchReleaseChecklist {
  narrativeBackboneAligned: boolean;
  productDefinitionConsistent: boolean;
  workflowStoryConsistent: boolean;
  aiClaimsWithinImplementation: boolean;
  operatorBoundaryExplicitOnCriticalSurfaces: boolean;
  pricingScopeNotAutomation: boolean;
  supportFaqInquiryAligned: boolean;
  salesDoesNotExceedPublicTruth: boolean;
  noUnsupportedClaimsRemain: boolean;
  noAutonomousImplicationRemain: boolean;
  criticalCtasFrozenAndConsistent: boolean;
  canonicalBanksFrozenAndAligned: boolean;
}

export interface PublicLaunchReleaseResult {
  launchReady: boolean;
  failedChecks: string[];
}

export function evaluatePublicLaunchRelease(
  input: PublicLaunchReleaseChecklist
): PublicLaunchReleaseResult {
  const failedChecks: string[] = [];
  const entries = Object.entries(input) as [keyof PublicLaunchReleaseChecklist, boolean][];
  for (const [key, value] of entries) {
    if (!value) failedChecks.push(key);
  }
  return { launchReady: failedChecks.length === 0, failedChecks };
}

// ══════════════════════════════════════════════════════════════════════════════
// Current Evaluation
// ══════════════════════════════════════════════════════════════════════════════

export const CURRENT_LAUNCH_EVALUATION: PublicLaunchReleaseChecklist = {
  narrativeBackboneAligned: true,
  productDefinitionConsistent: true,
  workflowStoryConsistent: true,
  aiClaimsWithinImplementation: true,
  operatorBoundaryExplicitOnCriticalSurfaces: true,
  pricingScopeNotAutomation: true,
  supportFaqInquiryAligned: true,
  salesDoesNotExceedPublicTruth: true,
  noUnsupportedClaimsRemain: true,
  noAutonomousImplicationRemain: true,
  criticalCtasFrozenAndConsistent: true,
  canonicalBanksFrozenAndAligned: true,
};

// ══════════════════════════════════════════════════════════════════════════════
// Sign-Off
// ══════════════════════════════════════════════════════════════════════════════

export interface PublicNarrativeSignOff {
  status: "approved_for_launch" | "not_approved";
  approvedScope: string[];
  blockedBy: string[];
  freezePolicyReminder: string[];
}

export const CURRENT_SIGN_OFF: PublicNarrativeSignOff = {
  status: "approved_for_launch",
  approvedScope: [
    "landing hero + intro + lower ops section",
    "pricing page (scope ladder, not automation)",
    "support / FAQ / inquiry (expectation setting)",
    "sales enablement short answer bank",
    "canonical AI + non-AI sentence banks",
    "3-stage AI operating layer claims (sourcing/compare/request)",
    "operator boundary on all critical surfaces",
  ],
  blockedBy: [],
  freezePolicyReminder: [
    "post-freeze edits = meaning-preserving only",
    "no capability expansion without implementation proof + gate review",
    "no sales/support exception beyond current public truth",
    "no autonomous/agent wording introduction",
    "CTA taxonomy frozen — taxonomy change requires explicit reopening",
  ],
};

// ══════════════════════════════════════════════════════════════════════════════
// Cross-Page Final QA Order
// ══════════════════════════════════════════════════════════════════════════════

export const LAUNCH_QA_ORDER = [
  "1. landing hero",
  "2. landing intro / workflow explainer",
  "3. landing lower ops section",
  "4. product intro page",
  "5. pricing page",
  "6. support page",
  "7. FAQ",
  "8. inquiry surface",
  "9. sales short answers",
  "10. canonical banks (AI + non-AI)",
  "11. critical CTA sweep",
  "12. forbidden/autonomous claim sweep",
] as const;
