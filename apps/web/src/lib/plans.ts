// 플랜별 기능 제한 및 권한 관리

export enum SubscriptionPlan {
  FREE = "FREE",
  TEAM = "TEAM",
  ORGANIZATION = "ORGANIZATION",
}

export interface PlanLimits {
  maxMembers: number | null;
  maxQuotesPerMonth: number | null;
  maxSharedLinks: number | null;
  features: {
    advancedReports: boolean;
    budgetManagement: boolean;
    autoReorder: boolean;
    vendorPortal: boolean;
    sso: boolean;
    onPremise: boolean;
    prioritySupport: boolean;
  };
}

export const PLAN_LIMITS: Record<SubscriptionPlan, PlanLimits> = {
  [SubscriptionPlan.FREE]: {
    maxMembers: 3,
    maxQuotesPerMonth: 10,
    maxSharedLinks: 5,
    features: {
      advancedReports: false,
      budgetManagement: false,
      autoReorder: false,
      vendorPortal: false,
      sso: false,
      onPremise: false,
      prioritySupport: false,
    },
  },
  [SubscriptionPlan.TEAM]: {
    maxMembers: 20,
    maxQuotesPerMonth: 100,
    maxSharedLinks: 50,
    features: {
      advancedReports: true,
      budgetManagement: true,
      autoReorder: true,
      vendorPortal: false,
      sso: false,
      onPremise: false,
      prioritySupport: false,
    },
  },
  [SubscriptionPlan.ORGANIZATION]: {
    maxMembers: null, // 무제한
    maxQuotesPerMonth: null, // 무제한
    maxSharedLinks: null, // 무제한
    features: {
      advancedReports: true,
      budgetManagement: true,
      autoReorder: true,
      vendorPortal: true,
      sso: true,
      onPremise: true,
      prioritySupport: true,
    },
  },
};

export function getPlanLimits(plan: SubscriptionPlan): PlanLimits {
  return PLAN_LIMITS[plan] || PLAN_LIMITS[SubscriptionPlan.FREE];
}

export function checkFeatureAccess(
  plan: SubscriptionPlan,
  feature: keyof PlanLimits["features"]
): boolean {
  const limits = getPlanLimits(plan);
  return limits.features[feature];
}

export function checkLimit(
  plan: SubscriptionPlan,
  limitType: "maxMembers" | "maxQuotesPerMonth" | "maxSharedLinks",
  currentCount: number
): { allowed: boolean; limit: number | null } {
  const limits = getPlanLimits(plan);
  const limit = limits[limitType];

  if (limit === null) {
    return { allowed: true, limit: null }; // 무제한
  }

  return {
    allowed: currentCount < limit,
    limit,
  };
}


