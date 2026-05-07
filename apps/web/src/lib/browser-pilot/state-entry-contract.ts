export const LABAXIS_STATE_ENTRY_CONTRACT_VERSION =
  "labaxis.browser-state-entry-contract.v1" as const;

export const LABAXIS_STATE_ENTRY_PROFILES = {
  "inventory-disposal": {
    route: "/dashboard/inventory",
    requiredTestIds: {
      priorityBanner: "inventory-priority-banner",
      expiredLotRow: "inventory-expired-lot-row",
      disposalCta: "lot-disposal-cta",
      disposalDock: "lot-disposal-dock",
      disposalImpactSummary: "lot-disposal-impact-summary",
    },
  },
  "quote-dispatch": {
    route: "/dashboard/quotes",
    requiredTestIds: {
      workQueue: "quote-work-queue",
      requestCard: "quote-request-card",
      dispatchReviewCta: "quote-dispatch-review-cta",
      dispatchDock: "quote-dispatch-dock",
      dispatchBlockerSummary: "quote-dispatch-blocker-summary",
      dispatchMessagePreview: "quote-dispatch-message-preview",
    },
  },
  "sourcing-ai-compare": {
    route: "/app/search",
    requiredTestIds: {
      searchInput: "sourcing-search-input",
      resultRow: "sourcing-result-row",
      compareAddCta: "compare-add-cta",
      compareDecisionSurface: "compare-decision-surface",
      aiOptionExactMatch: "ai-option-exact-match",
      aiOptionEquivalent: "ai-option-equivalent",
      aiOptionSubstitute: "ai-option-substitute",
    },
  },
} as const;

export type LabAxisStateEntryProfile =
  keyof typeof LABAXIS_STATE_ENTRY_PROFILES;

export type LabAxisStateEntryTestIdMap =
  (typeof LABAXIS_STATE_ENTRY_PROFILES)[LabAxisStateEntryProfile]["requiredTestIds"];

export function getLabAxisStateEntryProfile(
  profile: LabAxisStateEntryProfile,
) {
  return LABAXIS_STATE_ENTRY_PROFILES[profile];
}
